# Phase 5: Turn Replay UI - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning
**Mode:** Smart Discuss (autonomous — all recommended answers accepted)

<domain>
## Phase Boundary

Implement the main user-facing replay experience: a virtualized turn timeline that shows each user-agent exchange with tools, skills, subagents and activity in context.

**Deliverables:**
- Session replay page at `/openclaw/sessions/[sessionId]` (reuses existing route path)
- Full-page replay layout with collapsible right rail for session metadata
- Turn cards with user input, assistant response, and structured activity blocks
- Tool blocks with category/name, input/output, status/error/duration, copy action
- Skill blocks with skill name, input summary, result/status
- Subagent blocks with lazy-load, bounded nesting (depth 2), "open full session" link
- Virtualized turn list using `@tanstack/react-virtual` for sessions >15 turns
- In-session search, block filter chips, prev/next turn navigation
- Session status indicators: running/awaiting-user/aborted/error/truncated/parser-warning

**Not in this phase:**
- SSE real-time refresh (Phase 6)
- OpenClaw live Gateway drilldown integration (Phase 6)
- Parser fixture/regression tests (Phase 6)
- Sync status & file watcher (Phase 6)

</domain>

<decisions>
## Implementation Decisions

### Replay Page Layout & Route Structure
- Clicking a session row in Session Explorer navigates to `/openclaw/sessions/[sessionId]` — no new route group needed. Replay is the page content when a session is selected.
- Full-page replay layout with right rail collapsed to a toggle. Right rail shows session metadata (start/end time, model, stats, source info) and turn navigation thumbnails.
- Browser back button returns to session list with filters preserved via URL state. Breadcrumb in replay header: `Sessions > {session-name}`.
- "View Session" button in the existing right-rail session detail card also navigates to replay.

### Turn Card Structure & Content Rendering
- Short sessions (≤10 turns): all turns expanded on first load. Long sessions: collapsed by default with "Expand all" / "Collapse all" toggle. Per-turn expand state persisted during the session view.
- Tool blocks: inline collapsible sub-cards between user and assistant messages. Each shows icon + tool name + category + status badge + duration. Click expands to show input JSON (syntax highlighted) and result event stream. Copy button on each tool block.
- Skill blocks: same visual hierarchy as tool blocks (inline sub-card) but with distinct icon/color. Shows skill name, truncated input summary, status badge. Expand for full input/output.
- Subagent blocks: inline card with subagent session ID + "Load subagent" lazy fetch button. Once loaded, shows nested mini-timeline capped at depth 2. "Open full session" link button navigates to `/openclaw/sessions/[childSessionId]`.

### Virtualization & Performance
- Library: `@tanstack/react-virtual` — headless, lightweight (5KB), supports variable-height turn cards.
- Data loading: turns fetched from BFF proxy as paginated list (`?offset=N&limit=50`). Virtualized list renders only visible cards. Pre-fetch next page when scrolling near bottom. Cache keyed by sessionId+filter.
- Threshold: virtualize when session has >15 turns. Below that, render all turns directly.
- Scroll position: session-scoped in a Zustand `useReplayStore`. Restored on back-navigation to same session. Reset on session change or filter change. Keyed by sessionId.

### Search, Filters & Navigation
- In-session search: search bar at top of replay, highlights matching turns/messages inline with jump-to-match navigation. Debounced 300ms. Searches message content and tool names.
- Block filter chips: toggle bar above turn list — `All | User | Assistant | Tools | Skills | Subagents | System`. Multi-select, persisted in URL search params (`?filter=user,tools`).
- Turn navigation: prev/next turn buttons + keyboard shortcuts (j/k or ↑/↓), scroll to turn with smooth animation. Current turn indicator in virtualized list. Jump-to-turn-N input.

