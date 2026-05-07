# agent-tracing-dashboard

**Multi-source AI agent session tracing dashboard for OpenClaw, Claude Code, and Codex**

agent-tracing-dashboard is a local developer tool for browsing and replaying AI agent sessions. It supports OpenClaw, Claude Code, and Codex as data sources, providing turn-by-turn replay of user input, agent responses, tool/skill/subagent activity, and failure reasons.

## Core Value

Developers can quickly find local agent sessions and accurately review each turn of user input, agent response, tool/skill/subagent activity, and failure reasons.

## Key Features

- **Multi-source support**: OpenClaw, Claude Code, and Codex
- **Turn-based replay**: Review sessions turn-by-turn with full context
- **Tool/Activity tracking**: See what tools were called, skills used, and subagents spawned
- **Local-first**: All data stays on your machine
- **Cyberpunk HUD design**: Built with shadcn/ui and Tailwind v4

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development servers (Next.js + ingest)
pnpm dev
```

This starts:
- **Next.js frontend** at [http://localhost:3000](http://localhost:3000)
- **Ingest API** at [http://localhost:8078](http://localhost:8078)

Verify everything is running:
```bash
# Frontend
curl http://localhost:3000

# Ingest health
curl http://localhost:8078/health
# → {"status":"ok","version":"0.1.0","database":"connected"}

# Source discovery
curl http://localhost:8078/api/v1/sources
# → {"sources":[...],"total":N}
```

The shell status bar at the bottom of the dashboard shows ingest connection status
(INGEST ONLINE / INGEST OFFLINE / INGEST RECONNECTING).

## Privacy

This is a **local-only developer tool**. It operates entirely on your machine:

- **No data uploads.** Session data is parsed and indexed locally in SQLite. Nothing leaves your computer.
- **No sharing.** There are no share links, public URLs, or cloud sync features.
- **No tool execution.** The dashboard is read-only. It replays recorded tool calls — it never executes them.
- **Local files only.** The ingest service only reads from configured session directories on your local filesystem.
- **No telemetry.** No usage data, error reports, or analytics are collected or transmitted.

All session data remains under your control. The dashboard is a viewer, not a recorder or transmitter.

## Getting Started

### Prerequisites

- Node.js 20+ and pnpm
- OpenClaw workspace (if testing OpenClaw source)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd agents-tracing-dashboard

# Install dependencies
pnpm install
```

## Development

### Starting Development Environment

The project consists of two services:
- **Next.js Frontend** (port 3000) - Web dashboard
- **Ingest Service** (port 8078) - Session parsing and API

Start both services with a single command:

```bash
pnpm dev
```

This will start:
- Next.js on http://localhost:3000
- Ingest service on http://localhost:8078

Both services run concurrently with colored log prefixes:
- `[NEXT]` - Next.js frontend logs
- `[INGEST]` - Ingest service logs

Stop both services with `Ctrl+C`.

### Individual Service Control

Start only Next.js:
```bash
pnpm run dev:next
```

Start only ingest service:
```bash
pnpm run dev:ingest
```

### Configuration

#### Ingest Service

Configure OpenClaw source discovery:

```bash
export WORKSPACE_PATH=/path/to/openclaw/workspace
pnpm run dev:ingest
```

Or set in `.env.local`:
```bash
WORKSPACE_PATH=/path/to/openclaw/workspace
INGEST_PORT=8078
INGEST_DB_PATH=./data/ingest.db
```

#### API Endpoints

Ingest service provides:
- `GET /health` - Service health check
- `GET /version` - Service version and info
- `GET /api/v1/sources` - List discovered sources
- `POST /api/v1/sources/:type/sync` - Trigger source sync
- `GET /api/v1/sessions` - List sessions
- `GET /api/v1/sessions/:id` - Get session details
- `GET /api/v1/sessions/:id/turns` - Get session turns
- `GET /api/v1/sessions/:id/messages` - Get session messages

### Production Build

```bash
# Next.js production build
pnpm build

# Ingest service production build
pnpm run build:ingest

# Start production servers
pnpm start
pnpm run start:ingest
```

### Troubleshooting

**Port 3000 already in use:**
- Kill process using port 3000: `lsof -ti:3000 | xargs kill`
- Or change Next.js port: set `PORT=3001 pnpm dev:next`

