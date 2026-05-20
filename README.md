# Agents Tracing Dashboard

**A local dashboard for tracking and replaying AI coding agent sessions — token usage, cost, tool calls, and subagent trees, all in one place.**

![Overview dashboard](image/README/1779286882349.png)

![Session replay](image/README/1779290188740.png)

---

## What it does

### Usage overview across all your agents

A unified dashboard aggregates token consumption and estimated cost across Claude Code, OpenClaw, Codex, OpenCode, and Qoder — broken down by day, session, project, and model. At a glance you can see:

- Total tokens and estimated USD cost for any time window (today / week / all)
- Per-project and per-model breakdowns with trends over time
- Which sessions consumed the most tokens and where your budget is going
- Live activity feed as new sessions are written to disk

Everything is computed locally from the JSONL files your agents already produce — no account, no upload, no cloud.

### Full session replay with tool and subagent detail

Open any session and step through every turn exactly as it happened. The replay view goes beyond raw text — it surfaces the internal structure of each assistant turn:

- **Tool calls**: expand any `Bash`, `Read`, `Edit`, `Write`, or custom tool invocation to see the exact input arguments and the full output the model received
- **Subagent spawns**: when Claude Code or OpenClaw launches a sub-agent, the dashboard renders the nested agent tree so you can trace which subtask was delegated, what instructions it received, and what it returned
- **Injected context and system events**: surface hidden context blocks, permission prompts, and synthetic messages that normally live between turns but shape how the model behaves
- **Token accounting per turn**: see input, output, cache-read, cache-write, and reasoning token counts at the turn level, not just the session level

---

## Install

### Option 1 — curl (requires Node.js 20+)

```bash
curl -fsSL https://raw.githubusercontent.com/camtrik/agents-tracing-dashboard/main/install.sh | bash
agents-tracing
```

Open <http://localhost:3000>.

### Option 2 — Docker (no Node.js required)

```bash
# Download docker-compose.yml from the repo, then:
docker compose up -d
```

Or run directly:

```bash
docker run --rm -p 127.0.0.1:3000:3000 \
  -v "$HOME/.claude/projects:/agents/claude:ro" \
  -e CLAUDE_PROJECTS_DIR=/agents/claude \
  ghcr.io/camtrik/agents-tracing-dashboard:latest
```

Open <http://localhost:3000>. Mount additional agent directories with `-v` and the matching env var (`OPENCLAW_DIR`, `CODEX_SESSIONS_DIR`, `OPENCODE_DB_PATH`).

### Option 3 — from source

```bash
pnpm install
pnpm dev       # starts Next.js (3000) + ingest service (8078)
```

See [`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md) for full setup and environment variable reference.

---

## Supported agents

| Agent | Source files | Notes |
| --- | --- | --- |
| **Claude Code** | `~/.claude/projects/**/*.jsonl` | Full tool-call and subagent replay |
| **OpenClaw** | `~/.openclaw/agents/*/sessions/*.jsonl` | Gateway live view + file ingest |
| **Codex** | `~/.codex/sessions/**/*.jsonl` | Parent-child session tree |
| **OpenCode** | `~/.local/share/opencode/opencode.db` | SQLite source |
| **Qoder** | local cache DB | Token counts (cost excluded from rollups) |

---

## Privacy

This is a **local-only** tool. No data leaves your machine.

- JSONL files are parsed and indexed into a local SQLite database (`data/ingest.db`).
- The dashboard is read-only — it replays recorded tool calls, never re-executes them.
- No telemetry, no analytics, no cloud sync.

---

## Architecture

Two services, one repo:

| Service | Path | Port | Purpose |
| --- | --- | --- | --- |
| **Next.js frontend** | `app/` | `3000` | UI, BFF proxy to ingest |
| **Ingest service** | `ingest/` | `8078` | File watcher, JSONL parsers, SQLite, REST + SSE |

For the full data flow and architecture decisions see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/DATA-FLOW.md`](docs/DATA-FLOW.md).
