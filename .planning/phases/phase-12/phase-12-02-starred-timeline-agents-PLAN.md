---
wave: 2
depends_on: [phase-12-01]
files_modified:
  - components/overview/starred-sessions.tsx
  - components/overview/activity-timeline.tsx
  - components/overview/overview-agents.tsx
  - components/overview/overview-page.tsx
  - app/(tool-shell)/[tool]/dashboard/page.tsx
autonomous: true
---

# Phase 12 Plan 02: Starred, Timeline, Agents Modules

## Context

Wave 2 adds the remaining overview sections: starred sessions, activity timeline, and source-specific agents module. These depend on Wave 1 hooks being available. Covers OVR-101 (starred, timeline, agents modules), OVR-104 (capability-gated agents module), OVR-105 (states for these panels).

## Tasks

### Task 1: Create Starred Sessions component

<read_first>
  - components/dashboard/empty-state.tsx
  - components/ui/skeleton.tsx
  - components/ui/badge.tsx
  - types/overview.ts (StarredSession)
  - lib/agent-tools/client-hooks.tsx (useStarredSessions hook)
</read_first>

Create `components/overview/starred-sessions.tsx`:

```xml
<action file="components/overview/starred-sessions.tsx" verb="create">
'use client'

// Starred sessions list — compact rows
// Each row: session name (or "UNTITLED"), project, source badge, relative time
// Loading: 3 Skeleton rows
// Empty: "NO STARRED SESSIONS" EmptyState (not error — user may not have starred any)
// Source badge uses Badge component with muted variant
// Relative time: "2h ago", "3d ago" pattern
</action>
```

Implementation details:
- Compact list: session name (font-mono truncate), project label, source Badge, relative timestamp
- Session name fallback: "UNTITLED" if name is undefined
- Source Badge: small badge with source label (OPENCLAW / CLAUDE:CODE / CODEX)
- Relative time helper: convert ISO string to "Xm ago", "Xh ago", "Xd ago"
- Loading: 3 Skeleton rows matching row height
- Empty: `EmptyState` with heading="NO STARRED SESSIONS" body="STAR SESSIONS FROM THE SESSIONS VIEW TO PIN THEM HERE."
- Section heading: "STARRED SESSIONS" in ALL CAPS tracking pattern

<acceptance_criteria>
- Renders starred session rows with name, project, source, time
- Loading shows Skeleton rows
- Empty shows EmptyState
- Source badges rendered correctly
- Relative time formatting works
</acceptance_criteria>

### Task 2: Create Activity Timeline component

<read_first>
  - components/dashboard/empty-state.tsx
  - components/ui/skeleton.tsx
  - types/overview.ts (TimelineEvent, TimelineEventType)
  - lib/agent-tools/client-hooks.tsx (useTimeline hook)
  - components/hud/hud-panel.tsx
</read_first>

Create `components/overview/activity-timeline.tsx`:

```xml
<action file="components/overview/activity-timeline.tsx" verb="create">
'use client'

// Activity timeline — vertical event list with event type indicators
// Event types and their visual treatment:
//   session_started: green dot, "STARTED" label
//   session_completed: muted dot, "COMPLETED" label
//   session_error: red dot, "ERROR" label + error message
//   sync_error: red dot, "SYNC ERROR" label
// Each row: dot + event label + session/project name + relative time
// Loading: 5 Skeleton rows
// Empty: EmptyState "NO RECENT ACTIVITY"
</action>
```

Implementation details:
- Vertical list with left-aligned status dots (2px colored circle)
- Event type → color mapping:
  - `session_started`: accent color (chartreuse)
  - `session_completed`: muted-foreground
  - `session_error`: destructive
  - `sync_error`: destructive
- Each row: `[dot] EVENT_LABEL · session_name · project · relative_time`
- Event label in ALL CAPS tracking-sm
- Error events show `errorMessage` on second line in smaller text-destructive
- Session name: truncate with font-mono
- Loading: 5 Skeleton rows
- Empty: `EmptyState` with "NO RECENT ACTIVITY"
- Section heading: "ACTIVITY" in ALL CAPS tracking pattern

<acceptance_criteria>
- Renders timeline events with colored dots
- Event type determines dot color
- Error events show error message
- Loading/empty states render
- Relative time formatting
</acceptance_criteria>

### Task 3: Create Overview Agents module (OpenClaw-only)

<read_first>
  - components/dashboard/agent-card.tsx (existing agent card)
  - components/dashboard/agent-avatar.tsx
  - components/dashboard/empty-state.tsx
  - types/overview.ts (SourceCapabilitySet)
  - lib/agent-tools/client-hooks.tsx (useOverviewCapabilities, useToolAgents)
  - lib/agent-tools/capability-gate.tsx (existing CapabilityGate — but uses static defs)
</read_first>

Create `components/overview/overview-agents.tsx`:

```xml
<action file="components/overview/overview-agents.tsx" verb="create">
'use client'

// Source-specific agents module — only rendered when runtime capabilities say agents=true
// Uses existing AgentCard component for each agent
// Props: capabilities (SourceCapabilitySet | null), toolId (AgentToolId)
// If capabilities.agents === false → render null
// If toolId === 'all' → render null (agents endpoint requires specific source)
// Otherwise: render agent grid using useToolAgents(toolId)
// Loading: grid of 2 Skeleton cards
// Empty: "NO AGENTS" EmptyState
</action>
```

