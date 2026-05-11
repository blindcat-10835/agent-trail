---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Data-Rich HUD Redesign
status: executing
last_updated: "2026-05-12T18:48:00.000Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
---

# agent-tracing-dashboard Project State

**Project:** agent-tracing-dashboard
**Core Value:** Developers can quickly find local agent sessions and accurately review each turn of user input, agent response, tool/skill/subagent activity, and failure reasons.
**Last Updated:** 2026-05-12

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-12)

**Core value:** Developers can quickly find local agent sessions and accurately review each turn of user input, agent response, tool/skill/subagent activity, and failure reasons.

**Current focus:** v1.1 Data-Rich HUD Redesign — Phase 11 in progress

---

## Current Position

**Milestone:** v1.1 Data-Rich HUD Redesign — ACTIVE

**Phase:** 11 (HUD Shell & Design System Foundation) — in progress

**Plan:** 01 complete (1/2)

**Status:** Phase 11 Plan 01 complete — design tokens verified, status bar wired to real data

**Progress Bar:**

```text
v1.1:                [▓▓░░░░░░░░] 25% (5/5 plans in Phase 10-11, 1/5 phases complete)
```

**Phase Progress:**

- Phase 10: Rich Ingest Metrics & Data Contracts — ✓ Complete (4/4 plans)
  - 10-01: Schema migration v9→v10 + source capabilities — ✓ Complete
  - 10-02: Overview aggregate endpoints + tests — ✓ Complete
  - 10-03: Session/turn enrichment + FTS5 search — ✓ Complete
  - 10-04: BFF proxy routes for overview & search — ✓ Complete
- Phase 11: HUD Shell & Design System Foundation — In Progress (1/2 plans)
  - 11-01: Design tokens + status bar real data — ✓ Complete
  - 11-02: Right rail scope tabs + source-color spines — Planned

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

None currently known.

### Watchpoints

- `.planning/designs/draft-design/` is currently an untracked design input directory; do not treat it as generated by the v1.1 planning edits.
- Cost values are local estimates unless a source provides authoritative billing data.
- Automation data should be source-capability-driven; unavailable sources need stable empty states rather than fake data.
- Frontend redesign must not bypass BFF or replace v1.0 parser contracts.

---

## Session Continuity

**Last Session**: 2026-05-12 — Executing Phase 11, Plan 01 complete

**What Was Done:**

- Executed Plan 11-01: Design tokens + status bar real data
- Added status palette CSS variables to both light/dark themes in globals.css
- Wired useIngestStatus hook into ShellStatusBar for real connection state
- Removed hardcoded fake metrics (MEM 42.1MB, FPS 60)
- Applied tabular-nums to dynamic values
- Verified all existing OKLCH tokens match design-notes exactly

**What's Next:**

- Phase 11, Plan 02: Right rail scope tabs + source-color spines

---

*State created: 2026-05-06*
*Last updated: 2026-05-12*
*Last activity: 2026-05-12 - Completed Plan 11-01, Phase 11 in progress*
