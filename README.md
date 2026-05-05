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

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm/yarn
- OpenClaw Gateway (for OpenClaw source only)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd agents-tracing-dashboard

# Install dependencies
pnpm install
```

### Development

```bash
# Start the development server
pnpm dev

# Open http://localhost:3000
```

### Build

```bash
# Production build
pnpm build

# Start production server
pnpm start
```

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
pnpm dev      # Development server (http://localhost:3000)
pnpm build    # Production build
pnpm start    # Start production server
pnpm lint     # ESLint (eslint-config-next)
```

**Note**: This project uses **pnpm** as the package manager (see `pnpm-workspace.yaml`, `pnpm-lock.yaml`). Do not use npm/yarn.

## Documentation

- **[PROJECT.md](.planning/PROJECT.md)** — Project positioning, constraints, and key decisions
- **[REQUIREMENTS.md](.planning/REQUIREMENTS.md)** — v1 requirements and traceability
- **[ROADMAP.md](.planning/ROADMAP.md)** — Milestones and phase breakdown
- **[CLAUDE.md](CLAUDE.md)** — Project instructions for AI agents
- **[AGENTS.md](AGENTS.md)** — Additional project instructions and skills reference

## Status

**Current Phase**: Phase 1 — Trace Contract & Brownfield Reset

See [`.planning/STATE.md`](.planning/STATE.md) for current progress and session continuity.

## Vision

Build agent-tracing-dashboard as a multi-source local tracing dashboard where developers can switch between OpenClaw, Claude Code, and Codex sources from the header, browse past sessions, and replay each turn with full context of user input, agent response, tool/skill/subagent activity, and failure reasons.

## History

**Note**: This project was formerly known as OVAO (OpenClaw Visual Agents Office) during initial development. The cyberpunk HUD design language and existing OpenClow overview capabilities have been preserved and enhanced as part of the multi-source tracing dashboard.

## License

[Specify your license here]

## Contributing

[Specify contribution guidelines here]
