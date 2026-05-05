# Architecture Patterns

**Domain:** Next.js 16 App Router HUD Dashboard
**Researched:** 2026-04-30

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Root Layout                              │
│                   (app/layout.tsx - Server)                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Shell Layout (app/dashboard/layout.tsx)       │ │
│  │                   ┌──────────────────────────────────────┐ │ │
│  │                   │  HUD Header (48px)                   │ │ │
│  │                   ├──────────────────────────────────────┤ │ │
│  │                   │                                      │ │ │
│  │                   │  Main Content (1fr)                  │ │ │
│  │                   │  ┌──────────┬──────────┬──────────┐ │ │ │
│  │                   │  │ Sidebar  │  Page    │  Panel   │ │ │ │
│  │                   │  │ (260px)  │ (1fr)    │ (300px)  │ │ │ │
│  │                   │  │          │          │          │ │ │ │
│  │                   │  │ Client   │ Server/  │  Client  │ │ │ │
│  │                   │  │          │  Client  │          │ │ │ │
│  │                   │  └──────────┴──────────┴──────────┘ │ │ │
│  │                   │                                      │ │ │
│  │                   ├──────────────────────────────────────┤ │ │
│  │                   │  Status Bar (26px)                   │ │ │
│  │                   └──────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With | Server/Client |
|-----------|---------------|-------------------|---------------|
| **Root Layout** | HTML structure, global styles, fonts, theme provider | Shell Layout, global providers | Server Component |
| **Shell Layout** | Grid shell (header/main/statusbar), persistent state | All page components, HUD components | Server Component |
| **HUD Header** | Brand logo, command palette, connection status, clock | Gateway store (connection status) | Client Component |
| **Sidebar Navigation** | Route navigation, active state highlighting | Next.js router, page routes | Client Component |
| **Status Bar** | Gateway status, agent counts, session info, theme toggle | Gateway store, theme provider | Client Component |
| **Dashboard Page** | Agent cards grid, quick stats, alerts panel | Gateway store, office layout store | Mixed (Server layout, Client cards) |
| **Office Layout Page** | Visual office map, agent positioning | Office layout store, gateway store | Client Component |
| **Workspace Page** | Single agent detail view, logs, tasks | Gateway store (agent-specific data) | Client Component |
| **HUD Card** | Reusable card container with HUD styling | Parent components | Client Component |
| **HUD Panel** | Reusable panel with header/body structure | Parent components | Client Component |
| **Status Indicator** | Connection/status dots with animations | Parent components | Client Component |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Data Flow Architecture                       │
└─────────────────────────────────────────────────────────────────┘

Gateway WebSocket (ws-client.ts)
         │
         ├─── onStatusChange() ──→ GatewayStore (connectionStatus)
         │
         └─── onEvent() ─────────→ GatewayStore (agents, logs, alerts)
                                       │
                                       ├──→ Selector: useAgentList()
                                       ├──→ Selector: useAgentLogs()
                                       ├──→ Selector: useConnectionStatus()
                                       ├──→ Selector: useAlertItems()
                                       └──→ Selector: useGlobalEventFeed()
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
                    ▼                       ▼                       ▼
           Dashboard Page         Office Layout Page        Workspace Page
          (Server Component)     (Client Component)      (Client Component)
                    │                       │                       │
                    │                       │                       │
        ┌───────────┴─────┐       ┌────────┴────────┐      ┌────────┴────────┐
        │                 │       │                 │      │                 │
    HUD Cards         HUD Panels    Office Map      Agent Details    Log Viewer
 (Client Component) (Client)    (Client)        (Client)        (Client)
        │                 │           │                 │                │
        └─────────┬───────┘           └─────────┬───────┘                │
                  │                             │                        │
                  └───────────┬─────────────────┘                        │
                              │                                          │
                              └──────────────────┬───────────────────────┘
                                                 │
                                                 ▼
                                        User Interactions
                                        (click, hover, scroll)
