---
phase: 12-overview-v2
plan: 01
subsystem: ui
tags: [overview, kpi, rankings, hooks, types, react, tailwind]

requires:
  - phase: phase-10
    provides: Overview aggregate endpoints, BFF proxy routes, source capabilities
  - phase: phase-11
    provides: HUD design tokens, hud-clip utilities, EmptyState component

provides:
  - Overview response TypeScript types (types/overview.ts)
  - 6 overview data hooks (useOverviewAggregates, useTopModels, useTopProjects, useStarredSessions, useTimeline, useOverviewCapabilities)
  - KPI Hero component with loading/empty states
  - Time Window Selector component
  - Top Models ranking table with share bars
  - Top Projects ranking table with weight bars
  - Unified dashboard page replacing per-tool routing

affects: [phase-12, overview-dashboard, sessions-stats-bar]

tech-stack:
  added: []
  patterns: [div-based ranking tables, accent-colored share bars, useState+useEffect+fetchToolApi hooks]

key-files:
  created:
    - types/overview.ts
    - components/overview/kpi-hero.tsx
    - components/overview/time-window-selector.tsx
    - components/overview/top-models-table.tsx
    - components/overview/top-projects-table.tsx
  modified:
    - lib/agent-tools/client-hooks.tsx
    - app/(tool-shell)/[tool]/dashboard/page.tsx

key-decisions:
  - "KPI Hero reuses KpiTile pattern from sessions-stats-bar for visual consistency"
  - "Ranking tables use div-based layout (not HTML table) matching project conventions"
  - "Time window defaults to 7d in the overview page"
  - "Ingest offline error shows EmptyState instead of inline error message"
  - "Old dashboard components (openclaw-dashboard, session-stats-dashboard) kept for now, cleanup deferred"

patterns-established:
  - "Overview component pattern: KpiTile/Skeleton for loading, EmptyState for empty, div-based rows for ranking tables"
  - "Overview hook pattern: useState<DataType>(null/[]), useEffect([toolId, window]), fetchToolApi<T>"

requirements-completed: []

duration: 17min
completed: 2026-05-15
---

# Phase 12 Plan 01: Data Layer + KPI Hero + Rankings Summary

**Overview types, 6 BFF data hooks, KPI hero bar, time-window selector, and model/project ranking tables wired into unified dashboard**

## Performance

- **Duration:** 17 min
- **Started:** 2026-05-15T15:15:20Z
- **Completed:** 2026-05-15T15:32:45Z
- **Tasks:** 7
- **Files modified:** 7

## Accomplishments
- Created complete overview type system matching all ingest API response shapes
- Added 6 overview data hooks following the existing client-hooks pattern with window-dependent re-fetching
- Built KPI Hero component with 4-column grid showing Sessions, Turns, Tokens (with input/output split), Projects
- Built time window selector with accent-highlighted active tab and hud-clip-sm styling
- Built top models ranking table with share percentage bars
- Built top projects ranking table with rank weight bars
- Replaced per-tool dashboard routing with unified data-driven overview page

## Task Commits

Each task was committed atomically:

1. **Task 1: Create overview response types** - `4abea27` (feat)
2. **Task 2: Add overview data hooks to client-hooks** - `4199cd8` (feat)
3. **Task 3: Create KPI Hero component** - `4868522` (feat)
4. **Task 4: Create Time Window Selector** - `0967a48` (feat)
5. **Task 5: Create Top Models Table** - `b959a39` (feat)
6. **Task 6: Create Top Projects Table** - `9ef860a` (feat)
7. **Task 7: Replace dashboard page with overview** - `e473086` (feat)

## Files Created/Modified
- `types/overview.ts` - Overview response TypeScript interfaces (OverviewAggregates, ModelRanking, ProjectRanking, etc.)
- `lib/agent-tools/client-hooks.tsx` - Added 6 overview data hooks with window-dependent re-fetching
- `components/overview/kpi-hero.tsx` - 4-column KPI grid with loading/empty states
- `components/overview/time-window-selector.tsx` - Three-tab selector (TODAY/7D/30D) with accent styling
- `components/overview/top-models-table.tsx` - Model ranking table with share bars
- `components/overview/top-projects-table.tsx` - Project ranking table with weight bars
- `app/(tool-shell)/[tool]/dashboard/page.tsx` - Unified overview page replacing per-tool routing

## Decisions Made
- KPI Hero reuses KpiTile pattern from sessions-stats-bar for visual consistency
- Ranking tables use div-based layout (not HTML table) matching project conventions
- Time window defaults to 7d in the overview page
- Ingest offline error shows EmptyState instead of inline error message
- Old dashboard components (openclaw-dashboard, session-stats-dashboard) kept for now, cleanup deferred

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Overview data layer and core visual panels complete
- Ready for plan 12-02 (Starred, Timeline, Agents/Automations modules)
- The starred sessions, timeline, and capabilities hooks are already in place from Task 2, ready for UI components in plan 12-02
- Plan 12-03 (States polish) will handle loading/empty/error state refinements across all overview modules

## Self-Check: PASSED

- All 5 created files verified on disk
- All 2 modified files verified on disk
- All 7 task commits found in git log
- Production build passes without errors

---
*Phase: 12-overview-v2*
*Completed: 2026-05-15*
