# Phase 4: Agent Dashboard - Research

**Research Date:** 2026-04-30
**Researcher:** Phase Researcher Agent
**Status:** Complete

## Executive Summary

Phase 4 (Agent Dashboard) is recommended to be split into **2 sequential plans**:

- **Plan 4.1:** Dashboard Center Area + Left Panel (KPI bar + agent card grid + search/filter + left sub-nav tabs)
- **Plan 4.2:** Right Panel Detail View (agent detail panel with info + terminal log + capabilities)

This split minimizes cross-plan dependencies — Plan 4.1 delivers a functional dashboard with agent discovery, Plan 4.2 adds the deep-dive detail view.

---

## 1. Plan Decomposition Strategy

### Recommended: 2-Plan Sequential Split

#### **Plan 4.1: Dashboard Core (Center + Left)**
**Goal:** Deliver a functional agent overview dashboard with search/filter capabilities.

**Scope:**
- Center area: KPI bar + search/filter + agent card grid
- Left panel: sub-nav tabs (Overview/Agents/Skills) + content panels
- Agent card interactivity: click to set `selectedAgentId` state (highlight border)

**Dependencies:**
- ✅ None — builds directly on Phase 3 Shell Layout

**Deliverables:**
- `DashboardKpiBar` component
- `AgentSearchFilter` component
- `AgentCardGrid` component with `AgentCard` items
- `DashboardLeftPanel` component with tab navigation
- Three tab content panels: `OverviewTab`, `AgentsTab`, `SkillsTab`

---

#### **Plan 4.2: Right Panel Detail View**
**Goal:** Add deep-dive agent detail view with real-time log stream.

**Scope:**
- Right panel: agent detail view (triggered by `selectedAgentId`)
- Agent basic info section (name/status/current tool)
- Terminal-style log stream (auto-scroll, color-coded)
- Agent capabilities section (model/tool list)

**Dependencies:**
- ⚠️ Requires Plan 4.1's `selectedAgentId` state to be accessible

**Deliverables:**
- `AgentDetailPanel` component
- `AgentLogStream` component (terminal-style)
- `AgentCapabilities` component (optional, can be inline in detail panel)

---

### Alternative: 3-Plan Split (Not Recommended)

A 3-plan split (KPI+Search, Card Grid, Right Panel) was considered but rejected due to:
- **Increased coordination overhead** — 3 plans require more handoffs
- **Delayed user value** — Card grid alone (without search/filter) is less useful
- **Artificial boundaries** — KPI and search/filter are tightly coupled in UX

---

## 2. Component Tree

### New Components to Create

```
app/(shell)/dashboard/page.tsx (existing placeholder)
├── DashboardKpiBar (NEW)
│   ├── KpiCard (reusable micro-component)
├── AgentSearchFilter (NEW)
│   ├── SearchInput (shadcn input variant)
│   └── StatusFilter (shadcn select/dropdown)
├── AgentCardGrid (NEW)
│   └── AgentCard[] (NEW, uses HudCard)
├── DashboardLeftPanel (NEW)
│   ├── TabNav (reusable component)
│   ├── OverviewTab (NEW)
│   ├── AgentsTab (NEW)
│   └── SkillsTab (NEW)
└── AgentDetailPanel (NEW, Plan 4.2)
    ├── AgentBasicInfo (inline)
    ├── AgentLogStream (NEW, Plan 4.2)
    └── AgentCapabilities (inline or separate)
```

### Component Hierarchy in Dashboard Page

```tsx
// app/(shell)/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <>
      {/* Left panel: 260px */}
      <DashboardLeftPanel />
      
      {/* Center: 1fr */}
      <div className="flex flex-col">
        <DashboardKpiBar />
        <AgentSearchFilter />
        <AgentCardGrid />
      </div>
      
      {/* Right panel: 300px */}
      <AgentDetailPanel />
    </>
  )
}
```

---

## 3. Store Integration

### Data Source: `useGatewayStore()`

**Location:** `/Users/ebbi/Work/openclaw-projects/ovao/stores/gateway/gateway-store.ts`

