"""Config-driven ICP policy helpers for the Python pipeline.

This mirrors the runtime behavior used by the dashboard so backend discovery
paths (such as executive search) can evaluate candidates with the same rules.
"""

from __future__ import annotations

import json
from typing import Any

from mir.data_paths import data_file
from mir.icps import load_global_rules, load_icps


_TAXONOMY = json.loads(data_file("taxonomy.json").read_text())

AMPLIFIER_SECTORS = {
    "artificial intelligence",
    "cloud computing",
    "cybersecurity",
    "capital markets",
    "private equity",
    "venture capital",
    "asset management",
    "digital health",
    "biotechnology",
    "renewable energy",
    "energy storage",
    "digital transformation",
    "esg and sustainability",
    "insurance",
}

REVIEW_SECTORS = {
    value.lower()
    for value in (
        (_TAXONOMY.get("sectors", {}).get("technology") or [])
        + (_TAXONOMY.get("sectors", {}).get("energy") or [])
    )
}

_C_LEVEL_FALLBACK_ROLES = {
    "ceo",
    "cfo",
    "cio",
    "coo",
    "cto",
    "president",
    "chairman",
    "managing director",
}


def normalize(value: str) -> str:
    return value.strip().lower()


def parse_string_array(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str) and item.strip()]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except Exception:
            return [value] if value.strip() else []
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, str) and item.strip()]
    return []


def _unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            result.append(value)
    return result


def _match_normalized_value(input_value: str, candidate: str) -> bool:
    return candidate == input_value or candidate in input_value or input_value in candidate


def matches_configured_value(input_value: str, candidates: list[str]) -> bool:
    if not input_value:
        return False
    normalized_input = normalize(input_value)
    return any(_match_normalized_value(normalized_input, normalize(candidate)) for candidate in candidates)


def matches_any_configured_value(inputs: list[str], candidates: list[str]) -> bool:
    normalized_inputs = [normalize(item) for item in inputs if item and item.strip()]
    normalized_candidates = [normalize(item) for item in candidates if item and item.strip()]
    for input_value in normalized_inputs:
        if any(_match_normalized_value(input_value, candidate) for candidate in normalized_candidates):
            return True
    return False


def get_row_sectors(row: dict[str, Any]) -> list[str]:
    return parse_string_array(row.get("sectors"))


def get_row_countries(row: dict[str, Any]) -> list[str]:
    countries = parse_string_array(row.get("countries"))
    if countries:
        return countries
    apollo_country = (row.get("apollo_country") or row.get("country") or "").strip()
    return [apollo_country] if apollo_country else []


def get_row_category(row: dict[str, Any]) -> str:
    return (row.get("category_of_operation") or "").strip()


def get_row_title(row: dict[str, Any]) -> str:
    return (row.get("title") or "").strip()


def get_row_title_candidates(row: dict[str, Any]) -> list[str]:
    values = [
        (row.get("title") or "").strip(),
        (row.get("headline") or "").strip(),
    ]
    return _unique([value for value in values if value])


def get_row_companies(row: dict[str, Any]) -> list[str]:
    values = [
        (row.get("company") or "").strip(),
        (row.get("org_name") or "").strip(),
    ]
    return _unique([value for value in values if value])


def has_core_sector(row: dict[str, Any]) -> bool:
    return any(normalize(sector) not in AMPLIFIER_SECTORS for sector in get_row_sectors(row))


def has_relevant_review_sector(row: dict[str, Any]) -> bool:
    return any(normalize(sector) in REVIEW_SECTORS for sector in get_row_sectors(row))


def matches_category_for_division(row: dict[str, Any], icp: dict[str, Any]) -> bool:
    category = get_row_category(row)
    targets = icp.get("target_categories") or []
    return bool(category and targets and matches_configured_value(category, targets))


def matches_sector_for_division(row: dict[str, Any], icp: dict[str, Any]) -> bool:
    targets = icp.get("target_sectors") or []
    return bool(targets and matches_any_configured_value(get_row_sectors(row), targets))


def matches_country_for_division(row: dict[str, Any], icp: dict[str, Any]) -> bool:
    targets = icp.get("target_countries") or []
    return bool(targets and matches_any_configured_value(get_row_countries(row), targets))


