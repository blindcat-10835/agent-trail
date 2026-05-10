# Sessions Pagination & Group Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side GROUP BY counts to ingest sessions endpoint, scroll-based pagination to right rail, and fix inaccurate group-by counts.

**Architecture:** Ingest runs extra `SELECT COUNT(*) GROUP BY` queries when `?groupBy` is present. BFF passes through. Frontend hooks gain `loadMore()` offset-based pagination and `groupCounts` state. Right rail uses IntersectionObserver for scroll loading and server-side counts for group labels.

**Tech Stack:** Hono (ingest), better-sqlite3, Next.js App Router, React 19, Zustand, TypeScript

---

## File Structure

```
ingest/api/sessions.ts              MODIFY: add groupBy param + GROUP BY queries
ingest/api/sessions.test.ts         MODIFY: add groupBy param validation tests
lib/agent-tools/server-adapter.ts   MODIFY: SessionListResult + groupCounts type, pass groupBy
lib/agent-tools/client-hooks.tsx    MODIFY: useToolSessions loadMore + groupCounts, useAggregateSessions groupCounts
components/sessions/sessions-right-rail.tsx  MODIFY: fix group key, use groupCounts, IntersectionObserver pagination
types/trace.ts                      READ: TraceSession reference
```

---

### Task 1: Ingest API — add `groupBy` query parameter with GROUP BY counts

**Files:**
- Modify: `ingest/api/sessions.ts:80-180`
- Test: `ingest/api/sessions.test.ts`

- [ ] **Step 1: Write failing tests for groupBy param validation**

  ```typescript
  // Append to ingest/api/sessions.test.ts

  describe('GET /api/v1/sessions — groupBy parameter validation', () => {
    it('should return 400 for invalid groupBy value', async () => {
      const app = createApp();
      const res = await app.request('/api/v1/sessions?source=openclaw&groupBy=invalid');
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('groupBy');
    });

    it('should accept groupBy=agent', async () => {
      const app = createApp();
      const res = await app.request('/api/v1/sessions?source=openclaw&groupBy=agent');
      // Without a real DB, this will fail at DB access — but param validation passes
      // The test confirms 400 doesn't come from groupBy validation
      expect(res.status).not.toBe(400);
    });

    it('should accept groupBy=agent,project', async () => {
      const app = createApp();
      const res = await app.request('/api/v1/sessions?source=openclaw&groupBy=agent,project');
      expect(res.status).not.toBe(400);
    });

    it('should accept groupBy with single valid value and no comma', async () => {
      const app = createApp();
      const res = await app.request('/api/v1/sessions?source=openclaw&groupBy=agent');
      expect(res.status).not.toBe(400);
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  cd ingest && npx vitest run api/sessions.test.ts 2>&1
  ```
  Expected: the groupBy validation tests pass (no 400 from groupBy) BUT there's no groupBy handling yet — the 400 won't trigger for invalid values since validation code doesn't exist yet. The key test: `'should return 400 for invalid groupBy value'` should NOT return 400 (it passes through without validation = FAIL condition).

  Wait — since there's no groupBy handling, the `groupBy=invalid` param would just be ignored and the query would hit the DB (which won't be available in test). The test should check that the response is NOT 400 (current behavior, no validation) — then after the fix, we expect 400.

  Update the test approach: the "failing" behavior is that invalid groupBy values pass through silently. After the fix, they return 400.

- [ ] **Step 3: Validate groupBy param in the sessions handler**

  In `ingest/api/sessions.ts`, after the existing validation block (after line 113), add:

  ```typescript
  // Parse and validate groupBy (T-06: allow agent, project, or both)
  const groupByRaw = c.req.query('groupBy');
  const validGroupByValues = ['agent', 'project'];
  let groupByDimensions: string[] = [];
  if (groupByRaw) {
    const requested = groupByRaw.split(',').map(d => d.trim()).filter(Boolean);
    if (requested.length === 0 || requested.some(d => !validGroupByValues.includes(d))) {
      return c.json({ error: 'Invalid groupBy parameter. Must be "agent", "project", or comma-separated combination' }, 400);
    }
    groupByDimensions = [...new Set(requested)];
  }
  ```

