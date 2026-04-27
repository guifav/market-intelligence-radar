"""ICP (Ideal Contact Profile) loader — reads from JSON files."""

import json
from typing import Optional
from mir.data_paths import data_file

ICPS_FILE = data_file("division-icps.json")
GLOBAL_RULES_FILE = data_file("icp-global-rules.json")


def load_icps() -> dict:
    if not ICPS_FILE.exists():
        return {}
    with open(ICPS_FILE) as f:
        return json.load(f)


def load_global_rules() -> dict:
    if not GLOBAL_RULES_FILE.exists():
        return {}
    with open(GLOBAL_RULES_FILE) as f:
        return json.load(f)


def get_division_icp(division: str) -> Optional[dict]:
    return load_icps().get(division)
