---
phase: phase-12
reviewed: 2026-05-16T12:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - types/overview.ts
  - lib/agent-tools/client-hooks.tsx
  - components/overview/kpi-hero.tsx
  - components/overview/time-window-selector.tsx
  - components/overview/top-models-table.tsx
  - components/overview/top-projects-table.tsx
  - components/overview/starred-sessions.tsx
  - components/overview/activity-timeline.tsx
  - components/overview/overview-agents.tsx
  - components/overview/overview-page.tsx
  - app/(tool-shell)/[tool]/dashboard/page.tsx
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-05-16T12:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed all 11 Phase 12 source files implementing the unified overview dashboard with KPI hero, ranking tables, starred sessions, activity timeline, and agents module. The implementation is well-structured: types align with BFF API contracts, components follow established project patterns (HudPanel, EmptyState, Skeleton), all colors use semantic Tailwind tokens, and React hooks rules are respected.

Four warnings found: the most significant is a stale-data bug across all 6 overview hooks where data from a previous source persists after a failed fetch on source switch — the KpiHero specifically renders this stale data because its error guard requires `!aggregates` (null check) which is never true after an initial successful fetch. Two info items cover duplicated utility functions and a minor redundant network request.

No hardcoded secrets, no injection vulnerabilities, no eval/innerHTML, no hardcoded colors. Theme tokens are used throughout. Source scoping via `toolId` in hook dependency arrays is correct for all 6 new hooks.

## Warnings

### WR-01: Stale cross-source data in KpiHero after fetch failure

**File:** `lib/agent-tools/client-hooks.tsx:890-910` and `components/overview/kpi-hero.tsx:81-131`
**Issue:** When the user switches source (e.g., openclaw → claude-code) and the new source's aggregates fetch fails, the `aggregates` state retains data from the previous source. The `useOverviewAggregates` hook sets `loading=true` (showing skeleton) and starts a new fetch, but does NOT reset `aggregates` to `null`. On fetch failure, `loading` becomes false with stale data still in state. The KpiHero error guard at line 94 (`if (error && !aggregates)`) does not trigger because `aggregates` is non-null (contains the old source's data), so the component falls through to render the stale values — showing openclaw's session/turn/token counts under the claude-code tool scope. The same pattern exists in all 6 new hooks, but the KpiHero is the most impactful because it's the primary data display and its error guard is the only one that requires both `error` AND null data. The table components (TopModelsTable, TopProjectsTable) handle this correctly because they check `error` independently of data state.

**Fix:** Reset data state to null/empty at the start of each fetch in the useEffect:

```tsx
// In useOverviewAggregates (and same pattern for all 6 hooks):
useEffect(() => {
  setAggregates(null)  // ← Add this line to clear stale data
  setLoading(true)
  setError(null)
  fetchToolApi<OverviewAggregates>(toolId, '/overview/aggregates', { window })
    .then((data) => {
      setAggregates(data)
      setError(null)
    })
    .catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load aggregates'),
    )
    .finally(() => setLoading(false))
}, [toolId, window])
```

### WR-02: No AbortController in overview hooks — race on rapid source switches

**File:** `lib/agent-tools/client-hooks.tsx:890-1064`
**Issue:** All 6 new overview hooks (`useOverviewAggregates`, `useTopModels`, `useTopProjects`, `useStarredSessions`, `useTimeline`, `useOverviewCapabilities`) initiate `fetchToolApi` calls in `useEffect` without AbortController cleanup. If `toolId` or `window` changes while a fetch is in-flight, there is no mechanism to abort the stale request. The stale response's `.then()` will still execute, potentially overwriting data from a newer fetch that already completed. This can cause the UI to briefly show data from a previous source after a rapid source switch (e.g., quickly toggling between openclaw → claude-code → codex). The same pattern exists in pre-existing hooks in this file, but the 6 new hooks perpetuate it.

**Fix:** Add AbortController with cleanup:

```tsx
export function useOverviewAggregates(toolId: AgentToolId, window: TimeWindow) {
  const [aggregates, setAggregates] = useState<OverviewAggregates | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setAggregates(null)
    setLoading(true)
    setError(null)
    fetchToolApi<OverviewAggregates>(toolId, '/overview/aggregates', { window })
      .then((data) => {
        if (!controller.signal.aborted) {
          setAggregates(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load aggregates')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [toolId, window])

  return { aggregates, loading, error }
}
```

