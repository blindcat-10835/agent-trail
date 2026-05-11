---
phase: 04-multi-source-frontend-shell-session-explorer
plan: 04
subsystem: ui
tags: [react, nextjs, session-explorer, data-hooks, bff-proxy, trace-session, filter-bar, stats-bar, detail-rail]

# Dependency graph
requires:
  - phase: 04-multi-source-frontend-shell-session-explorer
    plan: 01
    provides: AgentToolId types, registry, AgentToolProvider, useAgentTool hook, per-tool definitions with sessionColumns
  - phase: 04-multi-source-frontend-shell-session-explorer
    plan: 02
    provides: BFF API proxy routes (/api/agent-tools/[tool]/sessions, /sessions/[sessionId], /health)
  - phase: 04-multi-source-frontend-shell-session-explorer
    plan: 03
    provides: ShellFrame, right-rail frame, tool-shell route group, source switcher, tool-store
provides:
  - useToolSessions(toolId, query) data hook fetching sessions from ingest via BFF proxy
  - useSessionDetail(toolId, sessionId) data hook fetching single session detail
  - useAggregateSessions(query) merging sessions from all 3 tools sorted by recency
  - useSourceStatus(toolId) ingest health check hook
  - SessionExplorerTable with per-tool dynamic columns from AgentToolUIProfile sessionColumns
  - SessionsFilterBar emitting ingest-compatible SessionFilters query params
  - SessionsStatsBar with totalCount prop and active/tokens/cost KPIs
  - SessionsDetailRail using BFF proxy (not Gateway fetch) for session detail
  - Wired right-rail via tool-store selectedSessionId for cross-component session selection
  - Fully populated (tool-shell)/[tool]/sessions page with stats, filters, table
