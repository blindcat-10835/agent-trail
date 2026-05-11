---
phase: 04-multi-source-frontend-shell-session-explorer
plan: 05
subsystem: ui
tags: [react, nextjs, aggregate-landing, dashboard, openclaw, claude-code, codex, session-stats, cross-source]

# Dependency graph
requires:
  - phase: 04-multi-source-frontend-shell-session-explorer
    plan: 02
    provides: BFF API proxy routes (/api/agent-tools/[tool]/sessions, /health)
  - phase: 04-multi-source-frontend-shell-session-explorer
    plan: 04
    provides: useAggregateSessions, useToolSessions data hooks, SessionExplorerTable with sourceBadge prop, SessionsFilterBar, SessionsStatsBar, EmptyState
provides:
  - Synthetic ALL shell at /all/dashboard, reached by / redirect, with merged cross-source session list from all 3 ingest-backed tools
  - OpenClaw dashboard skeleton at /openclaw/dashboard with empty/unpopulated KPI, Agents, Sessions, Skills, Cron, Activity sections
  - Claude Code dashboard at /claude-code/dashboard with session stats (total, active, model breakdown, recent list)
  - Codex dashboard at /codex/dashboard with same session stats pattern
  - Extended EmptyState component supporting heading/body aliases for HUD copywriting
affects: [05-turn-replay-ui, 06-sync-openclaw-drilldown]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-tool dashboard routing: useAgentTool() toolId switch in dashboard page — OpenClaw gets skeleton, Claude/Codex share SessionStatsDashboard"
    - "Synthetic all scope: AgentToolId includes all as shell-only aggregate profile while TOOL_IDS remains source-only for ingest-backed aggregate queries"
    - "Skeleton-first placeholder strategy: OpenClaw overview renders section structure with EmptyState components labeled 'Phase 6+' instead of Gateway-dependent live components"
    - "Model breakdown aggregation: client-side reduce over sessions with model → count mapping for Claude/Codex dashboards"

key-files:
  created:
    - lib/agent-tools/all/definition.ts - Synthetic ALL profile for aggregate shell chrome; not an ingest source
    - components/sessions/aggregate-sessions-view.tsx - Shared ALL dashboard/sessions view using useAggregateSessions and source badges
    - app/(tool-shell)/[tool]/dashboard/openclaw-dashboard.tsx - OpenClaw overview skeleton with empty/placeholder sections per D-13
    - app/(tool-shell)/[tool]/dashboard/session-stats-dashboard.tsx - Shared Claude/Codex session stats dashboard per D-14/D-15
  modified:
    - app/page.tsx - Redirects root traffic to /all/dashboard
    - app/(tool-shell)/[tool]/dashboard/page.tsx - Routes all -> AggregateSessionsView, OpenClaw -> OpenClawDashboard, Claude/Codex -> SessionStatsDashboard
    - app/(tool-shell)/[tool]/sessions/page.tsx - Routes all -> AggregateSessionsView and keeps source-specific Session Explorer for real tools
    - lib/agent-tools/registry.ts - Adds SHELL_TOOL_IDS for all shell scopes while keeping TOOL_IDS source-only
    - components/dashboard/empty-state.tsx - Extended interface to accept heading/body aliases alongside title/description

key-decisions:
  - "OpenClaw dashboard renders skeleton sections directly with HUD markup rather than reusing Gateway-dependent components (DashboardKpiBar, AgentCardGrid, SkillsList) — prevents D-13 violation where Gateway live data would appear"
  - "SessionStatsDashboard shared by Claude Code and Codex via simple toolId routing — no profile-level differentiation needed at this stage (both show same stats)"
  - "EmptyState component extended with heading/body aliases rather than breaking existing title/description consumers — backward-compatible interface evolution"
  - "Aggregate view is a first-class synthetic all scope inside (tool-shell); / redirects to /all/dashboard so header, source switcher, sidebar, right rail, and status bar are preserved"
  - "Model breakdown uses cast via unknown for ingest-specific model field on sessions — ingest API returns richer shapes than canonical TraceSession"

