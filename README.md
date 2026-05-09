# agent-tracing-dashboard

**Local multi-source AI agent session tracing dashboard for OpenClaw, Claude Code, and Codex.**

A cyberpunk-HUD-styled developer tool that browses local agent sessions and replays each turn — user input, assistant response, tool/skill/subagent activity, token usage — in a single Next.js dashboard. All data stays on your machine.

> Note: this project was previously named **OVAO** (OpenClaw Visual Agents Office). The OpenClaw Gateway live overview surface has been preserved and integrated alongside file-based ingest for Claude Code and Codex.

---

## Two services, one repo

| Service | Path | Port | Runtime | Purpose |
| --- | --- | --- | --- | --- |
| **Next.js frontend (BFF)** | `app/` | `3000` | Node.js | UI shell, replay, BFF proxy that fronts the ingest service |
| **Ingest service** | `ingest/` | `8078` | Node.js + Hono | File watcher, JSONL parsers, SQLite read model, REST + SSE API |

`pnpm dev` starts both with `concurrently`. The frontend never talks to the ingest service directly — every request passes through `app/api/agent-tools/[tool]/...` BFF proxies that inject the source filter and sanitize errors.

```text
~/.openclaw/agents/*/sessions/*.jsonl   ─┐
~/.claude/projects/*/*.jsonl             ├─►  ingest (8078)  ─►  SQLite (data/ingest.db)
~/.codex/sessions/*/*.jsonl              ─┘                         │
                                                                    │ REST + SSE
                                                                    ▼
                                                            Next.js BFF (3000)
                                                                    │
                                                                    ▼
                                                                  React UI
```

For the full data flow and architecture decisions see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/DATA-FLOW.md`](docs/DATA-FLOW.md).

---

## Quick start

```bash
pnpm install        # use pnpm, not npm/yarn — see pnpm-lock.yaml
pnpm dev            # starts NEXT (3000) + INGEST (8078) with colored prefixes
```

Verify everything is up:

```bash
curl http://localhost:3000             # Next.js (redirects to /all/dashboard)
curl http://localhost:8078/health      # ingest health
curl http://localhost:8078/api/v1/sources
```

The bottom status bar of the dashboard shows `INGEST ONLINE / OFFLINE / RECONNECTING`. The full bootstrap walkthrough lives in [`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md).

---

## Privacy

This is a **local-only developer tool**:

- **No data uploads.** JSONL files are parsed and indexed locally into SQLite (`data/ingest.db`). Nothing leaves your machine.
- **No share links.** No cloud sync, no public URLs, no team sharing.
- **No tool execution.** The dashboard is read-only. It replays recorded tool calls — it never re-runs them.
- **Local files only.** Source discovery is restricted to configured roots (`WORKSPACE_PATH`, `CLAUDE_SESSIONS_PATH`, `CODEX_SESSIONS_PATH`) and validated with absolute-path containment checks (`isWithinRoot`).
- **No telemetry.** No usage metrics, error reports, or analytics are collected.

Treat session files like source code — they may contain code snippets, file paths, command output, and credentials.

---

## Tech stack

- **Next.js 16.2.4** App Router + **React 19.2.4** + TypeScript (strict)
- **Tailwind v4** (CSS-first; theme tokens in `app/globals.css` via `@theme inline` — there is no `tailwind.config.js`)
- **shadcn/ui** with the `radix-nova` style, `neutral` base color, OKLCH tokens, lucide icons (`components.json`)
- **Zustand** for client state (`stores/`)
- **Hono 4** + **better-sqlite3** + **chokidar** for the ingest service
- **Vitest 4** for tests; `eslint-config-next` flat config (`eslint.config.mjs`)
- **pnpm** package manager (`pnpm-lock.yaml`)

---

## Repo layout