affects: [04-05-aggregate-landing, 05-turn-replay-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fetchToolApi<T>(): shared fetch utility routing all data hooks through BFF proxy /api/agent-tools/[tool]/..."
    - "Vanilla React hooks (useState + useEffect + useCallback) — no SWR/react-query dependency needed for 3-tool scope"
    - "Dynamic column grid: CSS grid-template-columns computed from SessionColumnDef.width entries per tool profile"
    - "Status badge mapping: SessionStatus → config({label, color, pulse}) per UI-SPEC copywriting"
    - "Zustand cross-component communication: tool-store.selectedSessionId bridges page state to ShellFrame/RightRail"

key-files:
  created:
    - components/sessions/session-explorer-table.tsx - Shared session table with per-tool dynamic columns, status badges, expand/collapse, click-to-select
  modified:
    - lib/agent-tools/client-hooks.tsx - Added useToolSessions, useSessionDetail, useAggregateSessions, useSourceStatus data hooks + fetchToolApi utility
    - components/sessions/sessions-filter-bar.tsx - Rewritten for ingest-compatible SessionFilters query params (status/model/search/sort/order)
    - components/sessions/sessions-stats-bar.tsx - Adapted for TraceSession data with totalCount prop and KPI tile layout
    - components/sessions/sessions-detail-rail.tsx - Replaced Gateway fetch with useSessionDetail BFF proxy hook; new props interface (sessionId, onClose)
    - components/shell/right-rail.tsx - Wired session detail via SessionsDetailRail with selectedSessionId from store
    - components/shell/shell-frame.tsx - Added useToolStore integration for session selection state; new props selectedSessionId/onCloseSession
    - stores/tool-store.ts - Extended with selectedSessionId state for cross-component communication
    - app/(tool-shell)/[tool]/sessions/page.tsx - Populated with full Session Explorer (stats, filters, table, error/loading states)
    - app/(shell)/sessions/page.tsx - Updated for new SessionsStatsBar/SessionsDetailRail signatures
    - components/dashboard/overview-tab.tsx - Updated SessionsDetailRail prop from session to sessionId

key-decisions:
  - "Data hooks use vanilla React (useState + useEffect + useCallback) — no external SWR/react-query dependency for Phase 4 3-tool scope (per plan guidance)"
  - "fetchToolApi centralizes all BFF proxy calls with URLSearchParams encoding and consistent error handling — no ad-hoc fetch() calls in components"
  - "useToolSessions uses JSON.stringify(query) in useCallback deps — intentionally triggers refetch on any filter change"
  - "useSessionDetail returns null when sessionId is null (no-op) — clean pattern for unselected state"
  - "useAggregateSessions silently excludes failed tool fetches (empty array fallback) — partial data is better than no data"
  - "Dynamic column grid: grid-template-columns built from SessionColumnDef.width entries per tool profile — 4 cols for OpenClaw, 5 cols for Claude Code/Codex"
  - "Status badges map TraceSession.status (active/idle/aborted/error/unknown) using STATUS_CONFIG — no client-side time-based heuristic (per T-04-14, ingest owns status)"
  - "Session selection flows through Zustand tool-store for cross-component access — ShellFrame reads selectedSessionId, pages write it via setSelectedSessionId"
  - "Old (shell) route group pages minimally adapted for new component signatures — coexists with new (tool-shell) route group"

patterns-established:
  - "BFF Proxy Data Hook Pattern: All data hooks use fetchToolApi<T>() → /api/agent-tools/[tool]/... — never call ingest directly (per D-10)"
  - "Profile-Driven Column Grid: SessionExplorerTable reads definition.ui.sessionColumns from useAgentTool() context — no hardcoded column names"
  - "Status Badge Config Pattern: STATUS_CONFIG maps SessionStatus to {label, color, pulse?} — single source of truth for status display"
  - "Session Selection via Zustand: tool-store.selectedSessionId bridges page state to ShellFrame/RightRail without prop drilling through layout"

requirements-completed: [UI-04, UI-05]

# Metrics
duration: 11min
completed: 2026-05-06
---

# Phase 4 Plan 4: Session Explorer Components and Data Hooks Summary

**Shared Session Explorer with per-tool dynamic columns, ingest-powered data hooks via BFF proxy, UI-SPEC-aligned status badges, filter bar with query params, stats bar with KPI tiles, and right rail detail panel using useSessionDetail hook — all data flows through BFF proxy, never direct ingest or Gateway**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-06T16:08:31Z
- **Completed:** 2026-05-06T16:19:35Z
- **Tasks:** 2
- **Files modified:** 11 (1 created, 10 modified)

## Accomplishments

- Added 4 data hooks to client-hooks.tsx: `useToolSessions` (session list with pagination), `useSessionDetail` (single session detail), `useAggregateSessions` (cross-source merge), `useSourceStatus` (ingest health check) — all via shared `fetchToolApi<T>()` utility routing through BFF proxy
- Created `SessionExplorerTable` with per-tool dynamic columns from `AgentToolUIProfile.sessionColumns` — OpenClaw shows 4 base columns (LABEL, STATUS, MODEL, UPDATED), Claude Code and Codex each show 5 (adding PROJECT). Columns rendered via dynamic CSS grid from `SessionColumnDef.width` entries.
- Implemented UI-SPEC status badges: LIVE (green pulsing dot for `active`), IDL (gray for `idle`), ABT (red for `aborted`), ERR (red for `error`), --- (gray for `unknown`)
- Rewrote `SessionsFilterBar` to emit ingest-compatible `SessionFilters` with status chips (ALL, ACTIVE, IDLE, ABORTED, ERROR), model filter, and search input — filter params consumed by `useToolSessions` and forwarded to ingest
- Adapted `SessionsStatsBar` for TraceSession data with 4 KPI tiles (TOTAL SESSIONS, ACTIVE SESSIONS, TOTAL TOKENS, TOTAL COST) and `totalCount` prop from pagination
- Replaced Gateway fetch in `SessionsDetailRail` with `useSessionDetail` BFF proxy hook — header (label, model, status badge), KPI strip (tokens, cost, kind, created), message history placeholder (deferred to Phase 5), session metadata section
- Wired right-rail session detail via `useToolStore.selectedSessionId` — pages write selection state, ShellFrame reads and passes to RightRail/SessionsDetailRail
- Populated `(tool-shell)/[tool]/sessions/page.tsx` with full Session Explorer — stats bar, filter bar, table, loading spinner, ingest-unreachable error state with retry button
- Per D-10: all data hooks and components route through BFF proxy at `/api/agent-tools/[tool]/...` — never call ingest directly, never read Gateway store

## Task Commits

1. **Task 1: Add data hooks (useToolSessions, useSessionDetail) to client-hooks** - `65812ae` (feat)
2. **Task 2: Build Session Explorer table, filter bar, stats bar, and detail rail** - `d780d99` (feat)

## Files Created/Modified

### Created
- `components/sessions/session-explorer-table.tsx` — Shared session table with per-tool dynamic columns from `AgentToolUIProfile.sessionColumns`; status badges per UI-SPEC; expand/collapse metadata; click-to-select with `bg-accent/10` highlight; empty state ("NO SESSIONS")

### Modified
- `lib/agent-tools/client-hooks.tsx` — Added `fetchToolApi<T>()` shared fetch utility, `useToolSessions()`, `useSessionDetail()`, `useAggregateSessions()`, `useSourceStatus()` data hooks (192 lines added)
- `components/sessions/sessions-filter-bar.tsx` — Rewritten: `SessionFilters` type (status/model/search/sort/order), status chips per UI-SPEC, model filter, search input, collapsible FILTERS toggle
- `components/sessions/sessions-stats-bar.tsx` — Adapted: `TraceSession[]` + `totalCount` prop, 4 KPI tiles (TOTAL SESSIONS, ACTIVE SESSIONS, TOTAL TOKENS, TOTAL COST), cost estimate at $2/M tokens
- `components/sessions/sessions-detail-rail.tsx` — Rewritten: `useSessionDetail` BFF proxy hook replaces Gateway fetch; props: `sessionId` + `onClose`; header, KPI strip, message history placeholder, session metadata
- `components/shell/right-rail.tsx` — Wired: accepts `selectedSessionId`/`onCloseSession` props, renders `SessionsDetailRail`
- `components/shell/shell-frame.tsx` — Added `useToolStore` integration for `selectedSessionId`; new optional props `selectedSessionId`/`onCloseSession`
- `stores/tool-store.ts` — Extended with `selectedSessionId` and `setSelectedSessionId` state
- `app/(tool-shell)/[tool]/sessions/page.tsx` — Fully populated: stats bar, filter bar, table, loading spinner, ingest-unreachable error state with retry button
- `app/(shell)/sessions/page.tsx` — Updated for new `SessionsStatsBar` (totalCount prop) and `SessionsDetailRail` (sessionId prop) signatures
- `components/dashboard/overview-tab.tsx` — Updated `SessionsDetailRail` prop from `session` to `sessionId`

## Decisions Made

- Data hooks use vanilla React (`useState` + `useEffect` + `useCallback`) — no external SWR/react-query dependency for Phase 4 3-tool scope (per plan guidance)
- `fetchToolApi` centralizes all BFF proxy calls with `URLSearchParams` encoding and consistent error handling — no ad-hoc `fetch()` calls in components
- `useToolSessions` uses `JSON.stringify(query)` in `useCallback` deps — intentionally triggers refetch on any filter change
- `useSessionDetail` returns null when `sessionId` is null (no-op) — clean pattern for unselected state
- `useAggregateSessions` silently excludes failed tool fetches (empty array fallback) — partial data is better than no data
- Dynamic column grid: `grid-template-columns` built from `SessionColumnDef.width` entries per tool profile — 4 cols for OpenClaw, 5 cols for Claude Code/Codex
- Status badges map `TraceSession.status` (active/idle/aborted/error/unknown) using `STATUS_CONFIG` — no client-side time-based heuristic (per T-04-14, ingest owns status)
- Session selection flows through Zustand `useToolStore` for cross-component access — `ShellFrame` reads `selectedSessionId`, pages write it via `setSelectedSessionId`
- Old `(shell)` route group pages minimally adapted for new component signatures — coexists with new `(tool-shell)` route group

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated old (shell) route group pages for new component signatures**

- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** Rewriting shared components (`sessions-filter-bar.tsx`, `sessions-stats-bar.tsx`, `sessions-detail-rail.tsx`) broke the old `(shell)` route group pages that still import them. The old `app/(shell)/sessions/page.tsx` used the removed `useSessionsFilter` hook, the removed `setFilters` prop, the removed `availableKinds` prop, and the old `session` prop on `SessionsDetailRail`. `components/dashboard/overview-tab.tsx` also used the old `session` prop.
- **Fix:** Updated `app/(shell)/sessions/page.tsx` to remove `useSessionsFilter` import, pass `totalCount` to `SessionsStatsBar`, pass `sessionId` instead of `session` to `SessionsDetailRail`, and replace the Gateway-specific filter bar with a simpler model/kinds summary. Updated `overview-tab.tsx` to pass `sessionId` (derived from `peekSession.sessionId || peekSession.key`) instead of `session` object.
- **Files modified:** `app/(shell)/sessions/page.tsx`, `components/dashboard/overview-tab.tsx`
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** `d780d99` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed duplicate `rightRailOpen` declaration in shell-frame.tsx**

- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** When adding `useToolStore` integration to `shell-frame.tsx`, the edit accidentally left a duplicate `const rightRailOpen = useUIStore(...)` declaration, causing TS2451 "Cannot redeclare block-scoped variable".
- **Fix:** Removed the duplicate declaration on line 30
- **Files modified:** `components/shell/shell-frame.tsx`
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** `d780d99` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 - Blocking, 1 Rule 1 - Bug)
**Impact on plan:** Both auto-fixes necessary for compilation correctness. The old route group adaptation was a natural consequence of shared component evolution — the plan's coexistence strategy (old + new route groups) required these updates. No scope creep.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Message history placeholder | `components/sessions/sessions-detail-rail.tsx` | 194 | Turn replay UI built in Phase 5; detail rail shows session metadata but message content is deferred |
| Session icon placeholder | `components/sessions/sessions-detail-rail.tsx` | 136 | Visual placeholder using ◉ character until per-tool agent avatar system is built (Phase 6+) |

