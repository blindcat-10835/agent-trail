# Phase 4: Multi-source Frontend Shell + Session Explorer - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Reshape the Next.js frontend from a single-source OVAO dashboard into a reusable multi-source shell with `[tool]`-first routing (`/openclaw/*`, `/claude-code/*`, `/codex/*`). Extract a shared ShellFrame, implement an AgentToolProvider/registry/profile system, connect session browsing to the ingest API via a BFF proxy layer, and preserve the OpenClaw overview as a skeleton to be filled later.

**Deliverables:**
- `[tool]` route segments with shared ShellFrame layout
- Header source switcher (OpenClaw / Claude Code / Codex)
- AgentToolDefinition types, registry, 3 tool profiles, capability gates
- BFF API proxy routes (`/api/agent-tools/[tool]/...`) proxying ingest
- Legacy redirects from `/dashboard`, `/sessions`, etc. to `/openclaw/*`
- Shared Session Explorer (table + filters + right rail detail) for all 3 sources
- Aggregate landing page with cross-source session list
- Per-tool dashboard pages (OpenClaw overview skeleton, Claude/Codex session stats)
- Profile-driven sidebar navigation

**Not in this phase:**
- OpenClaw Overview Gateway data population (cron, skills, agents, activity — deferred to Phase 6+)
- Turn replay UI components (Phase 5)
- File watcher / chokidar / SSE real-time sync (Phase 6)
- API path security hardening (Phase 6)

</domain>

<decisions>
## Implementation Decisions

### Routing + Shell Architecture
- **D-01:** Route model: `[tool]` URL segments (`/openclaw/*`, `/claude-code/*`, `/codex/*`). Sources are URL-segment-based, not query-param or client-state-based. This enables deep-linking, bookmarking, and parallel-tab comparison across sources.
- **D-02:** Shell migration: extract shared ShellFrame (header, sidebar, status bar, right rail frame) from current `app/(shell)/layout.tsx` into `components/shell/`. Create new `app/(tool-shell)/[tool]/layout.tsx` that validates `params.tool`, mounts `AgentToolProvider`, and renders ShellFrame. Do NOT duplicate shell components per tool.
- **D-03:** Source switcher placement: Header brand area becomes source switcher (OpenClaw / Claude Code / Codex tabs). Sidebar provides page-level navigation, built from profile-driven nav configuration. Switcher changes the URL (e.g., from `/openclaw/dashboard` to `/codex/dashboard`).
- **D-04:** Layout type: `[tool]/layout.tsx` is a Server Component for param validation; `AgentToolProvider` is a Client Component wrapper inside it. Single root layout — no multi-root-layout per tool (avoids full-page reload on source switch).
- **D-05:** Legacy redirects: `/dashboard` → `/openclaw/dashboard`, `/sessions` → `/openclaw/sessions`, `/activity` → `/openclaw/activity`, `/office` → `/openclaw/office`, `/workspace` → `/openclaw/workspace`. OpenClaw remains the default entry point for existing users.
- **D-06:** Aggregate landing page (`/`): cross-source session list (all 3 sources merged from ingest) in main area, with right rail showing session detail on click. A single view to see all sessions on the machine.

### API Proxy Layer
- **D-07:** Frontend data access pattern: BFF proxy via Next.js API routes at `/api/agent-tools/[tool]/...`. Frontend components never call ingest (`localhost:8078`) directly. Benefits: same-origin (no CORS), usable in Server Components, centralized error sanitization and path validation.
- **D-08:** API route organization: unified per-tool routing (`/api/agent-tools/[tool]/sessions`, `/api/agent-tools/[tool]/sessions/:id/turns`, etc.). Each tool gets a server adapter file. Frontend uses shared hooks (`useToolSessions`, `useReplayPage`) — no tool-conditional fetch logic in components.
- **D-09:** OpenClaw Gateway data scope: Gateway (WebSocket/Zustand) preserved ONLY for the OpenClaw Overview page's real-time data. Session browsing, session listing, and replay all go through ingest API proxy. GatewayBootstrap only runs within the OpenClaw `[tool]` layout. Gateway is NOT removed in Phase 4.

