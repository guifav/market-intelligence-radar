"""Inline person enrichment — Apollo → SalesQL waterfall.

Designed to be called per-person during the streaming pipeline,
rather than as a batch post-process.
"""

import time
import logging
import requests
# Enrichment uses PostgreSQL via pg_storage.py
from mir.config import APOLLO_API_KEY, SALESQL_API_KEY
from mir.rate_limit import ThreadSafeIntervalLimiter

log = logging.getLogger("mir.enricher")

import threading

_APOLLO_MIN_INTERVAL = 1.0  # 1 second between Apollo calls
_apollo_rate_limiter = ThreadSafeIntervalLimiter(_APOLLO_MIN_INTERVAL)


def _apollo_rate_limit():
    """Enforce 1 req/sec rate limit for Apollo (thread-safe)."""
    _apollo_rate_limiter.wait()


# In-memory cache for quick_apollo_lookup (name+company → result) — thread-safe
# Capped at 5000 entries to prevent unbounded growth (~OOM risk on 188 sources)
_QUICK_CACHE_MAX = 5000
_quick_lookup_cache: dict[str, dict | None] = {}
_cache_lock = threading.Lock()


def quick_apollo_lookup(name: str, company: str | None = None) -> dict | None:
    """Lightweight Apollo lookup — returns org_industry + country only.

    Used BEFORE classification so the classifier can use Apollo industry
    as a fallback when Claude didn't extract sectors.

    Returns: {"org_industry": str, "country": str, "city": str} or None
    Caches results in memory (same batch = no duplicate calls).
    """
    if not APOLLO_API_KEY or not name:
        return None

    cache_key = f"{name.strip().lower()}|{(company or '').strip().lower()}"
    with _cache_lock:
        if cache_key in _quick_lookup_cache:
            return _quick_lookup_cache[cache_key]

    first, last = _split_name(name)
    if not last:
        with _cache_lock:
            _quick_lookup_cache[cache_key] = None
        return None

    _apollo_rate_limit()

    match_body = {
        "first_name": first,
        "last_name": last,
        "reveal_personal_emails": False,  # lighter call — don't need emails
    }
    if company:
        match_body["organization_name"] = company

    try:
        resp = requests.post(
            "https://api.apollo.io/api/v1/people/match",
            headers={"Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY},
            json=match_body,
            timeout=10,
        )
        if not resp.ok:
            with _cache_lock:
                _quick_lookup_cache[cache_key] = None
            return None

        person = resp.json().get("person")
        if not person:
            with _cache_lock:
                _quick_lookup_cache[cache_key] = None
            return None

        org = person.get("organization") or {}

        # Cache org_id for future executive search
        org_id = org.get("id", "")
        org_company = (company or "").strip()
        if org_id and org_company:
            cache_org_id(org_company, org_id)

        result = {
            "org_industry": org.get("industry", ""),
            "org_id": org_id,
            "country": person.get("country", ""),
            "city": person.get("city", ""),
            "state": person.get("state", ""),
        }
        with _cache_lock:
            if len(_quick_lookup_cache) >= _QUICK_CACHE_MAX:
                # Evict oldest ~20% entries (FIFO-ish via dict order)
                evict_n = _QUICK_CACHE_MAX // 5
                for _ in range(evict_n):
                    _quick_lookup_cache.pop(next(iter(_quick_lookup_cache)), None)
            _quick_lookup_cache[cache_key] = result
        log.debug(f"Quick lookup {name}: industry={result['org_industry']}, country={result['country']}, org_id={org_id[:12] if org_id else 'none'}")
        return result

    except Exception as e:
        log.warning(f"Quick Apollo lookup failed for {name}: {e}")
        with _cache_lock:
            _quick_lookup_cache[cache_key] = None
        return None


# Enrichment data is stored in PostgreSQL via pg_storage.py


def _split_name(name: str) -> tuple[str, str]:
    """Split a full name into (first, last)."""
    parts = name.strip().split()
    first = parts[0] if parts else ""
    last = " ".join(parts[1:]) if len(parts) > 1 else ""
    return first, last


def _filter_fake_email(email: str | None) -> str:
    """Filter out placeholder/fake emails from enrichment providers."""
    if not email:
        return ""
    if "not_unlocked" in email or email.endswith("@domain.com"):
        return ""
    return email


def _try_apollo(first: str, last: str, company: str | None, title: str | None) -> dict | None:
    """Try Apollo /people/match endpoint. Returns enrichment data dict or None."""
    if not APOLLO_API_KEY:
        return None

    _apollo_rate_limit()

    match_body = {
        "first_name": first,
        "last_name": last,
        "reveal_personal_emails": True,
    }
    if company:
        match_body["organization_name"] = company
    if title and title.lower() not in ("unknown", "other"):
        match_body["title"] = title

    try:
        resp = requests.post(
            "https://api.apollo.io/api/v1/people/match",
            headers={"Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY},
            json=match_body,
            timeout=15,
        )
        if not resp.ok:
            return None

        person = resp.json().get("person")
        if not person or not person.get("id"):
            return None

        email = _filter_fake_email(person.get("email"))

        org = person.get("organization") or {}
        emp = org.get("estimated_num_employees")
        org_size = ""
        if emp:
            org_size = "1-50" if emp < 50 else "51-200" if emp < 200 else "201-1000" if emp < 1000 else "1000+"

        phone = ""
        phones = person.get("phone_numbers") or []
        if phones:
            phone = phones[0].get("sanitized_number", "")

        return {
            "source": "apollo",
            "apollo_id": person.get("id", ""),
            "email": email,
            "phone": phone,
            "linkedin": person.get("linkedin_url", ""),
            "photo": person.get("photo_url", ""),
            "headline": person.get("headline", ""),
            "city": person.get("city", ""),
            "state": person.get("state", ""),
            "country": person.get("country", ""),
            "org_name": org.get("name", ""),
            "org_industry": org.get("industry", ""),
            "org_size": org_size,
            "org_linkedin": org.get("linkedin_url", ""),
            "org_website": org.get("website_url", ""),
        }
    except Exception as e:
        log.warning(f"Apollo error for {first} {last}: {e}")
        return None


def _try_salesql(first: str, last: str, company: str | None) -> dict | None:
    """Try SalesQL /persons/enrich endpoint. Returns enrichment data dict or None."""
    if not SALESQL_API_KEY:
        return None

    try:
        params = {"first_name": first, "last_name": last}
        if company:
            params["organization_name"] = company

        resp = requests.get(
            "https://api-public.salesql.com/v1/persons/enrich",
            headers={"Authorization": f"Bearer {SALESQL_API_KEY}"},
            params=params,
            timeout=15,
        )
        if not resp.ok:
            return None

        sq = resp.json()
        if not sq.get("uuid"):
            return None

        # Validate name match
        sq_name = (sq.get("full_name") or "").lower()
        if last and last.lower() not in sq_name:
            return None

        # Find best email
        sq_emails = [e for e in (sq.get("emails") or [])
                     if e.get("status") in ("Valid", "Unverifiable")]
        best_email = (
            next((e for e in sq_emails if e.get("type") == "Work" and e.get("status") == "Valid"), None)
            or next((e for e in sq_emails if e.get("type") == "Work"), None)
            or next((e for e in sq_emails if e.get("status") == "Valid"), None)
            or (sq_emails[0] if sq_emails else None)
        )
        email = _filter_fake_email(best_email.get("email", "") if best_email else "")

        sq_phones = [p for p in (sq.get("phones") or []) if p.get("is_valid") is not False]
        sq_org = sq.get("organization") or {}

        return {
            "source": "salesql",
            "apollo_id": sq.get("uuid", ""),
            "email": email,
            "phone": sq_phones[0].get("phone", "") if sq_phones else "",
            "linkedin": sq.get("linkedin_url", ""),
            "photo": sq.get("image", ""),
            "headline": sq.get("headline") or sq.get("title", ""),
            "city": (sq.get("location") or {}).get("city", ""),
            "state": (sq.get("location") or {}).get("state", ""),
            "country": (sq.get("location") or {}).get("country", ""),
            "org_name": sq_org.get("name", ""),
            "org_industry": sq_org.get("industry", ""),
            "org_size": sq_org.get("number_of_employees", ""),
            "org_linkedin": sq_org.get("linkedin_url", ""),
            "org_website": f"https://{sq_org['website_domain']}" if sq_org.get("website_domain") else "",
        }
    except Exception as e:
        log.warning(f"SalesQL error for {first} {last}: {e}")
        return None


def _has_useful_contact_data(result: dict | None) -> bool:
    return bool(
        result
        and (
            result.get("email")
            or result.get("linkedin")
            or result.get("phone")
        )
    )


def enrich_person_inline(person_data: dict, person_id: str) -> dict | None:
    """Enrich a single person via Apollo → SalesQL waterfall.

    Args:
        person_data: dict with name, title, company fields
        person_id: canonical_id of the person in PostgreSQL

    Returns:
        Enrichment data dict with 'source' key, or None if not found.
        Updates the person record in PostgreSQL directly.
    """
    name = (person_data.get("name") or "").strip()
    if not name:
        return None

    first, last = _split_name(name)
    company = person_data.get("company")
    title = person_data.get("title")

    # Try Apollo first
    result = _try_apollo(first, last, company, title)

    # Quality gate: if Apollo returned an ID but no useful contact data,
    # treat it as "not found" so SalesQL fallback kicks in.
    if result and not _has_useful_contact_data(result):
        log.debug(f"Apollo returned empty shell for {name} — trying SalesQL")
        result = None

    # SalesQL fallback (full) if Apollo found nothing useful
    if not result:
        result = _try_salesql(first, last, company)

    # SalesQL LinkedIn supplement: if Apollo found the person but has no LinkedIn,
    # try SalesQL just for the LinkedIn URL (49% hit rate from backfill testing)
    if result and result.get("source") == "apollo" and not result.get("linkedin"):
        sq_result = _try_salesql(first, last, company)
        if sq_result and sq_result.get("linkedin"):
            result["linkedin"] = sq_result["linkedin"]
            result["linkedin_source"] = "salesql_supplement"
            log.debug(f"LinkedIn supplemented from SalesQL for {name}")

    # Persist enrichment results
    from mir.pg_storage import update_enrichment

    if result:
        # Quality gate: only mark as 'enriched' if we got real contact data
        has_contact_data = _has_useful_contact_data(result)
        effective_status = "enriched" if has_contact_data else "not_found"
        if not has_contact_data:
            log.info(f"Enrichment returned no contact data for {name} — marking as not_found")

        update_enrichment(person_id, result, status=effective_status)
        log.debug(f"Enriched {name} via {result['source']} (status={effective_status})")
        return result if has_contact_data else None
    else:
        update_enrichment(person_id, {}, status="not_found")
        log.debug(f"Enrichment not_found for {name}")
        return None


def company_drill_down(person_data: dict, division: str) -> list[dict]:
    """When a person's enrichment fails, try to find executives from their company.

    Uses Apollo /organizations/enrich to get company info, then searches for
    ICP-matching executives.

    Returns list of executive dicts ready for storage.
    """
    if not APOLLO_API_KEY:
        return []

    company = (person_data.get("company") or "").strip()
    if not company:
        return []

    _apollo_rate_limit()

    try:
        # Search for the organization
        resp = requests.post(
            "https://api.apollo.io/api/v1/organizations/enrich",
            headers={"Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY},
            json={"domain": None, "name": company},
            timeout=15,
        )
        if not resp.ok:
            return []

        org = resp.json().get("organization")
        if not org:
            return []

        org_domain = org.get("primary_domain") or org.get("website_url", "")

        # Search for executives at this org
        _apollo_rate_limit()

        resp2 = requests.post(
            "https://api.apollo.io/api/v1/mixed_people/search",
            headers={"Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY},
            json={
                "organization_domains": [org_domain] if org_domain else [],
                "organization_names": [company],
                "person_seniorities": ["c_suite", "vp", "director", "owner", "partner", "founder"],
                "page": 1,
                "per_page": 5,
            },
            timeout=15,
        )
        if not resp2.ok:
            return []

        people = resp2.json().get("people", [])
        if not people:
            return []

        executives = []
        for p in people[:3]:  # Cap at 3
            name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
            if not name or len(name) < 3:
                continue
            executives.append({
                "name": name,
                "title": p.get("title", ""),
                "company": company,
                "context": f"Executive at {company} (found via company drill-down)",
                "seniority": _map_apollo_seniority(p.get("seniority", "")),
                "is_decision_maker": True,
                "is_author": False,
                "source_type": "company_drill_down",
            })

        log.info(f"Company drill-down for '{company}': found {len(executives)} executives")
        return executives

    except Exception as e:
        log.warning(f"Company drill-down error for '{company}': {e}")
        return []


# In-memory cache: org_name → org_id (from people/match results) — thread-safe
# Capped at 2000 entries
_ORG_CACHE_MAX = 2000
_org_id_cache: dict[str, str] = {}
_org_cache_lock = threading.Lock()


def _lookup_org_by_name(company_name: str) -> dict | None:
    """Resolve an Apollo organization by company name and cache its org_id."""
    if not APOLLO_API_KEY or not company_name:
        return None

    _apollo_rate_limit()

    try:
        resp = requests.post(
            "https://api.apollo.io/api/v1/organizations/enrich",
            headers={"Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY},
            json={"domain": None, "name": company_name},
            timeout=15,
        )
        if not resp.ok:
            return None

        org = resp.json().get("organization")
        if not org:
            return None

        org_id = org.get("id")
        if org_id:
            cache_org_id(company_name, org_id)
        return org
    except Exception as e:
        log.warning(f"Organization lookup error for '{company_name}': {e}")
        return None


def _resolve_org_id(company_name: str) -> str | None:
    """Resolve a company name to an Apollo org_id (thread-safe).

    Uses the org data already cached from quick_apollo_lookup / people/match.
    Falls back to organizations/enrich with guessed domain.
    """
    cache_key = company_name.strip().lower()
    with _org_cache_lock:
        if cache_key in _org_id_cache:
            return _org_id_cache[cache_key]
    org = _lookup_org_by_name(company_name)
    if org:
        return org.get("id")
    return None


def cache_org_id(company_name: str, org_id: str):
    """Cache an org_id discovered during people/match (thread-safe)."""
    if company_name and org_id:
        with _org_cache_lock:
            if len(_org_id_cache) >= _ORG_CACHE_MAX:
                evict_n = _ORG_CACHE_MAX // 5
                for _ in range(evict_n):
                    _org_id_cache.pop(next(iter(_org_id_cache)), None)
            _org_id_cache[company_name.strip().lower()] = org_id


def _company_name_matches(query_name: str, result_name: str) -> bool:
    query = query_name.strip().lower()
    result = result_name.strip().lower()
    if not query or not result:
        return False
    return query == result or query in result or result in query


def _search_people_by_company_name(company_name: str, per_page: int) -> list[dict]:
    """Fallback Apollo search when org_id lookup is unavailable."""
    if not APOLLO_API_KEY or not company_name:
        return []

    _apollo_rate_limit()

    try:
        resp = requests.post(
            "https://api.apollo.io/api/v1/mixed_people/search",
            headers={"Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY},
            json={
                "q_organization_name": company_name,
                "person_seniorities": ["c_suite", "owner", "founder", "partner", "vp", "director"],
                "page": 1,
                "per_page": per_page,
            },
            timeout=15,
        )
        if not resp.ok:
            return []
        return resp.json().get("people", []) or []
    except Exception as e:
        log.warning(f"Company name search error for '{company_name}': {e}")
        return []


def company_executive_search(company_name: str, division: str, org_id: str | None = None, per_page: int = 10) -> list[dict]:
    """Search for executives at a company using Apollo org_id.

    IMPORTANT: Requires org_id (Apollo organization ID). Use _resolve_org_id() or
    pass org_id from a prior people/match call. The organization_names parameter
    in mixed_people/search is BROKEN — returns phantom results.

    Flow: people/match (for known person) → extract org_id → mixed_people/search by org_id

    Returns list of executive dicts ready for storage.
    """
    if not APOLLO_API_KEY or not company_name:
        return []

    org = None

    # Resolve org_id if not provided
    if not org_id:
        org_id = _resolve_org_id(company_name)
    if not org_id:
        org = _lookup_org_by_name(company_name)
        org_id = (org or {}).get("id")
    people = []

    if org_id:
        _apollo_rate_limit()

        try:
            resp = requests.post(
                "https://api.apollo.io/api/v1/mixed_people/search",
                headers={"Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY},
                json={
                    "organization_ids": [org_id],
                    "person_seniorities": ["c_suite", "owner", "founder", "partner", "vp", "director"],
                    "page": 1,
                    "per_page": per_page,
                },
                timeout=15,
            )
            if resp.ok:
                people = resp.json().get("people", []) or []
        except Exception as e:
            log.warning(f"Company exec search error for '{company_name}': {e}")

    if not people:
        people = _search_people_by_company_name(company_name, per_page)

    try:
        executives = []
        for p in people[:per_page]:
            name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
            if not name or len(name) < 3:
                continue

            p_org = (p.get("organization") or {})
            p_org_name = p_org.get("name", company_name)

            # Validation: person must actually work at this company
            if not _company_name_matches(company_name, p_org_name):
                log.debug(f"  Skipping {name} — org mismatch: {p_org_name} != {company_name}")
                continue

            executives.append({
                "name": name,
                "title": p.get("title", ""),
                "headline": p.get("headline", "") or p.get("title", ""),
                "company": company_name,
                "context": f"Executive at {company_name} (found via company executive search)",
                "seniority": _map_apollo_seniority(p.get("seniority", "")),
                "is_decision_maker": True,
                "is_author": False,
                "source_type": "company_executive_search",
                "apollo_id": p.get("id", ""),
                "country": p.get("country", ""),
                "city": p.get("city", ""),
                "linkedin": p.get("linkedin_url", ""),
                "org_name": p_org_name,
                "org_industry": p_org.get("industry", "") or (org or {}).get("industry", ""),
            })

        log.info(f"Company exec search for '{company_name}' (org_id={org_id[:12] if org_id else 'none'}): "
                 f"found {len(executives)} executives")
        return executives

    except Exception as e:
        log.warning(f"Company exec search error for '{company_name}': {e}")
        return []


def enrich_all_pending() -> dict:
    """Enrich all people with enrichment_status pending.
    
    Reads from PostgreSQL, enriches via Apollo/SalesQL, writes back to PostgreSQL.
    Returns stats dict with total, enriched, not_found, errors.
    """
    from mir.pg_storage import get_pending_enrichment

    pending = get_pending_enrichment(limit=500)
    
    stats = {"total": len(pending), "enriched": 0, "not_found": 0, "errors": 0}
    log.info(f"Enrich all pending: {len(pending)} contacts to process")
    
    for i, person in enumerate(pending):
        person_data = {"name": person.get("name", ""), "title": person.get("title", ""), "company": person.get("company", "")}
        try:
            result = enrich_person_inline(person_data, person["canonical_id"])
            if result:
                stats["enriched"] += 1
            else:
                stats["not_found"] += 1
        except Exception as e:
            log.error(f"Error enriching {person.get('name')}: {e}")
            stats["errors"] += 1
        
        if (i + 1) % 50 == 0:
            log.info(f"  Progress: {i + 1}/{len(pending)} — {stats['enriched']} found, {stats['not_found']} not found")
    
    log.info(f"Enrich complete: {stats}")
    return stats


def _map_apollo_seniority(apollo_seniority: str) -> str:
    """Map Apollo seniority values to MIR seniority."""
    mapping = {
        "c_suite": "c-level",
        "vp": "director",
        "director": "director",
        "manager": "manager",
        "owner": "c-level",
        "partner": "c-level",
        "founder": "c-level",
    }
    return mapping.get(apollo_seniority.lower(), "unknown")