All stubs are intentional per the phase boundary — turn replay belongs to Phase 5, and agent avatars are deferred to Phase 6+.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-04-12 mitigated | `lib/agent-tools/client-hooks.tsx` | `fetchToolApi()` uses `new URLSearchParams(query)` for query encoding — filter values are URL-encoded before reaching the BFF proxy; ingest API already validates sort/limit/offset |
| T-04-13 accepted | `components/sessions/sessions-detail-rail.tsx` | Session IDs and metadata visible in client; acceptable for local-only dev tool; path hardening in Phase 6 |
| T-04-14 accepted | `components/sessions/session-explorer-table.tsx` | Status read from `TraceSession.status` (ingest database), not client-computed time-based heuristic; source of truth is the ingest service |

No new threat surface beyond plan's threat model. All plan-specified mitigations applied. No additional threat flags.

## Verification Results

### Task acceptance criteria

**Task 1:**
- `useToolSessions(toolId, query)` returns `{ sessions, pagination, loading, error, refetch }` — PASS
- `useSessionDetail(toolId, sessionId)` returns `{ session, loading, error }` — PASS
- `useAggregateSessions(query)` merges sessions from all 3 tools sorted by recency — PASS
- `useSourceStatus(toolId)` returns `'connected' | 'error' | 'loading'` — PASS
- All hooks call `/api/agent-tools/[tool]/...` (BFF proxy), never ingest directly — PASS
- TypeScript compiles cleanly — PASS