**Available State:**
```typescript
interface GatewayState {
  // Agent data
  agents: Map<string, AgentInfo>
  agentLogs: Record<string, LogEntry[]>
  
  // Dashboard data
  channels: ChannelInfo[]
  skills: SkillInfo[]
  cronTasks: CronTask[]
  providers: UsageProviderInfo[]
  activeSessions: number
  
  // P0 data (Wave 2 Contract Freeze)
  globalEventFeed: GlobalEventFeedItem[]
  usageDetail: UsageDetailSnapshot | null
  alertItems: AlertItem[]
  
  // Connection state
  connectionStatus: ConnectionStatus
  isDashboardLoading: boolean
}
```

### Selectors from `p0-selectors.ts`

**Location:** `/Users/ebbi/Work/openclaw-projects/ovao/stores/gateway/p0-selectors.ts`

**Available Selectors:**
```typescript
// Returns { state: P0UIState, data: UsageDetailSnapshot | null }
selectUsageState(state: GatewayState)

// Returns { state: P0UIState, data: AlertItem[] }
selectAlertsState(state: GatewayState)

// Returns { state: AgentDetailUIState, data: AgentInfo | null }
selectAgentDetailState(agentId: string)(state: GatewayState)

// Returns { state: P0UIState, data: GlobalEventFeedItem[] }
selectGlobalFeedState(state: GatewayState)
```

### Local UI State Strategy

**Question:** Should dashboard UI state (selectedAgentId, searchQuery, statusFilter, activeTab) use local `useState` or a separate Zustand slice?

**Recommendation: Use local `useState` in Dashboard page**

**Rationale:**
1. **Simpler data flow** — UI state is local to Dashboard page, doesn't need to be shared across components
2. **No persistence requirement** — Dashboard state doesn't need to survive page navigation
3. **Easier to test** — Local state is easier to reason about in a single component
4. **Consistent with existing patterns** — `ThemeToggle` uses local `useState` for mounted state

**Example:**
```typescript
// app/(shell)/dashboard/page.tsx
'use client'

export default function DashboardPage() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<AgentDisplayStatus | 'all'>('all')
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'skills'>('overview')
  
  // ... component implementation
}
```

---

## 4. Responsive Grid CSS (Tailwind v4)

### Agent Card Grid Layout

**Requirement:** Compact multi-column grid, ~180-200px per card, adaptive to screen size.

**Tailwind v4 Approach:**
```tsx
// AgentCardGrid.tsx
<div className="
  grid 
  gap-3 
  grid-cols-[repeat(auto-fill,minmax(180px,1fr))]
  p-4
">
  {agents.map(agent => (
    <AgentCard key={agent.id} agent={agent} />
  ))}
</div>
```

**Breakpoints Strategy:**
- **Default (< 640px):** `grid-cols-[repeat(auto-fill,minmax(140px,1fr))]` — smaller cards on mobile
- **sm (≥ 640px):** `grid-cols-[repeat(auto-fill,minmax(160px,1fr))]`
- **md (≥ 768px):** `grid-cols-[repeat(auto-fill,minmax(180px,1fr))]` — target size
- **lg (≥ 1024px):** `grid-cols-[repeat(auto-fill,minmax(200px,1fr))]` — more space

**Alternative (simpler):** Use `minmax(180px, 1fr)` without breakpoints — browser auto-fills based on available width.

**Gap:** `gap-3` (12px) matches HUD cyberpunk aesthetic (consistent with Shell Header spacing).

---

## 5. Terminal Log Component

### Implementation Approach

**Component:** `AgentLogStream`

**Location:** `/Users/ebbi/Work/openclaw-projects/ovao/components/dashboard/agent-log-stream.tsx`

#### Key Features

1. **Scroll-to-Bottom Auto-Scroll**
```typescript
const logEndRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [logs])
```

2. **Color-Coded Log Lines**
```typescript
const logTypeColors: Record<LogEntry['type'], string> = {
  lifecycle: 'text-white',
  tool: 'text-yellow-400',
  assistant: 'text-green-400',
  error: 'text-red-400',
}

<LogLine className={logTypeColors[log.type]}>{log.content}</LogLine>
```

3. **Terminal Styling**
```tsx
<div className="
  bg-black 
  font-mono 
  text-xs 
  p-3 
  h-full 
  overflow-y-auto
  scrollbar-thin
  scrollbar-thumb-border
  scrollbar-track-transparent
">
  {/* Log lines */}
</div>
```

