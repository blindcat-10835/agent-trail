---
wave: 1
depends_on: []
files_modified:
  - types/overview.ts
  - lib/agent-tools/client-hooks.tsx
  - components/overview/kpi-hero.tsx
  - components/overview/time-window-selector.tsx
  - components/overview/top-models-table.tsx
  - components/overview/top-projects-table.tsx
  - app/(tool-shell)/[tool]/dashboard/page.tsx
autonomous: true
---

# Phase 12 Plan 01: Data Layer + KPI Hero + Rankings

## Context

Wave 1 establishes the data fetching foundation and the core KPI/ranking panels that every source shows. This covers OVR-101 (KPI hero, top models, top projects), OVR-102 (source scoping), OVR-103 (token/cost toggle), and OVR-105 (loading/empty states for these panels).

## Tasks

### Task 1: Create overview response types

<read_first>
  - types/overview.ts (does not exist yet — create)
  - ingest/api/overview.ts (response shapes)
  - types/trace.ts (existing type patterns)
</read_first>

Create `types/overview.ts` with TypeScript interfaces matching all BFF overview endpoint response shapes:

```xml
<action file="types/overview.ts" verb="create">
export interface OverviewAggregates {
  sessionCount: number
  turnCount: number
  projectCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface ModelRanking {
  name: string
  sessionCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  sharePercent: number
  cost: number | null
}

export interface TopModelsResponse {
  models: ModelRanking[]
}

export interface ProjectRanking {
  project: string
  sessionCount: number
  turnCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  rankWeight: number
}

export interface TopProjectsResponse {
  projects: ProjectRanking[]
}

export interface StarredSession {
  id: string
  name?: string
  source: string
  project: string
  status: string
  startedAt: string | null
  updatedAt?: string
  starredAt: string
}

export interface StarredResponse {
  starred: StarredSession[]
}

export type TimelineEventType = 'session_started' | 'session_completed' | 'session_error' | 'sync_error'

export interface TimelineEvent {
  id: string
  source: string
  eventType: TimelineEventType
  eventTime: string | null
  project?: string
  name?: string
  status: string
  errorMessage?: string
}

export interface TimelineResponse {
  timeline: TimelineEvent[]
}

export interface SourceCapabilitySet {
  agents: boolean
  automations: boolean
  cost: boolean
  activity: boolean
  sessions: boolean
  replay: boolean
}

export interface CapabilitiesResponse {
  capabilities: Record<string, SourceCapabilitySet>
  sources: string[]
}

export interface OverviewStatus {
  ingest: { status: string; uptime: number; db: string }
  watcher: { status: string; filesWatched: number; lastSyncAt: string | null }
  gateway: { status: string }
}

export type TimeWindow = 'today' | '7d' | '30d'
</action>
```

<acceptance_criteria>
- types/overview.ts exists with all interfaces
- TypeScript compiles without errors
</acceptance_criteria>

### Task 2: Add overview data hooks to client-hooks

<read_first>
  - lib/agent-tools/client-hooks.tsx (existing hooks pattern)
  - types/overview.ts (just created)
</read_first>

Add these hooks to `lib/agent-tools/client-hooks.tsx`, following the existing `useState + useEffect + fetchToolApi` pattern:

