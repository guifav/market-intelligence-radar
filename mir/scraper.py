"""Article scraper — uses Firecrawl to fetch and extract articles from news sources."""

import re
import time
import json
import logging
import threading
import requests
from datetime import datetime, timezone
from urllib.parse import urlparse
from mir.config import FIRECRAWL_API_KEY, FIRECRAWL_BASE_URL, FIRECRAWL_RATE_LIMIT
from mir.data_paths import writable_data_file
from mir.rate_limit import ThreadSafeIntervalLimiter

log = logging.getLogger("mir.scraper")

# Rate limiter (thread-safe)
_rate_limiter = ThreadSafeIntervalLimiter(60.0 / FIRECRAWL_RATE_LIMIT)

# ── Scrape-failure cache (thread-safe) ──────────────────────────────────────
# In-memory cache of source URLs that failed both /map and fallback scrape.
# After a source is marked here, it will be skipped for 7 days.
_FAIL_CACHE_FILE = None  # Lazy-loaded path
_fail_cache: dict[str, str] = {}  # url -> ISO timestamp of last failure
_fail_cache_lock = threading.Lock()
_FAIL_COOLDOWN_DAYS = 7


def _get_fail_cache_path():
    global _FAIL_CACHE_FILE
    if _FAIL_CACHE_FILE is None:
        _FAIL_CACHE_FILE = writable_data_file("scrape_failures.json")
    return _FAIL_CACHE_FILE


def _load_fail_cache():
    global _fail_cache
    path = _get_fail_cache_path()
    try:
        if path.exists():
            with open(path) as f:
                _fail_cache = json.load(f)
    except Exception:
        _fail_cache = {}


def _save_fail_cache():
    path = _get_fail_cache_path()
    try:
        with open(path, "w") as f:
            json.dump(_fail_cache, f, indent=2)
    except Exception as e:
        log.warning(f"Failed to save scrape failure cache: {e}")


def _mark_scrape_failed(source_url: str):
    """Mark a source as failing — skip it for _FAIL_COOLDOWN_DAYS (thread-safe)."""
    with _fail_cache_lock:
        _fail_cache[source_url] = datetime.now(timezone.utc).isoformat()
        _save_fail_cache()
    log.info(f"Marked source as scrape_failed (skip {_FAIL_COOLDOWN_DAYS}d): {source_url}")


def is_source_on_cooldown(source_url: str) -> bool:
    """Check if a source should be skipped due to recent failure (thread-safe)."""
    with _fail_cache_lock:
        if not _fail_cache:
            _load_fail_cache()
        ts_str = _fail_cache.get(source_url)
        if not ts_str:
            return False
        try:
            failed_at = datetime.fromisoformat(ts_str)
            age_days = (datetime.now(timezone.utc) - failed_at).days
            if age_days >= _FAIL_COOLDOWN_DAYS:
                # Cooldown expired — remove and retry
                del _fail_cache[source_url]
                _save_fail_cache()
                return False
            return True
        except Exception:
            return False


# ── URL filtering (shared between /map and fallback) ───────────────────────

# Static page path segments to reject
_STATIC_SEGMENTS = {
    "about", "about-us", "contact", "contact-us", "privacy", "privacy-policy",
    "terms", "terms-of-service", "terms-and-conditions", "cookie", "cookies",
    "cookie-policy", "login", "signin", "sign-in", "register", "signup",
    "sign-up", "search", "tag", "tags", "category", "categories", "author",
    "authors", "page", "feed", "rss", "sitemap", "archive", "archives",
    "subscribe", "newsletter", "cart", "checkout", "account", "profile",
    "settings", "help", "faq", "careers", "jobs", "advertise", "media-kit",
    "disclaimer", "accessibility",
}

# File extensions to reject
_FILE_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".xml",
                    ".zip", ".mp3", ".mp4", ".webp", ".ico", ".css", ".js"}


