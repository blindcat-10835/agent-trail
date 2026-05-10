# Sessions Pagination & Group Counts Fix

**Date:** 2026-05-10
**Status:** approved

---

## Problem

Right rail session list suffers from two issues:

1. **Session loading is truncated:** Client requests `limit: 500` but BFF `sanitizeLimit()` caps it at 100 (`MAX_LIMIT = 100`). No scroll-based pagination to load more.
2. **Group counts are inaccurate:** Client-side group-by (agent/project) counts only reflect the loaded session slice, not the full database total.

Root cause: group counts are computed from `sessions.length` within loaded data, not from a server-side `SELECT COUNT(*) GROUP BY` query.

## Design

### Core principle

Session data can be paginated (limit + offset, scroll to load more), but **count totals must be server-side and always accurate** — they must not depend on how many sessions have been loaded.

### Approach

Add an optional `?groupBy=agent|project` query parameter to the ingest `GET /api/v1/sessions` endpoint. When present, the endpoint runs an additional `SELECT COUNT(*) GROUP BY` query using the **same WHERE conditions** as the main session query, and returns the results in a new `groupCounts` field.

This ensures:
- Session list remains paginated (limit + offset)
- Group counts are always accurate (from SQL, not client-side)
- A single request provides both data and counts

### Response shape change

```typescript
// Before
{
  sessions: TraceSession[]
  pagination: { total: number; limit: number; offset: number; hasMore: boolean }
}

// After
{
  sessions: TraceSession[]
  pagination: { total: number; limit: number; offset: number; hasMore: boolean }
  groupCounts?: {
    agent?: Array<{ label: string; count: number }>
    project?: Array<{ label: string; count: number }>
  }
}
```

---

## Implementation Plan

### 1. Ingest API — `ingest/api/sessions.ts`

Add `groupBy` query parameter to the existing `GET /api/v1/sessions` handler:

- Accept `?groupBy=agent,project` (comma-separated, optional, no default)
  - Values: `agent`, `project`, or both comma-separated: `agent,project`
  - The frontend always requests `groupBy=agent,project` so counts for both grouping modes are available immediately without refetching when switching modes
- For each requested dimension, run an extra `SELECT COUNT(*) GROUP BY` query using the **same WHERE conditions** as the main session query
- `groupBy=agent` query:
  - `SELECT COALESCE(agent_name, source) as label, COUNT(*) as count FROM sessions [same WHERE] GROUP BY label ORDER BY count DESC`
  - Note: `agent_name` is OpenClaw-specific (null for Claude Code/Codex). Use `COALESCE(agent_name, source)` so non-OpenClaw sessions appear under their source name.
- `groupBy=project` query:
  - `SELECT COALESCE(NULLIF(project, 'default'), '-') as label, COUNT(*) as count FROM sessions [same WHERE] GROUP BY label ORDER BY count DESC`
- Response shape: `groupCounts: { agent?: Array<{label, count}>, project?: Array<{label, count}> }`
- If `groupBy` contains invalid value, return 400
- If `groupBy` is not present, omit `groupCounts` from response (backward compatible)

### 2. BFF Server Adapter — `lib/agent-tools/server-adapter.ts`

- Add `groupCounts` field to `SessionListResult` interface (optional, matches ingest response)
- Pass through `groupBy` query param in `buildSourceScopedSessionParams()`

### 3. Frontend Hooks — `lib/agent-tools/client-hooks.tsx`

**`useToolSessions`:**
- Add `groupCounts` to return value, extracted from API response
- Add `loadMore()` function: increments internal offset, fetches next page, appends to existing sessions array
- Add `hasMore` and `isLoadingMore` to return value for UI state

**`useAggregateSessions`:**
- Add `groupCounts` to return value (aggregated from per-source responses)
  - For aggregate: merge groupCounts from each source, summing counts for same labels

### 4. Right Rail — `components/sessions/sessions-right-rail.tsx`

**Fix "Group by tool" grouping key:**

```typescript
// Before (line 233):
filter.groupMode === 'agent'
  ? (s.agentName || s.source)    // WRONG: mixes OpenClaw agent names with tool sources

// After:
filter.groupMode === 'agent'
  ? s.source                       // CORRECT: always group by source/tool
```

**Use server-side groupCounts for group labels:**

- `SourceSessionsRightRail` passes `groupCounts` from hook to `SessionsRailContent` as a new prop
- `AggregateSessionsRightRail` aggregates `groupCounts` from per-source responses and passes merged version
- When `groupCounts` is available and `groupMode !== 'none'`, render group header count from `groupCounts[groupMode]` lookups instead of `group.sessions.length`
  - e.g. for groupMode='agent': find `groupCounts.agent.find(g => g.label === groupLabel)?.count`
- Fall back to `group.sessions.length` if `groupCounts` is not available (graceful degradation)

**Add scroll-based load more:**

- Add an IntersectionObserver on a sentinel element at the bottom of the session list
- When sentinel is visible AND `hasMore` AND not already loading: call `loadMore()`
- Append loaded sessions to existing list (don't replace)
- Show a subtle loading indicator at the bottom while loading more

### 5. Filter Dropdown — `components/sessions/session-filter-dropdown.tsx`

- Per-source counts in the source filter section should use `pagination.total` from each source (already correct in aggregate view via `source.total`)

### 6. `MAX_LIMIT` unchanged

Keep `MAX_LIMIT = 100` in `server-adapter.ts`. The scroll-based pagination will load successive pages of 100 sessions each.

---

## Data Flow (Updated)

```
Frontend Right Rail
  │  useToolSessions(toolId, { limit: '100', groupBy: 'agent,project' })
  │
  ▼
BFF: GET /api/agent-tools/openclaw/sessions?limit=100&groupBy=agent,project
  │  buildSourceScopedSessionParams → source=openclaw
  ▼
Ingest: GET /api/v1/sessions?source=openclaw&limit=100&groupBy=agent,project
  │
  ├─► Session query: SELECT ... FROM sessions WHERE source='openclaw' ORDER BY ... LIMIT 100 OFFSET 0
  │
  ├─► Agent count query: SELECT COALESCE(agent_name, source) as label, COUNT(*) as count
  │    FROM sessions WHERE source='openclaw' GROUP BY label ORDER BY count DESC
  │
  └─► Project count query: SELECT COALESCE(NULLIF(project, 'default'), '-') as label, COUNT(*) as count
       FROM sessions WHERE source='openclaw' GROUP BY label ORDER BY count DESC
  │
  ▼
Response: {
  sessions: [...100 sessions],
  pagination: { total: 2340, limit: 100, offset: 0, hasMore: true },
  groupCounts: {
    agent: [{ label: "main", count: 1800 }, { label: "orchestrator", count: 540 }],
    project: [{ label: "my-project", count: 1200 }, { label: "-", count: 800 }]
  }
}
  │
  ▼
Frontend: renders group headers with "main (1800)" etc.
          scrolls to bottom → loadMore() → offset=100 → append sessions
```

---

## Things NOT in scope

- Per-project breakdown in `aggregate-sessions-view.tsx` — this is a separate feature, not related to right rail pagination
- Turn/activity-level pagination changes
- API batch endpoints for multiple sources
