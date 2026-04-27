"""CRM Matcher — Cross-reference extracted people/companies against local CRM contacts.

Uses PostgreSQL crm_contacts table (imported via CSV).

Match strategies for people (in priority order):
1. Exact email match (score 1.0)
2. Exact full name match (score 0.8)
3. Name prefix match (score 0.7)
4. Name + company match (score 0.6)
"""

import hashlib
import logging
import re

from mir.db import execute

log = logging.getLogger("mir.matcher")


def canonical_id(name: str, company: str = "") -> str:
    """Generate a deterministic canonical ID from normalized name + company."""
    norm = re.sub(r"[^a-z0-9 ]", "", f"{name} {company}".lower().strip())
    norm = re.sub(r"\s+", " ", norm).strip()
    return hashlib.sha256(norm.encode()).hexdigest()[:16]


# ── In-memory lookup (loaded once per pipeline run) ─────────────────────

_contacts_lookup: dict | None = None


def _load_crm_contacts():
    """Load CRM contacts into memory for fast matching."""
    global _contacts_lookup
    if _contacts_lookup is not None:
        return

    _contacts_lookup = {"by_name": {}, "by_email": {}, "by_name_prefix": {}}

    try:
        rows = execute(
            "SELECT id, name, email, company, title FROM crm_contacts",
            fetch=True
        )
        if not rows:
            log.info("No CRM contacts found — matching disabled")
            return

        for r in rows:
            entry = {
                "crm_id": r["id"],
                "company": (r["company"] or "").strip().lower(),
                "full_name": (r["name"] or "").strip().lower(),
            }
            name_key = entry["full_name"]
            if name_key:
                _contacts_lookup["by_name"].setdefault(name_key, []).append(entry)
                tokens = name_key.split()
                if len(tokens) >= 2:
                    prefix = f"{tokens[0]} {tokens[1]}"
                    _contacts_lookup["by_name_prefix"].setdefault(prefix, []).append(entry)
            email = (r["email"] or "").strip().lower()
            if email:
                _contacts_lookup["by_email"][email] = {"crm_id": r["id"]}

        log.info(f"CRM contacts loaded: {len(rows)} contacts, "
                 f"{len(_contacts_lookup['by_name'])} names, "
                 f"{len(_contacts_lookup['by_email'])} emails")
    except Exception as e:
        log.warning(f"Failed to load CRM contacts: {e}")
        _contacts_lookup = {"by_name": {}, "by_email": {}, "by_name_prefix": {}}


def match_single_person(person_data: dict) -> dict | None:
    """Match a person against CRM contacts. Returns match info or None."""
    _load_crm_contacts()
    if not _contacts_lookup:
        return None

    name = (person_data.get("name") or "").strip().lower()
    email = (person_data.get("email") or "").strip().lower()

    # 1) Email match
    if email and email in _contacts_lookup["by_email"]:
        m = _contacts_lookup["by_email"][email]
        return {"crm_contact_id": m["crm_id"], "crm_match_type": "email_exact", "crm_match_score": 1.0}

    # 2) Exact name match
    if name and name in _contacts_lookup["by_name"]:
        candidates = _contacts_lookup["by_name"][name]
        return {"crm_contact_id": candidates[0]["crm_id"], "crm_match_type": "name_exact", "crm_match_score": 0.8}

    # 3) Name prefix match
    if name:
        tokens = name.split()
        if len(tokens) >= 2:
            prefix_key = f"{tokens[0]} {tokens[1]}"
            candidates = _contacts_lookup.get("by_name_prefix", {}).get(prefix_key, [])
            candidates = [c for c in candidates if c["full_name"].startswith(name)]
            if candidates:
                company = (person_data.get("company") or "").strip().lower()
                if len(candidates) > 3 and not company:
                    return None
                best = None
                for c in candidates:
                    if company and (company in c["company"] or c["company"] in company):
                        best = c
                        break
                if not best and len(candidates) <= 3:
                    best = candidates[0]
                if best:
                    return {"crm_contact_id": best["crm_id"], "crm_match_type": "name_prefix", "crm_match_score": 0.7}

    return None


def match_single_company(company_name: str) -> str | None:
    """Match a company against CRM contacts (by company field). Returns crm_id or None."""
    if not company_name:
        return None
    _load_crm_contacts()
    # Simple approach: check if any contact has this company
    key = company_name.strip().lower()
    result = execute(
        "SELECT DISTINCT id FROM crm_contacts WHERE LOWER(company) = %s LIMIT 1",
        (key,), fetch=True
    )
    return result[0]["id"] if result else None
