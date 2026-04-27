"""
Market Intelligence Radar Scanner — Main pipeline orchestrator.

Streaming architecture: each article is fully processed inline
(scrape → extract → store → enrich → CRM match).

Usage:
    python3 -m mir.scanner --division technology
    python3 -m mir.scanner --all
    python3 -m mir.scanner --all --max-articles 5
"""

import argparse
import gc
import json
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

from mir.config import DIVISIONS
from mir.sources import sources_by_division, load_sources
from mir.scraper import discover_articles, scrape_url
from mir.extractor import extract_intelligence
from mir.pg_storage import (
    ensure_tables, is_article_scraped, store_article, article_id,
    is_person_enriched, update_enrichment, update_crm_match,
    mark_article_extracting, mark_article_failed, get_failed_articles,
)
from mir.matcher import canonical_id as make_canonical, match_single_person

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("mir.scanner")


def _get_rss_mb() -> float:
    try:
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return int(line.split()[1]) / 1024
    except Exception:
        pass
    return 0.0


def _process_person_inline(person_row: dict, aid: str, division: str, enrich: bool = False):
    """Process a single person inline: enrich → CRM match."""
    name = person_row.get("name", "")
    cid = person_row.get("canonical_id", "")
    status = person_row.get("enrichment_status", "pending")

    if status in ("not_relevant", "excluded"):
        return

    if enrich and not is_person_enriched(cid):
        from mir.enricher import enrich_person_inline
        enrich_result = enrich_person_inline(
            {"name": name, "title": person_row.get("title"), "company": person_row.get("company")},
            cid,
        )
        if enrich_result:
            crm_match = match_single_person({**person_row, "email": enrich_result.get("email", "")})
            if crm_match:
                update_crm_match(cid, crm_match["crm_contact_id"],
                                 crm_match["crm_match_type"], crm_match["crm_match_score"])
    else:
        crm_match = match_single_person(person_row)
        if crm_match:
            update_crm_match(cid, crm_match["crm_contact_id"],
                             crm_match["crm_match_type"], crm_match["crm_match_score"])


def scan_source(source: dict, division: str, max_articles: int = 10, enrich: bool = False) -> dict:
    """Scan a single source: discover → scrape → extract → store → enrich."""
    name = source["name"]
    url = source["url"]
    stats = {
        "source": name, "discovered": 0, "scraped": 0, "extracted": 0,
        "skipped": 0, "errors": 0, "people_processed": 0, "companies_processed": 0,
    }

    log.info(f"📡 Scanning {name} ({url}) [{division}]")

    article_urls = discover_articles(url, limit=max_articles)
    stats["discovered"] = len(article_urls)
    log.info(f"  Found {len(article_urls)} article URLs")

    if not article_urls:
        return stats

    for article_url in article_urls:
        if is_article_scraped(article_url):
            stats["skipped"] += 1
            continue

        article = scrape_url(article_url)
        if not article:
            stats["errors"] += 1
            continue
        stats["scraped"] += 1

        try:
            mark_article_extracting(article_url)
        except Exception:
            pass

        intelligence = extract_intelligence(article, division, name)
        if not intelligence:
            mark_article_failed(article_url, "Extraction returned None")
            stats["errors"] += 1
            continue
        stats["extracted"] += 1

        article.pop("content", None)
        article.pop("html", None)

        try:
            result = store_article(article, intelligence, division, name, url)
        except Exception as e:
            log.error(f"  Storage error for {article_url}: {e}")
            mark_article_failed(article_url, str(e)[:500])
            stats["errors"] += 1
            continue

        aid = result.get("article_id", "")

        for person_row in result.get("people_rows", []):
            try:
                _process_person_inline(person_row, aid, division, enrich=enrich)
                stats["people_processed"] += 1
            except Exception as e:
                log.warning(f"  Person processing error: {e}")

        p = len(intelligence.get("people", []))
        c = len(intelligence.get("companies", []))
        d = len(intelligence.get("deals", []))
        log.info(f"  ✓ {article.get('title', '?')[:60]} — {p} people, {c} companies, {d} deals")

    return stats