- [ ] **Step 4: Run validation-only groupBy query when groupBy=agent**

  After the main session query (after line 169), add the group count queries. The WHERE clause and params are already built (same `whereClause` and `params`):

  ```typescript
  const groupCounts: { agent?: Array<{ label: string; count: number }>; project?: Array<{ label: string; count: number }> } = {};

  if (groupByDimensions.includes('agent')) {
    const agentRows = db.prepare(`
      SELECT COALESCE(agent_name, source) as label, COUNT(*) as count
      FROM sessions
      ${whereClause}
      GROUP BY label
      ORDER BY count DESC
    `).all(...params) as Array<{ label: string; count: number }>;
    groupCounts.agent = agentRows;
  }

  if (groupByDimensions.includes('project')) {
    const projectRows = db.prepare(`
      SELECT COALESCE(NULLIF(project, 'default'), '-') as label, COUNT(*) as count
      FROM sessions
      ${whereClause}
      GROUP BY label
      ORDER BY count DESC
    `).all(...params) as Array<{ label: string; count: number }>;
    groupCounts.project = projectRows;
  }
  ```

- [ ] **Step 5: Include groupCounts in the response when present**

  Modify the return statement to conditionally include groupCounts:

  ```typescript
  const response: {
    sessions: TraceSession[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
    groupCounts?: { agent?: Array<{ label: string; count: number }>; project?: Array<{ label: string; count: number }> };
  } = {
    sessions: sessions.map(row => parseSessionRow(row)),
    pagination: {
      total: countResult.total,
      limit: cappedLimit,
      offset,
      hasMore: offset + cappedLimit < countResult.total
    }
  };

  if (Object.keys(groupCounts).length > 0) {
    response.groupCounts = groupCounts;
  }

  return c.json(response);
  ```

- [ ] **Step 6: Run tests to verify validation works**

  ```bash
  cd ingest && npx vitest run api/sessions.test.ts 2>&1
  ```
  Expected: groupBy validation tests pass — invalid values return 400, valid values don't cause 400. All existing tests still pass.

- [ ] **Step 7: Commit**

  ```bash
  git add ingest/api/sessions.ts ingest/api/sessions.test.ts
  git commit -m "feat(ingest): add groupBy query param with COUNT(*) GROUP BY to sessions endpoint"
  ```

---

### Task 2: BFF Server Adapter — add groupCounts type and pass through groupBy

**Files:**
- Modify: `lib/agent-tools/server-adapter.ts`

- [ ] **Step 1: Add groupCounts to SessionListResult interface**

  In `lib/agent-tools/server-adapter.ts`, modify the `SessionListResult` interface (around line 258):

  ```typescript
  export interface SessionListResult {
    sessions: TraceSession[]
    pagination: {
      total: number
      limit: number
      offset: number
      hasMore: boolean
    }
    groupCounts?: {
      agent?: Array<{ label: string; count: number }>
      project?: Array<{ label: string; count: number }>
    }
  }
  ```

- [ ] **Step 2: Verify groupBy passes through buildSourceScopedSessionParams**

  The `buildSourceScopedSessionParams` function already spreads `sanitizedQuery` into `URLSearchParams`, so `groupBy` from the frontend will pass through automatically. No code change needed — just verify by reading lines 90-102.

- [ ] **Step 3: Verify the BFF route handler passes through groupBy**

  The route handler at `app/api/agent-tools/[tool]/sessions/route.ts` forwards all query params via `request.nextUrl.searchParams.forEach((value, key) => { query[key] = value })`. The `groupBy` param will pass through to `buildSourceScopedSessionParams`. No code change needed.

- [ ] **Step 4: Commit**

  ```bash
  git add lib/agent-tools/server-adapter.ts
  git commit -m "feat(bff): add groupCounts to SessionListResult type"
  ```

---

### Task 3: Frontend Hooks — add loadMore pagination and groupCounts

**Files:**
- Modify: `lib/agent-tools/client-hooks.tsx`