#### Performance Considerations

**Question:** Is virtualization needed for 200 log lines?

**Answer:** No — 200 lines is well within React's rendering capacity.

**Rationale:**
- Each log line is a simple text element (no complex components)
- 200 lines × ~50px height = 10,000px total height
- Modern browsers handle 10kpx scrollable containers easily
- Virtualization adds complexity (react-window/react-virtual) for minimal gain

**Optimization:** If performance issues arise:
1. Use `React.memo()` on individual `LogLine` components
2. Limit rendered lines to last 100 (store already caps at 200)
3. Consider virtualization as last resort

---

## 6. Tab Navigation for Left Panel

### Question: State-Based vs Router-Based Tabs?

**Recommendation: State-based tabs (local component state)**

**Rationale:**

#### State-Based Tabs (Recommended)
✅ **Simpler implementation** — no route changes, no URL params
✅ **Instant switching** — no page transition, no router overhead
✅ **Consistent with UX** — left panel tabs are UI organization, not navigation
✅ **Easier to maintain** — all state in one component

```typescript
const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'skills'>('overview')

return (
  <>
    <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
    {activeTab === 'overview' && <OverviewTab />}
    {activeTab === 'agents' && <AgentsTab />}
    {activeTab === 'skills' && <SkillsTab />}
  </>
)
```

#### Router-Based Tabs (Not Recommended)
❌ **Unnecessary complexity** — adds route params (`?tab=agents`)
❌ **Page transitions** — router navigation feels heavier than state switch
❌ **URL pollution** — tab state is ephemeral, doesn't belong in URL
❌ **No benefit** — tabs aren't shareable or bookmarkable

---

## 7. Data Flow Diagrams

### Dashboard Page Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard Page                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Local UI State (useState)                            │  │
│  │  - selectedAgentId: string | null                    │  │
│  │  - searchQuery: string                               │  │
│  │  - statusFilter: AgentDisplayStatus | 'all'          │  │
│  │  - activeTab: 'overview' | 'agents' | 'skills'       │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Gateway Store (useGatewayStore)                      │  │
│  │  - agents: Map<string, AgentInfo>                   │  │
│  │  - agentLogs: Record<string, LogEntry[]>             │  │
│  │  - skills: SkillInfo[]                               │  │
│  │  - providers: UsageProviderInfo[]                    │  │
│  │  - alertItems: AlertItem[]                           │  │
│  │  - globalEventFeed: GlobalEventFeedItem[]            │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Selectors (p0-selectors.ts)                          │  │
│  │  - selectUsageState()                                │  │
│  │  - selectAlertsState()                               │  │
│  │  - selectAgentDetailState(agentId)                   │  │
│  │  - selectGlobalFeedState()                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Props Flow

```
DashboardPage
  │
  ├─── DashboardKpiBar
  │     └── props: { agents, providers, activeSessions }
  │
  ├─── AgentSearchFilter
  │     └── props: { searchQuery, onSearchChange, statusFilter, onStatusChange }
  │
  ├─── AgentCardGrid
  │     └── props: { agents, selectedAgentId, onAgentClick }
  │           └─ AgentCard[]
  │                 └── props: { agent, isSelected, onClick }
  │
  ├─── DashboardLeftPanel
  │     └── props: { activeTab, onTabChange }
  │           ├─ OverviewTab
  │           │     └── props: { stats, alerts }
  │           ├─ AgentsTab
  │           │     └── props: { agents, selectedAgentId, onAgentClick }
  │           └─ SkillsTab
  │                 └── props: { skills }
  │
  └─── AgentDetailPanel (Plan 4.2)
        └── props: { selectedAgentId }
              ├─ AgentBasicInfo
              │     └── props: { agent }
              ├─ AgentLogStream
              │     └── props: { logs }
              └─ AgentCapabilities
                    └── props: { agent }
```

---

## 8. Color Tokens (OKLCH)

### Agent Status Colors

**Requirement (D-04):** idle=gray, working=blue, tool_calling=yellow, speaking=green, error=red

