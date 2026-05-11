---
phase: 05-turn-replay-ui
plan: 04
subsystem: Turn Replay UI — Virtualization, Search, Filter, Navigation
tags: [virtualization, react-virtual, search, filter-chips, keyboard-shortcuts, navigation, debounce, pagination, scroll-restoration]
requires:
  - phase: 05-02
    provides: replay-page-route, replay-header, replay-right-rail, session-row-navigation
  - phase: 05-03
    provides: turn-card-rendering, activity-block-discriminator, expand-collapse
provides:
  - virtualized-turn-list
  - pagination-pre-fetching
  - scroll-position-restoration
  - in-session-search
  - filter-chip-bar
  - turn-navigation-keyboard-shortcuts
affects:
  - components/replay/turn-timeline.tsx
  - components/replay/replay-search-bar.tsx
  - components/replay/replay-filter-bar.tsx
  - components/replay/turn-navigator.tsx
  - stores/replay-store.ts
  - app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx
tech-stack:
  added: []
  patterns:
    - "@tanstack/react-virtual useVirtualizer with dynamic item sizing"
    - "Zustand currentTurnIndex + focusedTurnId for turn navigation state"
    - "300ms debounced search via useRef<setTimeout> + useEffect cleanup"
    - "URL-synced multi-select filter chips via useSearchParams + router.replace"
    - "Global keydown listener scoped to replay page (j/k/ArrowUp/ArrowDown/Escape)"
    - "Pagination accumulator pattern: offset state + useEffect append with dedup"
    - "Scroll position save/restore keyed by sessionId in useReplayStore"
key-files:
  created:
    - tests/unit/bff/turn-timeline-virtualization.test.ts
    - components/replay/replay-search-bar.tsx
    - components/replay/replay-filter-bar.tsx
    - components/replay/turn-navigator.tsx
  modified:
    - stores/replay-store.ts
    - components/replay/turn-timeline.tsx
    - app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx
key-decisions:
  - "Virtualization threshold: 15 turns (or hasMore is true) — enables useVirtualizer; below that, direct rendering"
  - "Pre-fetch trigger: within 300px of bottom (~5 items at ~60px/item) — fires onLoadMore callback"
  - "Pagination accumulator: page.tsx manages offset + accumulated allTurns with dedup via Set of IDs"
  - "Auto-expand: short sessions (≤10 turns) auto-expand on first load; long sessions show Expand/Collapse toggle"
  - "Search debounce: 300ms via useRef<setTimeout> pattern — localQuery state, debounced to store searchQuery"
  - "Filter chips: 7 options (All/User/Assistant/Tools/Skills/Subagents/System), 'All' mutual exclusion, URL-synced"
  - "Keyboard shortcuts: j/ArrowDown=next, k/ArrowUp=prev, Escape=collapse all — not active when typing in inputs"
  - "Jump-to-turn: number input + Go button parses 1-based input to 0-based index, scrolls to turn-N"
requirements-completed: [REPLAY-02, REPLAY-05]
metrics:
  duration: ~12min
  completed_date: 2026-05-07
  task_count: 2
  file_count: 7
  test_count: 5
  commits: 3
---

# Phase 5 Plan 4: Virtualization, Search, Filters & Turn Navigation

**Virtualized turn list with @tanstack/react-virtual, 300ms debounced in-session search with match counter, URL-synced multi-select filter chips, and turn navigator with prev/next buttons + j/k keyboard shortcuts + jump-to-turn input**

## TDD Gate Compliance

| Gate  | Task  | Commit      | Description                                               |
|-------|-------|-------------|----------------------------------------------------------|
| RED   | 1     | `2ebf497`   | Failing tests for currentTurnIndex and focusedTurnId    |
| GREEN | 1     | `0430596`   | Implement store nav fields, virtualized TurnTimeline, pagination |

## Completed Tasks

### Task 1: @tanstack/react-virtual + Pagination Pre-fetching + Scroll Restoration

| Aspect                 | Implementation |
|------------------------|----------------|
| **Virtualization**     | `useVirtualizer` from `@tanstack/react-virtual` — active for sessions with >15 turns or when `hasMore` is true. Overscan=5. Dynamic item sizing via `virtualizer.measureElement`. Direct rendering for ≤15 turns |
| **Pagination**         | Page route manages `turnsOffset` + `allTurns` accumulator. Fetches 50 turns per page via `useSessionTurns(id, null, { offset, limit: 50 })`. Appends new turns with dedup (Set of IDs). Resets on sessionId change |
| **Pre-fetching**       | `handleScrollWithPrefetch` — when scroll distance from bottom < 300px (~5 items × 60px/item), fires `onLoadMore` callback. Protected against duplicate fetches via `loadingMore` flag |
| **Scroll restoration** | Scroll position saved to `useReplayStore.scrollPositions[sessionId]` on every scroll event (RAF-throttled). Restored on mount via `useEffect`. Keyed by sessionId — independent per session |
| **Auto-expand**        | Short sessions (≤10 turns) auto-expand all turns on first load. Long sessions show Expand All / Collapse All toggle |
| **Store additions**    | `currentTurnIndex` (number, default 0) + `setCurrentTurnIndex`, `focusedTurnId` (string | null, default null) + `setFocusedTurnId` |