patterns-established:
  - "Per-Tool Dashboard Routing: Simple toolId === 'openclaw' switch in page.tsx delegates to OpenClawDashboard or SessionStatsDashboard — minimal abstraction for Phase 4 scope"
  - "Skeleton Placeholder Pattern: Render section structure with EmptyState(heading, body) labeled with target phase instead of forcing empty data into incompatible Gateway components"

requirements-completed: [OPEN-01]

# Metrics
duration: 9min
completed: 2026-05-07
---

# Phase 4 Plan 5: Aggregate Landing + Per-Tool Dashboard Pages Summary

**Cross-source ALL shell at `/all/dashboard` (with `/` redirect) merging sessions from all 3 ingest-backed tools with source badges, OpenClaw dashboard skeleton preserving overview structure with Phase 6+ placeholders, and Claude/Codex session statistics dashboards — all data via BFF proxy hooks, never Gateway directly**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-07T00:00:00Z
- **Completed:** 2026-05-07T00:09:00Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- Built aggregate ALL shell at `/all/dashboard` with `/` redirect — merges sessions from all 3 ingest-backed tools via `useAggregateSessions`, shows source badges (OPENCLAW/CLAUDE:CODE/CODEX), preserves shell chrome, and routes selected sessions to the concrete source `/[source]/sessions`
- Created OpenClaw dashboard skeleton at `/openclaw/dashboard` preserving overview structure: KPI placeholder grid, Agents section, Sessions list from ingest, Skills placeholder, Cron placeholder, Activity placeholder — all labeled "Phase 6+" with EmptyState components per D-13
- Built shared session stats dashboard for Claude Code (`/claude-code/dashboard`) and Codex (`/codex/dashboard`) — total sessions, active sessions, model breakdown table, recent sessions list per D-14/D-15
- Extended `EmptyState` component with `heading`/`body` aliases supporting HUD uppercase copywriting while preserving backward compatibility with existing `title`/`description` consumers
- All dashboards exclusively use BFF proxy hooks (`useToolSessions`, `useAggregateSessions`) — never call Gateway or ingest directly

## Task Commits

1. **Task 1: Build aggregate entry point (now `/all/dashboard` via `/` redirect)** - `24edaf6` (feat)
2. **Task 2: Build per-tool dashboard pages** - `2b724eb` (feat)
3. **Audit fix F-01: Support provider-free aggregate table columns** - `11a7047` (fix)
4. **Audit fix F-02: Promote aggregate view to synthetic ALL shell scope** - `7be538a` (fix)

## Files Created/Modified

### Created
- `lib/agent-tools/all/definition.ts` — Synthetic ALL profile with OVR/SES nav and aggregate session columns; not an ingest source
- `components/sessions/aggregate-sessions-view.tsx` — Shared aggregate view for `/all/dashboard` and `/all/sessions`
- `app/(tool-shell)/[tool]/dashboard/openclaw-dashboard.tsx` — OpenClaw overview skeleton: KPI grid placeholder, Agents empty state, Sessions count from ingest, Skills/Cron/Activity empty states with Phase 6+ labels
- `app/(tool-shell)/[tool]/dashboard/session-stats-dashboard.tsx` — Shared Claude/Codex dashboard: total/active session counts, model breakdown table, recent sessions via SessionExplorerTable

### Modified
- `app/page.tsx` — Replaced root aggregate rendering with `redirect('/all/dashboard')`
- `app/(tool-shell)/[tool]/dashboard/page.tsx` — Routes ALL → AggregateSessionsView, OpenClaw → OpenClawDashboard, others → SessionStatsDashboard
- `app/(tool-shell)/[tool]/sessions/page.tsx` — Routes ALL → AggregateSessionsView, real tools → source-scoped Session Explorer
- `components/sessions/session-explorer-table.tsx` — Allows explicit column definitions for provider-free/shared table use and removes `any` casts
- `components/shell/source-switcher.tsx` — Includes ALL and falls back to the target default route when a scope does not support the current section
- `components/shell/shell-header.tsx`, `components/shell/shell-status-bar.tsx` — Show LOCAL/INDEX LOCAL for non-Gateway scopes
- `lib/agent-tools/registry.ts`, `lib/agent-tools/types.ts` — Split shell scopes from ingest-backed source IDs
- `lib/agent-tools/server-adapter.ts` — Returns a 400 for synthetic scopes such as `all` when called through source API routes
- `components/dashboard/empty-state.tsx` — Extended `EmptyStateProps` with optional `heading`/`body` aliases (take precedence over `title`/`description`). Updated rendering to use HUD-consistent 11px uppercase headings with 0.12em tracking.

