"""Source management — loads news sources from JSON file.

Sources are a global pool. `region_hint` is used for scan scheduling
and article provenance, but entity division is determined by the
classifier (sectors + countries), not the source.
"""

import json
import logging
from mir.data_paths import data_file

log = logging.getLogger(__name__)

SOURCES_FILE = data_file("sources.json")


def load_sources(include_disabled: bool = False) -> list[dict]:
    """Load all active sources from JSON."""
    if not SOURCES_FILE.exists():
        return []
    with open(SOURCES_FILE) as f:
        sources = json.load(f)
    if not include_disabled:
        before = len(sources)
        sources = [s for s in sources if s.get("enabled", True)]
        disabled = before - len(sources)
        if disabled:
            log.info(f"Filtered out {disabled} disabled source(s)")
    return sources


def sources_by_region(region_hint: str | None = None) -> list[dict]:
    """Get sources filtered by region_hint."""
    sources = load_sources()
    if region_hint:
        return [s for s in sources if s.get("region_hint") == region_hint
                or region_hint in s.get("region_hints", [])]
    return sources


def sources_by_division(division: str | None = None) -> list[dict]:
    """Legacy wrapper — maps division to region_hint."""
    return sources_by_region(division)


def all_divisions() -> list[str]:
    """Get all unique region_hints from sources."""
    hints = set()
    for s in load_sources():
        hints.add(s.get("region_hint", "global"))
        for h in s.get("region_hints", []):
            hints.add(h)
    return sorted(hints)