Implementation details:
- Check runtime capabilities: `capabilities?.agents === true` AND `toolId !== 'all'`
- If condition fails → return null (no render)
- If passes → call `useToolAgents(toolId)` and render agent cards
- Reuse existing `AgentCard` component for each agent
- Grid layout: `grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3` (same as openclaw-dashboard)
- Loading: 2 placeholder Skeleton cards
- Empty: `EmptyState` with "NO AGENTS"
- Section heading: "AGENTS" in ALL CAPS tracking pattern

<acceptance_criteria>
- Returns null when capabilities.agents is false or toolId is 'all'
- Renders AgentCard grid for OpenClaw
- Loading/empty states work
- Section hidden for claude-code/codex/all sources
</acceptance_criteria>

### Task 4: Create unified OverviewPage component

<read_first>
  - app/(tool-shell)/[tool]/dashboard/page.tsx (current state from Wave 1)
  - components/overview/kpi-hero.tsx
  - components/overview/time-window-selector.tsx
  - components/overview/top-models-table.tsx
  - components/overview/top-projects-table.tsx
  - components/overview/starred-sessions.tsx (just created)
  - components/overview/activity-timeline.tsx (just created)
  - components/overview/overview-agents.tsx (just created)
  - lib/agent-tools/client-hooks.tsx (all overview hooks)
</read_first>

Create `components/overview/overview-page.tsx` — the complete overview layout:

```xml
<action file="components/overview/overview-page.tsx" verb="create">
'use client'

// Complete Overview Page component
// Layout (top to bottom):
//   1. KPI Hero bar (full width)
//   2. Time Window Selector (right-aligned)
//   3. Two-column grid: Top Models | Top Projects
//   4. Starred Sessions (full width)
//   5. Two-column grid: Activity Timeline | Agents (if capabilities allow)
//
// State: TimeWindow (useState, default '7d')
// Data hooks: useOverviewAggregates, useTopModels, useTopProjects,
//             useStarredSessions, useTimeline, useOverviewCapabilities
// Error boundary: if aggregates fails → full-page error state
// Loading: initial spinner, then per-section skeletons
</action>
```

Implementation details:
- Single component that orchestrates all overview sections
- State: `const [window, setWindow] = useState<TimeWindow>('7d')`
- Data hooks called at top level:
  - `useOverviewAggregates(toolId, window)` — window-dependent
  - `useTopModels(toolId, window)` — window-dependent
  - `useTopProjects(toolId, window)` — window-dependent
  - `useStarredSessions(toolId)` — NOT window-dependent
  - `useTimeline(toolId)` — NOT window-dependent
  - `useOverviewCapabilities(toolId)` — NOT window-dependent
- Layout structure:
  ```
  <div className="p-4 space-y-6 min-h-0 overflow-y-auto">
    <KpiHero aggregates={aggregates} loading={aggregatesLoading} />
    <div className="flex justify-end">
      <TimeWindowSelector window={window} onChange={setWindow} />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <TopModelsTable models={models} loading={modelsLoading} />
      <TopProjectsTable projects={projects} loading={projectsLoading} />
    </div>
    <StarredSessions starred={starred} loading={starredLoading} />
    <div className="grid grid-cols-2 gap-4">
      <ActivityTimeline timeline={timeline} loading={timelineLoading} />
      <OverviewAgents capabilities={capabilities} toolId={toolId} />
    </div>
  </div>
  ```
- Error state: if aggregates fails with error → full page `EmptyState` "INGEST OFFLINE"
- Per-section error handling: individual sections show their own error/empty states

<acceptance_criteria>
- Complete overview renders all sections
- KPI hero at top, rankings below, starred, timeline, agents
- Time window selector updates KPI + rankings only
- Agents section hidden for non-OpenClaw sources
- Loading states per-section
- Full-page error if aggregates fails
- Build passes
</acceptance_criteria>

### Task 5: Update page.tsx to use OverviewPage

<read_first>
  - app/(tool-shell)/[tool]/dashboard/page.tsx
  - components/overview/overview-page.tsx
</read_first>

Simplify `page.tsx` to delegate entirely to `OverviewPage`:

```xml
<action file="app/(tool-shell)/[tool]/dashboard/page.tsx" verb="replace">
'use client'

// Single line: render OverviewPage for all tool IDs
// Remove old imports (AggregateSessionsView, OpenClawDashboard, SessionStatsDashboard)
// Replace with: import { OverviewPage } from '@/components/overview/overview-page'
// export default function ToolDashboardPage() { return <OverviewPage /> }
</action>
```

This replaces all three previous dashboard variants with the unified overview.

<acceptance_criteria>
- page.tsx is minimal — just renders OverviewPage
- Old dashboard components no longer imported
- All source routes (all, openclaw, claude-code, codex) show unified overview
- Build passes, `pnpm lint` clean
</acceptance_criteria>