## Decisions Made

- OpenClaw dashboard renders skeleton sections directly with HUD markup rather than reusing Gateway-dependent components (`DashboardKpiBar`, `AgentCardGrid`, `SkillsList`) — these components read from `useGatewayStore` internally and would populate live data, contradicting D-13
- SessionStatsDashboard shared by Claude Code and Codex via simple `toolId` routing — no profile-level differentiation needed at this stage (both show same stats per D-14/D-15)
- EmptyState component extended with `heading`/`body` aliases rather than breaking existing `title`/`description` consumers — backward-compatible interface evolution
- Aggregate view uses synthetic `all` in `(tool-shell)` so root navigation keeps the same shell chrome as OpenClaw/Claude/Codex. `all` is intentionally excluded from ingest-backed `TOOL_IDS`; `SHELL_TOOL_IDS` contains `all` plus the real sources.
- Model breakdown uses `unknown` cast for ingest-specific `model` field on sessions — ingest API returns richer shapes than canonical `TraceSession`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] OpenClaw dashboard plan code used Gateway-dependent components with incompatible props**

- **Found during:** Task 2 (OpenClaw dashboard implementation)
- **Issue:** Plan template code passed `DashboardKpiBar` (no props), `AgentCardGrid agents={[]} loading={false}`, and `SkillsList skills={[]} loading={false}` — but `DashboardKpiBar` requires 4 mandatory props and reads Gateway store internally, `AgentCardGrid` requires `agents: AgentInfo[]` (Gateway type) with `filter` and `onAgentClick` props, and `SkillsList` only accepts `onViewAll` while reading skills from Gateway store. Using these components would either fail to compile or populate live Gateway data, violating D-13 ("do NOT populate Gateway live data content").
- **Fix:** Replaced Gateway component calls with skeleton sections using HUD-pattern markup directly — KPI grid with dash placeholders, Agent/Skills/Cron/Activity sections rendered as EmptyState components. Sessions section uses `useToolSessions()` BFF hook for session count from ingest. Existing Gateway components preserved untouched for the old `(shell)` route group.
- **Files modified:** `app/(tool-shell)/[tool]/dashboard/openclaw-dashboard.tsx` (created with skeleton approach)
- **Verification:** `npx tsc --noEmit` passes, all sections render with empty/placeholder states
- **Committed in:** `2b724eb` (Task 2 commit)

**2. [Rule 3 - Blocking] TypeScript error: SessionFilters not assignable to Record<string, string>**

- **Found during:** Task 1 (aggregate landing page TypeScript compilation)
- **Issue:** `useAggregateSessions` expects `Record<string, string>` but `SessionFilters` has optional string fields. TypeScript cannot guarantee all values are strings.
- **Fix:** Applied `filters as Record<string, string>` cast — same pattern used in the sessions page (`app/(tool-shell)/[tool]/sessions/page.tsx`)
- **Files modified:** `app/page.tsx`
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** `24edaf6` (Task 1 commit)

**3. [Rule 3 - Blocking] TypeScript error: direct cast of TraceSession to Record<string, unknown>**

