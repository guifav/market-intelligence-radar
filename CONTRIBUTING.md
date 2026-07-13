# Contributing to Market Intelligence Radar

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

### Prerequisites

- Python 3.12+
- Node.js 22+
- PostgreSQL 16+
- Docker & Docker Compose (optional, for easy setup)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/guifav/market-intelligence-radar.git
cd market-intelligence-radar

# Copy and configure environment
cp .env.example .env
# Edit .env — set LLM_API_KEY, POSTGRES_PASSWORD, AUTH_EMAIL, AUTH_PASSWORD, and AUTH_SECRET
# POSTGRES_PASSWORD=$(openssl rand -hex 24)
# AUTH_SECRET=$(openssl rand -hex 32)

# Option A: Docker Compose (recommended)
docker compose up -d

# Login with AUTH_EMAIL / AUTH_PASSWORD from .env

# Option B: Manual setup
# Set DATABASE_URL in .env to your manually managed PostgreSQL instance.
# URL-encode reserved characters used in DATABASE_URL credentials.
# Backend (mir.config loads the root .env file)
pip install -r requirements.txt
python3 -m mir.scanner --setup

# Frontend (Next.js loads its ignored app/.env.local copy)
cp .env app/.env.local
cd app
npm install
npm run dev
```

Docker Compose requires all four security values before it starts: `POSTGRES_PASSWORD`,
`AUTH_EMAIL`, `AUTH_PASSWORD`, and `AUTH_SECRET`. PostgreSQL is internal to the Compose
network and is not published to the host. The application binds to `127.0.0.1` by default;
set `MIR_BIND_ADDRESS=0.0.0.0` only when the application is intentionally exposed behind a
TLS-terminating reverse proxy. Hex-generated credentials are the simplest `.env` format. Wrap
values containing `$`, `#`, or other punctuation in single quotes so Compose preserves them
literally.

## Upgrading Existing Docker Compose Data

The [README upgrade guide](README.md#upgrading-existing-docker-compose-data) is the canonical
data-preserving procedure for existing Docker Compose volumes. Do not delete the `pgdata` volume
or run `docker compose down -v` during the upgrade; either action deletes the existing database
data.

## Running Tests

```bash
# Python — compile check
python3 -m unittest discover -s tests -p 'test_*.py'
python3 -m compileall -q mir

# TypeScript — type check + build
cd app
npm test
npm run build
```

## Pull Request Process

1. Fork the repo and create a feature branch from `main`
2. Make your changes
3. Ensure `python3 -m compileall -q mir` passes
4. Ensure `cd app && npm run build` passes
5. Write a clear PR description explaining what changed and why
6. Submit the PR — a maintainer will review it

## Code Style

### Python (`mir/`)

- Standard Python conventions (PEP 8)
- Use type hints where practical
- Logging via `logging` module (not print)

### TypeScript (`app/`)

- Functional React components with hooks
- Tailwind CSS for styling (shadcn/ui components)

## Reporting Issues

Open a GitHub issue with:

- Clear description of the problem or feature request
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Environment details (OS, Python/Node version)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
