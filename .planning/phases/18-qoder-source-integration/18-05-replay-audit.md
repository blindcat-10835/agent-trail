# Replay UI Subagent Surface Audit

**Plan:** 18-05
**Date:** 2026-05-19
**Scope:** D-06 parts 2 (parent transcript inline link) and 3 (child session header back-link)

---

## D-06 Part 2: Parent Transcript Inline Link

**Definition:** In the parent session's replay UI, when an `Agent` tool call's `toolCallId` matches a `subagent_links` row, an inline link to `/${source}/sessions/<child>` should render.

### Existing Rendering

**File:** `components/replay/subagent-block.tsx` (lines 1–117)
**Component:** `SubagentBlock`

The `SubagentBlock` component:
1. Receives a `TraceSubagentLink` as its `subagent` prop (line 12–13)
2. Renders the subagent session inline with expand/collapse behavior (lines 56–116)
3. Uses `useAgentTool()` hook to get `toolId` and `href()` helper (line 23)
4. Navigates to `href('/sessions/${subagent.subagentSessionId}')` when "Open Full Session" is clicked (line 47)
5. Loads child session turns via `useSessionTurns(toolId, subagent.subagentSessionId, ...)` (lines 26–29)

**Source-agnosticism:** ✅ YES
- The component uses `useAgentTool()` which provides the current source's `toolId` (from URL params)
- Navigation uses `href('/sessions/...')` which produces source-scoped URLs (e.g., `/qoder/sessions/...`)
- No source literal ('openclaw', 'codex', etc.) in any rendering predicate
- Works for ANY source that produces `TraceSubagentLink` rows

**How it's triggered:**

**File:** `components/replay/trace-thread.tsx` (line 89)
```tsx
case 'subagent_link': return <SubagentBlock subagent={activity} parentTurnIndex={turnIndex} />
```

**File:** `components/replay/turn-card.tsx` (line 257)
```tsx
case 'subagent_link':
  return <SubagentBlock subagent={activity} parentTurnIndex={turnIndex} />
```

Both `trace-thread.tsx` and `turn-card.tsx` dispatch `subagent_link` activities to `SubagentBlock` without any source filtering.

**File:** `components/replay/key-utils.ts` (line 22)
```ts
if (activity.type === 'subagent_link') {
```
Key utility handles subagent links generically.

### Decision: **Outcome (a) — Already source-agnostic**

No production code change required. The existing `SubagentBlock` component works for Qoder without modification because:
- It receives `TraceSubagentLink` as props (already produced by `parseQoderSession`)
- It navigates via `useAgentTool().href()` which produces the correct source-scoped URL
- It loads turns via `useSessionTurns(toolId, sessionId)` which works for any registered source

---

## D-06 Part 3: Child Session Header Back-link

**Definition:** When `session.parentSessionId` is non-null, the child session's detail header should show a "Spawned by <parent title>" badge linking back to `/${parent.source}/sessions/${parent.id}`.

### Existing Rendering

**Grep results:** No matches for `parentSessionId`, `parent_session_id`, `parentBadge`, `Spawned by`, or `backLink` in any component under `components/` or `app/`.

**Session detail page:** `app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx`
- Renders the `TraceThread` component
- Passes `session` (of type `TraceSession`) to `TraceThread`

**TraceThread header (trace-thread.tsx lines 508–558):**
- Shows session title, ID, project, model, turns, tokens, cost, status
- Does NOT render any parent session back-link
- The `session` prop has `parentSessionId` (type definition at `types/trace.ts:124`) but it is never read in any rendering code

### Decision: **Outcome (c) — Does not render at all**

No existing UI renders a parent back-link for any source. The `TraceSession.parentSessionId` field exists in the type but is unused in any component.

**Natural home for the back-link:** `components/replay/trace-thread.tsx` — the `TraceThread` component already renders the session HUD header (lines 509–558). Adding a "Spawned by" badge to the header subline is the natural placement, co-located with the existing project/model metadata.

**Required action:** Add a source-agnostic parent back-link badge in `TraceThread`'s HUD header, rendering when `session.parentSessionId` is non-null. The badge should:
1. Look up the parent session's display info (title, source)
2. Link to `/${parentSource}/sessions/${parentSessionId}`
3. Use existing `useAgentTool()` or `useRouter()` for navigation
4. Match the existing HUD pill/badge style (e.g., `HudPill` component already defined in the file)

**Challenge:** The session object from the API response contains `parentSessionId` but not the parent session's title or source. The badge needs either:
- (a) The parent session info embedded in the API response (requires backend change)
- (b) A client-side lookup to fetch parent session details
- (c) A simpler badge that just says "Spawned by parent session" with a link using the current tool's source (assumes parent is same source)

For Qoder and the existing sources, parent-child subagent relationships are always intra-source (both parent and child have the same source). So option (c) is sufficient and source-agnostic: link to `/${toolId}/sessions/${session.parentSessionId}`.

---

## Decision Matrix Summary

| D-06 Part | Component | Outcome | Action for Task 3 |
|-----------|-----------|---------|-------------------|
| Part 2 (parent transcript inline link) | `components/replay/subagent-block.tsx` | **(a) Already source-agnostic** | No code change required; verify Qoder routes resolve |
| Part 3 (child session header back-link) | `components/replay/trace-thread.tsx` | **(c) Does not render at all** | Create source-agnostic "Spawned by" badge in TraceThread HUD header |
