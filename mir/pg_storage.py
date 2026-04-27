"""PostgreSQL storage layer for Market Intelligence Radar.

PostgreSQL storage layer via psycopg2.
Keeps the same function signatures for minimal changes to scanner/enricher.
"""

import hashlib
import json
import logging
import re as _re
from datetime import datetime, timezone
from typing import Optional

from mir.db import execute, get_conn, put_conn
from mir.extractor import TAXONOMY, _NORM_COUNTRIES, _NORM_CITIES, _NORM_SECTORS

log = logging.getLogger("mir.pg_storage")

# ── Geographic region classification ─────────────────────────────────────
_GEO_REGION_MAP: dict[str, str] = {}
for _region, _countries in TAXONOMY.get("geo_regions", {}).items():
    if _region == "Rest of World":
        continue
    for _c in _countries:
        _GEO_REGION_MAP[_c.upper()] = _region


def classify_geo_region(countries: list[str] | None) -> str | None:
    if not countries:
        return None
    regions_found: set[str] = set()
    for c in countries:
        if not c:
            continue
        normed = _NORM_COUNTRIES.get(c, c)
        region = _GEO_REGION_MAP.get(normed.upper(), "Rest of World")
        regions_found.add(region)
    if not regions_found:
        return None
    specific = regions_found - {"Rest of World"}
    return sorted(specific)[0] if specific else "Rest of World"


# ── ID generation ────────────────────────────────────────────────────────