### Task 2: ReplaySearchBar + ReplayFilterBar + TurnNavigator

| Aspect                 | Implementation |
|------------------------|----------------|
| **ReplaySearchBar**    | 300ms debounced search via `useRef<setTimeout>` + `useEffect` cleanup. Searches userMessage content, assistantMessages content, and tool_call activity names. Match counter "N of M matches" in search bar. Enter navigates next match, Shift+Enter navigates previous. `/` key shortcut focuses the search input. Clear button (X) when query active |
| **ReplayFilterBar**    | 7 filter chips: All, User, Assistant, Tools, Skills, Subagents, System. Active chip styled with `bg-accent/15 border-accent text-accent`. Inactive with `bg-card border-border text-muted-foreground`. Multi-select — "All" deselects all others; selecting any other deselects "All". State persisted in URL via `useSearchParams` + `router.replace` with `scroll: false` |
| **TurnNavigator**      | Prev/Next buttons (ChevronUp/ChevronDown) with disabled states. "Turn N of M" position display. Jump-to-turn: number input (1-based) + Go button, scrolls to `turn-N` element. Keyboard shortcuts: j/ArrowDown=next, k/ArrowUp=prev, Escape=collapse all. Shortcuts suppressed when typing in INPUT/TEXTAREA. "j/k to navigate" hint hidden on small screens |
| **Page wiring**        | All three components inserted between SessionStatusBar and the main content area. Search + filters wrapped in `flex-shrink-0` divider. Navigator only renders when `turns.length > 0` |

## Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `stores/replay-store.ts` | Modified | Added `currentTurnIndex`, `setCurrentTurnIndex`, `focusedTurnId`, `setFocusedTurnId` to Zustand store |
| `components/replay/turn-timeline.tsx` | Rewritten | Virtualized turn list using `@tanstack/react-virtual` with pagination pre-fetching and scroll restoration |
| `app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx` | Modified | Added pagination state management (turnsOffset, allTurns accumulator, loadingMore), wired new TurnTimeline props, integrated search/filter/navigator components |
| `components/replay/replay-search-bar.tsx` | Created | 300ms debounced search with match counter and match navigation |
| `components/replay/replay-filter-bar.tsx` | Created | URL-synced multi-select filter chip bar with 7 options |
| `components/replay/turn-navigator.tsx` | Created | Prev/Next buttons, jump-to-turn input, j/k/Escape keyboard shortcuts |
| `tests/unit/bff/turn-timeline-virtualization.test.ts` | Created | 5 store tests for currentTurnIndex and focusedTurnId |

## Decisions Made

- Virtualization threshold set at 15 turns — matches the CONTEXT.md specification exactly
- Pre-fetch trigger at 300px (not 5 items exactly) — more reliable since item heights vary; approximately equals 5 items at default 60px estimate
- Pagination accumulator uses Set-based dedup — prevents duplicate turns when same offset is fetched again
- Search matches include tool_call names in addition to message content — per CONTEXT.md specification
- Keyboard shortcuts suppress when focused on INPUT/TEXTAREA to avoid intercepting text input — per UI-SPEC specification
- `useSearchParams` used directly in client component without Suspense wrapper — follows existing codebase pattern from dashboard page

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed useRef type error with setTimeout**
- **Found during:** Task 2 (ReplaySearchBar creation)
- **Issue:** `useRef<ReturnType<typeof setTimeout>>()` requires an initial value argument in React 19 TypeScript types. Empty call produced "Expected 1 arguments, but got 0" error.
- **Fix:** Changed to `useRef<ReturnType<typeof setTimeout> | null>(null)` with explicit null initial value and union type
- **Files modified:** `components/replay/replay-search-bar.tsx`
- **Verification:** `pnpm typecheck` passes
- **Committed in:** `b1ddf91` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor type signature adjustment for React 19 compatibility. No scope change.

## Known Stubs

None. All implemented code is functional with no placeholder values. Search matches are computed from actual turn data. Filter chips sync to real URL params. Turn navigation controls update the Zustand store and scroll to real DOM elements.

## Threat Flags

None. Both threat model dispositions (T-05-07 mitigate via overscan=5, T-05-08 accept for URL filter params) are implemented as specified:
- Virtualization overscan is capped at 5 items, limiting rendered DOM to ~10-15 visible items
- Filter state in URL is client-side only with no sensitive data in filter names

## Verification Results

- `pnpm typecheck` — **PASS** (0 errors)
- `pnpm test:run` — **202/202 passing** (all 18 test files, including 5 new tests)
- All Task 1 store tests (5/5) pass after GREEN phase implementation
- All Task 2 acceptance criteria met (15/15 grep criteria for all 3 components)
- All 7 key files verified on disk
- All 3 commits verified in git history

## Self-Check: PASSED

- All 7 key files found on disk
- Commits `2ebf497` (RED), `0430596` (GREEN), `b1ddf91` (Task 2) verified in git log
- `pnpm typecheck` returns no errors
- Full test suite passes (202/202)

---

*Phase: 05-turn-replay-ui*
*Completed: 2026-05-07*