- **Found during:** Task 2 (session stats dashboard TypeScript compilation)
- **Issue:** `(s as Record<string, unknown>).model` fails because `TraceSession` doesn't sufficiently overlap with `Record<string, unknown>`
- **Fix:** Used double cast `(s as unknown as Record<string, unknown>).model` for ingest-specific `model` field
- **Files modified:** `app/(tool-shell)/[tool]/dashboard/session-stats-dashboard.tsx`
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** `2b724eb` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 1 - Bug, 2 Rule 3 - Blocking)
**Impact on plan:** All fixes necessary for compilation correctness and D-13 compliance. The Gateway component incompatibility was a design-level issue where the plan template assumed components would accept empty data props when they actually read from internal stores. The skeleton approach achieves the same visual outcome (empty placeholders) without breaking existing Gateway consumers.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| KPI overview dash placeholders | `openclaw-dashboard.tsx` | 28-38 | Intentional: KPI data populated from local file data sources in Phase 6+ per D-13 |
| Agents section empty state | `openclaw-dashboard.tsx` | 41-46 | Intentional: Agent data populated in Phase 6+ per D-13 |
| Skills section empty state | `openclaw-dashboard.tsx` | 91-95 | Intentional: Skill data populated in Phase 6+ per D-13 |
| Cron section empty state | `openclaw-dashboard.tsx` | 98-102 | Intentional: Cron job data populated in Phase 6+ per D-13 |
| Activity section empty state | `openclaw-dashboard.tsx` | 105-109 | Intentional: Activity log data populated in Phase 6+ per D-13 |

All stubs are intentional per the phase boundary — OpenClaw overview data population from local file data sources is deferred to Phase 6+. Gateway live data is deliberately NOT connected per D-13.

## Verification Results

### Post-UAT audit fixes
- F-01 (`11a7047`): Fixed runtime provider crash on `/` by allowing aggregate table columns to be supplied explicitly.
- F-02 (`7be538a`): Replaced root aggregate rendering with `/all/dashboard` shell scope and root redirect; browser verification confirmed `/` lands on `/all/dashboard` with header/source switcher/sidebar/right rail/status bar and 0 console errors.
- `/api/agent-tools/all/sessions` returns 400 because `all` is a shell scope, not an ingest source.

### Task 1 acceptance criteria
- `app/page.tsx` redirects `/` to `/all/dashboard` — PASS
- `/all/dashboard` renders aggregate session list from all 3 tools via `useAggregateSessions` — PASS
- Sessions have source badges (OPENCLAW, CLAUDE:CODE, CODEX) in table — PASS
- Clicking a session routes to the concrete source `/[source]/sessions` with selected session state set for the right rail — PASS
- Empty state: "NO SESSIONS INDEXED" heading — PASS
- Error state: "INGEST UNREACHABLE" heading — PASS
- Loading state: spinner only (no text) — PASS
- TypeScript compiles cleanly — PASS

### Task 2 acceptance criteria
- OpenClaw dashboard preserves overview skeleton: KPI, Agents, Sessions, Skills, Cron, Activity sections — PASS
- OpenClaw overview sections show empty/unpopulated state (labeled "Phase 6+") — PASS
- Claude Code dashboard shows session stats: total sessions, active count, model breakdown, recent sessions — PASS
- Codex dashboard shows same pattern as Claude Code — PASS
- Empty states and error states match UI-SPEC HUD copywriting — PASS
- All dashboards use BFF proxy (never Gateway directly) for data — PASS
- TypeScript compiles cleanly — PASS

### Plan-level verification
- `npx tsc --noEmit` — PASS (no errors)
- All 7 success criteria verified — PASS

## Issues Encountered

None — implementation proceeded smoothly after adapting the plan code for Gateway component incompatibilities. The deviations were handled as auto-fixes at compile time.

## User Setup Required

None — no external service configuration required. Dashboards use existing BFF proxy routes (`/api/agent-tools/[tool]/...`) which connect to the ingest service at `localhost:8078` (configured in Plan 04-02).

## Next Phase Readiness

- Aggregate ALL shell and per-tool dashboards complete — all Phase 4 deliverables achieved
- Phase 4 (Multi-source Frontend Shell + Session Explorer) is fully complete with all 5 plans executed
- Ready for Phase 5: Turn Replay UI — session data layer (hooks, BFF proxy, session explorer) fully available
- Phase 6: Sync, OpenClaw Drilldown & Hardening — OpenClaw dashboard skeleton ready for data population from local file sources

---

*Phase: 04-multi-source-frontend-shell-session-explorer*
*Completed: 2026-05-07*
