---
phase: 10-rich-ingest-metrics
plan: 04
subsystem: api
tags: [bff, proxy, next.js, ingest, overview, search, trust-boundary]

# Dependency graph
requires:
  - phase: 10-02
    provides: Overview aggregate ingest endpoints (/api/v1/overview/*)
  - phase: 10-03
    provides: Session search ingest endpoint (/api/v1/sessions/:id/search)
provides:
  - 8 BFF proxy routes under /api/agent-tools/[tool]/overview/*
  - 1 BFF search route under /api/agent-tools/[tool]/sessions/[sessionId]/search
  - Source-scoped 'all' handling (omits source param)
  - Global endpoints (capabilities, status) without source filtering
affects: [phase-12, phase-13, frontend-overview, frontend-sessions]

# Tech tracking
tech-stack:
  added: []
  patterns: [fetchIngest-direct-proxy, assertAgentToolId-for-all-scope, assertSourceToolId-source-only]

key-files:
  created:
    - app/api/agent-tools/[tool]/overview/aggregates/route.ts
    - app/api/agent-tools/[tool]/overview/top-models/route.ts
    - app/api/agent-tools/[tool]/overview/top-projects/route.ts
    - app/api/agent-tools/[tool]/overview/timeline/route.ts
    - app/api/agent-tools/[tool]/overview/starred/route.ts
    - app/api/agent-tools/[tool]/overview/capabilities/route.ts
    - app/api/agent-tools/[tool]/overview/agents/route.ts
    - app/api/agent-tools/[tool]/overview/status/route.ts
    - app/api/agent-tools/[tool]/sessions/[sessionId]/search/route.ts
  modified: []

key-decisions:
  - "Source-scoped overview routes use assertAgentToolId (accepts 'all') with conditional source param injection"
  - "Agents route uses assertSourceToolId (rejects 'all') since agent summaries require a specific source"
  - "Capabilities and status routes are global — no source param regardless of tool"
  - "Search route accepts 'all' tool scope since search works across any session"

patterns-established:
  - "fetchIngest direct proxy: assertAgentToolId + conditional source param + qs forwarding"
  - "Global endpoint proxy: assertAgentToolId for validation only, no source injection"

requirements-completed:
  - DATA-101
  - DATA-102
  - DATA-103
  - DATA-104
  - DATA-105
  - DATA-106
  - TURN-101
  - TURN-102
  - TURN-103
  - TURN-104
  - TURN-105
  - OPEN-101
  - OPEN-102
  - OPEN-103
  - TEST-101
  - TEST-104

# Metrics
duration: 3min
completed: 2026-05-12
---

# Phase 10 Plan 04: BFF Proxy Routes for Overview & Search Summary

**9 BFF proxy routes wiring every Phase 10-02/03 ingest endpoint through the D-07 trust boundary with source-scoped and global access patterns**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-11T18:22:19Z
- **Completed:** 2026-05-11T18:26:16Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- All 8 overview BFF proxy routes created under `app/api/agent-tools/[tool]/overview/`
- BFF search route with session ID validation and query param validation
- Source-scoped routes handle 'all' by omitting source filter (per Pitfall 5 from RESEARCH)
- Agents route rejects 'all' using `assertSourceToolId` (source-scoped only)
- Capabilities and status routes are global (no source param injection)
- All routes use `sanitizeError` for error sanitization and `{ cache: 'no-store' }` for fresh data
- Build succeeds, all 530 tests pass

## Task Commits

1. **Task 1: Create BFF proxy routes for overview endpoints** - `d0d637b` (feat)
2. **Task 2: Create BFF search route and verify full data plane** - `03e88e4` (feat)

## Files Created/Modified
- `app/api/agent-tools/[tool]/overview/aggregates/route.ts` - BFF proxy for overview aggregates
- `app/api/agent-tools/[tool]/overview/top-models/route.ts` - BFF proxy for top models ranking
- `app/api/agent-tools/[tool]/overview/top-projects/route.ts` - BFF proxy for top projects ranking
- `app/api/agent-tools/[tool]/overview/timeline/route.ts` - BFF proxy for activity timeline
- `app/api/agent-tools/[tool]/overview/starred/route.ts` - BFF proxy for starred sessions
- `app/api/agent-tools/[tool]/overview/capabilities/route.ts` - BFF proxy for source capabilities (global)
- `app/api/agent-tools/[tool]/overview/agents/route.ts` - BFF proxy for agent summaries (source-scoped)
- `app/api/agent-tools/[tool]/overview/status/route.ts` - BFF proxy for system status (global)
- `app/api/agent-tools/[tool]/sessions/[sessionId]/search/route.ts` - BFF proxy for in-session search

## Decisions Made
- Source-scoped overview routes use `assertAgentToolId` (accepts 'all' + specific tools) with conditional source param injection — 'all' omits source, specific tools inject it
- Agents route uses `assertSourceToolId` (rejects 'all') since agent summaries are source-specific
- Capabilities and status are global endpoints — validated tool param but no source injection
- Search route accepts 'all' tool scope since search works across any session regardless of source

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All Phase 10 ingest endpoints now have matching BFF proxy routes
- Frontend can access overview, ranking, timeline, starred, agents, capabilities, status, and search data through `/api/agent-tools/[tool]/...`
- Phase 11 (HUD Shell & Design System Foundation) and Phase 12 (Overview v2 Real Data) can consume these BFF routes

## Self-Check: PASSED

- All 9 route files verified present
- Both commit hashes verified in git log
- Build passes, 530 tests pass

---
*Phase: 10-rich-ingest-metrics*
*Completed: 2026-05-12*
