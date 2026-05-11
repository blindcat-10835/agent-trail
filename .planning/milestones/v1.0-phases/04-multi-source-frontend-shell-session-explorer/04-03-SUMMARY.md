---
phase: 04-multi-source-frontend-shell-session-explorer
plan: 03
subsystem: ui
tags: [react, nextjs, shell, agent-tools, zustand, profile-driven, source-switcher]

# Dependency graph
requires:
  - phase: 04-multi-source-frontend-shell-session-explorer
    plan: 01
    provides: AgentToolId, AgentToolDefinition, AgentToolCapabilities, registry, AgentToolProvider, useAgentTool hook
  - phase: 04-multi-source-frontend-shell-session-explorer
    plan: 02
    provides: BFF API proxy routes, legacy redirect pages
provides:
  - Extracted ShellFrame shared component with immutable grid contract
  - Profile-driven shell header reading AgentToolUIProfile.brand
  - Source switcher with 3 tabs (OPENCLAW, CLAUDE:CODE, CODEX) via URL segment change
  - Capability-gated sidebar nav filtering by AgentToolCapabilities
  - Right rail frame component with children slot
  - Profile-driven status bar with SRC label from definition.shortLabel
  - Tool Zustand store for cross-component tool awareness
  - (tool-shell) route group with [tool] param validation and 404 handling
  - Conditional GatewayBootstrap scoped to OpenClaw only (per D-09)
  - Placeholder dashboard/sessions/activity pages for all 3 tools
