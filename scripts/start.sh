#!/usr/bin/env bash
# Launch script bundled inside release tarballs.
# Run from the directory where the tarball was extracted.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1
export PORT="${PORT:-3030}"
export INGEST_PORT="${INGEST_PORT:-8078}"
export INGEST_DB_PATH="${INGEST_DB_PATH:-${HOME}/.agents-tracing/ingest.db}"

mkdir -p "$(dirname "$INGEST_DB_PATH")"

echo "[agents-tracing] Starting ingest service on port ${INGEST_PORT}..."
node "${SCRIPT_DIR}/ingest/dist/index.js" &
INGEST_PID=$!

cleanup() {
  echo "[agents-tracing] Shutting down..."
  kill "$INGEST_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[agents-tracing] Starting dashboard on http://localhost:${PORT}"
exec node "${SCRIPT_DIR}/server.js"