**Port 8078 already in use:**
- Kill process using port 8078: `lsof -ti:8078 | xargs kill`
- Or change ingest port: set `INGEST_PORT=3001 pnpm dev:ingest`

**WORKSPACE_PATH not configured:**
- Ingest service will start but OpenClaw source discovery will fail
- Set WORKSPACE_PATH env var or pass via command line

**TypeScript errors:**
- Run type check: `pnpm typecheck`
- Check ingest types: `pnpm typecheck:ingest`
- Ensure `pnpm install` has been run

**Database errors:**
- Ensure `./data/` directory exists and is writable
- Delete `data/ingest.db` and restart to reinitialize schema

## Tech Stack

- **Next.js 16.2.4** App Router + **React 19.2.4** + TypeScript
- **Tailwind v4** — CSS-first configuration with cyberpunk HUD theme
- **shadcn/ui** — `radix-nova` style, OKLCH colors, lucide icons
- **Zustand** — State management
- **Node/TypeScript ingest service** — Local session parsing and indexing (Phase 2+)

## Project Structure

```
app/
  (shell)/              # Route group — shared Shell layout (sidebar + main + status bar)
    dashboard/          # Agent Dashboard
    office/             # Office Layout (2D floor plan)
    workspace/          # Single Agent terminal/logs
    layout.tsx          # Shell layout
  globals.css           # Tailwind v4 + theme tokens (@theme inline)
  layout.tsx            # Root layout (Geist font)
gateway/                # WebSocket RPC client (connects to ws://localhost:18789)
stores/
  gateway/              # Agent / logs / UI state (Zustand)
  office-layout/        # Office floor plan layout store
components/ui/          # shadcn components (button, card, badge, separator)
lib/
  utils.ts              # cn() — clsx + tailwind-merge
  gateway-config.ts     # Read/write .ovao-config.json (Gateway URL/Token)
types/                  # Shared types
.planning/              # GSD workflow documentation (PROJECT.md, ROADMAP.md, STATE.md, phases/)
```

**Path aliases**: `@/*` → `./*` (see `tsconfig.json`)

## Commands

```bash
pnpm dev              # Start both Next.js and ingest service
pnpm dev:next         # Start Next.js only (port 3000)
pnpm dev:ingest       # Start ingest service only (port 8078)
pnpm build            # Production build (Next.js)
pnpm build:ingest     # Compile ingest TypeScript to ./dist
pnpm start            # Start production Next.js server
pnpm start:ingest     # Start production ingest server
pnpm lint             # ESLint (eslint-config-next)
pnpm typecheck        # TypeScript check all code
pnpm typecheck:ingest # TypeScript check ingest code only
pnpm test             # Vitest in watch mode
pnpm test:run         # Vitest single run
```

**Note**: This project uses **pnpm** as the package manager (see `pnpm-workspace.yaml`, `pnpm-lock.yaml`). Do not use npm/yarn.

## Documentation

- **[PROJECT.md](.planning/PROJECT.md)** — Project positioning, constraints, and key decisions
- **[REQUIREMENTS.md](.planning/REQUIREMENTS.md)** — v1 requirements and traceability
- **[ROADMAP.md](.planning/ROADMAP.md)** — Milestones and phase breakdown
- **[CLAUDE.md](CLAUDE.md)** — Project instructions for AI agents
- **[AGENTS.md](AGENTS.md)** — Additional project instructions and skills reference

## Status

**Current Phase**: Phase 2 — Local Ingest Core + OpenClaw Parser

See [`.planning/STATE.md`](.planning/STATE.md) for current progress and session continuity.

## Vision

Build agent-tracing-dashboard as a multi-source local tracing dashboard where developers can switch between OpenClaw, Claude Code, and Codex sources from the header, browse past sessions, and replay each turn with full context of user input, agent response, tool/skill/subagent activity, and failure reasons.

## History

**Note**: This project was formerly known as OVAO (OpenClaw Visual Agents Office) during initial development. The cyberpunk HUD design language and existing OpenClow overview capabilities have been preserved and enhanced as part of the multi-source tracing dashboard.

## License

[Specify your license here]

## Contributing

[Specify contribution guidelines here]
