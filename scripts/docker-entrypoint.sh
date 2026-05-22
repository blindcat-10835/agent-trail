#!/bin/sh
set -e

# Default paths for agent session directories when running in Docker.
# Override by mounting host dirs and setting env vars:
#   -v "$HOME/.claude/projects:/agents/claude:ro" -e CLAUDE_PROJECTS_DIR=/agents/claude
export CLAUDE_PROJECTS_DIR="${CLAUDE_PROJECTS_DIR:-/agents/claude}"
export OPENCLAW_DIR="${OPENCLAW_DIR:-/agents/openclaw}"
export CODEX_SESSIONS_DIR="${CODEX_SESSIONS_DIR:-/agents/codex}"
export OPENCODE_DB_PATH="${OPENCODE_DB_PATH:-/agents/opencode/opencode.db}"

export INGEST_DB_PATH="${INGEST_DB_PATH:-/data/ingest.db}"
export INGEST_PORT="${INGEST_PORT:-8078}"
export PORT="${PORT:-3030}"
export AGENT_TRAIL_LOG_LEVEL="${AGENT_TRAIL_LOG_LEVEL:-${AGENTS_TRACING_LOG_LEVEL:-warn}}"
export AGENTS_TRACING_LOG_LEVEL="${AGENTS_TRACING_LOG_LEVEL:-${AGENT_TRAIL_LOG_LEVEL}}"

# NEXT_PUBLIC_INGEST_URL is the URL the browser uses to reach the BFF proxy,
# which is the same host as the Next.js server — no need to change this.
export NEXT_PUBLIC_INGEST_URL="http://localhost:${PORT}"

exec node /app/bin/agent-trail.js