**Implementation:**
```typescript
const statusColors: Record<AgentDisplayStatus, string> = {
  idle: 'oklch(0.55 0.008 160)',        // gray-500
  working: 'oklch(0.62 0.17 65)',       // blue-500 (accent)
  tool_calling: 'oklch(0.8 0.17 75)',   // yellow-500 (accent)
  speaking: 'oklch(0.65 0.15 145)',     // green-500
  error: 'oklch(0.577 0.245 27.325)',   // red-500 (destructive)
}
```

**Alternative (reuse existing tokens):**
```typescript
const statusColors: Record<AgentDisplayStatus, string> = {
  idle: 'var(--color-muted-foreground)',
  working: 'var(--color-accent)',
  tool_calling: 'var(--color-accent)',
  speaking: 'oklch(0.65 0.15 145)',     // custom green
  error: 'var(--color-destructive)',
}
```

**Recommendation:** Use custom OKLCH values for consistency across light/dark themes. The existing `--color-accent` and `--color-destructive` tokens can be reused for working/tool_calling/error states.

### Log Type Colors

**Requirement (D-09):** lifecycle=white, tool=yellow, assistant=green, error=red

**Implementation (terminal on black bg):**
```typescript
const logTypeColors: Record<LogEntry['type'], string> = {
  lifecycle: 'text-white',              // pure white
  tool: 'text-yellow-400',              // oklch(0.85 0.2 85)
  assistant: 'text-green-400',          // oklch(0.75 0.15 145)
  error: 'text-red-400',                // oklch(0.7 0.2 25)
}
```

**Note:** Use Tailwind's semantic color names (`yellow-400`, `green-400`, `red-400`) instead of raw OKLCH for better maintainability. These colors are optimized for dark backgrounds (terminal use case).

---

## 9. Empty States & Loading States

### Empty State Patterns

**Scenario:** No agents, empty search results, Gateway disconnected.

**Recommendation:** Create a reusable `EmptyState` component.

```typescript
// components/dashboard/empty-state.tsx
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <HudPanel className="flex flex-col items-center justify-center p-8 text-center">
      {icon && <div className="text-muted-foreground mb-3">{icon}</div>}
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-xs text-muted-foreground mb-4">{description}</p>}
      {action}
    </HudPanel>
  )
}
```

**Usage Examples:**
```typescript
// No agents
<EmptyState
  icon={<AgentIcon />}
  title="No agents found"
  description="Connect to Gateway to see agents"
  action={<Button>Connect</Button>}
/>

// Empty search
<EmptyState
  title="No matching agents"
  description="Try a different search term"
/>

// Gateway disconnected
<EmptyState
  icon={<WifiOff />}
  title="Gateway disconnected"
  description="Check your connection settings"
  action={<Button onClick={reconnect}>Reconnect</Button>}
/>
```

### Loading State Pattern

**Use existing P0UIState pattern from `p0-selectors.ts`:**
```typescript
const { state: uiState, data } = selectAlertsState(useGatewayStore())

if (uiState === 'loading') {
  return <LoadingSpinner />
}
if (uiState === 'error') {
  return <ErrorState error={error} />
}
if (uiState === 'empty') {
  return <EmptyState {...} />
}
// render success state
```

---

## 10. File Structure

### Recommended Component Organization

```
components/
├── dashboard/
│   ├── dashboard-kpi-bar.tsx       (Plan 4.1)
│   ├── agent-search-filter.tsx     (Plan 4.1)
│   ├── agent-card-grid.tsx         (Plan 4.1)
│   ├── agent-card.tsx              (Plan 4.1)
│   ├── dashboard-left-panel.tsx    (Plan 4.1)
│   ├── tab-nav.tsx                 (Plan 4.1, reusable)
│   ├── overview-tab.tsx            (Plan 4.1)
│   ├── agents-tab.tsx              (Plan 4.1)
│   ├── skills-tab.tsx              (Plan 4.1)
│   ├── agent-detail-panel.tsx      (Plan 4.2)
│   ├── agent-log-stream.tsx        (Plan 4.2)
│   ├── agent-basic-info.tsx        (Plan 4.2, inline)
│   └── agent-capabilities.tsx      (Plan 4.2, inline)
├── ui/
│   ├── button.tsx                  (existing shadcn)
│   ├── input.tsx                   (ADD via shadcn)
│   ├── select.tsx                  (ADD via shadcn)
│   └── badge.tsx                   (existing shadcn)
└── hud/
    ├── hud-card.tsx                (existing)
    ├── hud-panel.tsx               (existing)
    └── status-indicator.tsx        (existing)
```

