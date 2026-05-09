# Frontend service deep-dive

The Next.js frontend is a server-rendered React app that browses the local trace store and replays sessions turn-by-turn. This document describes the layers — routing, BFF, agent-tool registry, stores, replay UI — and how they fit together.

System context: [`../ARCHITECTURE.md`](../ARCHITECTURE.md). The HTTP shape it consumes: [`../API.md`](../API.md). The service it talks to: [`./ingest.md`](./ingest.md).

---

## 1. Module map

```text
app/
├── layout.tsx                          # Root layout: JetBrains Mono + Inter, theme bootstrap, IngestHealthOverlay
├── page.tsx                            # /  →  redirect('/all/dashboard')
├── globals.css                         # Tailwind v4 + @theme inline tokens (no tailwind.config.js)
├── favicon.ico
├── (tool-shell)/                       # Route group — wraps every per-tool page in the shell
│   └── [tool]/                         # Dynamic segment: openclaw | claude-code | codex | all
│       ├── layout.tsx                  # Server component: assertAgentToolId(tool) → ToolLayoutClient
│       ├── tool-layout-client.tsx      # 'use client': AgentToolProvider + ShellFrame wrapper
│       ├── dashboard/
│       │   ├── page.tsx                # Per-tool dashboard
│       │   ├── openclaw-dashboard.tsx  # OpenClaw-specific overview
│       │   └── session-stats-dashboard.tsx
│       ├── sessions/
│       │   ├── page.tsx                # AggregateSessionsView | SessionStatsDashboard
│       │   └── [sessionId]/page.tsx    # Turn-by-turn replay UI
│       └── activity/page.tsx
└── api/                                # All server-side routes (see API.md for HTTP contract)
    ├── agent-tools/[tool]/             # BFF proxies (D-07): health, sessions, sessions/:id, .../messages, .../turns, sessions/lookup, sync, events
    ├── ingest/health/                  # Frontend-facing ingest health
    ├── sync/                           # All-source aggregate sync
    ├── logs/                           # Reads activity logs from local FS
    ├── sessions/messages/              # Legacy OpenClaw file-scan endpoint (preserved)
    └── action/{restart,update}/        # OpenClaw service control (Linux/systemd)

lib/
├── utils.ts                            # cn() — clsx + tailwind-merge
├── env.ts                              # requireEnv / optionalEnv
├── api-error.ts                        # apiErrorResponse helper
├── logs.ts                             # Activity log reader
├── parseFixture.ts                     # Test/CI fixture parser dispatch
├── agent-avatar-utils.ts               # Avatar + initials helpers
└── agent-tools/                        # Per-tool registry, server adapters, client hooks
    ├── types.ts                        # AgentToolId, AgentToolDefinition, capabilities, UI profile
    ├── registry.ts                     # AGENT_TOOL_DEFINITIONS, assertAgentToolId, assertSourceToolId
    ├── server-adapter.ts               # Base interface + fetchIngest + sanitizeError + source-scoping helpers
    ├── client-hooks.tsx                # AgentToolProvider, useAgentTool, useSessionDetail, useSessionTurns, syncToolSessions
    ├── capability-gate.tsx             # Conditional render by capability
    ├── all/definition.ts               # Synthetic aggregate scope
    ├── openclaw/{definition,server-adapter}.ts
    ├── claude-code/{definition,server-adapter}.ts
    └── codex/{definition,server-adapter}.ts

stores/                                 # Zustand
├── tool-store.ts                       # Selected session, sidebar UI state
├── replay-store.ts                     # Per-turn expand/collapse, search, scroll position
├── ui-store.ts                         # Right rail open, modal state
├── ingest-health-store.ts              # 'checking' | 'connected' | 'timeout' health probe
├── theme-store.ts                      # 'light' | 'dark' | 'system' (bootstrap script in app/layout.tsx)
└── office-layout/                      # OpenClaw 2D office floor plan persistence

components/
├── ui/                                 # shadcn/ui (button, card, badge, input, separator, scroll-area, select, skeleton, tooltip)
├── shell/                              # ShellFrame, ShellHeader, ShellStatusBar, SidebarNav, RightRail, SourceSwitcher
├── replay/                             # TurnTimeline (virtualized), TurnCard, ToolBlock, SkillBlock, SubagentBlock, ThinkingBlock, SystemEventBlock, ReplaySearchBar, ReplayHeader, ReplayRightRail, TurnNavigator, MarkdownContent, key-utils
├── sessions/                           # AggregateSessionsView, SessionsRightRail, SessionsStatsBar
├── activity/                           # ActivityEntryDrawer, ActivitySummaryCards, LogBrowser
├── dashboard/empty-state.tsx
└── hud/                                # HudPanel, IngestHealthOverlay, ThemeToggle

types/
├── trace.ts                            # Canonical contract (TraceSession, TraceTurn, TraceMessage, TraceActivity, ...)
├── activity.ts                         # LogEntry, LogSummary
└── log.ts                              # Log shapes
```