def _is_article_url(link: str, source_url: str) -> bool:
    """Determine if a URL is likely an article (not a static/navigation page).

    New inclusive approach — accepts any URL from the same domain that:
    1. Is not a static page (about, contact, privacy, etc.)
    2. Is not a file (.pdf, .jpg, etc.)
    3. Is not the homepage itself
    4. Has path depth >= 2 (e.g., /section/article-slug)
    """
    try:
        parsed = urlparse(link)
        source_parsed = urlparse(source_url)
    except Exception:
        return False

    # Must be same domain (or subdomain variant)
    link_domain = parsed.netloc.lower().replace("www.", "")
    source_domain = source_parsed.netloc.lower().replace("www.", "")
    if link_domain != source_domain:
        return False

    path = parsed.path.rstrip("/").lower()

    # Reject empty path (homepage)
    if not path or path == "/":
        return False

    # Reject if same as source URL path
    source_path = source_parsed.path.rstrip("/").lower()
    if path == source_path:
        return False

    # Reject fragments-only links
    if "#" in link and not parsed.path:
        return False

    # Reject file extensions
    for ext in _FILE_EXTENSIONS:
        if path.endswith(ext):
            return False

    # Split path into segments
    segments = [s for s in path.split("/") if s]

    # Require path depth >= 2 (e.g., /news/article-slug)
    if len(segments) < 2:
        return False

    # Reject if any segment is a static page keyword
    for seg in segments:
        if seg in _STATIC_SEGMENTS:
            return False

    return True


def _score_article_url(link: str) -> int:
    """Score a URL by how likely it is to be an article. Higher = more likely."""
    score = 0
    path = urlparse(link).path.lower()
    last_segment = path.rstrip("/").split("/")[-1] if "/" in path else ""

    # Hyphens/underscores in last segment = likely article slug
    if "-" in last_segment or "_" in last_segment:
        score += 3

    # Date patterns in URL = strong article signal
    if re.search(r"/20\d{2}/", path):
        score += 2

    # Known article path keywords
    article_keywords = {"/news/", "/article/", "/noticias/", "/noticia/",
                        "/story/", "/post/", "/insight/", "/analysis/",
                        "/report/", "/feature/", "/blog/", "/opinion/",
                        "/commentary/", "/press-release/", "/comunicado/"}
    if any(kw in path for kw in article_keywords):
        score += 2

    # Longer paths tend to be articles
    segments = [s for s in path.split("/") if s]
    if len(segments) >= 3:
        score += 1

    return score


def _rate_limit():
    """Enforce rate limit between Firecrawl requests (thread-safe)."""
    _rate_limiter.wait()