```

**Key Data Flow Principles:**

1. **Unidirectional Flow:** Gateway → Store → UI (no UI → Gateway direct mutations)
2. **Selector Pattern:** UI components use selectors to subscribe to specific store slices
3. **Server-Client Hydration:** Server Components provide initial structure, Client Components hydrate interactivity
4. **Event-Driven Updates:** WebSocket events trigger store updates, components re-render via Zustand subscription

## Patterns to Follow

### Pattern 1: Server Component Shell with Client Islands

**What:** Server Components provide structure and initial data, Client Components handle interactivity at component boundaries.

**When:** Use for all pages with static structure + dynamic data (Dashboard, Office, Workspace).

**Example:**

```typescript
// app/dashboard/page.tsx - Server Component
import { DashboardHeader } from '@/components/dashboard/header'
import { AgentCardsGrid } from '@/components/dashboard/agent-cards-grid'
import { QuickStatsPanel } from '@/components/dashboard/quick-stats-panel'

export default function DashboardPage() {
  return (
    <div className="hud-main">
      {/* Server-rendered structure */}
      <DashboardHeader />
      
      {/* Client component islands for interactivity */}
      <AgentCardsGrid />
      <QuickStatsPanel />
      
      {/* Additional panels... */}
    </div>
  )
}
```

```typescript
// components/dashboard/agent-cards-grid.tsx - Client Component
'use client'

import { useAgentList } from '@/stores/gateway/p0-selectors'

export function AgentCardsGrid() {
  const agents = useAgentList()
  
  return (
    <div className="grid grid-cols-4 gap-4">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  )
}
```

### Pattern 2: Zustand Store with Server-Client Selectors

**What:** Server Components fetch initial data via RPC, Client Components use Zustand selectors for reactive updates.

**When:** Real-time data synchronization (agent status, logs, connection state).

**Example:**

```typescript
// stores/gateway/p0-selectors.ts (extend existing)
import { useGatewayStore } from './gateway-store'

// Selector for dashboard page
export function useAgentList() {
  return useGatewayStore((state) => Array.from(state.agents.values()))
}

// Selector for workspace page
export function useAgentLogs(agentId: string) {
  return useGatewayStore((state) => state.agentLogs[agentId] ?? [])
}

// Selector for header
export function useConnectionStatus() {
  return useGatewayStore((state) => ({
    status: state.connectionStatus,
    version: state.gatewayVersion,
  }))
}
```

```typescript
// components/hud/hud-header.tsx - Client Component
'use client'

import { useConnectionStatus } from '@/stores/gateway/p0-selectors'
import { ConnectionIndicator } from './connection-indicator'

export function HUDHeader() {
  const { status, version } = useConnectionStatus()
  
  return (
    <header className="hud-head">
      <div className="hud-brand">
        {/* Brand logo, name... */}
      </div>
      
      <ConnectionIndicator status={status} version={version} />
      
      {/* Clock, command palette... */}
    </header>
  )
}
```

### Pattern 3: Design Token System with CSS Custom Properties

**What:** Semantic CSS custom properties for HUD theme (colors, spacing, clip-paths, shadows).

**When:** All visual components for consistent cyberpunk HUD styling.

**Example:**

```css
/* app/globals.css */
:root {
  /* Semantic Colors */
  --color-background: oklch(0.14 0.008 160);
  --color-panel: oklch(0.185 0.008 160);
  --color-card: oklch(0.21 0.008 160);
  --color-border: oklch(0.3 0.008 160);
  --color-foreground: oklch(0.96 0 0);
  --color-foreground-dim: oklch(0.72 0.008 160);
  --color-foreground-muted: oklch(0.52 0.008 160);
  
  /* Agent Status Colors */
  --color-idle: oklch(0.58 0.008 160);
  --color-working: oklch(0.8 0.17 75);
  --color-tool-calling: oklch(0.72 0.14 220);
  --color-speaking: oklch(0.76 0.17 145);
  --color-error: oklch(0.68 0.21 25);
  
  /* Typography */
  --font-display: 'Rajdhani', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  
  /* HUD Clip Paths */
  --clip-sm: polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px));
  --clip-md: polygon(0 14px, 14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px));
  
  /* Effects */
  --glow-cyan: 0 0 12px oklch(0.8 0.17 220);
  --glow-amber: 0 0 12px oklch(0.8 0.17 75);
}