---

## 2. Routing

The app uses Next.js App Router with one route group `(tool-shell)/` and one dynamic segment `[tool]`.

### 2.1 Top-level

| URL | File | Purpose |
| --- | --- | --- |
| `/` | `app/page.tsx` | `redirect('/all/dashboard')` — there is no plain root page |
| `/api/*` | `app/api/.../route.ts` | All server routes (see [`../API.md`](../API.md)) |

### 2.2 Per-tool

The route group `(tool-shell)/` is invisible in URLs. `[tool]` is a dynamic segment.

| URL pattern | Resolves via |
| --- | --- |
| `/<tool>/dashboard` | `app/(tool-shell)/[tool]/dashboard/page.tsx` |
| `/<tool>/sessions` | `app/(tool-shell)/[tool]/sessions/page.tsx` |
| `/<tool>/sessions/<id>` | `app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx` (turn-by-turn replay) |
| `/<tool>/activity` | `app/(tool-shell)/[tool]/activity/page.tsx` |

`<tool>` must be one of `openclaw | claude-code | codex | all`. The shell layout validates it via `assertAgentToolId`; anything else triggers `notFound()` (Next 404).

### 2.3 Shell layout

`app/(tool-shell)/[tool]/layout.tsx` is a **server component**: it awaits `params`, validates the tool ID, and renders `<ToolLayoutClient toolId={...}>`. The client component installs `<AgentToolProvider>` and the `<ShellFrame>` chrome around its children.

`ShellFrame` is a 3-row CSS grid:

```text
┌────────────────────────────────────────────────────────────┐ 48px  ShellHeader (brand, source switcher, theme toggle)
├──┬─────────────────────────────────────┬───────────────────┤
│ S│                                     │                   │
│ I│                                     │   RightRail       │
│ D│         page children               │   (360px when     │
│ N│                                     │    open, 0 else)  │
│ A│                                     │                   │
│ V│                                     │                   │
├──┴─────────────────────────────────────┴───────────────────┤ 26px  ShellStatusBar (INGEST · ONLINE/OFFLINE/RECONNECTING)
└────────────────────────────────────────────────────────────┘
56px
```

The grid template columns animate between `'56px 1fr 0px'` and `'56px 1fr 360px'` when `useUIStore((s) => s.rightRailOpen)` flips.

---

## 3. Agent-tool registry

The registry is the single source of truth for "what does each tool look like in the UI?".

```ts
// lib/agent-tools/registry.ts
export const AGENT_TOOL_DEFINITIONS: Record<AgentToolId, AgentToolDefinition> = {
  all: allDef,
  openclaw: openclawDef,
  'claude-code': claudeCodeDef,
  codex: codexDef,
}

export const TOOL_IDS: SourceToolId[] = ['openclaw', 'claude-code', 'codex']           // ingest-backed only
export const SHELL_TOOL_IDS: AgentToolId[] = ['all', ...TOOL_IDS]                       // includes aggregate
```

Each `AgentToolDefinition` ([`lib/agent-tools/types.ts`](../../lib/agent-tools/types.ts)) carries:

- `id`, `label`, `shortLabel`, `defaultRoute`
- `capabilities` — feature flags (`sessions`, `replay`, `activity`, `office`, `workspace`, `subagents`, `cost`, `approvals`)
- `nav` — sidebar items, each with optional `requiredCapability`
- `ui` — `brand`, `sessionColumns`, `dashboardSlots?`, `replayBlocks?`, formatters

Current tool capabilities (from the four definition files):