**Task 2:**
- `SessionExplorerTable` renders sessions with per-tool column definitions from AgentToolUIProfile — PASS
- Status badges match UI-SPEC: LIVE (green pulse), IDL (gray), ABT (red), ERR (red) — PASS
- `SessionsFilterBar` emits query params consumed by `useToolSessions` — PASS
- `SessionsDetailRail` fetches session detail via `useSessionDetail` (BFF proxy, not Gateway) — PASS
- `RightRail` shows session list + detail panel with open/close behavior — PASS
- Empty states and error states match UI-SPEC copywriting contract — PASS
- All data flows through BFF proxy, never direct ingest or Gateway calls — PASS
- TypeScript compiles cleanly — PASS

### Plan-level verification
- `npx tsc --noEmit` — PASS (no errors)
- Session Explorer lists sessions from ingest API filtered by current tool source — PASS (useToolSessions uses BFF proxy, filter bar sends ingest params)
- Table columns adapt per tool profile — PASS (OpenClaw: 4 base columns; Claude/Codex: 5 columns with Project)
- Filter bar with status chips, model filter, search input — PASS (SessionFilters type forwarded to ingest)
- Stats bar shows total sessions, active count, total tokens, estimated cost — PASS (4 KPI tiles with totalCount prop)
- Right rail shows session detail on row click — PASS (via useToolStore.selectedSessionId)
- Empty states and error states match UI-SPEC HUD copywriting — PASS (NO SESSIONS, INGEST UNREACHABLE, spinner-only loading)
- Session Explorer works across all 3 tools via shared components + profile injection — PASS (dynamic columns from definition.ui.sessionColumns)

### Success criteria
1. Session Explorer lists sessions from ingest API filtered by current tool source — PASS
2. Table columns adapt per tool profile (OpenClaw: 4 base columns; Claude/Codex: 5 columns with Project) — PASS
3. Filter bar with status chips, model filter, search input — all fed to ingest query params — PASS
4. Stats bar shows total sessions, active count, total tokens, estimated cost — PASS
5. Right rail shows session detail on row click with label, status badge, KPI strip — PASS
6. Empty states and error states match UI-SPEC HUD copywriting — PASS
7. Session Explorer works identically across all 3 tools via shared components + profile injection — PASS

## Issues Encountered

None — implementation proceeded as planned. The old route group page updates were expected downstream consequences of shared component evolution and were handled as deviation fixes.

## User Setup Required

None — no external service configuration required. The Session Explorer uses the existing BFF proxy routes (`/api/agent-tools/[tool]/...`) which connect to the ingest service at `localhost:8078` (already configured in Plan 04-02).

## Next Phase Readiness

- Session Explorer data layer complete — `useToolSessions`, `useSessionDetail`, `useAggregateSessions`, `useSourceStatus` hooks available for Plan 04-05 (Aggregate Landing) and Phase 5 (Turn Replay)
- Session Explorer table component ready for reuse in Plan 04-05 aggregate landing page (`sourceBadge` prop already supported)
- Right rail session detail panel functional — session metadata + KPI strip displaying; message history ready for Phase 5 turn replay UI integration
- Filter bar, stats bar, and all shared session components ready for Plan 04-05
- Ready for Wave 5 (Plan 04-05): Dashboard pages + aggregate landing page

---

*Phase: 04-multi-source-frontend-shell-session-explorer*
*Completed: 2026-05-06*
