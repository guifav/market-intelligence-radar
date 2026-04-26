# Market Intelligence Radar (MIR)

An AI-powered market intelligence platform that automatically scans news sources, extracts structured intelligence (people, companies, deals, signals), and presents it in a real-time dashboard.

<!-- Screenshot: add a screenshot of the dashboard here -->

## What It Does

1. **Scans** configurable news sources for new articles
2. **Scrapes** article content (Firecrawl or requests+BeautifulSoup fallback)
3. **Extracts** structured intelligence using LLMs (Claude, GPT-4o, or Gemini)
4. **Stores** everything in PostgreSQL
5. **Matches** extracted people against your CRM contacts
6. **Enriches** contacts via Apollo/SalesQL (optional)
7. **Displays** everything in a sleek Next.js dashboard

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/guifav/market-intelligence-radar.git
cd market-intelligence-radar

# 2. Set your LLM API key
cp .env.example .env
# Edit .env — at minimum set LLM_API_KEY

# 3. Start with Docker Compose
docker compose up -d

# 4. Open the dashboard
open http://localhost:3000
# Login: admin@example.com / changeme
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql://mir:mir@localhost:5432/mir` | PostgreSQL connection string |
| `LLM_PROVIDER` | Yes | `anthropic` | LLM provider: `anthropic`, `openai`, or `gemini` |
| `LLM_API_KEY` | Yes | — | API key for your LLM provider |
| `LLM_MODEL` | No | Auto | Override the default model per provider |
| `AUTH_EMAIL` | No | `admin@example.com` | Login email for the dashboard |
| `AUTH_PASSWORD` | No | `changeme` | Login password |
| `AUTH_SECRET` | No | — | JWT signing secret (change in production!) |
| `FIRECRAWL_API_KEY` | No | — | Firecrawl API key for premium scraping |
| `APOLLO_API_KEY` | No | — | Apollo.io key for contact enrichment |
| `SALESQL_API_KEY` | No | — | SalesQL key for enrichment fallback |

> **Security note:** The default `AUTH_EMAIL`, `AUTH_PASSWORD`, and `AUTH_SECRET` values are for **local development only**. If you deploy this to a server, change all three in your `.env` file. The `docker-compose.yml` defaults are intentionally insecure to make local setup frictionless.

## Architecture

```
┌─────────────┐     ┌──────────┐     ┌──────────┐     ┌────────────┐
│ News Sources │────▶│ Scraper  │────▶│ LLM      │────▶│ PostgreSQL │
│ (JSON config)│     │ Firecrawl│     │ Extractor│     │ Storage    │
└─────────────┘     │ +BS4     │     └──────────┘     └─────┬──────┘
                    └──────────┘                            │
                                                            ▼
┌─────────────┐     ┌──────────┐     ┌──────────┐     ┌────────────┐
│ CRM Contacts│────▶│ Matcher  │     │ Apollo   │     │ Next.js    │
│ (CSV import)│     │ 4-tier   │     │ SalesQL  │     │ Dashboard  │
└─────────────┘     └──────────┘     │ (optional)│    └────────────┘
                                     └──────────┘
```

### Python Pipeline (`mir/`)
- `scanner.py` — Main orchestrator
- `scraper.py` — Article discovery and scraping
- `extractor.py` — LLM-based intelligence extraction
- `pg_storage.py` — PostgreSQL storage layer
- `enricher.py` — Contact enrichment (Apollo/SalesQL)
- `matcher.py` — CRM contact matching
- `llm.py` — Unified LLM interface

### Next.js Dashboard (`app/`)
- Real-time intelligence dashboard
- People, companies, deals, signals views
- Lead approval/rejection workflow
- CSV export

## Running the Pipeline

```bash
# Setup database tables
python3 -m mir.scanner --setup

# Scan all sources (max 5 articles each)
python3 -m mir.scanner --all --max-articles 5

# Scan with enrichment enabled
python3 -m mir.scanner --all --enrich

# Scan a specific division
python3 -m mir.scanner --division technology --max-articles 10
```

## Adding Sources

Edit `app/data/sources.json`:

```json
[
  {
    "name": "TechCrunch",
    "url": "https://techcrunch.com",
    "region_hint": "technology",
    "enabled": true
  }
]
```

## Importing CRM Contacts

Prepare a CSV with columns: `id`, `name`, `email`, `company`, `title`

```bash
python3 -m mir.crm_import contacts.csv
```

The matcher will automatically cross-reference extracted people against your CRM.

## Customizing Taxonomy

Edit `app/data/taxonomy.json` to define your own:
- Industry sectors
- Organization categories  
- Investment strategies
- Geographic regions

The extraction prompt adapts automatically to your taxonomy.

## Development

```bash
# Backend
pip install -r requirements.txt
python3 -m mir.scanner --setup

# Frontend
cd app
npm install
npm run dev
```

## Tech Stack

- **Backend:** Python 3.12, psycopg2, requests
- **Frontend:** Next.js 15, React 19, Tailwind CSS 4, shadcn/ui
- **Database:** PostgreSQL 16
- **LLM:** Anthropic Claude / OpenAI GPT-4o / Google Gemini
- **Scraping:** Firecrawl (premium) + requests+BeautifulSoup (fallback)
- **Enrichment:** Apollo.io + SalesQL (optional)

## License

MIT — see [LICENSE](LICENSE)
