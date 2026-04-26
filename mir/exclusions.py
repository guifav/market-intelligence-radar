"""Exclusion rules engine — loads rules from PostgreSQL and matches against people."""

import logging
import time
from typing import Optional

from mir.db import execute

log = logging.getLogger("mir.exclusions")

_CACHE_TTL = 300
_cached_rules: list[dict] = []
_cache_ts: float = 0


def _normalize_text(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


def load_exclusion_rules(force: bool = False) -> list[dict]:
    global _cached_rules, _cache_ts
    if not force and _cached_rules and (time.time() - _cache_ts) < _CACHE_TTL:
        return _cached_rules
    try:
        rows = execute(
            "SELECT * FROM exclusion_rules WHERE active = TRUE",
            fetch=True
        )
        _cached_rules = [dict(r) for r in rows] if rows else []
        _cache_ts = time.time()
        return _cached_rules
    except Exception as e:
        log.warning(f"Failed to load exclusion rules: {e}")
        return _cached_rules


def match_exclusion(person: dict, division: str,
                    rules: Optional[list[dict]] = None) -> Optional[str]:
    if rules is None:
        rules = load_exclusion_rules()
    if not rules:
        return None

    name = _normalize_text(person.get("name") or "")
    company = _normalize_text(person.get("company") or "")
    title = _normalize_text(person.get("title") or "")

    for rule in rules:
        rule_div = _normalize_text(rule.get("division") or "global")
        if rule_div != "global" and rule_div != _normalize_text(division):
            continue
        pattern = _normalize_text(rule.get("pattern") or "")
        if not pattern:
            continue
        rule_type = rule.get("rule_type", "")
        if rule_type == "company_pattern" and pattern in company:
            return rule["id"]
        elif rule_type == "title_pattern" and pattern in title:
            return rule["id"]
        elif rule_type == "custom" and pattern == name:
            return rule["id"]
    return None


def match_company_hard_exclusion(company_name: str, division: str,
                                  rules: Optional[list[dict]] = None) -> Optional[str]:
    if rules is None:
        rules = load_exclusion_rules()
    if not rules:
        return None
    company = _normalize_text(company_name or "")
    if not company:
        return None
    for rule in rules:
        if rule.get("rule_type") != "company_pattern":
            continue
        rule_div = _normalize_text(rule.get("division") or "global")
        if rule_div != "global" and rule_div != _normalize_text(division):
            continue
        if rule.get("blocks_company_search") is False:
            continue
        pattern = _normalize_text(rule.get("pattern") or "")
        if pattern and pattern in company:
            return rule["id"]
    return None


def increment_matches_count(rule_id: str):
    try:
        execute("UPDATE exclusion_rules SET matches_count = matches_count + 1 WHERE id = %s",
                (rule_id,))
    except Exception as e:
        log.warning(f"Failed to increment matches_count for rule {rule_id}: {e}")