def matches_role_for_division(row: dict[str, Any], icp: dict[str, Any]) -> bool:
    targets = [normalize(role) for role in (icp.get("target_roles") or []) if isinstance(role, str)]
    if not targets:
        return False

    title = normalize(get_row_title(row))
    seniority = normalize((row.get("seniority") or ""))

    return (
        any(target in title for target in targets)
        or (seniority == "c-level" and any(target in _C_LEVEL_FALLBACK_ROLES for target in targets))
        or (seniority == "director" and any("director" in target for target in targets))
    )


def has_division_context(row: dict[str, Any], icp: dict[str, Any]) -> bool:
    if icp.get("target_sectors"):
        return matches_sector_for_division(row, icp)
    return matches_country_for_division(row, icp) or matches_role_for_division(row, icp)


def is_globally_blocked(row: dict[str, Any], global_rules: dict[str, Any]) -> bool:
    category = get_row_category(row)
    return bool(category and matches_configured_value(category, global_rules.get("blocked_categories") or []))


def is_globally_conditional(row: dict[str, Any], global_rules: dict[str, Any]) -> bool:
    category = get_row_category(row)
    return bool(category and matches_configured_value(category, global_rules.get("conditional_categories") or []))


def is_division_excluded(row: dict[str, Any], icp: dict[str, Any]) -> bool:
    category = get_row_category(row)
    titles = get_row_title_candidates(row)
    companies = get_row_companies(row)
    sectors = get_row_sectors(row)
    countries = get_row_countries(row)

    return (
        bool(category and matches_configured_value(category, icp.get("excluded_categories") or []))
        or bool(titles and any(matches_configured_value(title, icp.get("excluded_titles") or []) for title in titles))
        or bool(companies and matches_any_configured_value(companies, icp.get("excluded_companies") or []))
        or bool(sectors and matches_any_configured_value(sectors, icp.get("excluded_sectors") or []))
        or bool(countries and matches_any_configured_value(countries, icp.get("excluded_countries") or []))
    )


def is_division_conditional(row: dict[str, Any], icp: dict[str, Any]) -> bool:
    category = get_row_category(row)
    return bool(category and matches_configured_value(category, icp.get("conditional_categories") or []))


def get_eligible_divisions(
    row: dict[str, Any],
    requested_divisions: list[str] | None = None,
    icps: dict[str, dict[str, Any]] | None = None,
    global_rules: dict[str, Any] | None = None,
) -> list[str]:
    effective_icps = icps or load_icps()
    effective_global_rules = global_rules or load_global_rules()

    if is_globally_blocked(row, effective_global_rules):
        return []
    if is_globally_conditional(row, effective_global_rules) and not has_relevant_review_sector(row):
        return []

    divisions = requested_divisions or parse_string_array(row.get("divisions"))
    fallback_division = (row.get("division") or "").strip()
    if not divisions and fallback_division:
        divisions = [fallback_division]

    eligible: list[str] = []
    for division in _unique([value for value in divisions if value]):
        icp = effective_icps.get(division)
        if not icp:
            continue
        if is_division_excluded(row, icp):
            continue
        if is_division_conditional(row, icp) and not has_division_context(row, icp):
            continue
        eligible.append(division)
    return eligible


def compute_icp_for_division(
    row: dict[str, Any],
    division: str,
    icps: dict[str, dict[str, Any]] | None = None,
    global_rules: dict[str, Any] | None = None,
) -> dict[str, Any]:
    effective_icps = icps or load_icps()
    effective_global_rules = global_rules or load_global_rules()
    icp = effective_icps.get(division)
    if not icp:
        return {"eligible": False, "pct": 0, "dims": []}

    if division not in get_eligible_divisions(row, [division], effective_icps, effective_global_rules):
        return {"eligible": False, "pct": 0, "dims": []}

    if not has_core_sector(row):
        return {"eligible": True, "pct": 0, "dims": []}

    matched_dims: list[str] = []
    max_dims = 0

    if icp.get("target_categories"):
        max_dims += 1
        if matches_category_for_division(row, icp):
            matched_dims.append("category")

    if icp.get("target_sectors"):
        max_dims += 1
        if matches_sector_for_division(row, icp):
            matched_dims.append("sector")

    if icp.get("target_countries"):
        max_dims += 1
        if matches_country_for_division(row, icp):
            matched_dims.append("country")

    if icp.get("target_roles"):
        max_dims += 1
        if matches_role_for_division(row, icp):
            matched_dims.append("role")

    pct = round((len(matched_dims) / max_dims) * 100) if max_dims else 0
    return {"eligible": True, "pct": pct, "dims": matched_dims}
