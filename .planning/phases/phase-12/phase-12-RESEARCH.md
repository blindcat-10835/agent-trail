# Phase 12: Overview v2 Real Data — Research

**Gathered:** 2026-05-12

## 1. Current Dashboard Structure

The dashboard lives at `app/(tool-shell)/[tool]/dashboard/page.tsx` and routes based on `toolId`:

| toolId | Component | Status |
|--------|-----------|--------|
| `all` | `AggregateSessionsView` | Cross-source session list + project breakdown. Loads 500 sessions client-side, computes stats in `useMemo`. Uses `SessionsStatsBar` (4-tile KPI) + project list. |
| `openclaw` | `OpenClawDashboard` | Placeholder KPI (4 tiles with `—`), `AgentCard` grid from `useToolAgents`, session count, empty states for skills/cron/activity. |
| `claude-code` / `codex` | `SessionStatsDashboard` | 2-tile stats grid (total sessions, active), model breakdown list, project breakdown list. Computes all stats from `useToolSessions` client-side. |

All three dashboards are `'use client'` components using `useAgentTool()` + `useToolSessions()`/`useToolAgents()` hooks.

### Existing Dashboard Components

- `components/dashboard/agent-card.tsx` — `AgentCard` with HUD clip, status bar, avatar
- `components/dashboard/agent-avatar.tsx` — `AgentAvatar` with initials fallback
- `components/dashboard/agent-status-meta.ts` — `AGENT_STATUS_META` color/label map
- `components/dashboard/empty-state.tsx` — `EmptyState` with `HudPanel`, heading/body pattern
- `components/sessions/sessions-stats-bar.tsx` — `SessionsStatsBar` with 4 `KpiTile` grid (fmtNum, fmtUsd helpers)
- `components/sessions/aggregate-sessions-view.tsx` — `AggregateSessionsView` + `SourceStatusStrip`
- `components/hud/hud-panel.tsx` — `HudPanel` (border + bg-card wrapper)
- `components/hud/ingest-health-overlay.tsx` — health overlay
- `components/hud/theme-toggle.tsx` — theme toggle

### HUD Design Tokens (from globals.css)

- `hud-clip-sm`, `hud-clip-md`, `hud-clip-lg` — clip-path utilities
- `hud-glow` — box-shadow glow utility
- OKLCH color tokens: `--accent` (chartreuse), `--status-success`, `--status-warning`, `--destructive`
- ALL CAPS tracking pattern: `text-[11px] font-semibold uppercase tracking-[0.12em]`

### shadcn/ui Components Available

`badge`, `button`, `card`, `input`, `scroll-area`, `select`, `separator`, `skeleton`, `tooltip`

## 2. BFF Overview Endpoints (Phase 10)

All endpoints are at `/api/agent-tools/[tool]/overview/...` — frontend calls via `fetchToolApi(toolId, '/overview/...')`.

### Endpoint Response Shapes

#### `GET /overview/aggregates?window=7d`
```ts
{
  sessionCount: number
  turnCount: number
  projectCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
}
```
- `window` param: `today` | `7d` | `30d` (default: `7d`)
- Source filtering: BFF injects `source` param for specific tools, omits for `all`

#### `GET /overview/top-models?window=7d&limit=10&sortBy=tokens`
```ts
{
  models: Array<{
    name: string
    sessionCount: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
    sharePercent: number
    cost: null  // placeholder, no price data yet
  }>
}
```
- `sortBy`: `tokens` (default) — only tokens sort is meaningful since cost is null

#### `GET /overview/top-projects?window=7d&limit=10`
```ts
{
  projects: Array<{
    project: string
    sessionCount: number
    turnCount: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
    rankWeight: number  // percentage of total tokens
  }>
}
```

#### `GET /overview/starred?limit=20`
```ts
{
  starred: Array<{
    id: string
    name?: string
    source: string
    project: string
    status: string
    startedAt: string | null
    updatedAt?: string
    starredAt: string
  }>
}
```

#### `GET /overview/timeline?limit=50`
```ts
{
  timeline: Array<{
    id: string
    source: string
    eventType: 'session_started' | 'session_completed' | 'session_error' | 'sync_error'
    eventTime: string | null
    project?: string
    name?: string
    status: string
    errorMessage?: string
  }>
}
```

#### `GET /overview/capabilities` (global, no source filter)
```ts
{
  capabilities: {
    openclaw: { agents: true, automations: true, cost: true, activity: true, sessions: true, replay: true }
    'claude-code': { agents: false, automations: false, cost: true, activity: true, sessions: true, replay: true }
    codex: { agents: false, automations: false, cost: false, activity: true, sessions: true, replay: true }
  }
  sources: string[]
}
```

#### `GET /overview/agents?source=openclaw` (source-scoped, rejects `all`)
```ts
{
  agents: Array<{
    name: string
    sessionCount: number
    toolCallCount: number
    lastActiveAt: string | null
    latestStatus: string
  }>
}
```

