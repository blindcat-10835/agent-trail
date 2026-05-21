# syntax=docker/dockerfile:1
ARG NODE_VERSION=24-slim
# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ARG PNPM_VERSION=11.1.3
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/* && \
    corepack enable && \
    corepack prepare pnpm@${PNPM_VERSION} --activate

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

# ── Stage 3b: keep only native deps needed by the bundled ingest service ──────
FROM prod-deps AS ingest-deps
WORKDIR /app
RUN mkdir -p /ingest-node_modules && \
    for pkg in better-sqlite3 bindings file-uri-to-path; do \
      cp -a "node_modules/${pkg}" "/ingest-node_modules/${pkg}"; \
    done

# ── Stage 4: build ────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build Next.js (produces .next/standalone) and compile ingest TypeScript
RUN pnpm build && pnpm build:ingest

# ── Stage 5: runtime ──────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
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

# The Next.js standalone output already includes traced frontend/server deps.
# The ingest bundle externalizes only better-sqlite3, so copy that native
# package and its tiny runtime helpers instead of the full prod node_modules.
COPY --from=ingest-deps /ingest-node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=ingest-deps /ingest-node_modules/bindings ./node_modules/bindings
COPY --from=ingest-deps /ingest-node_modules/file-uri-to-path ./node_modules/file-uri-to-path

COPY bin/agents-tracing.js ./bin/agents-tracing.js
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Data directory for SQLite database
RUN mkdir -p /data
VOLUME /data

EXPOSE 3030 8078
ENTRYPOINT ["/docker-entrypoint.sh"]