Note: `fetchToolApi` would need to accept and forward an `AbortSignal` to `fetch()` for full cancellation. If that refactor is too large for this phase, at minimum guard all state setters with `controller.signal.aborted` checks as shown above.

### WR-03: `useToolAgents` fires unnecessary network request for non-agent sources

**File:** `components/overview/overview-agents.tsx:47`
**Issue:** `useToolAgents(toolId)` is called unconditionally (correct — React hooks must not be conditional). However, this fires an HTTP request to `/api/agent-tools/${toolId}/agents` for every toolId including `all`, `claude-code`, and `codex` — sources that don't support agents. The result is discarded when the capability check shows the "N/A" placeholder. This is a wasted network round-trip on every source switch or page load for 3 out of 4 tool scopes.

**Fix:** Consider adding an `enabled` flag to `useToolAgents` (and the other hooks) that skips the fetch when false, using a pattern like:

```tsx
export function useToolAgents(toolId: AgentToolId, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true
  // ...
  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    // ... existing fetch logic
  }, [toolId, enabled])
  // ...
}
```

Then in `OverviewAgents`, pass `{ enabled: agentsEnabled && !isAll }` after computing capability flags. This requires restructuring so capability data is available before the hook call, which may need the capabilities to be passed as a prop and the hook conditional on it — or moving the `useToolAgents` call to the parent and passing agents as a prop.

### WR-04: Capabilities fetch error silently swallowed — no user feedback

**File:** `components/overview/overview-page.tsx:49`
**Issue:** `useOverviewCapabilities` returns `{ capabilities, loading, error }` but the `error` field is not destructured or propagated. If the capabilities endpoint fails (e.g., ingest returns 500), `capabilities` is `null` and `capsLoading` becomes `false`. The `OverviewAgents` component then receives null capabilities, resolves `agentsEnabled` to `false`, and shows the "N/A" placeholder — with no indication to the user that a fetch failed. This is distinct from the "agents not supported" case and should surface differently.

**Fix:** Destructure and propagate the error:

```tsx
const { capabilities, loading: capsLoading, error: capsError } = useOverviewCapabilities(toolId)
```

Then pass `capsError` to `OverviewAgents` and render an error state when capabilities failed:

```tsx
// In overview-agents.tsx, add capsError prop:
if (capsError && !capsLoading) {
  return (
    <div className="flex flex-col gap-2">
      {heading}
      <EmptyState heading="LOAD ERROR" body="FAILED TO LOAD SOURCE CAPABILITIES." />
    </div>
  )
}
```

## Info

### IN-01: Duplicated utility functions across overview components

**File:** `components/overview/kpi-hero.tsx:10-14`, `components/overview/top-models-table.tsx:11-15`, `components/overview/top-projects-table.tsx:11-15`, `components/overview/starred-sessions.tsx:13-29`, `components/overview/activity-timeline.tsx:20-36`
**Issue:** `fmtNum()` is copy-pasted identically in 3 files (kpi-hero, top-models-table, top-projects-table). `relativeTime()` is copy-pasted identically in 2 files (starred-sessions, activity-timeline). The `fmtNum` function also exists in `components/sessions/sessions-stats-bar.tsx`. Any fix to formatting logic (e.g., handling billions, locale-aware formatting) must be applied to all copies.

**Fix:** Extract to a shared utility module:

```tsx
// lib/format.ts
export function fmtNum(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1e6) return (n / 1000).toFixed(1) + 'k'
  return (n / 1e6).toFixed(2) + 'm'
}

export function relativeTime(iso: string | null): string {
  if (!iso) return '\u2014'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'just now'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}
```

### IN-02: `useOverviewCapabilities` re-fetches on every toolId change despite being a global endpoint

**File:** `lib/agent-tools/client-hooks.tsx:1049-1061`
**Issue:** The capabilities endpoint (`/overview/capabilities`) is global — it returns capabilities for ALL sources regardless of the `toolId` parameter (the BFF route validates `toolId` but doesn't use it for filtering). The hook includes `toolId` in its `useEffect` dependency array, causing a redundant network request every time the user switches sources. This is intentional per the Phase 12 plan ("re-fetch to ensure fresh data") but adds ~1 unnecessary request per source switch.

**Fix:** Consider removing `toolId` from the dependency array and only fetching once on mount, or using a module-level cache/ref to avoid duplicate fetches. Low priority — the overhead is minimal.

---

_Reviewed: 2026-05-16T12:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
