"""Configuration for Market Intelligence Radar — all from env vars."""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env", override=True)

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "")

# API Keys — optional providers stay empty until used.
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")
APOLLO_API_KEY = os.getenv("APOLLO_API_KEY", "")
SALESQL_API_KEY = os.getenv("SALESQL_API_KEY", "")

# LLM provider
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "anthropic")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "")  # Auto-selected per provider if empty

# Firecrawl
FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"
FIRECRAWL_RATE_LIMIT = 10  # requests per minute (conservative)

# Division configuration — customizable market segments
DIVISIONS = {
    "technology": {"name": "Technology", "region": "global", "languages": ["en"]},
    "finance": {"name": "Finance", "region": "global", "languages": ["en"]},
    "energy": {"name": "Energy", "region": "global", "languages": ["en"]},
    "healthcare": {"name": "Healthcare", "region": "global", "languages": ["en"]},
}