[data-theme="light"] {
  --color-background: oklch(0.98 0.003 90);
  --color-panel: oklch(1 0 0);
  --color-card: oklch(0.965 0.003 90);
  --color-border: oklch(0.88 0.005 90);
  --color-foreground: oklch(0.18 0.008 160);
}
```

```typescript
// components/hud/hud-card.tsx - Client Component
'use client'

import { cn } from '@/lib/utils'

interface HUDCardProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'accent' | 'alert'
}

export function HUDCard({ children, className, variant = 'default' }: HUDCardProps) {
  return (
    <div
      className={cn(
        'relative bg-[var(--color-card)] border border-[var(--color-border)]',
        'p-[var(--spacing-md)] clip-path-hud-card',
        'transition-all duration-200',
        variant === 'accent' && 'shadow-[var(--glow-cyan)] border-[var(--color-tool-calling)]',
        variant === 'alert' && 'shadow-[var(--glow-amber)] border-[var(--color-error)]',
        className
      )}
    >
      {children}
    </div>
  )
}
```

### Pattern 4: Layout Nesting with Route Groups

**What:** Use nested layouts for shared UI (shell) and route groups for logical sections.

**When:** Dashboard has shared shell but different page sections.

**Example:**

```
app/
├── layout.tsx                    # Root layout (Server)
├── page.tsx                      # Redirect to /dashboard
├── globals.css                   # Global styles + design tokens
├── (dashboard)/                  # Route group (no URL segment)
│   ├── layout.tsx                # Shell layout (Server + Client shell)
│   ├── page.tsx                  # Dashboard home (Server)
│   ├── dashboard/
│   │   └── page.tsx              # Agent dashboard (Server + Client)
│   ├── office/
│   │   └── page.tsx              # Office layout (Client)
│   └── workspace/
│       └── [agentId]/
│           └── page.tsx          # Workspace (Client)
└── api/                          # API routes (agent avatars, etc.)
```

```typescript
// app/(dashboard)/layout.tsx - Shell Layout
import { HUDHeader } from '@/components/hud/hud-header'
import { HUDStatusBar } from '@/components/hud/hud-status-bar'

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="shell">
      <HUDHeader />
      
      <main className="hud-main">
        {/* Sidebar navigation */}
        <nav className="panel-left">
          {/* Navigation items... */}
        </nav>
        
        {/* Main content area */}
        <div className="panel-center">
          {children}
        </div>
        
        {/* Right panel */}
        <aside className="panel-right">
          {/* Quick stats, alerts... */}
        </aside>
      </main>
      
      <HUDStatusBar />
    </div>
  )
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Giant Client Components

**What:** Making entire pages Client Components (`'use client'` at page level).

**Why bad:** Defeats Next.js 16 RSC benefits, increases client bundle, slower initial load.

**Instead:** Use Server Component pages with Client Component islands for interactivity.

**Example of what NOT to do:**

```typescript
// ❌ BAD: Entire page as Client Component
'use client'

import { useAgentList } from '@/stores/gateway/p0-selectors'

export default function DashboardPage() {
  const agents = useAgentList()
  return <div>{/* entire page UI */}</div>
}
```

**Correct approach:**

```typescript
// ✅ GOOD: Server page with Client components
import { AgentCardsGrid } from '@/components/dashboard/agent-cards-grid'

export default function DashboardPage() {
  return (
    <div className="hud-main">
      <AgentCardsGrid /> {/* Client component for interactive parts */}
    </div>
  )
}
```

### Anti-Pattern 2: Direct Store Access from Server Components