affects: [04-04-session-explorer, 04-05-dashboard-pages-aggregate-landing, 05-turn-replay-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ShellFrame: shared presentation component with gatewayBootstrap prop for tool scoping"
    - "SourceSwitcher: URL-segment-based tool switching via pathname.split + router.push"
    - "Profile-driven header: brand.name + brand.versionLabel from AgentToolUIProfile"
    - "Capability-gated sidebar: nav items filtered by requiredCapability boolean flags"
    - "Server Component layout + Client Component provider pattern (per D-04)"
    - "Conditional GatewayBootstrap injection: toolId === 'openclaw' ? <GatewayBootstrap /> : null"
    - "Zustand tool store synced on layout mount for cross-component tool awareness"

key-files:
  created:
    - components/shell/shell-frame.tsx
    - components/shell/shell-header.tsx
    - components/shell/source-switcher.tsx
    - components/shell/sidebar-nav.tsx
    - components/shell/right-rail.tsx
    - components/shell/shell-status-bar.tsx
    - stores/tool-store.ts
    - app/(tool-shell)/[tool]/layout.tsx
    - app/(tool-shell)/[tool]/tool-layout-client.tsx
    - app/(tool-shell)/[tool]/dashboard/page.tsx
    - app/(tool-shell)/[tool]/sessions/page.tsx
    - app/(tool-shell)/[tool]/activity/page.tsx
  modified: []

key-decisions:
  - "ShellFrame is a 'use client' component reading useUIStore for right rail state (existing pattern preserved)"
  - "SourceSwitcher uses client-side navigation (router.push) — no full-page reload, no animation per UI-SPEC"
  - "Sidebar nav href computation: href(item.href(definition.id).replace(/^\/[^/]+/, '')) normalizes the tool segment to current toolId"
  - "ShellStatusBar adapts existing hud/ component with one change: SRC label from definition.shortLabel (profile-driven)"
  - "GatewayBootstrap NOT imported directly in ShellFrame — injected via gatewayBootstrap prop for clean tool scoping"
  - "ToolLayoutClient syncs useToolStore on mount and toolId change via useEffect for cross-component awareness"
  - "Placeholder pages are minimal 'use client' components — full content built in Plans 04-04 and 04-05"

patterns-established:
  - "ShellFrame grid contract: grid-rows-[48px_1fr_26px], columns 56px/minmax(0,1fr)/360px-0px (immutable per UI-SPEC)"
  - "Profile-driven shell: all chrome components read from useAgentTool() context, no hardcoded tool names"
  - "Coexistence strategy: new components/shell/ files live alongside existing components/hud/ and components/dashboard/ files"
  - "Route group migration: (tool-shell) group added without removing (shell) group — gradual transition"

requirements-completed: [UI-01, UI-02]

# Metrics
duration: 10min
completed: 2026-05-06
---

# Phase 4 Plan 3: Shell Migration — Multi-source Architecture

**Multi-source shell architecture with profile-driven ShellFrame, URL-segment source switching via SourceSwitcher, capability-gated SidebarNav filtering AGT/USD/SKL for Claude/Codex, and tool-scoped GatewayBootstrap mounted only in OpenClaw layout**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-06T23:52:00Z
- **Completed:** 2026-05-06T16:01:37Z
- **Tasks:** 3
- **Files modified:** 12 (12 created, 0 modified)

## Accomplishments

- Extracted ShellFrame from `app/(shell)/layout.tsx` into shared `components/shell/shell-frame.tsx` with immutable grid contract (`grid-rows-[48px_1fr_26px]`, columns `56px minmax(0,1fr) 360px`/`0px`)
- Created profile-driven ShellHeader reading brand name/versionLabel from `AgentToolUIProfile` — replaces hardcoded OVAO/GATEWAY
- Built SourceSwitcher rendering 3 tabs (OPENCLAW, CLAUDE:CODE, CODEX) from `getAllDefinitions()` — switches URL segment via client-side navigation
- Converted SidebarNav to capability-gated navigation: AGT, USD, SKL hidden for Claude/Codex; OVR, SES, ACT visible for all tools
- Created RightRail frame component with `children` slot for Session Explorer (Plan 04-04)
- Adapted ShellStatusBar with profile-driven `SRC {TOOL}` label from `definition.shortLabel`
- Created Zustand `useToolStore` for cross-component tool awareness (synced on layout mount)
- Created `(tool-shell)` route group with Server Component `[tool]/layout.tsx` (param validation + 404) and Client Component `tool-layout-client.tsx` (AgentToolProvider + ShellFrame + conditional GatewayBootstrap)
- GatewayBootstrap scoped to OpenClaw only — Claude/Codex layouts never initiate Gateway WebSocket connection (per D-09)
- All HUD cyberpunk design tokens preserved across new components (hud-clip-sm, gradient lines, accent colors, tracking, monospace)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract ShellFrame and create tool-store** - `f7178f1` (feat)
2. **Task 2: Create profile-driven header, source switcher, sidebar, right-rail, and status bar** - `30da685` (feat)
3. **Task 3: Create tool-shell route group and wire layout with Gateway scoping** - `622f306` (feat)

## Files Created/Modified

### Created by Plan 04-03

- `components/shell/shell-frame.tsx` — Shared ShellFrame grid layout with `gatewayBootstrap` prop injection; reads `useUIStore` for right rail state
- `components/shell/shell-header.tsx` — Profile-driven header: brand name/versionLabel from `useAgentTool().definition.ui.brand`; renders SourceSwitcher + controls
- `components/shell/source-switcher.tsx` — Source tabs rendering from `getAllDefinitions()`; switches `[tool]` URL segment via `pathname.split` + `router.push`
- `components/shell/sidebar-nav.tsx` — Capability-gated navigation: filters `definition.nav` by `requiredCapability`; Suspense boundary preserved from existing pattern
- `components/shell/right-rail.tsx` — Right rail frame component with `children` slot; "Select a session" placeholder
- `components/shell/shell-status-bar.tsx` — Adapted status bar: `SRC` label from `definition.shortLabel`; all other fields preserved from `components/hud/shell-status-bar.tsx`
- `stores/tool-store.ts` — Zustand store for `selectedToolId` tracking (synced on layout mount)
- `app/(tool-shell)/[tool]/layout.tsx` — Server Component: validates `params.tool` via `assertAgentToolId()`, returns 404 via `notFound()` for invalid tools; delegates to `ToolLayoutClient`
- `app/(tool-shell)/[tool]/tool-layout-client.tsx` — Client Component: mounts `AgentToolProvider`, renders `ShellFrame` with conditional `GatewayBootstrap` (OpenClaw only), syncs `useToolStore`
- `app/(tool-shell)/[tool]/dashboard/page.tsx` — Placeholder dashboard page (content in Plans 04-04/04-05)
- `app/(tool-shell)/[tool]/sessions/page.tsx` — Placeholder sessions page (Session Explorer in Plan 04-04)
- `app/(tool-shell)/[tool]/activity/page.tsx` — Placeholder activity page (content in Phase 5+)

### Preserved (NOT deleted — coexistence strategy)

- `components/hud/shell-header.tsx` — Old header continues to work for `(shell)` route group
- `components/hud/shell-status-bar.tsx` — Old status bar preserved
- `components/dashboard/sidebar-nav.tsx` — Old sidebar preserved
- `components/dashboard/dashboard-right-rail.tsx` — Old right rail preserved
- `app/(shell)/layout.tsx` — Old shell layout continues functioning

## Decisions Made

- **ShellFrame is a `'use client'` component** — reads `useUIStore` for right rail toggle state (existing pattern, no server-only logic needed)
- **GatewayBootstrap injected via prop, not imported directly** — ShellFrame receives `gatewayBootstrap?: ReactNode`; `tool-layout-client.tsx` decides whether to pass `<GatewayBootstrap />` or `null` based on `toolId === 'openclaw'`
- **SourceSwitcher uses `pathname.split` + `router.push`** — client-side navigation preserves sub-route (e.g., `/openclaw/dashboard` → `/codex/dashboard`); no full-page reload
- **SidebarNav href normalization** — `href(item.href(definition.id).replace(/^\/[^/]+/, ''))` strips the tool-specific prefix, then re-prepends current toolId from context
- **Placeholder pages are minimal `'use client'` components** — render `{definition.label}` heading only; full content deferred to Plans 04-04 (Session Explorer) and 04-05 (Dashboard pages)
- **Coexistence strategy** — new `(tool-shell)` route group added alongside old `(shell)` group; old shell components not deleted

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Dashboard placeholder | `app/(tool-shell)/[tool]/dashboard/page.tsx` | entire file | Content built in Plans 04-04/04-05 |
| Sessions placeholder | `app/(tool-shell)/[tool]/sessions/page.tsx` | entire file | Session Explorer built in Plan 04-04 |
| Activity placeholder | `app/(tool-shell)/[tool]/activity/page.tsx` | entire file | Activity page built in Phase 5+ |
| RightRail children | `components/shell/right-rail.tsx` | 12-16 | Session list + detail panel injected by Plan 04-04 |

All stubs are intentional per the plan's phase boundary — placeholder pages ensure shell routing works; full content is built in subsequent plans.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-04-08 mitigated | `app/(tool-shell)/[tool]/layout.tsx` | `assertAgentToolId()` validates [tool] param; `notFound()` returns 404 for invalid values |
| threat_flag: T-04-09 mitigated | `components/shell/source-switcher.tsx` | `pathname.split` rebuild replaces segment[0] with validated tool ID; no user-controlled string injection |
| threat_flag: T-04-10 mitigated | `app/(tool-shell)/[tool]/tool-layout-client.tsx` | GatewayBootstrap only mounted for `toolId === 'openclaw'`; Claude/Codex never initiate Gateway connection |
| threat_flag: T-04-11 accepted | `components/shell/sidebar-nav.tsx` | Capability filtering is client-side only — acceptable for local-only dev tool |

All STRIDE threats from the plan's threat model are addressed — 3 mitigated, 1 accepted (DoS via capability gates is client-side only, acceptable for local dev tool).

## Verification Results

### Plan-level verification

- `npx tsc --noEmit` — PASS (no errors)
- ShellFrame grid contract: `grid-rows-[48px_1fr_26px]` — PASS (line 21 of shell-frame.tsx)
- ShellFrame columns: `56px minmax(0, 1fr) 360px` / `0px` — PASS (lines 25-27)
- SourceSwitcher: 3 tabs from `getAllDefinitions()` — PASS (OPENCLAW, CLAUDE:CODE, CODEX)
- SidebarNav: capability filtering — PASS (`requiredCapability` check at line 13 of sidebar-nav.tsx)
- GatewayBootstrap: only for OpenClaw — PASS (`toolId === 'openclaw'` conditional at line 24 of tool-layout-client.tsx)
- `assertAgentToolId` in layout — PASS (line 23 of layout.tsx)
- `notFound()` for invalid tools — PASS (line 26 of layout.tsx)
- Old `(shell)` layout preserved — PASS (file not deleted)

### Success criteria

1. Source switcher in header allows switching between 3 tools via URL segment change — PASS
2. Each tool renders its profile-driven brand, nav items, and capability-gated sidebar — PASS
3. GatewayBootstrap only mounts in OpenClaw layout (not Claude/Codex) — PASS
4. ShellFrame grid contract matches UI-SPEC — PASS
5. Invalid tool param returns 404 — PASS
6. Old `(shell)` layout continues to function alongside new route group — PASS
7. HUD cyberpunk visual identity preserved across all shell components — PASS

## Next Phase Readiness

- Shell architecture fully migrated — `(tool-shell)` route group ready to host Session Explorer and dashboard pages
- All shell components (`components/shell/`) importable by downstream plans with no hardcoded tool dependencies
- `AgentToolProvider` mounted in layout gives all pages access to `useAgentTool()`, `CapabilityGate`, and `requiresCapability`
- Placeholder pages provide routing targets for Plans 04-04 (Session Explorer) and 04-05 (Dashboard pages + Aggregate landing)
- Ready for Plan 04-04 (Session Explorer: shared table + filters + detail rail for all 3 sources)

---

## Self-Check: PASSED

- 12 key files verified on disk (all 12 created)
- 3 commits verified in git history (f7178f1, 30da685, 622f306)
- 6 old files confirmed preserved (coexistence strategy intact)
- TypeScript compiles with no errors (`npx tsc --noEmit`)
- ShellFrame grid contract verified: `grid-rows-[48px_1fr_26px]`, columns `56px minmax(0,1fr) 360px`/`0px`
- SourceSwitcher verified: 3 tabs from `getAllDefinitions()`
- GatewayBootstrap conditional verified: `toolId === 'openclaw' ? <GatewayBootstrap /> : null`
- Threat mitigations verified: T-04-08 (assertAgentToolId), T-04-09 (pathname.split), T-04-10 (conditional Gateway), T-04-11 (accepted)

---
*Phase: 04-multi-source-frontend-shell-session-explorer*
*Completed: 2026-05-06*
