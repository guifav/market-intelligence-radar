# ── Stage 1: Python dependencies ─────────────────────────────────────────
FROM python:3.12-slim-bookworm AS python-deps
WORKDIR /deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Stage 2: Node.js build ──────────────────────────────────────────────
FROM node:22-bookworm-slim AS node-builder
WORKDIR /build
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

# ── Stage 3: Runtime ────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Install wget for the healthcheck; Python comes from the official 3.12 stage.
RUN apt-get update && apt-get install -y --no-install-recommends wget && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PYTHONPATH=/app
ENV MIR_DATA_DIR=/app/data

# Copy the matching Python 3.12 runtime, installed packages, and source.
COPY --from=python-deps /usr/local /usr/local
RUN python3 --version | grep -E '^Python 3\.12\.'
COPY mir/ /app/mir/
COPY schema.sql /app/schema.sql
COPY requirements.txt /app/requirements.txt
RUN python3 -c "import psycopg2; import mir.db"

# Copy Next.js build
COPY --from=node-builder /build/.next/standalone ./
COPY --from=node-builder /build/.next/static ./.next/static
COPY --from=node-builder /build/public ./public
COPY --from=node-builder /build/data ./data

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
