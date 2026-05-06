---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-05-06T07:31:02.614Z"
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 9
  completed_plans: 7
  percent: 78
---

# agent-tracing-dashboard Project State

**Project:** agent-tracing-dashboard
**Core Value:** Developers can quickly find local agent sessions and accurately review each turn of user input, agent response, tool/skill/subagent activity, and failure reasons.
**Last Updated:** 2026-05-06

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-06)

**What This Is**:
Multi-source AI agent session tracing dashboard for OpenClaw, Claude Code, and Codex. Browse local sessions and replay each turn with user input, agent response, tool/skill/subagent activity, and failure reasons.

**Core Value**:
Developers can quickly find local agent sessions and accurately review each turn of user input, agent response, tool/skill/subagent activity, and failure reasons.

**Current Focus**:  
Phase 1 — Trace Contract & Brownfield Reset

---

## Current Position

Phase: 02 (local-ingest-core-openclaw-parser) — EXECUTING
Plan: 1 of 5
**Milestone**: M1 Trace Foundation
**Phase**: 2 — Planned
**Plan**: 5 plans in 3 waves
**Status**: Phase 2 planned, ready for `/gsd-execute-phase 2`

**Progress Bar**:

```text
M1 Trace Foundation: [▓▓▓░░░░░░░] 33% (1/3 phases complete)
M2 Multi-source UI:  [░░░░░░░░░░] 0% (0/2 phases complete)
M3 Hardening:        [░░░░░░░░░░] 0% (0/1 phases complete)

Overall:             [▓░░░░░░░░░] 17% (1/6 phases complete)
```

**Phase Progress**:

- Phase 1: Trace Contract & Brownfield Reset — **Complete** (4/4 plans)
- Phase 2: Local Ingest Core + OpenClaw Parser — Pending
- Phase 3: Claude/Codex Parsers + Turn Assembly — Pending
- Phase 4: Multi-source Frontend Shell + Session Explorer — Pending
- Phase 5: Turn Replay UI — Pending
- Phase 6: Sync, OpenClaw Drilldown & Hardening — Pending

---

## Research Summary

Research artifacts are in `.planning/research/`:

- `AGENTSVIEW-DATA-SCHEME.md` — agentsview 数据获取方案分析和本项目改造建议
- `STACK.md` — 推荐 Next.js + 独立 Node/TypeScript ingest + SQLite WAL/FTS5 + REST/SSE
- `FEATURES.md` — v1 table stakes、differentiators、anti-features
- `ARCHITECTURE.md` — multi-source frontend architecture
- `PITFALLS.md` — parser/sync/replay/security failure modes
- `SUMMARY.md` — synthesis for roadmap

**Key Finding**: Next.js should remain the frontend and OpenClaw live overview surface; historical session replay should move to an independent local Node/TypeScript ingest service modeled after agentsview's data pipeline.

---

## Accumulated Context

### Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hybrid Next.js frontend + Node/TypeScript ingest service | 保留当前前端投入和单语言维护优势，同时复用 agentsview 已验证的数据采集形态 | Pending |
| Turn-first read model | 用户目标是按 turn 重现 session 过程，而不是浏览原始 message list | Pending |
| v1 只支持 OpenClaw / Claude Code / Codex | 用户明确范围；避免 agentsview 全 agent 覆盖导致范围爆炸 | Pending |
| OpenClaw Gateway 和 ingest 分工 | Gateway 是实时状态通道；ingest 是历史回放和搜索通道 | Pending |
| Source-specific parser + canonical model | 三种日志协议差异大，不能用通用扫描器 | Pending |
| 默认只读本地工具 | 不做 tool rerun、prompt playground、公开分享、RBAC 或 OTLP collector | Pending |

### Technical Context

**Frontend**:

- Next.js App Router + React + TypeScript
- Tailwind v4 + shadcn/ui + HUD design tokens
- Zustand stores
- Existing OpenClaw Shell/Header/Sidebar/Overview/Sessions components

**Existing OpenClaw data layer**:

- `gateway/` WebSocket RPC client and event parser
- OpenClaw Gateway protocol v3 types
- Current session messages API is a temporary file-scanning route and should be replaced/proxied through ingest

**Planned ingest data layer**:

- Independent Node/TypeScript service under `ingest/`
- SQLite WAL/FTS5
- chokidar / Node fs watcher + debounce + periodic resync
- REST endpoints for sources/sessions/turns/messages/tools/search
- SSE endpoints for global/session invalidation

**Reference implementation**:

- `../references/agentsview`
- Go parser registry covers OpenClaw, Claude Code, Codex and should be treated as behavioral reference material for TypeScript parsers
- SQLite schema already models sessions/messages/tool_calls/tool_result_events/parent-child relationships

### Dependencies

```text
Trace Contract
  -> Ingest Core/OpenClaw Parser
  -> Claude/Codex Parser Parity
  -> Multi-source UI Shell
  -> Turn Replay UI
  -> Realtime/Hardening
```

### Blockers

**Current Blockers**:

- `gsd-sdk` command is not available in this environment, so GSD initialization was executed by writing artifacts directly.
- Current worktree already contains unrelated deleted `.planning/phases`, `.planning/quick`, `.planning/debug`, and `.planning/ui-reviews` files. These were present before this initialization and should not be reverted unless explicitly requested.

**Potential Blockers**:

- Current repo root appears to be missing `package.json` even though `../ovao/package.json` exists; Phase 1 should verify the intended project root and restore/relocate package metadata if needed.
- Introducing an independent ingest service means dev workflow must manage two processes or a launcher.
- Parser correctness depends on fixture coverage for real OpenClaw/Claude/Codex logs.

### Todos

**Immediate**:

- [ ] Run `$gsd-discuss-phase 1` to clarify trace contract scope and brownfield migration boundaries.
- [ ] Verify whether this workspace should own `package.json` or inherit/copy from `../ovao`.
- [ ] Decide whether old OVAO `.planning/phases` deletion state should be archived/committed separately or restored.

**Upcoming**:

- [ ] Plan Phase 1 with fixture paths and canonical DTO details.
- [ ] Decide ingest service launch strategy for development.
- [ ] Audit current OpenClaw overview components for preservation contracts.

---

## Session Continuity

**Last Session**: 2026-05-06 — Initialized agent-tracing-dashboard planning from user goals and agentsview reference.

**What Was Done**:

- Read existing agent-tracing-dashboard (formerly OVAO) project instructions and `.planning` docs.
- Analyzed `../references/agentsview` architecture, API, parser types, OpenClaw/Claude/Codex parser behavior, SQLite schema, sync watcher, and frontend transcript rendering concepts.
- Generated research docs for stack, features, frontend architecture, pitfalls, and agentsview data scheme.
- Replaced top-level `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, and `STATE.md` to reflect the new agent-tracing-dashboard target.
- Updated project documentation to use agent-tracing-dashboard branding and multi-source scope (Plan 01-04).

**What's Next**:

- `$gsd-discuss-phase 1` — gather implementation decisions for Trace Contract & Brownfield Reset.

**Open Questions**:

- Should ingest service be a repo-local TypeScript package under `ingest/`, or part of the main workspace package scripts?
- Should `pnpm dev` eventually launch both Next.js and ingest service, or should ingest be started manually for early phases?

---

*State created: 2026-05-06*
*Last updated: 2026-05-06 after project initialization*