**Note:** Use `pnpm dlx shadcn@latest add input select` to add missing shadcn components.

---

## 11. Implementation Checklist (Plan 4.1)

### Prerequisites
- [ ] Verify Gateway is running (`ws://localhost:18789`)
- [ ] Add shadcn components: `input`, `select`
- [ ] Create `components/dashboard/` directory

### Center Area
- [ ] Implement `DashboardKpiBar` component
  - [ ] Calculate stats from `agents` Map (active/working/error counts)
  - [ ] Calculate token usage from `providers` array
  - [ ] Display `activeSessions` count
- [ ] Implement `AgentSearchFilter` component
  - [ ] Search input (debounced, 300ms)
  - [ ] Status filter dropdown (all/idle/working/tool_calling/speaking/error)
  - [ ] Filter agents by search query AND status
- [ ] Implement `AgentCardGrid` component
  - [ ] Responsive grid layout (auto-fill, minmax 180px)
  - [ ] Filter agents based on search/filter state
  - [ ] Sort agents (active first, then by name)
- [ ] Implement `AgentCard` component
  - [ ] Use `HudCard` variant="sm"
  - [ ] Display avatar, name, status dot, current tool
  - [ ] Highlight border when selected
  - [ ] onClick handler to set `selectedAgentId`

### Left Panel
- [ ] Implement `DashboardLeftPanel` component
  - [ ] Tab navigation (Overview/Agents/Skills)
  - [ ] Active tab indicator
- [ ] Implement `OverviewTab` component
  - [ ] Global stats (total agents, active sessions, connection status)
  - [ ] Alert list (from `alertItems` in store)
  - [ ] Use `selectAlertsState()` selector
- [ ] Implement `AgentsTab` component
  - [ ] Agent list (compact view)
  - [ ] Click to highlight card in center grid
  - [ ] Sync with `selectedAgentId` state
- [ ] Implement `SkillsTab` component
  - [ ] Skills list (from `skills` in store)
  - [ ] Display skill icon, name, description

### Dashboard Page Integration
- [ ] Update `app/(shell)/dashboard/page.tsx`
  - [ ] Add local state (selectedAgentId, searchQuery, statusFilter, activeTab)
  - [ ] Connect all components
  - [ ] Implement filter/sort logic
  - [ ] Handle empty states

### Styling & Polish
- [ ] Verify agent status colors (OKLCH tokens)
- [ ] Verify log type colors (terminal style)
- [ ] Add hover effects to AgentCard
- [ ] Add transitions for smooth interactions
- [ ] Test responsive layout (mobile/tablet/desktop)
- [ ] Verify light/dark theme compatibility

### Testing
- [ ] Test with real Gateway connection
- [ ] Test empty states (no agents, disconnected)
- [ ] Test search/filter functionality
- [ ] Test tab switching
- [ ] Test agent selection flow
- [ ] Test KPI bar updates in real-time

---

## 12. Implementation Checklist (Plan 4.2)

### Right Panel
- [ ] Implement `AgentDetailPanel` component
  - [ ] Show empty state when no agent selected
  - [ ] Show loading state when agent data is loading
  - [ ] Use `selectAgentDetailState(selectedAgentId)` selector
- [ ] Implement `AgentBasicInfo` section (inline in detail panel)
  - [ ] Display agent name, avatar, status badge
  - [ ] Display current tool (if any)
  - [ ] Display session duration (if active)
- [ ] Implement `AgentLogStream` component
  - [ ] Terminal-style container (black bg, monospace font)
  - [ ] Color-coded log lines (lifecycle/tool/assistant/error)
  - [ ] Auto-scroll to bottom
  - [ ] Max 200 lines (enforced by store)
  - [ ] Handle empty log state
- [ ] Implement `AgentCapabilities` section (inline)
  - [ ] Display agent model (if available)
  - [ ] Display available tools (if available)
  - [ ] Fallback to "No capabilities info" message

### Integration
- [ ] Connect `AgentDetailPanel` to Dashboard page
  - [ ] Pass `selectedAgentId` prop
  - [ ] Handle `null` case (no selection)
