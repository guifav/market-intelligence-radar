"""Division classifier — assigns divisions based on article/person content.

Simplified classifier that maps content to industry-based divisions:
technology, finance, healthcare, energy.

Usage:
    from mir.classifier import classify_divisions
    divisions = classify_divisions(person_dict)
    # Returns: ["technology", "finance"] etc.
"""

import logging

log = logging.getLogger(__name__)

# ── Valid divisions ─────────────────────────────────────────────────────────

VALID_DIVISIONS = ["technology", "finance", "healthcare", "energy"]

# ── Sector → Division mapping ──────────────────────────────────────────────
# Maps taxonomy sectors to their primary division.

SECTOR_TO_DIVISION: dict[str, str] = {
    # Technology
    "Artificial Intelligence": "technology",
    "Cloud Computing": "technology",
    "Cybersecurity": "technology",
    "FinTech": "technology",
    "PropTech": "technology",
    "HealthTech": "technology",
    "CleanTech": "technology",
    "SaaS": "technology",
    "Enterprise Software": "technology",
    "IoT": "technology",
    "Data Centers": "technology",
    "Telecom": "technology",
    "Technology": "technology",
    # Finance
    "Capital Markets": "finance",
    "Private Equity": "finance",
    "Venture Capital": "finance",
    "Investment Banking": "finance",
    "Asset Management": "finance",
    "Insurance": "finance",
    "Wealth Management": "finance",
    "Digital Assets": "finance",
    "Banking": "finance",
    # Healthcare
    "Pharmaceuticals": "healthcare",
    "Biotechnology": "healthcare",
    "Medical Devices": "healthcare",
    "Digital Health": "healthcare",
    "Health Services": "healthcare",
    "Life Sciences": "healthcare",
    # Energy
    "Renewable Energy": "energy",
    "Oil and Gas": "energy",
    "Energy Storage": "energy",
    "Power Generation": "energy",
    "Energy Distribution": "energy",
    "Carbon Markets": "energy",
    "Mining": "energy",
    "Utilities": "energy",
    # Other
    "Transportation": "energy",
    "Social Services": "energy",
    "Water and Sanitation": "energy",
    "Digital Platforms": "technology",
}

# ── Apollo Industry → Division mapping ──────────────────────────────────────

APOLLO_INDUSTRY_TO_DIVISION: dict[str, str] = {
    "Architecture & Planning": "finance",
    "Facilities Services": "finance",
    "Leisure, Travel & Tourism": "finance",
    "Oil & Energy": "energy",
    "Oil & Gas": "energy",
    "Renewables & Environment": "energy",
    "Utilities": "energy",
    "Mining & Metals": "energy",
    "Hospital & Health Care": "healthcare",
    "Health, Wellness and Fitness": "healthcare",
    "Pharmaceuticals": "healthcare",
    "Biotechnology": "healthcare",
    "Investment Management": "finance",
    "Investment Banking": "finance",
    "Venture Capital & Private Equity": "finance",
    "Capital Markets": "finance",
    "Financial Services": "finance",
    "Banking": "finance",
    "Insurance": "finance",
    "Information Technology and Services": "technology",
    "Computer Software": "technology",
    "Internet": "technology",
    "Computer Hardware": "technology",
    "Telecommunications": "technology",
}

# ── Category of Operation → Division mapping ────────────────────────────────

CAT_OP_TO_DIVISION: dict[str, str] = {
    # Finance & Investment
    "Corporation": "finance",
    "Investment Fund": "finance",
    "Institutional Investor": "finance",
    "Bank/Lender": "finance",
    "Venture Capital": "finance",
    "Private Equity": "finance",
    "Family Office": "finance",
    "Operator": "finance",
    # Technology
    "Technology Company": "technology",
    "Startup": "technology",
    # Services
    "Consulting Firm": "finance",
    "Service Provider": "finance",
    # Other
    "Government": "energy",
    "Academic": "healthcare",
    "Non-profit": "healthcare",
}


def _lookup_case_insensitive(mapping: dict[str, str], key: str) -> str | None:
    """Look up a key in a mapping, trying exact match first, then case-insensitive."""
    result = mapping.get(key)
    if result:
        return result
    key_lower = key.lower().strip()
    for known, val in mapping.items():
        if known.lower() == key_lower:
            return val
    return None


def classify_divisions(person: dict, fallback_division: str | None = None) -> list[str]:
    """Classify a person into one or more divisions based on their profile.

    Uses sectors, Apollo industry, and category of operation to determine divisions.

    Args:
        person: dict with keys: sectors, category_of_operation,
                enrichment_data (optional, from Apollo), division (legacy)
        fallback_division: explicit fallback if classification yields nothing.

    Returns:
        List of division strings, e.g. ["technology", "finance"].
        Always returns at least one division.
    """
    divisions: set[str] = set()

    # 1) Extract sectors
    sectors = person.get("sectors") or []
    if isinstance(sectors, str):
        try:
            import json
            sectors = json.loads(sectors)
        except Exception:
            sectors = [sectors] if sectors else []

    # 2) Map sectors → divisions
    for sector in sectors:
        div = _lookup_case_insensitive(SECTOR_TO_DIVISION, sector)
        if div:
            divisions.add(div)

    # 3) Fallback: Apollo industry → division
    apollo_industry = (person.get("apollo_industry") or "").strip()
    if not divisions and apollo_industry:
        div = _lookup_case_insensitive(APOLLO_INDUSTRY_TO_DIVISION, apollo_industry)
        if div:
            divisions.add(div)
            log.debug(f"Division from Apollo industry '{apollo_industry}': {div}")

    # 4) Fallback: category_of_operation
    cat_op = (person.get("category_of_operation") or "").strip()
    if not divisions and cat_op:
        div = CAT_OP_TO_DIVISION.get(cat_op)
        if div:
            divisions.add(div)

    # 5) Handle unmapped cases
    if not divisions:
        if fallback_division and fallback_division in VALID_DIVISIONS:
            divisions.add(fallback_division)
        else:
            divisions.add("unclassified")

    return sorted(divisions)


def explain_classification(person: dict) -> dict:
    """Return a detailed explanation of the classification for debugging."""
    sectors = person.get("sectors") or []
    if isinstance(sectors, str):
        try:
            import json
            sectors = json.loads(sectors)
        except Exception:
            sectors = [sectors] if sectors else []

    cat_op = (person.get("category_of_operation") or "").strip()
    divisions = classify_divisions(person)
    old_division = person.get("division", "?")
    changed = set(divisions) != {old_division}

    return {
        "name": person.get("name", "?"),
        "company": person.get("company", "?"),
        "title": person.get("title", "?"),
        "old_division": old_division,
        "new_divisions": divisions,
        "changed": changed,
        "sectors": sectors,
        "cat_op": cat_op,
    }
