# ── Stage 1: Python dependencies ─────────────────────────────────────────
FROM python:3.12-slim AS python-deps
WORKDIR /deps
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/deps/site-packages -r requirements.txt

# ── Stage 2: Node.js build ──────────────────────────────────────────────
FROM node:22-alpine AS node-builder
WORKDIR /build
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

# ── Stage 3: Runtime ────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

# Install Python + wget (for healthcheck — node:22-slim lacks curl)
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip wget && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PYTHONPATH=/app/python-deps
ENV MIR_DATA_DIR=/app/data

# Copy Python deps and source
COPY --from=python-deps /deps/site-packages /app/python-deps
COPY mir/ /app/mir/
COPY schema.sql /app/schema.sql
COPY requirements.txt /app/requirements.txt

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
