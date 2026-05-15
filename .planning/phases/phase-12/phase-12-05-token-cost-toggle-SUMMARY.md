---
phase: 12-overview-v2
plan: 05
subsystem: ui
tags: [overview, top-models, toggle, cost, token-ranking, react, hono, bff-proxy]

# Dependency graph
requires:
  - phase: phase-12
    provides: Overview page with KPI hero, rankings, starred, timeline, agents, capabilities

provides:
  - Ingest top-models endpoint with sortBy validation and cost-aware ordering
  - useTopModels hook with sortBy parameter (default 'tokens')
  - TopModelsTable with RANK BY toggle (TOKENS/COST)
  - Cost column rendering em-dash for null cost values

affects: [phase-12, overview-dashboard, overview-page, top-models]

# Tech tracking
tech-stack:
  added: []
  patterns: [conditional column rendering based on sortBy mode, toggle bar with hud-clip-sm active style]

key-files:
  created: []
  modified:
    - ingest/api/overview.ts
    - lib/agent-tools/client-hooks.tsx
    - components/overview/top-models-table.tsx
    - components/overview/overview-page.tsx

key-decisions:
  - "Cost mode sorts with nulls last using proxy sort since cost data is always null currently"
  - "Toggle styled with hud-clip-sm matching TimeWindowSelector pattern"
  - "Cost column shows em-dash (—) for null values"

patterns-established:
  - "Sort toggle pattern: RANK BY label + button pair with hud-clip-sm active, follows TimeWindowSelector style"

requirements-completed: [OVR-103]

# Metrics
duration: 3min
completed: 2026-05-15
---

# Phase 12 Plan 05: Token/Cost Toggle Summary

**Top models ranking toggle switching between token-ordered and cost-ordered views with em-dash null rendering, wired end-to-end through ingest → BFF → hook → component**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-15T20:47:08Z
- **Completed:** 2026-05-15T20:50:23Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Ingest top-models endpoint now validates sortBy parameter (tokens|cost) with 400 on invalid value
- Cost-aware ordering implemented as proxy sort (nulls last) ready for when cost data becomes available
- useTopModels hook accepts sortBy with default 'tokens', included in fetch params and dependency array
- TopModelsTable has RANK BY toggle with TOKENS/COST buttons using hud-clip-sm active style
- Token mode preserves original SESSIONS, TOKENS, SHARE columns
- Cost mode shows SESSIONS and COST columns with em-dash (—) for null cost values

## Task Commits

Each task was committed atomically:

1. **Task 1: Ingest sortBy + BFF pass-through + hook update** - `2550e72` (feat)
2. **Task 2: Token/cost toggle UI in top-models-table** - `982faa2` (feat)

## Files Created/Modified
- `ingest/api/overview.ts` - Added sortBy validation (400 on invalid), cost-aware proxy sort with nulls last
- `lib/agent-tools/client-hooks.tsx` - useTopModels now accepts sortBy parameter with 'tokens' default
- `components/overview/top-models-table.tsx` - Added RANK BY toggle, conditional column rendering (token vs cost mode)
- `components/overview/overview-page.tsx` - Added modelSortBy state, passed to useTopModels hook and TopModelsTable

## Decisions Made
- Cost sort uses in-memory proxy sort on result array (cost is always null currently; SQL ORDER BY would be redundant)
- Toggle bar styled with hud-clip-sm on active button, matching TimeWindowSelector pattern exactly
- Em-dash (—) used for null cost values per plan requirement
- Share bar only rendered in token mode (cost mode has no meaningful share calculation)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- OVR-103 gap closure complete: top models table has token/cost ranking toggle
- Phase 12 gap closure plans (12-04 OVR-104, 12-05 OVR-103) both complete
- Ready for Phase 13 (Sessions Table & Trace Detail v2)

## Self-Check: PASSED

- All 0 created files verified (none created, only modified)
- All 4 modified files verified on disk
- All 2 task commits found in git log
- TypeScript type check passes with no errors
- All 42 overview tests pass
- Grep verification: sortBy in top-models-table (5), modelSortBy in overview-page (3), sortBy in client-hooks (3)

---
*Phase: 12-overview-v2*
*Completed: 2026-05-15*