```xml
<action file="lib/agent-tools/client-hooks.tsx" verb="append">
// Add imports for overview types at top

// New hooks (append before SSE section):

export function useOverviewAggregates(toolId: AgentToolId, window: TimeWindow) {
  // Returns { aggregates, loading, error }
  // fetchToolApi<OverviewAggregates>(toolId, '/overview/aggregates', { window })
}

export function useTopModels(toolId: AgentToolId, window: TimeWindow) {
  // Returns { models, loading, error }
  // fetchToolApi<TopModelsResponse>(toolId, '/overview/top-models', { window, limit: '10' })
}

export function useTopProjects(toolId: AgentToolId, window: TimeWindow) {
  // Returns { projects, loading, error }
  // fetchToolApi<TopProjectsResponse>(toolId, '/overview/top-projects', { window, limit: '10' })
}

export function useStarredSessions(toolId: AgentToolId) {
  // Returns { starred, loading, error }
  // fetchToolApi<StarredResponse>(toolId, '/overview/starred', { limit: '20' })
}

export function useTimeline(toolId: AgentToolId) {
  // Returns { timeline, loading, error }
  // fetchToolApi<TimelineResponse>(toolId, '/overview/timeline', { limit: '50' })
}

export function useOverviewCapabilities(toolId: AgentToolId) {
  // Returns { capabilities, loading, error }
  // fetchToolApi<CapabilitiesResponse>(toolId, '/overview/capabilities')
}
</action>
```

Key implementation details:
- Each hook follows exact same pattern as `useToolAgents`: `useState` + `useEffect([toolId, ...deps])` + `fetchToolApi`
- `window`-dependent hooks re-fetch when window changes (include in deps)
- Error state uses `string | null`
- Loading starts as `true`, aggregates starts as `null` (not empty object)

<acceptance_criteria>
- All 6 new hooks exported from client-hooks.tsx
- Each hook returns loading/error/data states
- window param causes re-fetch when changed
- TypeScript compiles clean
</acceptance_criteria>

### Task 3: Create KPI Hero component

<read_first>
  - components/sessions/sessions-stats-bar.tsx (KpiTile pattern)
  - components/ui/skeleton.tsx (loading states)
  - types/overview.ts (OverviewAggregates)
  - app/globals.css (HUD tokens, tabular-nums)
</read_first>

Create `components/overview/kpi-hero.tsx`:

```xml
<action file="components/overview/kpi-hero.tsx" verb="create">
'use client'

// KPI hero bar showing session count, turn count, token totals, project count
// Uses the same KpiTile visual pattern from sessions-stats-bar.tsx
// 
// Props: aggregates: OverviewAggregates | null, loading: boolean
// Loading: 4 Skeleton tiles matching grid density
// Empty: em-dash "—" in each tile value
// Uses: grid grid-cols-4, bg-card border border-border, tabular-nums font-mono
// Section heading: ALL CAPS + tracking pattern
</action>
```

Implementation details:
- 4-column grid: SESSIONS | TURNS | TOKENS | PROJECTS
- Number formatting: reuse `fmtNum` pattern from `sessions-stats-bar.tsx`
- Token display: show input/output split as sublabel (e.g. "1.2k in / 3.4k out")
- Loading: `Skeleton` components with same dimensions as tiles
- Follows exact `KpiTile` structure from `sessions-stats-bar.tsx`

<acceptance_criteria>
- kpi-hero.tsx renders 4-column grid
- Loading state shows Skeleton placeholders
- Null aggregates shows em-dash values
- Numbers use tabular-nums font-mono
</acceptance_criteria>

### Task 4: Create Time Window Selector

<read_first>
  - components/ui/button.tsx (button component)
  - app/globals.css (accent tokens)
  - types/overview.ts (TimeWindow type)
</read_first>

Create `components/overview/time-window-selector.tsx`:

```xml
<action file="components/overview/time-window-selector.tsx" verb="create">
'use client'

// Three-tab selector: TODAY | 7D | 30D
// Active tab uses accent color bg, inactive uses transparent
// Emits TimeWindow value via onChange callback
// ALL CAPS tracking labels, hud-clip-sm on active tab
</action>
```

Implementation details:
- Three inline buttons/tabs in a row
- Active: `bg-accent text-accent-foreground` + `hud-clip-sm`
- Inactive: `text-muted-foreground` hover:bg-muted
- Minimal: just a flex row with three buttons

<acceptance_criteria>
- Three tabs: TODAY, 7D, 30D
- Active tab highlighted with accent
- onChange fires on click
</acceptance_criteria>