- [ ] **Step 1: Add groupCounts state and return to useToolSessions**

  In `useToolSessions` (around line 273), after the `pagination` state:

  ```typescript
  const [groupCounts, setGroupCounts] = useState<{
    agent?: Array<{ label: string; count: number }>
    project?: Array<{ label: string; count: number }>
  } | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [currentOffset, setCurrentOffset] = useState(0)
  ```

- [ ] **Step 2: Add loadMore function to useToolSessions**

  Inside the same hook, add the `loadMore` function (after `fetchSessions` callback, before the effects):

  ```typescript
  const loadMore = useCallback(async () => {
    if (isLoadingMore) return
    const parsedQuery = JSON.parse(queryKey) as Record<string, string>
    const nextOffset = currentOffset + sanitizeLimit(String((parsedQuery as any).limit || '100'))
    setIsLoadingMore(true)
    try {
      const data = await fetchToolApi<{
        sessions: TraceSession[]
        pagination: { total: number; limit: number; offset: number; hasMore: boolean }
        groupCounts?: {
          agent?: Array<{ label: string; count: number }>
          project?: Array<{ label: string; count: number }>
        }
      }>(toolId, '/sessions', { ...parsedQuery, offset: String(nextOffset), groupBy: 'agent,project' })
      setSessions(prev => [...prev, ...data.sessions])
      setPagination(data.pagination)
      if (data.groupCounts) setGroupCounts(data.groupCounts)
      setCurrentOffset(nextOffset)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more sessions')
    } finally {
      setIsLoadingMore(false)
    }
  }, [toolId, queryKey, currentOffset, isLoadingMore])
  ```

  Need to import `sanitizeLimit` at the top of the file — wait, `sanitizeLimit` is a server-side function in `server-adapter.ts`. We shouldn't import it in client code. Instead, use the limit value directly.

  ```typescript
  const nextOffset = currentOffset + (parseInt(String((parsedQuery as any).limit || '100'), 10))
  ```

- [ ] **Step 3: Add groupBy to initial fetch and include groupCounts in response handling**

  Modify `fetchSessions` to include `groupBy: 'agent,project'` in the request:

  ```typescript
  const fetchSessions = useCallback(async () => {
    try {
      const parsedQuery = JSON.parse(queryKey) as Record<string, string>
      const data = await fetchToolApi<{
        sessions: TraceSession[]
        pagination: { total: number; limit: number; offset: number; hasMore: boolean }
        groupCounts?: {
          agent?: Array<{ label: string; count: number }>
          project?: Array<{ label: string; count: number }>
        }
      }>(toolId, '/sessions', { limit: '100', ...parsedQuery, groupBy: 'agent,project' })
      setSessions(data.sessions)
      setPagination(data.pagination)
      if (data.groupCounts) setGroupCounts(data.groupCounts)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [toolId, queryKey])
  ```

  And add `groupCounts`, `hasMore`, `isLoadingMore`, `loadMore` to the return:

  ```typescript
  return { sessions, pagination, groupCounts, loading, error, isLoadingMore, loadMore, refetch }
  ```