- [ ] Update `AgentCard` to sync selection
  - [ ] Highlight border when selected
  - [ ] Remove highlight when selection changes

### Styling & Polish
- [ ] Verify terminal log styling (JetBrains Mono, dark bg)
- [ ] Add scroll indicators for log stream
- [ ] Test log color coding in both themes
- [ ] Verify performance with 200 log lines
- [ ] Add smooth transitions for panel open/close

### Testing
- [ ] Test with real agent logs
- [ ] Test auto-scroll behavior
- [ ] Test log color coding
- [ ] Test empty log state
- [ ] Test agent selection/deselection
- [ ] Test right panel responsive behavior (300px fixed)

---

## 13. Open Questions & Trade-offs

### Q1: Agent Card Grid Density

**Question:** Should cards use `variant="sm"` or `variant="md"` from `HudCard`?

**Trade-off:**
- `sm`: More cards visible (~120px height), tighter fit
- `md`: More information per card (~160px height), better readability

**Recommendation:** Start with `variant="sm"` for density, switch to `md` if cards feel cramped. A/B testing during implementation.

---

### Q2: Search Debounce Time

**Question:** What debounce time for search input?

**Options:**
- 150ms: Responsive, but more re-renders
- 300ms: Balanced (recommended)
- 500ms: Fewer re-renders, but feels laggy

**Recommendation:** 300ms — standard practice for search inputs.

---

### Q3: Log Stream Performance

**Question:** Should we use `useMemo` to filter/sort logs?

**Trade-off:**
- With `useMemo`: Fewer re-renders, but more complexity
- Without `useMemo`: Simpler code, React handles shallow equality well

**Recommendation:** Skip `useMemo` initially. Logs are capped at 200 entries, and React's diffing is efficient. Add `useMemo` only if performance profiling shows bottlenecks.

---

### Q4: Tab Animation

**Question:** Should tab content fade in/out when switching?

**Trade-off:**
- With animation: Polished UX, but adds complexity (Framer Motion or CSS transitions)
- Without animation: Simpler, instant switching

**Recommendation:** Skip animations for Plan 4.1. Add subtle fade transition (150ms) in Plan 4.2 if time permits. Use CSS `@starting-style` (Next.js 16 feature) for performant transitions.

---

## 14. Next Steps

1. **Planner Agent:** Use this research to create detailed execution plans for Plan 4.1 and Plan 4.2
2. **Developer Agent:** Implement Plan 4.1 following the component tree and checklist
3. **Tester Agent:** Verify Plan 4.1 against requirements before starting Plan 4.2
4. **Documentation Agent:** Update CONTEXT.md with any implementation discoveries

---

## 15. References

### Files Referenced
- `/Users/ebbi/Work/openclaw-projects/ovao/stores/gateway/gateway-store.ts` — Agent data store
- `/Users/ebbi/Work/openclaw-projects/ovao/stores/gateway/p0-selectors.ts` — P0 selectors
- `/Users/ebbi/Work/openclaw-projects/ovao/stores/gateway/p0-ui-state.ts` — UI state types
- `/Users/ebbi/Work/openclaw-projects/ovao/stores/gateway/p0-types.ts` — Data types
- `/Users/ebbi/Work/openclaw-projects/ovao/types/log.ts` — LogEntry type
- `/Users/ebbi/Work/openclaw-projects/ovao/app/globals.css` — Theme tokens and HUD utilities
- `/Users/ebbi/Work/openclaw-projects/ovao/app/(shell)/layout.tsx` — Shell Grid layout
- `/Users/ebbi/Work/openclaw-projects/ovao/components/hud/hud-card.tsx` — HudCard component
- `/Users/ebbi/Work/openclaw-projects/ovao/.planning/phases/04-agent-dashboard/04-CONTEXT.md` — Phase 4 context and decisions

### External References
- Tailwind v4 docs: https://tailwindcss.com/docs/v4-beta
- shadcn/ui docs: https://ui.shadcn.com
- Zustand docs: https://zustand-demo.pmnd.rs
- Next.js 16 docs: `node_modules/next/dist/docs/`

---

*Research completed: 2026-04-30*
*Next phase: Planning*