| Tool | sessions | replay | activity | office | workspace | subagents | cost | approvals |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **openclaw** | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ |  |
| **claude-code** | ✓ | ✓ | ✓ |  |  | ✓ |  |  |
| **codex** | ✓ | ✓ | ✓ |  |  |  |  |  |
| **all** | ✓ |  |  |  |  |  |  |  |

The two trust-boundary validators:

- `assertAgentToolId(raw)` accepts `all | openclaw | claude-code | codex` — used in shell URL parsing.
- `assertSourceToolId(raw)` accepts only the three ingest sources — used in BFF route handlers, where `all` is meaningless.

Both throw with a descriptive error listing valid IDs, which the BFF turns into a 400 via `sanitizeError`.

---

## 4. BFF (server adapters)

`lib/agent-tools/server-adapter.ts` defines the contract:

```ts
interface AgentToolServerAdapter {
  toolId: string
  health(): Promise<{ status: string; version?: string }>
  listSessions(query: Record<string, string>): Promise<SessionListResult>
  getSession(sessionId: string): Promise<TraceSession | null>
  getSessionMessages(sessionId: string): Promise<unknown[]>
  getSessionTurns(sessionId: string, query?: TurnsQueryParams): Promise<TurnsListResult>
  lookupSessionByKey(key: string): Promise<TraceSession | null>
}
```

Each tool gets a tiny adapter implementation (see [`lib/agent-tools/openclaw/server-adapter.ts`](../../lib/agent-tools/openclaw/server-adapter.ts)) that:

- Sets `SOURCE = '<tool>'`.
- Calls `buildSourceScopedSessionParams(SOURCE, query)` for list queries — this **deletes any caller-supplied `source` key** and re-injects the adapter's source. Caller-controlled source filtering is impossible here.
- Calls `getSourceScopedSession(sessionId, SOURCE)` for `getSession`, which fetches the session from ingest and returns `null` if `session.source !== SOURCE`. Cross-source isolation lives here.
- Calls `requireSourceScopedSession(sessionId, SOURCE)` before fetching child resources (messages / turns) so cross-source access throws.

`fetchIngest<T>(path, options?)` is the shared HTTP client. It:

- Prefixes `INGEST_URL` (default `http://localhost:8078`).
- Times out at 5 seconds via `AbortController`.
- Sets `Content-Type: application/json` and serializes `body` as JSON.
- Forwards Next-style cache options (`cache`, `next.revalidate`, `next.tags`).
- Throws with the upstream `error` field if present, else `Ingest returned <status>`.
- Special-cases `AbortError` → `Error('Ingest service request timed out')`.

`sanitizeError(err)` turns:

- `SessionValidationError` → `{ error: err.message, code: err.code }`
- `Invalid (source|agent) tool ID …` → `{ error, code: 400 }`
- everything else → `{ error: 'Ingest service unreachable', code: 502 }`

This is why frontend errors look generic — that's intentional. Real causes appear only in the `[INGEST]` log.

The BFF route handlers themselves are thin: validate → dispatch → sanitize. See [`app/api/agent-tools/[tool]/sessions/route.ts`](../../app/api/agent-tools/%5Btool%5D/sessions/route.ts) for the canonical pattern.

---

## 5. Client hooks (`lib/agent-tools/client-hooks.tsx`)

All consumer components access the current tool through `useAgentTool()`:

```tsx
const { toolId, capabilities, href, definition } = useAgentTool()
// href('/sessions') → '/openclaw/sessions' (when toolId === 'openclaw')
```

Calling outside an `<AgentToolProvider>` throws with a descriptive message — useful for catching misconfiguration in dev.

Data hooks all hit the BFF. They never call ingest directly.

| Hook | What it does |
| --- | --- |
| `useToolSessions(toolId, query)` | List sessions for a tool. Calls `/api/agent-tools/<tool>/sessions?...`. |
| `useSessionDetail(toolId, sessionId)` | Fetch one session via `/api/agent-tools/<tool>/sessions/<id>`. |
| `useSessionTurns(toolId, sessionId, { offset, limit })` | Fetch turns via `/api/agent-tools/<tool>/sessions/<id>/turns?offset=&limit=`. |
| `syncToolSessions(toolId, { force? })` | POST to `/api/agent-tools/<tool>/sync`. Throws on non-OK. |
| `syncAggregate({ force? })` | POST to `/api/sync` for all-source sync. |
| `notifySessionsRefresh()` | Dispatches `agent-tracing-dashboard:sessions-refresh` window event for cross-component refresh. |