def _scrape_with_requests(url: str, timeout: int = 20) -> dict | None:
    """Fallback scraper using requests + BeautifulSoup + html2text.

    Used when Firecrawl fails or returns empty content.
    """
    try:
        from bs4 import BeautifulSoup
        import html2text

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
        }
        resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        if resp.status_code != 200:
            return None

        soup = BeautifulSoup(resp.text, "html.parser")

        # Remove noise elements
        for tag in soup.find_all(["script", "style", "nav", "footer", "header",
                                   "aside", "iframe", "noscript", "form"]):
            tag.decompose()

        # Try to find main content
        main = (
            soup.find("article")
            or soup.find("main")
            or soup.find("div", class_=re.compile(r"article|content|post|entry|story", re.I))
            or soup.find("div", id=re.compile(r"article|content|post|entry|story", re.I))
        )
        html_content = str(main) if main else str(soup.body or soup)

        # Convert to markdown
        h = html2text.HTML2Text()
        h.ignore_links = False
        h.ignore_images = True
        h.body_width = 0  # No wrapping
        content = h.handle(html_content).strip()

        if len(content) < 100:
            return None

        # Extract title
        title_tag = soup.find("title")
        og_title = soup.find("meta", property="og:title")
        title = (og_title["content"] if og_title and og_title.get("content") else
                 title_tag.get_text(strip=True) if title_tag else "")

        # Extract metadata
        og_date = soup.find("meta", property="article:published_time")
        meta_date = soup.find("meta", attrs={"name": "date"})
        published = (og_date["content"] if og_date and og_date.get("content") else
                     meta_date["content"] if meta_date and meta_date.get("content") else "")

        og_desc = soup.find("meta", property="og:description")
        meta_desc = soup.find("meta", attrs={"name": "description"})
        description = (og_desc["content"] if og_desc and og_desc.get("content") else
                       meta_desc["content"] if meta_desc and meta_desc.get("content") else "")

        og_lang = soup.find("html")
        language = og_lang.get("lang", "") if og_lang else ""

        return {
            "url": url,
            "title": title[:500],
            "content": content[:50000],
            "text": content[:50000],
            "published_date": published,
            "language": language,
            "description": description[:1000],
            "word_count": len(content.split()),
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        log.debug(f"Requests fallback failed for {url}: {e}")
        return None


def scrape_url(url: str, timeout: int = 30) -> dict | None:
    """
    Scrape a single URL. Tries Firecrawl first, falls back to requests+BS4.
    Returns: { url, title, content (markdown), published_date, language, word_count }
    """
    # Try Firecrawl first (if configured)
    if FIRECRAWL_API_KEY:
        result = _scrape_with_firecrawl(url, timeout)
        if result:
            return result

    # Fallback: requests + BeautifulSoup
    result = _scrape_with_requests(url, timeout=min(timeout, 20))
    if result:
        log.debug(f"Fallback scraper succeeded for {url[:80]}")
    return result


def _scrape_with_firecrawl(url: str, timeout: int = 30) -> dict | None:
    """Scrape using Firecrawl API."""
    _rate_limit()

    try:
        resp = requests.post(
            f"{FIRECRAWL_BASE_URL}/scrape",
            headers={
                "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "url": url,
                "formats": ["markdown"],
                "onlyMainContent": True,
                "timeout": timeout * 1000,
            },
            timeout=timeout + 10,
        )

        if resp.status_code == 429:
            log.warning(f"Rate limited on {url}, waiting 30s...")
            time.sleep(30)
            return _scrape_with_firecrawl(url, timeout)  # Retry once

        if resp.status_code != 200:
            log.debug(f"Firecrawl {resp.status_code} for {url}")
            return None

        data = resp.json()
        result = data.get("data", {})
        content = result.get("markdown", "")

        if not content or len(content) < 100:
            return None

        metadata = result.get("metadata", {})
        return {
            "url": url,
            "title": metadata.get("title", "")[:500],
            "content": content[:50000],
            "published_date": metadata.get("publishedTime", metadata.get("date", "")),
            "language": metadata.get("language", ""),
            "description": metadata.get("description", "")[:1000],
            "word_count": len(content.split()),
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        }

    except requests.exceptions.Timeout:
        log.debug(f"Firecrawl timeout for {url}")
        return None
    except Exception as e:
        log.debug(f"Firecrawl error for {url}: {e}")
        return None


def _extract_links_from_markdown(markdown: str, source_url: str) -> list[str]:
    """Extract URLs from markdown content (used as fallback when /map returns 0 links).

    Parses [text](url) patterns from Firecrawl's scraped markdown output.
    """
    links = re.findall(r'\[.*?\]\((https?://[^\s\)]+)\)', markdown)
    # Deduplicate while preserving order
    seen = set()
    unique = []
    for link in links:
        clean = link.split("#")[0].rstrip("/")
        if clean not in seen:
            seen.add(clean)
            unique.append(link)
    return unique


def discover_articles(source_url: str, limit: int = 10) -> list[str]:
    """
    Discover article URLs from a source's homepage/section page.
    Uses Firecrawl's /map endpoint to find article links.

    If /map returns 0 usable links, falls back to scraping the source URL
    and extracting links from the rendered markdown.
    """
    if not FIRECRAWL_API_KEY:
        return []

    # Check cooldown
    if is_source_on_cooldown(source_url):
        log.info(f"Skipping {source_url} — on scrape_failed cooldown")
        return []

    _rate_limit()

    article_links = []

    try:
        resp = requests.post(
            f"{FIRECRAWL_BASE_URL}/map",
            headers={
                "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "url": source_url,
                "limit": limit * 5,  # Get more, filter later
            },
            timeout=30,
        )

        if resp.status_code == 200:
            data = resp.json()
            links = data.get("links", [])
            log.debug(f"Firecrawl /map returned {len(links)} raw links for {source_url}")

            # Apply inclusive filter
            for link in links:
                if _is_article_url(link, source_url):
                    article_links.append(link)
        else:
            log.warning(f"Firecrawl map {resp.status_code} for {source_url}")

    except Exception as e:
        log.error(f"Error discovering articles from {source_url}: {e}")

    # ── Fallback: scrape source page and extract links from markdown ────
    if not article_links:
        log.info(f"  /map returned 0 usable links for {source_url}, trying fallback scrape...")
        scraped = scrape_url(source_url, timeout=30)
        if scraped and scraped.get("content"):
            raw_links = _extract_links_from_markdown(scraped["content"], source_url)
            for link in raw_links:
                if _is_article_url(link, source_url):
                    article_links.append(link)
            log.info(f"  Fallback extracted {len(article_links)} article links from page content")

    # If still nothing, mark source as failing
    if not article_links:
        _mark_scrape_failed(source_url)
        return []

    # Sort by article likelihood score, take top N
    article_links.sort(key=lambda u: _score_article_url(u), reverse=True)
    return article_links[:limit]
