---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Data-Rich HUD Redesign
status: completed
last_updated: "2026-05-17T14:36:44.011Z"
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 18
  completed_plans: 18
  percent: 71
---

# agent-tracing-dashboard Project State

**Project:** agent-tracing-dashboard
**Core Value:** Developers can quickly find local agent sessions and accurately review each turn of user input, agent response, tool/skill/subagent activity, and failure reasons.
**Last Updated:** 2026-05-17

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-12)

**Core value:** Developers can quickly find local agent sessions and accurately review each turn of user input, agent response, tool/skill/subagent activity, and failure reasons.

**Current focus:** Phase 13 — Sessions Table & Trace Detail v2 residuals

---

## Current Position

Phase: 13 (Sessions Table & Trace Detail v2) — PARTIAL
Plan: residual gap closure
**Milestone:** v1.1 Data-Rich HUD Redesign — ACTIVE

**Phase:** 13 (Sessions Table & Trace Detail v2)

**Plan:** complete remaining Sessions indexed table and long-session detail gaps

**Status:** Phase 12 complete; Phase 13 partially complete

**Progress Bar:**

```text
v1.1:                [▓▓▓▓▓▓▓▓▓░] 88% (16/16 plans complete, 5/7 phases complete)
```

**Phase Progress:**

- Phase 10: Rich Ingest Metrics & Data Contracts — ✓ Complete (4/4 plans)
  - 10-01: Schema migration v9→v10 + source capabilities — ✓ Complete
  - 10-02: Overview aggregate endpoints + tests — ✓ Complete
  - 10-03: Session/turn enrichment + FTS5 search — ✓ Complete
  - 10-04: BFF proxy routes for overview & search — ✓ Complete
- Phase 11: HUD Shell & Design System Foundation — Complete (2/2 plans)
  - 11-01: Design tokens + status bar real data — ✓ Complete
  - 11-02: Right rail scope tabs + source-color spines — ✓ Complete
- Phase 12: Overview v2 Real Data — ✓ Complete (5/5 plans)
  - 12-01: Data KPI rankings — ✓ Complete
  - 12-02: Starred timeline agents — ✓ Complete
  - 12-03: States polish — ✓ Complete
  - 12-04: Automation module — ✓ Complete
  - 12-05: Token/cost toggle and estimated cost — ✓ Complete
- Phase 13: Sessions Table & Trace Detail v2 — Partial (2/5 requirements complete)
  - SES-103: Session Detail v2 baseline — ✓ Complete
  - SES-104: Replay continuity baseline — ✓ Complete
  - SES-101: Sessions indexed table backend/search/filter/sort path — Pending
  - SES-102: Complete session row fields — Pending
  - SES-105: Routed long-session pagination/virtualization — Pending
- Phase 14: Visual QA & Integration Hardening — Planned
- Phase 15: Ingest Sync Performance Hardening — ✓ Complete (3/3 plans)
  - 15-01: Sync scheduler, watcher path handoff, periodic no-reentry — ✓ Complete
  - 15-02: Pre-parse skip, streaming hash, Codex relationship guardrails — ✓ Complete
  - 15-03: Sync observability and regression verification — ✓ Complete
- Phase 16: Ingest Incremental JSONL and Sync Observability Hardening — ✓ Complete (4/4 plans)
  - 16-01: Cursor schema and safety decision layer — ✓ Complete
  - 16-02: Claude/Codex append parser paths — ✓ Complete
  - 16-03: Idempotent append/upsert write path — ✓ Complete
  - 16-04: Sync debug history, structured logs, bounded config, regression gate — ✓ Complete

---

## Milestone Scope

v1.1 has two explicit workstreams:

1. **Extend ingest** so the app can fetch the data required by the new design: overview aggregates, cost/token windows, top models, top projects, starred sessions, mixed timeline, OpenClaw agents, automation summaries, enriched session headers, turn metadata, and normalized activity rows.
2. **Redesign frontend** according to `.planning/designs/design-notes.md` and `.planning/designs/draft-design/`: Terminal × HUD shell, Overview v2, dense sessions table, trace-thread session detail, right rail, source-aware modules, and light/dark validation.

**Primary design inputs:**

- `.planning/designs/design-notes.md`
- `.planning/designs/design-notes-zh.md`
- `.planning/designs/draft-design/`
- `.planning/2026-05-10-overall-new-design-by-user.md`

---

## Milestone Artifacts