Hooks subscribe to SSE via `EventSource('/api/agent-tools/<tool>/events?sessionId=...')` (per-session) or `'/api/agent-tools/<tool>/events'` (global). On `session_updated`, they refetch — events carry only IDs, never inline data (D-12).

---

## 6. State management (`stores/`)

State is split by concern; nothing lives in a single global store.

| Store | What it owns |
| --- | --- |
| `tool-store` | Currently-selected sessionId (`selectedSessionId`), sidebar collapsed/expanded, etc. |
| `replay-store` | Per-turn `expandedTurns: Set<string>`, `searchQuery`, `searchMatches`, `currentMatchIndex`, `currentTurnIndex`, `focusedTurnId`, scroll positions per session ID. |
| `ui-store` | `rightRailOpen`, modal state — visual chrome only. |
| `ingest-health-store` | `status: 'checking' \| 'connected' \| 'timeout'`, `hasConnectedOnce: boolean`, plus `retry / setConnected / setTimeout` actions. Polled by `IngestHealthOverlay`. |
| `theme-store` | `'light' \| 'dark' \| 'system'`. **Bootstrapped synchronously** via the inline script in `app/layout.tsx` to avoid FOUC. The store hydrates after mount. |
| `office-layout/office-layout-store` + `office-map` | OpenClaw office 2D floor-plan layout persistence (drag positions, zoom). |

Stores never call APIs directly. Hooks own the network; stores own the cross-component state.

---

## 7. Shell components (`components/shell/`)

- `ShellFrame` — the 3-row grid above. Reads `useUIStore` for right-rail state.
- `ShellHeader` — brand block (uses `definition.ui.brand`), `<SourceSwitcher>`, theme toggle.
- `ShellStatusBar` — bottom bar showing ingest connection status from `useIngestHealthStore`.
- `SidebarNav` — fixed 56px column. Renders `definition.nav` filtered by `requiredCapability`; active route highlight via `usePathname`.
- `RightRail` — context-sensitive panel. On the sessions page it shows session detail; on replay it shows turn navigator + metadata.
- `SourceSwitcher` — buttons for each tool from `getAllDefinitions()`. On click, computes the destination route via `buildSourceSwitchHref(pathname, targetToolId, tools)` so deep links survive the switch (e.g. `/openclaw/sessions` → `/codex/sessions`).
- `source-switcher-routing.ts` — pure function for the route mapping; covered by `tests/unit/bff/source-switcher-routing.test.ts`.

---

## 8. Replay UI (`components/replay/`)

The most complex feature. The session replay route at `/<tool>/sessions/<sessionId>` ([`app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx`](../../app/(tool-shell)/%5Btool%5D/sessions/%5BsessionId%5D/page.tsx)) drives the layout:

1. Calls `useSessionDetail(toolId, sessionId)` for header/metadata.
2. Calls `useSessionTurns(toolId, sessionId, { offset: 0, limit: 50 })` for the first page of turns.
3. Maintains accumulated turns across pagination — appends new pages to `allTurns` state on `handleLoadMore`.
4. Renders `<ReplayHeader>`, optional `<SessionStatusBar>`, `<ReplaySearchBar>`, `<TurnNavigator>`, then either skeleton, "NO TURNS" empty state, or `<TurnTimeline>`.

### `TurnTimeline`

- Uses `@tanstack/react-virtual` when `turns.length > 15` or `hasMore`. Short sessions render flat (no virtualizer).
- Auto-expands all turns on first load when length ≤ 10.
- Persists scroll position per session ID via `useReplayStore` so back-navigation restores it.
- Calls `onLoadMore` when nearing the bottom — parent appends the next page.

### `TurnCard`

- Renders one turn: user message, assistant messages, activities (tool / skill / subagent / thinking / system).
- Activities are anchored to specific message ordinals when possible — `groupActivityEntriesByOrdinal` interleaves them with assistant messages so a tool call appears next to the message that triggered it.
- Collapsed view shows badges (`toolCount`, `skillCount`, `subagentCount`).
- Copy-turn button writes a markdown-formatted `## Turn N\n**User:** ... \n**Assistant:** ...` to clipboard.

### Block components

Each activity type has its own block component, all under `components/replay/`:

- `tool-block.tsx` — input JSON viewer + result events (with partial-stream support)
- `skill-block.tsx` — skill metadata + invocation
- `subagent-block.tsx` — link to subagent session, recursive replay link
- `thinking-block.tsx` — collapsible thinking trace
- `system-event-block.tsx` — compact / system messages with subtype-aware rendering
- `markdown-content.tsx` — `react-markdown` + `remark-gfm`, used for assistant message bodies

`key-utils.ts` exports `getTurnKey`, `getActivityKey`, `getMessageKey` — stable keys for React reconciliation across re-renders. Tested in `tests/unit/bff/replay-key-utils.test.ts`.

### Search

`ReplaySearchBar` writes to `useReplayStore.searchQuery`. `TurnCard` uses the query to compute and highlight matches; the store also tracks `searchMatches` and `currentMatchIndex` for next/previous navigation, which `TurnNavigator` exposes as keyboard-accessible UI.

---

## 9. Sessions list (`components/sessions/`)

- `AggregateSessionsView` — used when `toolId === 'all'`. Shows sessions across all sources, with the wider `sessionColumns` from `all/definition.ts` (includes `project` column).
- `SessionStatsDashboard` — used for single-source views. Renders the per-tool dashboard plus the sessions table with the tool-specific column set.
- `SessionsRightRail` — session detail drawer when a row is selected.
- `SessionsStatsBar` — summary numbers row.

---

## 10. HUD components (`components/hud/`)

- `IngestHealthOverlay` — full-screen overlay shown by `app/layout.tsx`. Polls `/api/ingest/health` and updates `ingest-health-store`. While the ingest service is unreachable or warmup hasn't completed, this surfaces a visible "INGEST UNAVAILABLE" state instead of leaving the user staring at empty data.
- `HudPanel` — generic styled panel container shared across dashboard widgets.
- `ThemeToggle` — light / dark / system selector that updates `theme-store` and writes the selection to `localStorage` (`theme-storage` key, read by the synchronous bootstrap script).

---

## 11. Styling

- **Tailwind v4.** No `tailwind.config.js` — theme tokens live in `app/globals.css` inside `@theme inline { ... }`. PostCSS pipeline is just `@tailwindcss/postcss` (`postcss.config.mjs`).
- **Semantic tokens only.** Use `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`, `text-accent`, `text-destructive`, `bg-card`. Don't hardcode hex/oklch in component files.
- **OKLCH color space** with the `radix-nova` shadcn style. Status colors in `components/replay/[sessionId]/page.tsx`'s `SessionStatusBar` use raw `oklch(...)` for narrow accent purposes — copy that pattern when you need a one-off non-token color.
- **Both themes must pass WCAG AA.** Verify with the toggle.
- **Fonts.** `JetBrains Mono` (mono `--font-jetbrains-mono`) and `Inter` (sans `--font-inter`) loaded via `next/font/google` in `app/layout.tsx` with `display: 'swap'`.
- **HUD utilities.** `hud-clip-sm` is a custom utility (defined in `globals.css`) used for the cyberpunk-style angular borders on buttons and cards.

---

## 12. Adding a frontend feature

Use the playbook in [`../DEVELOPMENT.md`](../DEVELOPMENT.md#43-adding-a-frontend-page) for the full set. Quick checklist:

1. Decide whether it's per-tool or global. Per-tool → `app/(tool-shell)/[tool]/...`. Global → `app/...` outside the route group.
2. If it should be hidden for some tools, add a `nav` item with `requiredCapability` to the relevant tool definition in `lib/agent-tools/<tool>/definition.ts`.
3. For data, write a hook in `client-hooks.tsx` that hits the BFF. Don't call ingest directly.
4. For state, pick the smallest store that fits. Don't dump UI state into `tool-store`.
5. For UI primitives, use `pnpm dlx shadcn@latest add <name>` — don't hand-write `components/ui/`.
6. For tokens, add to `app/globals.css`'s `@theme inline { ... }`. Don't reach for hex.

If you're adding a new ingest source, the frontend side is: (a) tool definition in `lib/agent-tools/<source>/definition.ts`, (b) server adapter in `lib/agent-tools/<source>/server-adapter.ts` (copy from openclaw), (c) registration in `registry.ts`, (d) extend `assertSourceToolId`'s allowlist via `TOOL_IDS`. The BFF route handlers will dispatch automatically; no changes there.