### the agent's Discretion
- Exact component hierarchy and file organization (layout components, turn card inner structure)
- Styling details within HUD design system (cyberpunk dark theme, glow, monospace)
- `useReplayStore` Zustand store shape (scroll position, expand states, filter state, search state)
- `useSessionTurns` data hook implementation details (pagination, pre-fetching, cache invalidation)
- Tool block JSON rendering approach (syntax highlighting library or inline code block)
- Keyboard shortcut binding strategy (global vs scoped)
- Exact turn card CSS/animation for expand/collapse transitions
- Search highlight implementation (mark.js vs custom regex highlight)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/api/agent-tools/[tool]/sessions/[sessionId]/turns/route.ts` — BFF proxy endpoint for turns, already proxying ingest. Reuse as data source.
- `app/api/agent-tools/[tool]/sessions/[sessionId]/route.ts` — Session detail BFF proxy. Reuse for session metadata in right rail.
- `lib/agent-tools/client-hooks.tsx` — AgentToolProvider, `useAgentTool()`, `fetchToolApi` utility, `useSessionDetail` hook. Extend with `useSessionTurns` hook.
- `components/sessions/sessions-detail-rail.tsx` — Existing right rail pattern. Adapt to replay right rail.
- `components/shell/shell-frame.tsx` — Shared shell frame. Replay page renders inside this.
- `components/hud/hud-panel.tsx` — HUD-styled panel container. Reusable for turn cards.
- `components/hud/status-indicator.tsx` — Status indicator pattern. Reuse for session status display.
- `components/ui/` — shadcn/ui components (button, card, input, badge, separator, skeleton).
- `types/trace.ts` — TraceTurn, TraceActivity, TraceToolCall, TraceSkillUse, TraceSubagentLink, TraceMessage types — canonical model the replay consumes.

### Established Patterns
- BFF proxy for all data access (`/api/agent-tools/[tool]/...`) — never call ingest directly.
- AgentToolProvider context for tool-aware components.
- Zustand stores: `useUIStore`, `useToolStore`, `theme-store.ts` — follow same pattern for `useReplayStore`.
- `'use client'` directive on interactive components. Hooks without directive.
- HUD design system: dark cyberpunk theme, glow effects, monospace typography, `@theme inline` CSS custom properties.
- Tailwind v4 + class-variance-authority for component variants.
- Route groups: `(tool-shell)/[tool]` pattern. New replay page goes under existing `app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx`.

### Integration Points
- `app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx` — NEW file. Replay page content. Reads `params.sessionId` and `params.tool`.
- `lib/agent-tools/client-hooks.tsx` — Add `useSessionTurns` hook. Follows `fetchToolApi` pattern.
- `stores/` — Add `replay-store.ts` (Zustand) for scroll position, expand states, filters, search.
- `components/replay/` — NEW directory. TurnCard, ToolBlock, SkillBlock, SubagentBlock, TurnTimeline, ReplaySearchBar, ReplayFilterBar, ReplayRightRail, TurnNavigator.
- `ingest/api/` — Turns endpoint at `GET /api/v1/sessions/:id/turns?offset=N&limit=M` (verify exact shape from existing adapter).
- Session Explorer table — Click handler on session row navigates to replay using `useAgentTool().href('/sessions/' + sessionId)`.

### Dependencies to Add
- `@tanstack/react-virtual` — For turn list virtualization.
- No additional heavy dependencies needed beyond this.

</code_context>

<specifics>
## Specific Ideas

- Replay is the primary user experience in this project — it should feel polished and responsive. Turn cards should have clear visual hierarchy: user messages distinguished from assistant, tools clearly differentiated from regular text.
- Keyboard navigation is essential for power users: j/k for prev/next turn, Enter to expand/collapse, / to focus search.
- Search should highlight matches in real-time within visible turns, with a match counter ("3 of 12 matches").
- Tool input JSON should be syntax-highlighted with a monospace code block, collapsible by default if >10 lines.
- Session status should be prominent — a colored status bar or badge at the top of the replay showing running/error/truncated state.
- The right rail in replay mode shows session metadata (model, start/end time, duration, token counts, source path) and a mini turn index for quick jumping.
- Copy actions (copy turn, copy message, copy tool) should show a brief "Copied!" confirmation.
</specifics>

<deferred>
## Deferred Ideas

- SSE live refresh when new turns appear during an active session (Phase 6)
- OpenClaw Gateway live session integration — drilldown from Gateway overview to replay (Phase 6)
- Parser warning inline display with source line references (Phase 6 hardening)
- Turn comparison / diff view between sessions
- Export turn as markdown/code snippet
- Performance profiling and bundle optimization for replay page
- Accessibility audit and screen reader support for replay timeline

</deferred>

---

*Phase: 05-Turn Replay UI*
*Context gathered: 2026-05-07 via Smart Discuss (autonomous)*
*Relationship to discuss-phase: Smart Discuss is an autonomous-optimized variant that batches grey area questions. This CONTEXT.md is structurally identical to what discuss-phase produces. (CTRL-03)*
