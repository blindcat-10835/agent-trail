# agent-tracing-dashboard

## What This Is

**agent-tracing-dashboard** is a local multi-source AI agent session tracing dashboard for OpenClaw, Claude Code, and Codex. Developers can browse locally-indexed agent sessions and replay each turn with full fidelity: user input, agent response, tool calls, skill usage, subagent activity, and failure reasons — all powered by a standalone ingest service with SQLite storage.

OpenClaw retains its real-time overview value: Agent status, Gateway status, sessions, skills, cron, activity, and usage remain visible with drilldown into historical trace replay.

**Note:** This project was formerly known as OVAO (OpenClaw Visual Agents Office) during initial development.

## Core Value

Developers can quickly find local agent sessions and accurately review each turn of user input, agent response, tool/skill/subagent activity, and failure reasons.

## Requirements

### Validated

- ✓ Multi-source architecture supporting OpenClaw, Claude Code, Codex — v1.0
- ✓ Standalone Node/TypeScript ingest service with Hono REST API + SQLite WAL/FTS5 — v1.0
- ✓ Source-specific JSONL parsers with canonical trace model output — v1.0
- ✓ Turn-first replay API and virtualized UI — v1.0
- ✓ Shared frontend shell with AgentTool registry, source switcher, BFF proxy — v1.0
- ✓ Real-time sync via chokidar watcher + SSE invalidation — v1.0
- ✓ Security hardening: rate limiting, path traversal protection, source root boundaries — v1.0
- ✓ 400+ regression tests covering parsers, API, sync, and replay — v1.0
- ✓ OpenClaw Gateway live overview preserved and enhanced with historical drilldown — v1.0
- ✓ Next.js App Router HUD Shell with Tailwind v4 + shadcn/ui — existing/v1.0
- ✓ OpenClaw Gateway WebSocket/RPC real-time data — existing

### Active

_(To be defined for next milestone via `/gsd-new-milestone`)_

### Out of Scope

- SaaS observability / multi-tenant backend — local developer tool
- Public share links — local sessions may contain sensitive code/paths/output
- Tool rerun / prompt edit / replay execution — observe-only, no side effects
- Prompt playground, model comparison, AI evals, LLM-as-judge — not core to local replay
- RBAC / team collaboration — single-user local tool
- OTLP/OpenTelemetry ingestion server — not a general telemetry collector
- Mobile-first optimization and 3D/WebGL — desktop developer debugging priority
- Agent configuration or control — v1 is read-only observation
- All agentsview agent types — v1 only OpenClaw, Claude Code, Codex

## Context

- **Shipped v1.0** with ~69,648 LOC TypeScript across 315 commits over 7 days
- **Tech stack**: Next.js 16 + React 19 + TypeScript + Tailwind v4 + shadcn/ui (radix-nova) + Zustand + Hono + SQLite WAL/FTS5 + chokidar
- **Architecture**: Dual-service (Next.js port 3000 + Hono ingest port 8078) with BFF proxy layer
- **Testing**: 400+ regression tests, fixture-based parser validation, real-data corpus harness
- **Known tech debt**: Some `as any` type casts in UI, Phase 5/6/7 missing SUMMARY.md files, REQUIREMENTS.md checkboxes were never updated inline

## Constraints

- **Tech Stack**: Next.js + React + TypeScript + Tailwind v4 + shadcn/ui + Zustand + pnpm frontend; Hono + SQLite + chokidar ingest — single-language (TypeScript) maintenance
- **Data Plane**: Historical session replay comes from local ingest/index, never request-time JSONL scanning
- **Source Scope**: v1 only supports OpenClaw, Claude Code, Codex
- **Local-first**: Default localhost, local files, local SQLite, no uploads
- **Read-only**: No tool execution, no original session file modification, no agent control
- **Frontend Architecture**: Shared Shell, Session Explorer, Replay components with adapter/profile/slots differentiation
- **Parser Rigor**: Source-specific parsers for each log format — no generic string scanning
- **Language**: AI docs/spec/plan in Chinese; code comments, variable names, commit messages in English

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hybrid Next.js frontend + Node/TypeScript ingest service | Preserve OVAO frontend investment, single-language maintenance | ✓ Good — clean separation, shared types |
| Turn-first read model | Users want per-exchange replay, not raw message lists | ✓ Good — matches user mental model |
| Source-specific parsers + canonical model | Three log formats differ too much for generic scanner | ✓ Good — parsers handle edge cases well |
| BFF proxy layer | Frontend never connects directly to ingest | ✓ Good — clean trust boundary |
| `(tool-shell)` route group + `[tool]` dynamic segment | Shared shell for 3 sources | ✓ Good — avoids page duplication |
| concurrently dual-service dev workflow | Single `pnpm dev` starts both services | ✓ Good — seamless DX |
| SQLite WAL/FTS5 for local index | Local-first, zero-config, proven by agentsview | ✓ Good — fast queries, simple ops |
| Decimal phase numbering for inserted phases | Clear insertion semantics | ✓ Good — Phases 7/8/9 inserted naturally |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-05-12 after v1.0 milestone*
