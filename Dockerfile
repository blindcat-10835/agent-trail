# syntax=docker/dockerfile:1
# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ARG PNPM_VERSION=11.1.3
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# ── Stage 2: install all deps (dev+prod) for building ─────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# node-linker=hoisted gives a flat node_modules that copies cleanly between stages
RUN echo "node-linker=hoisted" > .npmrc && \
    pnpm install --frozen-lockfile

# ── Stage 3: install prod-only deps for runtime ───────────────────────────────
FROM base AS prod-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN echo "node-linker=hoisted" > .npmrc && \
    pnpm install --prod --frozen-lockfile

# ── Stage 4: build ────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build Next.js (produces .next/standalone) and compile ingest TypeScript
RUN pnpm build && pnpm build:ingest

# ── Stage 5: runtime ──────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3030
ENV INGEST_PORT=8078

# Next.js standalone — self-contained server + minimal node_modules
COPY --from=builder /app/.next/standalone ./
# Static assets and public dir must be copied alongside standalone
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Ingest compiled output (tsup single-file bundle + schema.sql asset)
COPY --from=builder /app/ingest/dist/index.js    ./ingest/dist/index.js
COPY --from=builder /app/ingest/dist/schema.sql  ./ingest/dist/schema.sql

# Production node_modules (provides hono, better-sqlite3, chokidar, etc. for ingest)
# Placed at /app/node_modules so Node's module resolution finds them from ingest/dist/
COPY --from=prod-deps /app/node_modules ./node_modules

COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Data directory for SQLite database
RUN mkdir -p /data
VOLUME /data

EXPOSE 3030 8078
ENTRYPOINT ["/docker-entrypoint.sh"]