### Session Explorer Data Source
- **D-10:** Session Explorer queries only ingest API (indexed sessions). Real-time Gateway sessions are not merged into the session list. New sessions appear after ingest syncs them. Overview page (not Session Explorer) shows live Gateway sessions.
- **D-11:** Cross-source aggregation: landing page (`/`) merges all 3 sources' sessions from ingest into a single list, sorted by recency. Source badge differentiates entries.
- **D-12:** Right rail: always visible alongside any page, shows session list for the current tool (or aggregated list on the landing page). Clicking a session opens session detail in the same right rail panel.

### OpenClaw Overview Handling
- **D-13:** OpenClaw Overview (`/openclaw/dashboard`): keep the UI skeleton structure (KPI bar, card grids, section layouts) but do NOT populate Gateway live data content. cron/skills/agents/activity modules to be filled from local file data sources in Phase 6+.
- **D-14:** Claude Code dashboard (`/claude-code/dashboard`): show session summary statistics from ingest — total indexed sessions, breakdown by status/model, list of most recent sessions. No agent grid, no cron, no skills.
- **D-15:** Codex dashboard (`/codex/dashboard`): same pattern as Claude Code — session summary stats + recent session list from ingest. No sandbox/approval details (deferred to Phase 5+).

### Implementation Sequencing
- **D-16:** Wave 1 — Foundation types: define `AgentToolDefinition`, `AgentToolCapabilities`, `AgentToolUIProfile`, `ToolNavItem` types. Create tool registry with 3 entries (`openclaw`, `claude-code`, `codex`). Define capability gates. Pure config — no UI changes, no broken pages.
- **D-17:** Wave 2 — API proxy + redirects: implement `/api/agent-tools/[tool]/...` BFF route handlers. Create server adapter files per tool (`lib/agent-tools/[tool]/server-adapter.ts`). Add legacy route redirects (`/dashboard` → `/openclaw/dashboard`).
- **D-18:** Wave 3 — Shell migration: extract ShellFrame from `app/(shell)/layout.tsx`. Create `app/(tool-shell)/[tool]/layout.tsx`. Build header source switcher. Convert sidebar to profile-driven nav. ShellHeader reads `AgentToolUIProfile.brand`, SidebarNav reads `definition.nav`.
- **D-19:** Wave 4 — Session Explorer: implement shared SessionExplorer component (table with sortable/filterable columns, filter bar, detail right rail). OpenClaw first (validate against ingest data), then generalize columns/profiles for Claude/Codex.
- **D-20:** Wave 5 — Dashboard pages + aggregate landing: implement aggregate landing page at `/`. Build per-tool dashboard pages (OpenClaw skeleton, Claude/Codex session stats). Polish navigation transitions and empty states.

### the agent's Discretion
- AgentToolProvider internal implementation (context shape, registry lookup, href builder)
- Exact AgentToolDefinition type structure (fields, optional vs required, union types)
- Server adapter interface design (method signatures, error handling, response types)
- Session Explorer column definitions per tool (which columns show, filter schemas, status badge mapping)
- HUD design token preservation strategy during component extraction (glow, scanline, monospace, dark-first)
- Whether GatewayBootstrap is tool-scoped (only in OpenClaw layout) or global (runs for all tools)
- Right rail open/close toggle behavior across tools and pages
- Tool profile structure for Claude Code and Codex (capabilities, nav items, session columns)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Product positioning, constraints (Tech Stack, Data Plane, Source Scope), key decisions
- `.planning/REQUIREMENTS.md` — UI-01 through UI-05 and OPEN-01 are Phase 4 requirements
- `.planning/ROADMAP.md` § Phase 4 — Phase goal, success criteria, deliverables, dependencies
- `.planning/STATE.md` — Current project state (Phase 3 executing, Phase 2 4/5 plans done)