```text
app/
  layout.tsx                              # Root layout (JetBrains Mono + Inter, theme bootstrap)
  page.tsx                                # Redirects / → /all/dashboard
  globals.css                             # Tailwind v4 + @theme inline tokens
  (tool-shell)/[tool]/                    # Per-source shell: openclaw | claude-code | codex | all
    layout.tsx                            # Validates [tool] via assertAgentToolId
    dashboard/, sessions/, activity/      # Per-source pages
  api/
    agent-tools/[tool]/...                # BFF proxies to ingest (per D-07)
    ingest/health/                        # Frontend-facing ingest health
    sync/                                 # All-source aggregate sync
    logs/, sessions/messages/             # Legacy OpenClaw file-scan endpoints
    action/restart, action/update         # OpenClaw service control (host-only)
ingest/
  index.ts                                # Hono server bootstrap + lifecycle
  config/                                 # Env-var parsing (INGEST_*)
  api/                                    # Hono route modules (sessions, sources, turns, events)
  parser/                                 # claude.ts | openclaw.ts | codex.ts
  sync/                                   # Source discovery + writeSessionToDatabase
  turns/assembler.ts                      # Turn-first read model
  src/watcher.ts, src/sse.ts              # chokidar watcher + SSE manager
  db/                                     # better-sqlite3 connection + schema.sql + migrations
lib/
  agent-tools/                            # Per-tool registry, server adapters, client hooks
  utils.ts, env.ts, api-error.ts          # Shared utilities
stores/                                   # Zustand stores (replay, ui, tool, theme, ingest-health, office-layout)
components/                               # ui/ (shadcn) + replay/ + sessions/ + shell/ + activity/ + hud/
types/                                    # trace.ts (canonical contract), activity.ts, log.ts
fixtures/                                 # Golden parser fixtures (openclaw / claude-code / codex)
tests/                                    # vitest: unit/, integration/ingest/, hooks/, perf/, local/
scripts/generate-golden.ts               # Regenerate golden fixtures
docs/                                     # See "Documentation" section
.planning/                                # GSD workflow artifacts (do not hand-edit)
data/                                     # SQLite DB (gitignored)
```

Path alias: `@/*` → `./*` (`tsconfig.json`).

---

## Commands

```bash
pnpm dev                  # Both services with colored INGEST/NEXT prefixes
pnpm dev:next             # Frontend only (Next 16 with --webpack to avoid Turbopack compile storm)
pnpm dev:ingest           # Ingest only (tsx watch)

pnpm build                # Next.js production build
pnpm build:ingest         # tsc -p ingest/tsconfig.json → ingest/dist/
pnpm start                # NODE_ENV=production node server/index.mjs
pnpm start:ingest         # NODE_ENV=production node ingest/dist/ingest/index.js

pnpm lint                 # ESLint (eslint-config-next)
pnpm typecheck            # tsc --noEmit (project + ingest references)
pnpm typecheck:ingest     # ingest only

pnpm test                 # vitest (watch)
pnpm test:run             # vitest run (single pass)
pnpm test:real-sessions   # tests/local/real-session-corpus.test.ts (your local sessions; gitignored)
```

---

## Documentation

| Doc | When to read |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Overall system architecture, service boundaries, key decisions |
| [`docs/DATA-FLOW.md`](docs/DATA-FLOW.md) | End-to-end pipeline: JSONL → parser → DB → turn assembler → BFF → UI |
| [`docs/db-schema.md`](docs/db-schema.md) | SQLite tables, columns, indexes, migrations, foreign keys |
| [`docs/services/ingest.md`](docs/services/ingest.md) | Ingest service deep-dive: parsers, watcher, sync, SSE |
| [`docs/services/frontend.md`](docs/services/frontend.md) | Next.js frontend deep-dive: shell, BFF adapters, replay UI, stores |
| [`docs/API.md`](docs/API.md) | Every endpoint (ingest + BFF) with parameters, status codes, examples |
| [`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md) | First-run setup including `WORKSPACE_PATH`/`CLAUDE_SESSIONS_PATH`/`CODEX_SESSIONS_PATH` |
| [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) | Every environment variable, defaults, and validation rules |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Dev workflow, hot reload, debugging, code conventions |
| [`docs/TESTING.md`](docs/TESTING.md) | Vitest setup, fixtures, golden-file workflow, integration tests |
| [`docs/ERRORS_LEARNED.md`](docs/ERRORS_LEARNED.md) | Past pitfalls (Tailwind v4, Next 16, etc.) — read before writing new components |
| [`docs/preserved-capabilities.md`](docs/preserved-capabilities.md) | Phase 1 audit of OpenClaw Gateway-exclusive vs file-replaceable features |
| [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) | Instructions for AI coding assistants working on this repo |

GSD workflow artifacts (`PROJECT.md`, `ROADMAP.md`, `STATE.md`, `phases/`) live under [`.planning/`](.planning/). Don't hand-edit them — use the `/gsd-*` skills.

---

## Status

Active development on milestone **v1.0**. Phase progress and session continuity are tracked in [`.planning/STATE.md`](.planning/STATE.md).
