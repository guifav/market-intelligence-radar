# Contributing to Market Intelligence Radar

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 16+
- Docker & Docker Compose (optional, for easy setup)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/guifav/market-intelligence-radar.git
cd market-intelligence-radar

# Copy and configure environment
cp .env.example .env
# Edit .env — at minimum set LLM_API_KEY

# Option A: Docker Compose (recommended)
docker compose up -d

# Option B: Manual setup
# Backend
pip install -r requirements.txt
python3 -m mir.scanner --setup

# Frontend
cd app
npm install
npm run dev
```

## Running Tests

```bash
# Python — compile check
python3 -m compileall -q mir

# TypeScript — type check + build
cd app
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