### Prior Phase Context
- `.planning/phases/01-trace-contract-brownfield-reset/01-CONTEXT.md` — Trace contract design (D-01 to D-15), dual status model (ingestStatus + gatewayStatus), HUD design preservation
- `.planning/phases/02-local-ingest-core-openclaw-parser/02-CONTEXT.md` — Ingest service architecture (Hono, port 8078, REST API at `/api/v1/...`), SQLite schema, concurrently dev workflow
- `.planning/phases/03-claude-codex-parsers-turn-assembly/03-CONTEXT.md` — Claude/Codex parser behavior, turn assembly completeness, source discovery paths

### Architecture Research
- `.planning/research/ARCHITECTURE.md` — Multi-source frontend architecture research with route structure, ShellFrame extraction, AgentToolProvider interface, adapter/provider pattern, replay component tree, migration points, anti-patterns, and build order recommendation. **This is the primary architectural reference for Phase 4 decisions.**
- `.planning/research/STACK.md` — Tech stack rationale (Next.js, TypeScript, Tailwind v4, shadcn/ui, Zustand, Hono)
- `.planning/research/SUMMARY.md` — Project research synthesis

### Trace Contract & Data Types
- `types/trace.ts` — Canonical trace types (TraceSource, TraceSession, TraceTurn, TraceMessage, TraceToolCall, etc.) that frontend components consume
- `gateway/types.ts` — Gateway WebSocket protocol types (preserved for OpenClaw Overview)
- `gateway/adapter-types.ts` — Dashboard display types (ChannelInfo, SkillInfo, SessionInfo, etc.)

### Ingest Service
- `ingest/api/` — Ingest REST API handlers (session, turn, message, tool-call endpoints) — patterns to mirror in BFF proxy
- `ingest/db/schema.sql` — SQLite schema (sessions, messages, tool_calls, tool_result_events, turns tables) — defines available query fields
- `ingest/config/` — Source configuration and discovery patterns

### Existing Frontend (to be refactored)
- `app/(shell)/layout.tsx` — Current shell (GatewayBootstrap, ShellHeader, SidebarNav, ShellStatusBar, DashboardRightRail) — source to extract ShellFrame from
- `components/hud/shell-header.tsx` — Current header with hardcoded OVAO brand and nav items
- `components/dashboard/sidebar-nav.tsx` — Current sidebar with hardcoded NAV_ITEMS
- `components/dashboard/overview-tab.tsx` — Current OpenClaw overview (KPI, agents, sessions, cron, skills, activity) — skeleton to preserve
- `components/sessions/sessions-table.tsx` — Current session table (columns, status badges) — base for shared Session Explorer table
- `components/sessions/sessions-filter-bar.tsx` — Current filter bar pattern
- `components/sessions/sessions-detail-rail.tsx` — Current detail rail (fetches messages itself — to be replaced)
- `app/globals.css` — HUD design tokens (@theme inline, glow, scanline, monospace, dark-first) — preserve during extraction