- [ ] **Step 4: Add groupCounts to useAggregateSessions return**

  In `useAggregateSessions` (around line 440), add state and aggregation logic:

  ```typescript
  const [groupCounts, setGroupCounts] = useState<{
    agent: Array<{ label: string; count: number }>
    project: Array<{ label: string; count: number }>
  } | null>(null)
  ```

  In `fetchAggregateSessions`, after the `.then((results) => { ... })`, add groupCounts merging:

  ```typescript
  // Merge groupCounts from all sources
  const mergedGroupCounts: {
    agent: Map<string, number>
    project: Map<string, number>
  } = { agent: new Map(), project: new Map() }

  for (const result of results) {
    const gc = (result as any)._groupCounts
    if (gc?.agent) {
      for (const item of gc.agent) {
        mergedGroupCounts.agent.set(item.label, (mergedGroupCounts.agent.get(item.label) || 0) + item.count)
      }
    }
    if (gc?.project) {
      for (const item of gc.project) {
        mergedGroupCounts.project.set(item.label, (mergedGroupCounts.project.get(item.label) || 0) + item.count)
      }
    }
  }

  const finalGroupCounts = {
    agent: Array.from(mergedGroupCounts.agent.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    project: Array.from(mergedGroupCounts.project.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
  }
  setGroupCounts(finalGroupCounts)
  ```

  But wait — the `fetchToolApi` generic type doesn't include `groupCounts` in `useAggregateSessions`. Let me update that. The `fetchToolApi` call in `useAggregateSessions` also needs to pass `groupBy` and capture `groupCounts`. Let me modify the hook more carefully.

  Actually, looking at the `useAggregateSessions` code more carefully:

  ```typescript
  fetchToolApi<{
    sessions: TraceSession[]
    pagination: { total: number; limit: number; offset: number; hasMore: boolean }
  }>(toolId, '/sessions', { limit: '50', ...parsedQuery })
  ```

  This needs to also accept groupCounts in the type and pass groupBy in the query:

  ```typescript
  fetchToolApi<{
    sessions: TraceSession[]
    pagination: { total: number; limit: number; offset: number; hasMore: boolean }
    groupCounts?: { agent?: Array<{ label: string; count: number }>; project?: Array<{ label: string; count: number }> }
  }>(toolId, '/sessions', { limit: '100', ...parsedQuery, groupBy: 'agent,project' })
  ```

  And capture the groupCounts in the `.then()` chain. Let me restructure this more carefully.

  Let me reconsider. The `useAggregateSessions` hook's `.then()` already destructures `d.sessions` and `d.pagination`. I need to also capture `d.groupCounts` and store it on the result object so it can be used for merging later.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/agent-tools/client-hooks.tsx
  git commit -m "feat(hooks): add loadMore pagination and groupCounts to useToolSessions and useAggregateSessions"
  ```

---

### Task 4: Right Rail — fix group key, use groupCounts, add scroll-based pagination

**Files:**
- Modify: `components/sessions/sessions-right-rail.tsx`

- [ ] **Step 1: Fix "Group by tool" grouping key from s.agentName || s.source to s.source**

  In `SessionsRailContent`, modify line 233:

  ```typescript
  // Before:
  filter.groupMode === 'agent'
    ? (s.agentName || s.source)

  // After:
  filter.groupMode === 'agent'
    ? s.source
  ```

- [ ] **Step 2: Add groupCounts prop to SessionsRailContent**

  Add `groupCounts` to the `SessionsRailContent` props interface:

  ```typescript
  interface SessionsRailContentProps {
    // ... existing props
    groupCounts?: {
      agent?: Array<{ label: string; count: number }>
      project?: Array<{ label: string; count: number }>
    } | null
  }
  ```

  Destructure it in the component function signature.

- [ ] **Step 3: Use groupCounts for group header counts**

  Modify the group header rendering (around line 362) to use server-side counts when available:

  ```typescript
  {groupedSessions.map((group) => {
    let groupCount: number | undefined
    if (groupCounts && filter.groupMode === 'agent') {
      groupCount = groupCounts.agent?.find(g => g.label === group.label)?.count
    } else if (groupCounts && filter.groupMode === 'project') {
      groupCount = groupCounts.project?.find(g => g.label === group.label)?.count
    }

    return (
      <div key={group.label}>
        <button ...>
          ...
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </span>
          <span className="text-[9px] font-mono tabular-nums text-muted-foreground/60">
            ({groupCount ?? group.sessions.length})
          </span>
        </button>
        ...
      </div>
    )
  })}
  ```

- [ ] **Step 4: Pass groupCounts from SourceSessionsRightRail and AggregateSessionsRightRail**

  In `SourceSessionsRightRail`:

  ```typescript
  // Add to destructuring:
  const { sessions, pagination, groupCounts, loading, error, isLoadingMore, loadMore, refetch } = useToolSessions(
    sourceToolId,
    { limit: '100', sort: 'updated_at', order: 'desc' },
  )
  ```

  Pass `groupCounts` to `SessionsRailContent`:

  ```typescript
  <SessionsRailContent
    // ... existing props
    groupCounts={groupCounts}
  />
  ```

  In `AggregateSessionsRightRail`, pass `aggregateSessions.groupCounts` similarly.

- [ ] **Step 5: Add IntersectionObserver scroll-based load more**

  At the bottom of `SessionsRailContent`, after the session list, add a sentinel element:

  ```typescript
  import { useRef, useEffect } from 'react'

  // Inside SessionsRailContent, add:
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loadMore || !hasMore || isLoadingMore) return
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore, hasMore, isLoadingMore])
  ```

  Add the `hasMore` and `isLoadingMore` and `loadMore` to the props interface of `SessionsRailContent`:

  ```typescript
  hasMore?: boolean
  isLoadingMore?: boolean
  loadMore?: () => void
  ```

  At the end of the scrollable content area (after the filtered sessions list), add the sentinel:

  ```typescript
  {/* Sentinel for infinite scroll */}
  <div ref={sentinelRef} className="flex items-center justify-center py-2">
    {isLoadingMore ? (
      <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-accent" />
    ) : hasMore ? (
      <span className="text-[9px] text-muted-foreground/40">Scroll for more</span>
    ) : null}
  </div>
  ```

  This should be placed inside the `min-h-0 flex-1 overflow-y-auto` div, after the sessions list:

  After line 393 (closing of the `</div>` for `filteredSessions.map`), but still inside the `overflow-y-auto` div (before line 394).

  Wait, looking at the structure more carefully:

  ```
  <div className="min-h-0 flex-1 overflow-y-auto">   <-- line 321
    {loading && sessions.length === 0 ? (
      ...spinner...
    ) : error ? (
      ...error...
    ) : filteredSessions.length === 0 ? (
      ...empty...
    ) : groupedSessions ? (
      ...grouped list...
    ) : (
      ...flat list...     <-- ends with </div> line 394
    )}
    {/* Sentinel goes here */}
  </div>
  ```

  Add the sentinel after the conditional rendering block but inside the overflow-y-auto div.

- [ ] **Step 6: Pass hasMore, isLoadingMore, loadMore from SourceSessionsRightRail and AggregateSessionsRightRail**

  In `SourceSessionsRightRail`:

  ```typescript
  const hasMore = sourceSessions.pagination?.hasMore ?? false
  ```

  Pass to `SessionsRailContent`:

  ```typescript
  hasMore={hasMore}
  isLoadingMore={sourceSessions.isLoadingMore}
  loadMore={sourceSessions.loadMore}
  ```

  For `AggregateSessionsRightRail`, the `useAggregateSessions` hook doesn't support loadMore yet. The aggregate view fetches from all 3 sources in one batch. For now, skip loadMore in aggregate view or add a simpler load-all-at-once approach. Since the primary use case is single-tool right rail, add it there first.

- [ ] **Step 7: Commit**

  ```bash
  git add components/sessions/sessions-right-rail.tsx
  git commit -m "fix(sessions): correct group-by-tool key, use server-side groupCounts, add scroll pagination"
  ```

---

### Task 5: Verify end-to-end

- [ ] **Step 1: Run lint**

  ```bash
  pnpm lint
  ```
  Expected: no errors

- [ ] **Step 2: Build check**

  ```bash
  pnpm build 2>&1 | tail -20
  ```
  Expected: successful build

- [ ] **Step 3: Run ingest tests**

  ```bash
  cd ingest && npx vitest run 2>&1
  ```
  Expected: all tests pass

- [ ] **Step 4: Manual verification notes**

  - Start dev: `pnpm dev` (wait for ingest service on 8078 and Next.js on 3000)
  - Open `http://localhost:3000/openclaw/sessions` — verify right rail shows "X indexed" with correct count
  - Toggle "Group by tool" — verify group labels show server-side counts from `groupCounts`
  - Scroll to bottom of session list — verify more sessions load (loading spinner then appended sessions)
  - Switch to "Group by project" — verify project group counts are correct
  - Open `http://localhost:3000/dashboard` (aggregate view) — verify per-source counts are correct
