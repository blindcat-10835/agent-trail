---
phase: 11-hud-shell-foundation
plan: 02
subsystem: ui
tags: [zustand, right-rail, scope-tabs, source-color-spines, tailwind]

requires:
  - phase: 11-01
    provides: design tokens, status bar, theme system, HUD visual foundation
provides:
  - RailScope type and railScope state in ui-store (recent/starred/live)
  - Scope tab bar in right rail with accent-active highlight
  - Scope-aware session filtering (starred=starredIds, live=status=active, recent=all)
  - Source-color spines on session entries (green/chartreuse/cyan by source)
  - hideStarredFilter prop on SessionFilterDropdown
affects: [right-rail, sessions-right-rail, ui-store, session-filter-dropdown]

tech-stack:
  added: []
  patterns:
    - "SOURCE_SPINE_COLORS: Record<string, string> mapping source to Tailwind border-l- classes"
    - "Scope pre-filter applied before existing search/source/group filters in useMemo chain"
    - "Scope-specific header count labels (X starred / X active / X indexed)"

key-files:
  created: []
  modified:
    - stores/ui-store.ts
    - components/shell/right-rail.tsx
    - components/sessions/sessions-right-rail.tsx
    - components/sessions/session-filter-dropdown.tsx

key-decisions:
  - "Source-color spine values: openclaw=oklch(0.76 0.17 145) green, claude-code=oklch(0.8 0.17 75) chartreuse, codex=oklch(0.76 0.17 200) cyan"
  - "RailScope state lives in ui-store (not local state) for cross-component access"
  - "Starred filter dropdown toggle hidden when railScope === 'starred' (redundant filter)"

patterns-established:
  - "Scope pre-filter pattern: apply railScope filter first, then existing search/source/group filters"
  - "SOURCE_SPINE_COLORS constant for per-source left-border coloring on session rows"

requirements-completed: [UI-104]

duration: 4min
completed: 2026-05-12
---

# Phase 11 Plan 02: Right Rail Scope Tabs & Source-Color Spines Summary

**Right rail scope tabs (RECENT/STARRED/LIVE) with scope-aware filtering and per-source OKLCH color spines on session entries**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-11T18:50:59Z
- **Completed:** 2026-05-11T18:54:58Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added RailScope type and state to ui-store with setRailScope action
- Built scope tab bar with 3 tabs (RECENT, STARRED, LIVE) with accent border-bottom highlight
- Implemented scope-based session filtering: STARRED uses starredIds, LIVE uses status=active, RECENT shows all
- Added source-color spines (3px left border) to session rows: green for openclaw, chartreuse for claude-code, cyan for codex
- Scope-aware header count labels (X starred / X active / X indexed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add rail scope state and scope tab bar to right rail** - `83ea053` (feat)
2. **Task 2: Add scope filtering and source-color spines to session entries** - `e02b13c` (feat)

## Files Created/Modified
- `stores/ui-store.ts` - Added RailScope type, railScope state (default 'recent'), setRailScope action
- `components/shell/right-rail.tsx` - Added scope tab bar with RECENT/STARRED/LIVE buttons, passes railScope to SessionsRightRail
- `components/sessions/sessions-right-rail.tsx` - Added scope pre-filtering, SOURCE_SPINE_COLORS constant, scope-aware count labels, RailScope prop threading
- `components/sessions/session-filter-dropdown.tsx` - Added hideStarredFilter prop to hide starred toggle when in starred scope

## Decisions Made
- Source-color spine values chosen from research: openclaw=oklch(0.76 0.17 145) green, claude-code=oklch(0.8 0.17 75) chartreuse, codex=oklch(0.76 0.17 200) cyan — matches design-notes status palette
- RailScope state stored in ui-store (not local component state) to enable cross-component scope awareness
- Starred filter dropdown toggle hidden when railScope=starred to avoid redundant UI

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added railScope prop threading to SessionsRightRail in Task 1**
- **Found during:** Task 1 (build verification)
- **Issue:** Build failed because right-rail.tsx passed railScope prop to SessionsRightRail which didn't accept it yet
- **Fix:** Added RailScope type and railScope prop to SessionsRightRail interface and threaded through AggregateSessionsRightRail, SourceSessionsRightRail, and SessionsRailContent in Task 1 (plan had this in Task 2)
- **Files modified:** components/sessions/sessions-right-rail.tsx
- **Verification:** Build passes
- **Committed in:** 83ea053 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal — moved interface prop threading from Task 2 to Task 1 for build correctness. Task 2 focused purely on filtering logic and spines as intended.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Right rail scope tabs fully functional, ready for UI verification
- Source-color spines provide visual source differentiation in session list
- Remaining Phase 11 plans can build on the scope-aware right rail

---
*Phase: 11-hud-shell-foundation*
*Completed: 2026-05-12*

## Self-Check: PASSED

- All 4 modified files verified present
- Both task commits verified in git log (83ea053, e02b13c)
- No unexpected file deletions in either commit