### Reference Implementation
- `../references/agentsview/` — agentsview Svelte frontend (MessageList, MessageContent, ToolBlock, SubagentInline, display-items, content-parser patterns)
- `../references/agentsview/internal/parser/types.go` — AgentType, AgentDef, Registry structure reference

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/(shell)/layout.tsx` — Shell structure (48px header, 56px sidebar, right rail, 26px status bar) to preserve. Contains GatewayBootstrap, ShellHeader, SidebarNav, ShellStatusBar, DashboardRightRail. Extract into `components/shell/shell-frame.tsx`.
- `components/hud/shell-header.tsx` — Header nav and brand structure. Hardcoded OVAO brand label and Dashboard/Office nav to be replaced with profile-driven values from AgentToolUIProfile.
- `components/dashboard/sidebar-nav.tsx` — Vertical icon-based nav bar (OVR, AGT, USD, SKL, ACT, SES). Structure preserved, NAV_ITEMS replaced by profile configuration. Active state detection uses pathname + searchParams.
- `components/hud/shell-status-bar.tsx` — Bottom status bar. Reusable as-is across all tools.
- `components/hud/status-indicator.tsx` — Gateway connection indicator. Reusable as-is for OpenClaw; may show "ingest connected" for Claude/Codex.
- `components/sessions/sessions-table.tsx` — Session table with sortable columns, selectable rows, model/status display. Column definitions need to be injectable per tool profile.
- `components/sessions/sessions-filter-bar.tsx` + `useSessionsFilter` — Filter pattern (search, models, kinds). Adapt to ingest query parameters.
- `components/sessions/sessions-stats-bar.tsx` — Stats overview bar (total, active, error counts). Reusable.
- `components/hud/hud-panel.tsx` — HUD-styled panel container. Reusable for right rail and detail views.
- `gateway/` — Gateway WebSocket RPC client and event parser. Preserved for OpenClaw Overview only.

### Established Patterns
- Zustand stores: `useUIStore` (rightRailOpen state), `useGatewayStore` (agents, sessions, cron, skills, activity, usage). `useGatewayStore` stays for OpenClaw Overview; all other pages move to fetch-based data from BFF proxy.
- HUD design system: cyberpunk dark theme with glow effects, scanline aesthetics, monospace typography, `@theme inline` CSS custom properties. All new components preserve this visual language.
- `@/*` path alias: all imports use `@/` prefix (e.g., `@/components/shell/shell-frame`). New files follow the same convention.
- `'use client'` directive: all interactive components are client components. Hook files do NOT include the directive (imported by client components).
- Route groups: `(shell)` pattern currently excludes route group name from URL. New `(tool-shell)` follows the same pattern.
- Suspense boundaries: pages that use `useSearchParams` are wrapped in `<Suspense>`. Shell components use `Suspense` for async-dependent parts.
- TypeScript strict mode: all new code passes `tsc --noEmit`. No `any` types without justification.
- pnpm: single package manager, no npm/yarn mixing.

### Integration Points
- `app/(tool-shell)/[tool]/layout.tsx` — NEW file. Mounts AgentToolProvider, renders ShellFrame. Replaces `app/(shell)/layout.tsx` as primary shell.
- `app/(legacy)/` — NEW route group. Contains redirect-only pages for old routes.
- `lib/agent-tools/` — NEW directory. Types, registry, server adapters, client hooks. Core of the multi-source abstraction.
- `components/shell/` — NEW directory (potentially renamed from `components/hud/`). Extracted ShellFrame and profile-driven header/sidebar.
- `ingest/api/` — Existing ingest endpoints at `localhost:8078`. BFF routes proxy to these. Response shapes need to be understood for proxy pass-through or transformation.
- Gateway WebSocket — Preserved in OpenClaw layout scope. GatewayBootstrap validates this connection is still live for overview data.
- `stores/` directory — Currently missing from working tree (exists in `.claude/worktrees/`). Need to verify location and restore or rebuild `stores/ui-store.ts` before ShellFrame extraction. Gateway store remains as-is.

</code_context>

<specifics>
## Specific Ideas

- Right rail is the primary session browsing surface — sessions live there, not in a separate `/sessions` page. The `/sessions` page may redirect to the landing page or become redundant.
- OpenClaw overview skeleton is a deliberate decision — don't delete the overview UI code, just disconnect it from Gateway data for now. It will be repopulated from local file data sources in Phase 6+.
- aggregate landing page (`/`) shows "all sessions on this machine" across all 3 sources — a quick-glance entry point before drilling into a specific source.
- HUD cyberpunk design language (glow, scanline, monospace, dark-first) is preserved throughout. AgentToolProvider and profiles do not change visual identity.
- Gateway is acknowledged as a legacy data source that should be gradually deprecated toward local file analysis, but that migration belongs to Phase 6+.

</specifics>

<deferred>
## Deferred Ideas

- Gateway full deprecation and migration to local file analysis — Phase 6 or future milestone
- OpenClaw Overview data population (cron, skills, agents, activity modules) — Phase 6+, when local file data sources are available for these concepts
- Claude Code dashboard: subagents/todos/hooks/transcript boundaries — Phase 5+
- Codex dashboard: sandbox approvals/patch summaries/command execution — Phase 5+
- Tool-agnostic session health/outcome/failure signals — Phase 6+

</deferred>

---

*Phase: 04-Multi-source Frontend Shell + Session Explorer*
*Context gathered: 2026-05-06*
