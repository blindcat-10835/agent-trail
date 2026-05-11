# Phase 7: M1 residual dashboard bug fixes - Context

**Gathered:** 2026-05-07
**Status:** Ready for execution

<domain>
## Phase Boundary

Fix the residual dashboard bugs reported in `.planning/2026-05-07-bugs-found-by-user-batch-1.md` after the milestone build: source switching from session detail pages, session-list placement, replay duplicate-key warnings, Codex session ordering/freshness, manual sync refresh, and compact session-list metadata.

This phase is a stabilization phase. It does not add new sources, new analysis features, export/share, or a new replay model.

</domain>

<decisions>
## Implementation Decisions

### Source Switching
- **D-01:** When switching tools from `/{tool}/sessions/{sessionId}`, route to `/{targetTool}/sessions` instead of carrying the old session id across source boundaries.
- **D-02:** Preserve same-section navigation for overview/activity pages, but treat source-scoped entity ids as incompatible across tools.

### Session Browsing Layout
- **D-03:** Session browsing belongs in the persistent right rail. The main children area should show overview/statistics when no session is selected and session replay/detail when a session is selected.
- **D-04:** The right rail should show a compact session list, not only a selected-session metadata panel.
- **D-05:** Session rows should display session name, project directory, updated time, and source/tool label.

### Replay Key Stability
- **D-06:** React keys in replay must be resilient to missing/null legacy ids. Use deterministic fallbacks from session id, ordinal, role, and index rather than raw nullable ids.

### Codex Freshness + Sync
- **D-07:** Codex parsing should use current payload timestamps such as `turn_context.started_at`, and sync should persist file mtime plus last-sync metadata for cache-hit and rewritten sessions.
- **D-08:** Session lists should sort by the freshest available timestamp across `ended_at`, `started_at`, `last_sync_at`, and file metadata where available.
- **D-09:** Header sync should notify visible session hooks so the current list refreshes after ingest sync completes.

### the agent's Discretion
- Exact compact rail styling inside the existing HUD design system.
- Whether the right rail includes filters in this phase; core fix is compact list plus refresh.
- Exact fallback-key helper names and test placement.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug Batch
- `.planning/2026-05-07-bugs-found-by-user-batch-1.md` — User-reported bug list and layout intent.

### Prior Phase Context
- `.planning/phases/04-multi-source-frontend-shell-session-explorer/04-CONTEXT.md` — Source-first routing, AgentToolProvider, Session Explorer, right rail decisions.
- `.planning/phases/05-turn-replay-ui/05-CONTEXT.md` — Replay route, turn timeline, replay right rail, virtualization and key-sensitive rendering.
- `.planning/phases/06-sync-openclaw-drilldown-hardening/06-CONTEXT.md` — Sync/SSE refresh, source status, Codex discovery, local hardening.

### Code References
- `components/shell/source-switcher.tsx` — Source switch URL rewrite behavior.
- `components/shell/right-rail.tsx` and `components/shell/shell-frame.tsx` — Persistent right rail integration.
- `components/sessions/session-explorer-table.tsx` and `components/sessions/sessions-detail-rail.tsx` — Existing session list/detail rendering patterns.
- `app/(tool-shell)/[tool]/sessions/page.tsx` and `app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx` — Main children behavior for overview vs selected session.
- `lib/agent-tools/client-hooks.tsx` — Session data hooks and refresh mechanism.
- `ingest/sync/index.ts` and `ingest/sync/sources.ts` — Codex/Claude/OpenClaw discovery and sync.
- `ingest/api/sessions.ts` — Session list ordering and response shape.
- `components/replay/turn-card.tsx`, `components/replay/turn-timeline.tsx`, `components/replay/replay-right-rail.tsx` — Key stability hotspots.
- `../references/agentsview/frontend/src/App.svelte`, `../references/agentsview/frontend/src/lib/components/sidebar/SessionList.svelte`, `../references/agentsview/frontend/src/lib/components/sidebar/SessionItem.svelte` — Reference layout: persistent session list with detail/overview in main content.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useToolSessions()` already returns `sessions`, `pagination`, `loading`, `error`, and `refetch`.
- `SessionExplorerTable` has reusable row formatting, but full table density is too large for a right rail.
- `SessionsDetailRail` already derives display name/project/model and has robust empty/loading/error states.
- `ShellHeader` already triggers `/api/sync`; it needs a client-side refresh notification after sync.
- `discoverJsonlDirectories()` already finds nested JSONL directories for Claude/Codex sources.

### Established Patterns
- Frontend data access goes through `/api/agent-tools/[tool]/...`, never ingest directly.
- Tool-specific behavior is driven by `AgentToolProvider` and registry definitions.
- Zustand stores are already used for UI and selected session state.
- Existing UI should stay HUD/dark/compact, with stable dimensions for rails and rows.

### Integration Points
- Add a compact `SessionsRightRail` under `components/sessions/` and render it from `components/shell/right-rail.tsx`.
- Add a lightweight global session refresh event in client hooks, dispatched by `ShellHeader` after `/api/sync`.
- Update sessions page to show the per-tool overview instead of duplicating the session list in children.
- Fix source switcher path rewriting for entity routes.
- Update ingest freshness metadata and session ordering, with focused tests.

</code_context>

<specifics>
## Specific Ideas

- Compact rail rows should use a two-line layout: session name on top, project path and updated time below, plus a small tool badge.
- Clicking a rail row navigates to `/{tool}/sessions/{sessionId}`.
- On a source with no selected session, the main content should be overview/statistics instead of a table duplicate.
- Manual sync should resync all sources and then cause session lists to refetch.

</specifics>

<deferred>
## Deferred Ideas

- Full agentsview-style grouping, star/rename/delete/context-menu features.
- Rich cross-source search and analytics refinements.
- Session comparison/diff and export.

</deferred>

---

*Phase: 07-m1-residual-dashboard-bug-fixes*
*Context gathered: 2026-05-07*