- **Project context:** `.planning/PROJECT.md`
- **Requirements:** `.planning/REQUIREMENTS.md`
- **Roadmap:** `.planning/ROADMAP.md`
- **v1.0 archive:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`
- **Milestones summary:** `.planning/MILESTONES.md`
- **v1.0 retrospective:** `.planning/RETROSPECTIVE.md`

---

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hybrid Next.js frontend + Node/TypeScript ingest service | Preserve OVAO frontend investment, single-language maintenance | ✓ Good |
| Turn-first read model | Users want per-exchange replay, not raw message lists | ✓ Good |
| Source-specific parsers + canonical model | Three log formats differ too much for generic scanner | ✓ Good |
| BFF proxy layer | Frontend never connects directly to ingest | ✓ Good |
| `(tool-shell)` route group + `[tool]` dynamic segment | Shared shell for 3 sources | ✓ Good |
| concurrently dual-service dev workflow | Single `pnpm dev` starts both services | ✓ Good |
| SQLite WAL/FTS5 for local index | Local-first, zero-config, proven by agentsview | ✓ Good |
| v1.1 design prototype is the implementation contract | User supplied concrete design goals and a high-fidelity draft | Pending |
| v1.1 starts with ingest data expansion before UI replacement | The prototype depends on real aggregate metrics and enriched session payloads | Pending |
| FTS5 external content mode for message search | Avoids data duplication, uses sync triggers to keep index current | — Pending |
| Source capabilities as static config map | No database lookup needed; pure TypeScript constant exported from ingest/config | — Pending |
| Skip cache invalidation on migration forces re-parse | Existing sessions get re-parsed to backfill total_input_tokens column | — Pending |

| Status palette uses plain CSS custom properties (not Tailwind @theme tokens) | Design-notes specifies "used inline in components" | — Pending |
| Dark theme status colors use higher lightness (0.82 vs 0.76) | Better visibility on dark backgrounds | — Pending |
| Error status continues using --destructive directly | No separate --status-error token per design-notes | — Pending |

---

## Accumulated Context

### Roadmap Evolution

- 2026-05-14: Phase 15 added: Ingest Sync Performance Hardening. Scope is based on `.planning/debug/ingest-memory-performance-fix-policy.md` and targets watcher/scheduler/full-sync memory amplification before continuing downstream UI work.
- 2026-05-14: Phase 16 added: Ingest Incremental JSONL and Sync Observability Hardening. Scope covers the remaining Phase 15 policy P2/P3 work: append-only JSONL cursors, safe fallback, append/upsert writes, sync run history, structured logs, bounded concurrency, and batching controls.
- 2026-05-15: Phase 16 completed. Safe Claude/Codex append sync now uses cursor decisions, range-bounded append parsers, idempotent append writes, and `/api/v1/debug/sync` observability; broad `pnpm test:run` is blocked only by watcher `EMFILE` in `ingest/src/watcher.test.ts`.

### v1.0 Archive

- v1.0 MVP shipped on 2026-05-12.
- Archived roadmap: `.planning/milestones/v1.0-ROADMAP.md`
- Archived requirements: `.planning/milestones/v1.0-REQUIREMENTS.md`
- Summary: `.planning/MILESTONES.md`
- Retrospective: `.planning/RETROSPECTIVE.md`

### Technical Context

**Frontend:**

- Next.js 16 App Router + React 19 + TypeScript
- Tailwind v4 + shadcn/ui `radix-nova`
- Zustand stores
- Shared `/(tool-shell)/[tool]` route group
- BFF routes under `app/api/agent-tools/[tool]/...`

**Ingest:**

- Hono service on port 8078
- SQLite WAL/FTS5
- Source-specific parsers for OpenClaw, Claude Code, Codex
- REST + SSE APIs
- chokidar watcher, background sync, skip cache

### Blockers

- Broad `pnpm test:run` currently fails in `ingest/src/watcher.test.ts` with `EMFILE: too many open files, watch`; targeted Phase 16 suites and typechecks pass.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260515-tn5 | Codex full sync relationship scope and 15-minute periodic resync | 2026-05-15 | 24df3f4 | [260515-tn5-codex-full-sync-regular-full-sync-relati](./quick/260515-tn5-codex-full-sync-regular-full-sync-relati/) |
| 260515-xa7 | Ingest session display name bounded extraction | 2026-05-15 | 559df1d | [260515-xa7-ingest-session-display-name-extractsessi](./quick/260515-xa7-ingest-session-display-name-extractsessi/) |
| 260516-nvg | Token accounting repair for Claude Code and Codex channels | 2026-05-16 | a8f60fe | [260516-nvg-2026-05-16-reference-token-cost-investig](./quick/260516-nvg-2026-05-16-reference-token-cost-investig/) |
| 260517-uks | Implement overview cost estimation from unified AI provider pricing table | 2026-05-17 | 1883e36 | [260517-uks-implement-overview-cost-estimation-from-](./quick/260517-uks-implement-overview-cost-estimation-from-/) |
| 260517-fast | Mark Phase 12 complete and Phase 13 partial from code status | 2026-05-17 | this commit | — |

### Watchpoints

- `.planning/designs/draft-design/` is currently an untracked design input directory; do not treat it as generated by the v1.1 planning edits.
- Cost values are local estimates unless a source provides authoritative billing data.
- Automation data should be source-capability-driven; unavailable sources need stable empty states rather than fake data.
- Frontend redesign must not bypass BFF or replace v1.0 parser contracts.

---

## Session Continuity

**Last Session**: 2026-05-17 — Marked Phase 12 complete and Phase 13 partial from code status

**What Was Done:**

- Marked OVR-101..OVR-105 complete after overview cost, automation, source scoping, and state handling landed
- Marked SES-103 and SES-104 complete for the current Session Detail v2/replay baseline
- Left SES-101, SES-102, and SES-105 pending for the known Sessions table and long-session detail gaps

**What's Next:**

- Phase 13 residuals: backend-backed Sessions table filtering/sorting/search, missing row fields, activity sort, and routed long-session pagination/virtualization

---

*State created: 2026-05-06*
*Last updated: 2026-05-17*
*Last activity: 2026-05-17 - Completed fast task 260517-fast: Mark Phase 12 complete and Phase 13 partial from code status*