def article_id(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def row_id(article_id_val: str, *parts: str) -> str:
    key = f"{article_id_val}:{'|'.join(parts)}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


# ── Normalisation helpers ────────────────────────────────────────────────

def _norm_list(values: list | None, norm_map: dict) -> list[str]:
    if not values:
        return []
    result = []
    for v in values:
        if not v:
            continue
        normed = norm_map.get(v, v)
        if normed and normed not in result:
            result.append(normed)
    return result


def _norm_countries(values: list | None) -> list[str]:
    return _norm_list(values, _NORM_COUNTRIES)


def _norm_cities(values: list | None) -> list[str]:
    return _norm_list(values, _NORM_CITIES)


def _norm_sectors(values: list | None) -> list[str]:
    return _norm_list(values, _NORM_SECTORS)


# ── Signal/capital normalisation ─────────────────────────────────────────

_ALLOWED_SIGNAL_TYPES = {
    "regulatory", "policy", "market_shift", "new_development",
    "technology", "sustainability", "risk",
}
_SIGNAL_TYPE_ALIASES = {
    "regulation": "regulatory", "regulations": "regulatory",
    "market shift": "market_shift", "new development": "new_development",
    "tech": "technology", "esg": "sustainability",
}

_ALLOWED_CAPITAL_ACTIONS = {
    "acquisition", "deployment", "capital_allocation", "fundraising",
    "development", "strategic_partnership", "platform_build",
    "strategic_quote", "mandate", "none",
}


def _normalize_signal_type(value: str | None) -> str:
    raw = (value or "").strip().lower()
    if not raw:
        return "risk"
    if raw in _ALLOWED_SIGNAL_TYPES:
        return raw
    if raw in _SIGNAL_TYPE_ALIASES:
        return _SIGNAL_TYPE_ALIASES[raw]
    collapsed = raw.replace("-", "_").replace(" ", "_")
    if collapsed in _ALLOWED_SIGNAL_TYPES:
        return collapsed
    return "risk"


def _normalize_capital_action(value: str | None) -> str:
    raw = (value or "").strip().lower()
    if not raw or raw == "null":
        return "none"
    if raw in _ALLOWED_CAPITAL_ACTIONS:
        return raw
    collapsed = raw.replace("-", "_").replace(" ", "_")
    if collapsed in _ALLOWED_CAPITAL_ACTIONS:
        return collapsed
    return "none"


# ── Quality score ────────────────────────────────────────────────────────

def _compute_quality_score(person: dict) -> int:
    score = 0
    if person.get("email"):
        score += 2
    if person.get("linkedin_url"):
        score += 2
    seniority = person.get("seniority", "")
    if seniority == "c-level":
        score += 3
    elif seniority == "director":
        score += 2
    elif seniority == "manager":
        score += 1
    sectors = person.get("sectors", [])
    if sectors:
        score += 2
    company = person.get("company", "")
    if company and company != "?":
        score += 1
    return score


# ── Relevance classification ────────────────────────────────────────────

_POLITICAL_TITLES = _re.compile(
    r"\b(senator|congressman|governor|mayor|minister|ambassador|"
    r"chancellor|attorney general|prosecutor)\b", _re.IGNORECASE)
_JOURNALIST_TITLES = _re.compile(
    r"\b(journalist|reporter|correspondent|columnist|editor-in-chief)\b", _re.IGNORECASE)
_IRRELEVANT_ROLES = _re.compile(
    r"\b(photographer|athlete|pope|bishop|artist|musician|singer|"
    r"professor|rector|academic|researcher)\b", _re.IGNORECASE)

INVALID_NAME_PATTERNS = {
    "unnamed", "unknown", "undisclosed", "anonymous",
    "not named", "not identified", "not mentioned",
}


def _is_not_relevant(person: dict) -> bool:
    """Determine if a person is not relevant for intelligence."""
    title = (person.get("title") or "").strip()
    name = (person.get("name") or "").strip()
    if person.get("is_author"):
        return True
    if name.startswith("@"):
        return True
    if _POLITICAL_TITLES.search(title):
        return True
    if _JOURNALIST_TITLES.search(title):
        return True
    if _IRRELEVANT_ROLES.search(title):
        return True
    cat_op = (person.get("category_of_operation") or "").strip().lower()
    if cat_op in ("government", "academic"):
        return True
    return False


# ═══════════════════════════════════════════════════════════════════════════
#  ARTICLE STORAGE
# ═══════════════════════════════════════════════════════════════════════════

def is_article_scraped(url: str) -> bool:
    result = execute(
        "SELECT extraction_status FROM articles WHERE article_id = %s",
        (article_id(url),), fetch=True
    )
    if not result:
        return False
    return result[0]["extraction_status"] == "complete"


def mark_article_extracting(url: str):
    aid = article_id(url)
    execute("""
        INSERT INTO articles (article_id, url, extraction_status)
        VALUES (%s, %s, 'extracting')
        ON CONFLICT (article_id) DO UPDATE SET extraction_status = 'extracting'
    """, (aid, url))


def mark_article_failed(url: str, error: str):
    aid = article_id(url)
    execute("""
        UPDATE articles SET extraction_status = 'failed', extraction_error = %s
        WHERE article_id = %s
    """, (error[:500], aid))


def get_failed_articles(limit: int = 100) -> list[dict]:
    return execute(
        "SELECT * FROM articles WHERE extraction_status = 'failed' LIMIT %s",
        (limit,), fetch=True
    ) or []


def store_article(article: dict, intelligence: dict, division: str,
                   source_name: str, source_url: str) -> dict:
    """Store article + all extracted intelligence to PostgreSQL."""
    from mir.matcher import canonical_id as make_canonical

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    aid = article_id(article["url"])
    conn = get_conn()

    try:
        with conn.cursor() as cur:
            # 1) Article
            cur.execute("""
                INSERT INTO articles (article_id, url, title, summary, content_preview,
                    full_content, source_name, source_url, division, language, sentiment,
                    word_count, published_date, scraped_at, extracted_at, extraction_status,
                    sectors, countries, geo_regions)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'complete',%s,%s,%s)
                ON CONFLICT (article_id) DO UPDATE SET
                    title=EXCLUDED.title, summary=EXCLUDED.summary,
                    extraction_status='complete', extracted_at=EXCLUDED.extracted_at
            """, (
                aid, article["url"], article.get("title", ""),
                intelligence.get("summary", ""),
                article.get("content", "")[:2000],
                article.get("content", ""),
                source_name, source_url, division,
                intelligence.get("language", ""),
                intelligence.get("sentiment", ""),
                article.get("word_count", 0),
                article.get("published_date", ""),
                now, now,
                json.dumps([]), json.dumps([]), json.dumps([])
            ))

            # 2) People
            people_rows = []
            for p in intelligence.get("people", []):
                name = (p.get("name") or "").strip()
                if len(name) < 3 or name.lower() in INVALID_NAME_PATTERNS:
                    continue
                cid = make_canonical(name, p.get("company", ""))
                countries = _norm_countries(p.get("countries"))
                sectors = _norm_sectors(p.get("sectors"))
                geo_region = classify_geo_region(p.get("countries"))
                person_data = {
                    "name": name, "title": p.get("title", ""),
                    "company": p.get("company", ""),
                    "context": p.get("context", ""),
                    "is_author": p.get("is_author", False),
                    "category_of_operation": p.get("category_of_operation"),
                }
                status = "not_relevant" if _is_not_relevant(person_data) else "pending"

                cur.execute("""
                    INSERT INTO people (canonical_id, name, title, company, context,
                        seniority, is_decision_maker, is_author, enrichment_status,
                        source_type, source_name, division, divisions,
                        category_of_operation, sectors, countries, cities, geo_region,
                        article_ids, mention_count, quality_score, first_seen, last_seen)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,1,%s,%s,%s)
                    ON CONFLICT (canonical_id) DO UPDATE SET
                        mention_count = people.mention_count + 1,
                        last_seen = EXCLUDED.last_seen,
                        article_ids = (
                            SELECT jsonb_agg(DISTINCT val)
                            FROM jsonb_array_elements_text(people.article_ids || EXCLUDED.article_ids) val
                        ),
                        divisions = (
                            SELECT jsonb_agg(DISTINCT val)
                            FROM jsonb_array_elements_text(people.divisions || EXCLUDED.divisions) val
                        ),
                        updated_at = NOW()
                """, (
                    cid, name, p.get("title", ""), p.get("company", ""),
                    p.get("context", ""), p.get("seniority", "unknown"),
                    p.get("is_decision_maker", False), p.get("is_author", False),
                    status, p.get("source_type", "article_mention"),
                    source_name, division, json.dumps([division]),
                    p.get("category_of_operation"),
                    json.dumps(sectors), json.dumps(countries),
                    json.dumps(_norm_cities(p.get("cities"))), geo_region,
                    json.dumps([aid]),
                    _compute_quality_score({"seniority": p.get("seniority", "unknown")}),
                    now, now,
                ))
                people_rows.append({
                    "id": row_id(aid, "person", name), "article_id": aid,
                    "canonical_id": cid, "name": name,
                    "title": p.get("title", ""), "company": p.get("company", ""),
                    "seniority": p.get("seniority", "unknown"),
                    "enrichment_status": status,
                    "division": division, "sectors": sectors,
                    "countries": countries, "extracted_at": now_iso,
                })

            # 3) Companies
            company_rows = []
            for c in intelligence.get("companies", []):
                cid = make_canonical(c.get("name", ""))
                c_sectors = _norm_sectors(c.get("sectors", []))
                c_countries = _norm_countries(c.get("countries"))
                geo = classify_geo_region(c.get("countries"))
                cur.execute("""
                    INSERT INTO companies (canonical_id, name, sector, context,
                        deal_involvement, source_name, division, divisions,
                        category_of_operation, sectors, countries, cities, geo_region,
                        article_ids, mention_count, first_seen, last_seen)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,1,%s,%s)
                    ON CONFLICT (canonical_id) DO UPDATE SET
                        mention_count = companies.mention_count + 1,
                        last_seen = EXCLUDED.last_seen,
                        article_ids = (
                            SELECT jsonb_agg(DISTINCT val)
                            FROM jsonb_array_elements_text(companies.article_ids || EXCLUDED.article_ids) val
                        ),
                        updated_at = NOW()
                """, (
                    cid, c.get("name", ""),
                    c_sectors[0] if c_sectors else "",
                    c.get("context", ""),
                    c.get("deal_involvement", False),
                    source_name, division, json.dumps([division]),
                    c.get("category_of_operation"),
                    json.dumps(c_sectors), json.dumps(c_countries),
                    json.dumps(_norm_cities(c.get("cities"))), geo,
                    json.dumps([aid]), now, now,
                ))
                company_rows.append({
                    "id": row_id(aid, "company", c.get("name", "")),
                    "article_id": aid, "canonical_id": cid,
                    "name": c.get("name", ""),
                    "division": division,
                })

            # 4) Topics
            topic_count = 0
            for t in intelligence.get("topics", []):
                tid = row_id(aid, "topic", t.get("topic", ""))
                cur.execute("""
                    INSERT INTO topics (id, article_id, topic, category, relevance,
                        division, divisions, sectors, countries, geo_region, extracted_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (id) DO NOTHING
                """, (
                    tid, aid, t.get("topic", ""), t.get("category", ""),
                    t.get("relevance", "medium"), division, json.dumps([division]),
                    json.dumps(_norm_sectors(t.get("sectors", []))),
                    json.dumps(_norm_countries(t.get("countries"))),
                    classify_geo_region(t.get("countries")), now,
                ))
                topic_count += 1

            # 5) Deals
            deal_count = 0
            for d in intelligence.get("deals", []):
                did = row_id(aid, "deal", d.get("description", ""))
                cur.execute("""
                    INSERT INTO deals (id, article_id, deal_type, parties, value,
                        description, stage, division, divisions, sectors, countries,
                        geo_region, extracted_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (id) DO NOTHING
                """, (
                    did, aid, d.get("type", "other"),
                    json.dumps(d.get("parties", [])),
                    d.get("value", ""), d.get("description", ""),
                    d.get("stage", "announced"),
                    division, json.dumps([division]),
                    json.dumps(_norm_sectors(d.get("sectors", []))),
                    json.dumps(_norm_countries(d.get("countries"))),
                    classify_geo_region(d.get("countries")), now,
                ))
                deal_count += 1

            # 6) Signals
            signal_count = 0
            for s in intelligence.get("signals", []):
                sid = row_id(aid, "signal", s.get("description", ""))
                cur.execute("""
                    INSERT INTO signals (id, article_id, signal_type, capital_action,
                        description, impact, division, divisions, sectors, countries,
                        geo_region, extracted_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (id) DO NOTHING
                """, (
                    sid, aid, _normalize_signal_type(s.get("type")),
                    _normalize_capital_action(s.get("capital_action")),
                    s.get("description", ""), s.get("impact", "medium"),
                    division, json.dumps([division]),
                    json.dumps(_norm_sectors(s.get("sectors", []))),
                    json.dumps(_norm_countries(s.get("countries"))),
                    classify_geo_region(s.get("countries")), now,
                ))
                signal_count += 1

            # 7) Update article counts
            cur.execute("""
                UPDATE articles SET people_count=%s, companies_count=%s,
                    deals_count=%s, signals_count=%s, topics_count=%s
                WHERE article_id=%s
            """, (len(people_rows), len(company_rows), deal_count,
                  signal_count, topic_count, aid))

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        put_conn(conn)

    counts = {
        "people": len(people_rows), "companies": len(company_rows),
        "topics": topic_count, "deals": deal_count, "signals": signal_count,
    }
    log.info(f"Stored article {aid} [{source_name}]: {counts}")
    return {**counts, "article_id": aid, "people_rows": people_rows, "company_rows": company_rows}


# ═══════════════════════════════════════════════════════════════════════════
#  ENRICHMENT & LEAD ACTIONS
# ═══════════════════════════════════════════════════════════════════════════

def update_enrichment(canonical_id: str, enrichment_data: dict, status: str = "enriched"):
    field_map = {
        "apollo_id": "apollo_id", "email": "email", "phone": "phone",
        "linkedin": "linkedin_url", "photo": "photo_url",
        "headline": "headline", "city": "city", "state": "state",
        "country": "country", "org_name": "org_name",
        "org_industry": "org_industry", "org_size": "org_size",
        "org_linkedin": "org_linkedin_url", "org_website": "org_website",
    }
    sets = ["enrichment_status = %s", "enriched_at = NOW()", "updated_at = NOW()"]
    vals = [status]
    for src, dst in field_map.items():
        val = enrichment_data.get(src)
        if val:
            sets.append(f"{dst} = %s")
            vals.append(val)
    vals.append(canonical_id)
    execute(f"UPDATE people SET {', '.join(sets)} WHERE canonical_id = %s", vals)


def update_lead_status(canonical_id: str, status: str, user_email: str,
                       reprove_category: str | None = None):
    execute("""
        UPDATE people SET lead_status=%s, lead_status_at=NOW(),
            lead_status_by=%s, reprove_category=%s, updated_at=NOW()
        WHERE canonical_id=%s
    """, (status, user_email, reprove_category, canonical_id))


def update_crm_match(canonical_id: str, crm_contact_id: str, match_type: str, match_score: float):
    execute("""
        UPDATE people SET crm_contact_id=%s, crm_match_type=%s,
            crm_match_score=%s, updated_at=NOW()
        WHERE canonical_id=%s
    """, (crm_contact_id, match_type, match_score, canonical_id))


# ═══════════════════════════════════════════════════════════════════════════
#  QUERY HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def is_person_enriched(canonical_id: str) -> bool:
    result = execute(
        "SELECT enrichment_status FROM people WHERE canonical_id = %s",
        (canonical_id,), fetch=True
    )
    if not result:
        return False
    return result[0]["enrichment_status"] in ("enriched", "not_found")


def get_person(canonical_id: str) -> Optional[dict]:
    result = execute("SELECT * FROM people WHERE canonical_id = %s",
                     (canonical_id,), fetch=True)
    return dict(result[0]) if result else None


def get_pending_enrichment(limit: int = 100) -> list[dict]:
    result = execute("""
        SELECT * FROM people
        WHERE enrichment_status IN ('pending')
            AND is_author = FALSE
        ORDER BY quality_score DESC LIMIT %s
    """, (limit,), fetch=True)
    return [dict(r) for r in result] if result else []


# ═══════════════════════════════════════════════════════════════════════════
#  ENSURE TABLES
# ═══════════════════════════════════════════════════════════════════════════

def ensure_tables():
    """Create database tables from schema.sql."""
    from mir.db import ensure_schema
    ensure_schema()


def ensure_dataset():
    """No-op compatibility."""
    pass