#### `GET /overview/status` (global, no source filter)
```ts
{
  ingest: { status: 'ok'|'error', uptime: number, db: 'connected'|'disconnected' }
  watcher: { status: 'watching'|'stopped', filesWatched: number, lastSyncAt: string|null }
  gateway: { status: 'disconnected' }
}
```

## 3. Data Fetching Pattern

The established pattern is in `lib/agent-tools/client-hooks.tsx`:

- **`fetchToolApi<T>(toolId, path, query?)`** — generic BFF fetcher at `/api/agent-tools/${toolId}${path}?query`
- **`useToolSessions(toolId, query?)`** — returns `{ sessions, pagination, loading, error, refetch }`
- **`useToolAgents(toolId)`** — returns `{ agents, loading, error }`
- **`useAggregateSessions(query?)`** — fetches all 3 sources in parallel
- **`useSourceStatus(toolId)`** — health check
- **`useIngestStatus(toolId)`** — periodic polling

All hooks follow: `useState` + `useEffect` + `fetchToolApi` pattern. No SWR/React Query — plain useState/useEffect with manual refetch.

### New Hooks Needed

Overview data requires new hooks:
- `useOverviewAggregates(toolId, window)` → aggregates
- `useTopModels(toolId, window, limit)` → models ranking
- `useTopProjects(toolId, window, limit)` → projects ranking
- `useStarredSessions(toolId, limit)` → starred list
- `useTimeline(toolId, limit)` → timeline events
- `useOverviewCapabilities(toolId)` → capability metadata
- `useOverviewStatus(toolId)` → system status

## 4. Source Capability Awareness (OVR-104)

`CapabilityGate` component exists at `lib/agent-tools/capability-gate.tsx`:
- `<CapabilityGate capability="agents">` — conditionally renders based on **static** tool definition capabilities
- `useRequiresCapability(capability)` — boolean hook

However, for OVR-104, we need **runtime** capabilities from the ingest API (`/overview/capabilities`), not static definition capabilities. The static capabilities in `lib/agent-tools/*/definition.ts` control nav/UI features. The runtime capabilities from `/overview/capabilities` control which **overview data modules** are available (agents, automations, cost, etc.).

**Decision**: Use runtime capabilities from the API for overview module gating. The `CapabilityGate` component can be extended or a new `OverviewCapabilityGate` created that reads from the fetched capabilities data.

## 5. Zustand Stores

Relevant stores:
- `stores/tool-store.ts` — `selectedToolId`, `selectedSessionId` (used by right rail)
- `stores/starred-store.ts` — starred session management
- `stores/theme-store.ts` — light/dark toggle
- `stores/ingest-health-store.ts` — ingest health state
- `stores/ui-store.ts` — UI state (right rail toggle, etc.)

No new stores needed for Phase 12 — all overview state can live in component-level hooks.

## 6. Key Implementation Considerations

### Source Scoping (OVR-102)
- `toolId` comes from `useAgentTool()` — already scoped per route
- `fetchToolApi(toolId, '/overview/...')` handles BFF source injection automatically
- All overview hooks just need `toolId` + `window` params

### Time Window (OVR-103)
- `window` param: `today` | `7d` | `30d`
- Affects: aggregates, top-models, top-projects
- Does NOT affect: starred, timeline, agents, capabilities, status
- UI: tab selector in the overview header

### Token vs Cost Toggle (OVR-103)
- Top-models endpoint returns `cost: null` — no price data yet
- UI should still show the toggle control but cost column shows `—`
- Token mode is default; cost mode is secondary

### Loading/Empty/Error States (OVR-105)
- **Loading**: `Skeleton` from shadcn/ui matching layout density
- **Empty**: em-dash `—` in KPI tiles, `EmptyState` for sections
- **Partial**: show available data, `—` for missing
- **Error**: "INGEST OFFLINE" or "NO SESSIONS" with retry prompt
- All states must preserve layout density (no layout shift)

### Component Organization
New overview components should go in `components/overview/`:
- `overview-page.tsx` — top-level overview that replaces current dashboard routing
- `kpi-hero.tsx` — aggregate KPI bar
- `top-models-table.tsx` — models ranking
- `top-projects-table.tsx` — projects ranking
- `starred-sessions.tsx` — starred session list
- `activity-timeline.tsx` — timeline events
- `overview-agents.tsx` — agents module (OpenClaw only)
- `time-window-selector.tsx` — today/7d/30d selector

The `page.tsx` router should be simplified to render the unified `OverviewPage` for all tool IDs.

## 7. Response Type Definitions Needed

New types needed in `types/overview.ts`:
- `OverviewAggregates`
- `ModelRanking`
- `ProjectRanking`
- `StarredSession`
- `TimelineEvent`
- `SourceCapabilities`
- `OverviewStatus`