**What:** Importing and calling Zustand store directly in Server Components.

**Why bad:** Server Components can't use hooks, breaks Next.js RSC model.

**Instead:** Server Components fetch data via RPC/API or receive as props, Client Components use store selectors.

**Example of what NOT to do:**

```typescript
// ❌ BAD: Direct store access in Server Component
import { useGatewayStore } from '@/stores/gateway/gateway-store'

export default function DashboardPage() {
  const agents = useGatewayStore((state) => state.agents) // ERROR!
  return <div>{/* ... */}</div>
}
```

**Correct approach:**

```typescript
// ✅ GOOD: Client component for store access
import { AgentCardsGrid } from '@/components/dashboard/agent-cards-grid'

export default function DashboardPage() {
  return <AgentCardsGrid /> {/* Client component handles store */}
}
```

### Anti-Pattern 3: Hardcoded Visual Values

**What:** Hardcoding colors, spacing, clip-paths in component Tailwind classes.

**Why bad:** Breaks theme switching, inconsistent styling, hard to maintain.

**Instead:** Use semantic design tokens (CSS custom properties).

**Example of what NOT to do:**

```typescript
// ❌ BAD: Hardcoded values
<div className="bg-[#040a12] border border-[rgba(95,212,255,.18)] p-3">
```

**Correct approach:**

```typescript
// ✅ GOOD: Semantic tokens
<div className="bg-[var(--color-card)] border border-[var(--color-border)] p-[var(--spacing-md)]">
```

### Anti-Pattern 4: Monolithic Layout Files

**What:** Putting entire shell UI (header/sidebar/statusbar) in one layout file.

**Why bad:** Unmaintainable, hard to reuse, breaks component boundaries.

**Instead:** Extract sections into separate components.

**Example of what NOT to do:**

```typescript
// ❌ BAD: 500-line layout file
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="hud-head">
        {/* 100 lines of header UI */}
      </header>
      <main className="hud-main">
        {/* 200 lines of sidebar + content */}
      </main>
      <footer className="hud-foot">
        {/* 100 lines of status bar */}
      </footer>
    </div>
  )
}
```

**Correct approach:**

```typescript
// ✅ GOOD: Componentized layout
import { HUDHeader } from '@/components/hud/hud-header'
import { HUDStatusBar } from '@/components/hud/hud-status-bar'

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <HUDHeader />
      <main className="hud-main">{children}</main>
      <HUDStatusBar />
    </div>
  )
}
```

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **Client bundle size** | Current RSC + Client islands optimal | Code splitting by route, lazy-load heavy components | Edge caching, CDN distribution |
| **Real-time updates** | WebSocket per tab (current) | Consider shared WebSocket or server-sent events | Message queue (Redis), separate WebSocket service |
| **Store performance** | Current Zustand optimal | Add memoization, pagination for logs/data | Virtualized lists, time-windowed data retention |
| **Server load** | Single server fine | Horizontal scaling with sticky sessions | Load balancer, separate WebSocket servers |
| **Data persistence** | In-memory logs (current) | Add IndexedDB for local persistence | Server-side log aggregation, database |

**Current architecture scales to 10K users without changes.** Beyond that, consider:
- Separate WebSocket service (remove from app server)
- Message queue for event distribution
- Database-backed log persistence
- CDN + edge caching for static assets

## Recommended Build Order

Based on component dependencies and data flow:

### Phase 1: Foundation (M1 - Milestone 1)
**Goal:** Shell structure + design tokens

1. **Design Token System** (`app/globals.css`)
   - Semantic CSS variables for colors, spacing, typography
   - Clip-path utilities, effects (glow, shadows)
   - Light/dark theme variants
   - **Dependencies:** None
   - **Used by:** All UI components

2. **Root Layout** (`app/layout.tsx`)
   - HTML structure, font imports
   - Theme provider wrapper
   - Global styles
   - **Dependencies:** Design tokens
   - **Used by:** All pages

