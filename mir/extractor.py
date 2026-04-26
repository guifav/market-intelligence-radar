"""Intelligence extractor — uses configurable LLM provider to extract
structured data from articles.

Uses customizable taxonomy (from app/data/taxonomy.json) for all
classification dimensions.
"""

import json
import logging
from mir.config import DIVISIONS
from mir.data_paths import data_file
from mir.llm import extract as llm_extract

log = logging.getLogger("mir.extractor")

# ── Load taxonomy ──────────────────────────────────────────────────────────
_TAXONOMY_FILE = data_file("taxonomy.json")
with open(_TAXONOMY_FILE) as _f:
    TAXONOMY = json.load(_f)

# Flatten all sectors
_ALL_SECTORS = []
for _seg_key in TAXONOMY.get("sectors", {}):
    _ALL_SECTORS.extend(TAXONOMY["sectors"][_seg_key])

# Build normalisation lookup
_NORM_COUNTRIES = TAXONOMY.get("normalisation", {}).get("countries", {})
_NORM_CITIES = TAXONOMY.get("normalisation", {}).get("cities", {})
_NORM_SECTORS = TAXONOMY.get("normalisation", {}).get("sectors", {})

SECTOR_LIST = "\n".join(f"  - {s}" for s in _ALL_SECTORS)
CATEGORY_LIST = "\n".join(f"  - {c}" for c in TAXONOMY.get("categories", []))
INVESTMENT_LIST = "\n".join(f"  - {v}" for v in TAXONOMY.get("investment_strategies", []))
DEAL_SIZE_LIST = "\n".join(f"  - {v}" for v in TAXONOMY.get("deal_sizes", []))
PORTFOLIO_LIST = "\n".join(f"  - {v}" for v in TAXONOMY.get("portfolio_strategies", []))
REGION_LIST = "\n".join(f"  - {v}" for v in TAXONOMY.get("regions", []))


EXTRACTION_PROMPT = """You are a market intelligence analyst. Analyse the following news article and extract ALL relevant intelligence.

The article is from the "{division_name}" segment ({region} region).

ARTICLE TITLE: {title}
ARTICLE SOURCE: {source_name}
ARTICLE URL: {url}

ARTICLE CONTENT:
{content}

---

## TAXONOMY — Use ONLY these canonical values

### Sectors
{sector_list}

### Categories of Operation
{category_list}

### Investment Strategies
{investment_list}

### Deal Sizes
{deal_size_list}

### Portfolio Strategies
{portfolio_list}

### Regions
{region_list}

---

Extract the following in JSON format. Be thorough — capture EVERY person, company, deal, and signal mentioned.

{{
  "summary": "2-3 sentence summary",

  "topics": [
    {{
      "topic": "Short topic name",
      "sectors": ["Pick 1-3 from Sectors list"],
      "countries": ["Countries mentioned"],
      "cities": ["Cities mentioned"],
      "relevance": "high/medium/low"
    }}
  ],

  "people": [
    {{
      "name": "Full name",
      "title": "Job title",
      "company": "Company name",
      "context": "What are they doing/saying? (1-2 sentences)",
      "is_decision_maker": true/false,
      "seniority": "c-level/director/manager/other/unknown",
      "is_author": true/false,
      "category_of_operation": "Pick from Categories list or null",
      "sectors": ["1-3 sectors from list"],
      "countries": ["Countries"],
      "cities": ["Cities"]
    }}
  ],

  "companies": [
    {{
      "name": "Company name",
      "category_of_operation": "Pick from Categories list",
      "sectors": ["1-3 sectors from list"],
      "countries": ["Countries"],
      "cities": ["Cities"],
      "context": "What is the company doing?",
      "deal_involvement": true/false
    }}
  ],

  "deals": [
    {{
      "type": "acquisition/investment/jv/fundraising/ipo/development/lease/sale/other",
      "parties": ["Company A", "Company B"],
      "value": "USD 500M or null",
      "deal_size": "Pick from Deal Sizes list",
      "sectors": ["Sectors"],
      "countries": ["Countries"],
      "description": "Brief deal description",
      "stage": "announced/completed/rumoured/planned"
    }}
  ],

  "signals": [
    {{
      "type": "regulatory/policy/market_shift/new_development/technology/sustainability/risk",
      "capital_action": "acquisition/deployment/fundraising/development/strategic_partnership/none",
      "description": "What is happening?",
      "impact": "high/medium/low",
      "sectors": ["Affected sectors"],
      "countries": ["Affected countries"]
    }}
  ],

  "sentiment": "positive/negative/neutral/mixed",
  "language": "en/es/pt/other"
}}

Rules:
- Only extract people whose name is explicitly stated in the article
- For people: estimate seniority from title
- Set is_author=true ONLY for the article's writer
- Skip politicians, journalists, academics, athletes, celebrities
- Use full English country names
- Be factual — only extract what's explicitly stated
- Return valid JSON only"""


def extract_intelligence(article: dict, division: str, source_name: str) -> dict | None:
    """Extract structured intelligence from an article using configured LLM."""
    div_info = DIVISIONS.get(division, {"name": division, "region": "unknown"})

    content = article.get("content", "")
    if len(content) > 15000:
        content = content[:15000] + "\n\n[... article truncated ...]"

    prompt = EXTRACTION_PROMPT.format(
        division_name=div_info["name"],
        region=div_info["region"],
        title=article.get("title", "Unknown"),
        source_name=source_name,
        url=article.get("url", ""),
        content=content,
        sector_list=SECTOR_LIST,
        category_list=CATEGORY_LIST,
        investment_list=INVESTMENT_LIST,
        deal_size_list=DEAL_SIZE_LIST,
        portfolio_list=PORTFOLIO_LIST,
        region_list=REGION_LIST,
    )

    result = llm_extract(prompt, "", retries=2)
    if not result:
        log.warning(f"Extraction failed for {article.get('url', '?')}")
    return result