def scan_all(max_articles_per_source: int = 10, enrich: bool = False, workers: int = 1) -> dict:
    """Scan all sources (deduplicated)."""
    all_sources = load_sources()
    seen_urls: set[str] = set()
    unique_sources: list[dict] = []
    for s in all_sources:
        url = s.get("url", "")
        if url not in seen_urls:
            seen_urls.add(url)
            unique_sources.append(s)

    rss_start = _get_rss_mb()
    log.info(f"🔍 Scanning {len(unique_sources)} sources with {workers} worker(s) | RSS: {rss_start:.0f}MB")

    results: dict[str, list] = {"all": []}

    def _scan_one(source: dict) -> dict:
        region = source.get("region_hint", source.get("division", "global"))
        return scan_source(source, region, max_articles=max_articles_per_source, enrich=enrich)

    if workers <= 1:
        for i, source in enumerate(unique_sources):
            try:
                stats = _scan_one(source)
                results["all"].append(stats)
            except Exception as e:
                log.error(f"Source {source.get('name', '?')} failed: {e}")
                results["all"].append({"source": source.get("name", "?"), "error": str(e)})
            if (i + 1) % 10 == 0:
                gc.collect()
    else:
        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_to_source = {executor.submit(_scan_one, s): s for s in unique_sources}
            for future in as_completed(future_to_source):
                source = future_to_source[future]
                try:
                    results["all"].append(future.result())
                except Exception as e:
                    results["all"].append({"source": source.get("name", "?"), "error": str(e)})

    total_extracted = sum(s.get("extracted", 0) for s in results["all"])
    log.info(f"✅ Scan complete: {len(results['all'])} sources, {total_extracted} articles")
    return results


def print_summary(results):
    print("\n" + "=" * 60)
    print("MARKET INTELLIGENCE RADAR — SCAN SUMMARY")
    print("=" * 60)
    if isinstance(results, list):
        stats_list = results
    else:
        stats_list = results.get("all", [])
    total_discovered = sum(s.get("discovered", 0) for s in stats_list)
    total_extracted = sum(s.get("extracted", 0) for s in stats_list)
    total_people = sum(s.get("people_processed", 0) for s in stats_list)
    total_errors = sum(s.get("errors", 0) for s in stats_list)
    print(f"Sources scanned: {len(stats_list)}")
    print(f"Articles discovered: {total_discovered}")
    print(f"Intelligence extracted: {total_extracted}")
    print(f"People processed: {total_people}")
    print(f"Errors: {total_errors}")


def main():
    parser = argparse.ArgumentParser(description="Market Intelligence Radar Scanner")
    parser.add_argument("--division", "-d", help="Division to scan")
    parser.add_argument("--source", "-s", help="Specific source name")
    parser.add_argument("--all", "-a", action="store_true", help="Scan all sources")
    parser.add_argument("--max-articles", "-m", type=int, default=10, help="Max articles per source")
    parser.add_argument("--setup", action="store_true", help="Create DB tables and exit")
    parser.add_argument("--enrich", action="store_true", help="Auto-enrich contacts via Apollo")
    parser.add_argument("--workers", "-w", type=int, default=4, help="Concurrent workers")
    args = parser.parse_args()

    start = time.time()
    log.info(f"🚀 MIR scanner starting | RSS: {_get_rss_mb():.0f}MB")

    ensure_tables()

    if args.setup:
        log.info("Tables created. Exiting.")
        return

    if args.source and args.division:
        sources = sources_by_division(args.division)
        source = next((s for s in sources if args.source.lower() in s["name"].lower()), None)
        if not source:
            log.error(f"Source '{args.source}' not found")
            sys.exit(1)
        stats = scan_source(source, args.division, max_articles=args.max_articles, enrich=args.enrich)
        print_summary([stats])
    elif args.division:
        sources = sources_by_division(args.division)
        all_stats = []
        for source in sources:
            try:
                all_stats.append(scan_source(source, args.division,
                                             max_articles=args.max_articles, enrich=args.enrich))
            except Exception as e:
                log.error(f"Source {source['name']} failed: {e}")
        print_summary(all_stats)
    elif args.all:
        results = scan_all(max_articles_per_source=args.max_articles,
                          enrich=args.enrich, workers=args.workers)
        print_summary(results)
    else:
        parser.print_help()
        sys.exit(1)

    elapsed = time.time() - start
    log.info(f"⏱ Scan completed in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