### Task 5: Create Top Models Table

<read_first>
  - components/ui/skeleton.tsx
  - components/dashboard/empty-state.tsx
  - types/overview.ts (ModelRanking)
  - components/sessions/sessions-stats-bar.tsx (fmtNum pattern)
</read_first>

Create `components/overview/top-models-table.tsx`:

```xml
<action file="components/overview/top-models-table.tsx" verb="create">
'use client'

// Top models ranking table
// Columns: Rank | Model Name | Sessions | Tokens | Share %
// Loading: Skeleton rows
// Empty: EmptyState with "NO MODEL DATA"
// Uses: border border-border bg-card, monospace font for numbers
// Share % shown as bar + percentage text
</action>
```

Implementation details:
- Table-style list (divs, not HTML table — matching existing project pattern)
- Each row: rank number, model name (font-mono truncate), session count, token total (fmtNum), share bar
- Share bar: thin horizontal bar with accent color, width = sharePercent%
- Loading: 5 Skeleton rows
- Empty: `EmptyState` component

<acceptance_criteria>
- Renders model ranking list
- Loading shows Skeleton rows
- Empty shows EmptyState
- Share bar visual with percentage
- tabular-nums on numbers
</acceptance_criteria>

### Task 6: Create Top Projects Table

<read_first>
  - components/overview/top-models-table.tsx (just created, similar pattern)
  - types/overview.ts (ProjectRanking)
</read_first>

Create `components/overview/top-projects-table.tsx`:

```xml
<action file="components/overview/top-projects-table.tsx" verb="create">
'use client'

// Top projects ranking table — similar structure to top-models-table
// Columns: Rank | Project | Sessions | Turns | Tokens | Weight
// Weight shown as bar + percentage
// Uses same visual patterns as top-models-table
</action>
```

Implementation details:
- Same div-based table pattern as top-models-table
- Columns: rank, project name, session count, turn count, total tokens (fmtNum), rank weight bar
- Loading/empty/error states identical to top-models-table

<acceptance_criteria>
- Renders project ranking list
- Loading/empty states work
- Rank weight bar visual
</acceptance_criteria>

### Task 7: Replace dashboard page with overview

<read_first>
  - app/(tool-shell)/[tool]/dashboard/page.tsx (current router)
  - components/overview/kpi-hero.tsx (just created)
  - components/overview/time-window-selector.tsx (just created)
  - components/overview/top-models-table.tsx (just created)
  - components/overview/top-projects-table.tsx (just created)
  - lib/agent-tools/client-hooks.tsx (new hooks)
</read_first>

Replace `page.tsx` with unified overview:

```xml
<action file="app/(tool-shell)/[tool]/dashboard/page.tsx" verb="replace">
'use client'

// Unified Overview Page for ALL tools
// Uses: useOverviewAggregates, useTopModels, useTopProjects
// State: TimeWindow selector (useState)
// Layout: KPI hero → time window selector → two-column (top models | top projects)
// Source scoping handled automatically by fetchToolApi via toolId
</action>
```

The page should:
1. Call `useOverviewAggregates(toolId, window)` for KPI hero
2. Call `useTopModels(toolId, window)` and `useTopProjects(toolId, window)` for rankings
3. Render: KPI Hero → Time Window Selector → 2-column grid (Top Models | Top Projects)
4. Error state: "INGEST OFFLINE" if aggregates fails (use EmptyState)
5. Full-page loading: spinner only while initial load

Remove or keep the old dashboard components (`openclaw-dashboard.tsx`, `session-stats-dashboard.tsx`, `aggregate-sessions-view.tsx`) — they can stay for now and be cleaned up later.

<acceptance_criteria>
- page.tsx renders unified overview for all tool IDs
- Source scoping works (all, openclaw, claude-code, codex)
- Time window selector updates KPI + rankings
- Loading/empty/error states render correctly
- Build passes, no TypeScript errors
</acceptance_criteria>
