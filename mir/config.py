"""Configuration for Market Intelligence Radar — all from env vars."""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env", override=True)

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://mir:mir@localhost:5432/mir")

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

# Auth
AUTH_EMAIL = os.getenv("AUTH_EMAIL", "admin@example.com")
AUTH_PASSWORD = os.getenv("AUTH_PASSWORD", "changeme")
AUTH_SECRET = os.getenv("AUTH_SECRET", "mir-default-secret-change-me")

import logging as _logging
_auth_log = _logging.getLogger("mir.config")
if AUTH_SECRET in ("", "mir-default-secret-change-me"):
    _auth_log.warning(
        "⚠️  AUTH_SECRET is using the default value. "
        "Set a strong, unique AUTH_SECRET in your .env for production deployments."
    )

# Division configuration — customizable market segments
DIVISIONS = {
    "technology": {"name": "Technology", "region": "global", "languages": ["en"]},
    "finance": {"name": "Finance", "region": "global", "languages": ["en"]},
    "energy": {"name": "Energy", "region": "global", "languages": ["en"]},
    "healthcare": {"name": "Healthcare", "region": "global", "languages": ["en"]},
}