3. **Shell Layout** (`app/(dashboard)/layout.tsx`)
   - Grid structure (header/main/statusbar)
   - Route groups setup
   - Basic shell HTML structure
   - **Dependencies:** Root layout
   - **Used by:** All dashboard pages

### Phase 2: Core Components (M1)
**Goal:** Reusable HUD components

4. **HUD Card Component** (`components/hud/hud-card.tsx`)
   - Reusable card with HUD styling
   - Variant system (default/accent/alert)
   - **Dependencies:** Design tokens
   - **Used by:** Dashboard, workspace pages

5. **HUD Panel Component** (`components/hud/hud-panel.tsx`)
   - Panel with header/body structure
   - Collapsible optional
   - **Dependencies:** Design tokens
   - **Used by:** Sidebar, right panel

6. **Status Indicator** (`components/hud/status-indicator.tsx`)
   - Connection/status dots with animations
   - Color variants (idle/working/error/etc.)
   - **Dependencies:** Design tokens
   - **Used by:** Header, cards, status bar

7. **HUD Header** (`components/hud/hud-header.tsx`)
   - Brand logo, command palette input
   - Connection status integration
   - Clock display
   - **Dependencies:** Status indicator, gateway store selectors
   - **Used by:** Shell layout

8. **HUD Status Bar** (`components/hud/hud-status-bar.tsx`)
   - Gateway status, agent counts
   - Theme toggle
   - **Dependencies:** Gateway store selectors, theme provider
   - **Used by:** Shell layout

### Phase 3: Pages & Features (M2)
**Goal:** Complete dashboard functionality

9. **Dashboard Page** (`app/(dashboard)/dashboard/page.tsx`)
   - Agent cards grid
   - Quick stats panel
   - Alerts panel
   - **Dependencies:** HUD Card, gateway store selectors
   - **Used by:** Users

10. **Office Layout Page** (`app/(dashboard)/office/page.tsx`)
    - Visual office map
    - Agent positioning
    - **Dependencies:** Office layout store
    - **Used by:** Users

11. **Workspace Page** (`app/(dashboard)/workspace/[agentId]/page.tsx`)
    - Single agent detail view
    - Log viewer
    - Task list
    - **Dependencies:** HUD Card, gateway store selectors
    - **Used by:** Users

**Build Order Rationale:**
- Design tokens first → all components depend on them
- Shell layout early → provides structure for pages
- Reusable components before pages → avoid duplication
- Store integration last → requires components to exist

## Key Architecture Decisions

| Decision | Rationale | Tradeoffs |
|----------|-----------|-----------|
| **Server Component pages with Client islands** | Leverages Next.js 16 RSC for performance, keeps client bundle small | Requires careful component boundary planning |
| **Zustand for state** | Existing stores are stable, works well with Client Components | Can't use in Server Components (need selectors) |
| **Semantic CSS tokens** | Enables theme switching, consistent styling, easier maintenance | More upfront design work |
| **Route groups for shell** | Clean URL structure, shared layout without URL segment | Slightly more complex folder structure |
| **Grid-based shell layout** | Matches dashboard-hud.html reference, flexible responsive design | Requires careful breakpoint planning |

## Sources

- **Next.js 16 Documentation:** Official docs on App Router, layouts, Server Components (HIGH confidence)
- **Existing Codebase:** gateway/, stores/ structure analysis (HIGH confidence)
- **Design Reference:** dashboard-hud.html, dashboard.html (HIGH confidence)
- **Context7 Research:** Next.js App Router patterns, Server/Client Component composition (HIGH confidence)

**Confidence Assessment:**
- Stack & File Structure: HIGH (based on Next.js 16 docs + existing codebase)
- Component Boundaries: HIGH (clear separation from design reference + store structure)
- Data Flow: HIGH (existing gateway/store pattern proven in old version)
- Design Token System: HIGH (directly from dashboard-hud.html reference)
- Build Order: MEDIUM (logical dependencies, but may need adjustment during implementation)
