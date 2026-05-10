# Phase 09: Batch 2 session replay and Codex subagent relationship fixes - Pattern Map

**Mapped:** 2026-05-10  
**Files analyzed:** 18 likely new/modified files  
**Analogs found:** 16 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `ingest/index.ts` | route | request-response | `ingest/api/sessions.ts`, `ingest/api/stars.ts` | exact |
| `tests/unit/ingest/stars-route-order.test.ts` | test | request-response | `ingest/api/sessions.test.ts`, `tests/unit/ingest/sessions-api.test.ts` | role-match |
| `lib/agent-tools/client-hooks.tsx` | hook | request-response, CRUD pagination | existing `useToolSessions` in same file | exact |
| `components/sessions/sessions-right-rail.tsx` | component | request-response pagination | source rail branch in same file | exact |
| `components/sessions/aggregate-sessions-view.tsx` | component | request-response pagination | `components/sessions/sessions-right-rail.tsx` sentinel wiring | role-match |
| `tests/hooks/client-hooks.test.tsx` | test | request-response hook state | existing tests in same file | exact |
| `components/replay/markdown-content.tsx` | component | transform | existing `MarkdownContent` + `react-markdown` import | exact, unsafe highlight section |
| `tests/unit/bff/markdown-content.test.tsx` | test | transform/render | `tests/hooks/client-hooks.test.tsx` jsdom render setup | role-match |
| `components/replay/tool-formatters.ts` | utility | transform | `components/replay/key-utils.ts` | role-match |
| `components/replay/tool-block.tsx` | component | transform/render | current `ToolBlock` and `ActivityBlock` dispatch | exact |
| `tests/unit/bff/tool-formatters.test.ts` | test | transform | `tests/unit/bff/replay-key-utils.test.ts` | exact |
| `ingest/parser/codex.ts` | parser | file-I/O, transform, event-driven | existing `custom_tool_call` and `inferToolCategory` blocks | exact |
| `tests/unit/ingest/codex-parser.test.ts` | test | file-I/O parser | existing Codex parser tests | exact |
| `ingest/sync/index.ts` | service | batch, file-I/O, CRUD | existing Codex sync and `writeSessionToDatabase` relationship writes | exact |
| `tests/unit/ingest/codex-relationships.test.ts` | test | batch, CRUD | `tests/unit/ingest/phase8-regression.test.ts`, `tests/unit/ingest/tool-persistence.test.ts` | role-match |
| `tests/unit/ingest/sessions-api.test.ts` | test | request-response, CRUD | existing sessions API temp DB test | exact |
| `ingest/db/index.ts` | migration/config | CRUD | existing migration table/index patterns | partial |
| `types/trace.ts` | model | transform | existing `TraceSubagentLink` / `TraceSession` relationship fields | partial, only if metadata is expanded |

## Pattern Assignments

### `ingest/index.ts` and `tests/unit/ingest/stars-route-order.test.ts`

**Analog:** route mount and Hono request tests in `ingest/index.ts`, `ingest/api/sessions.ts`, `ingest/api/stars.ts`, `ingest/api/sessions.test.ts`

**Route order pattern** (`ingest/index.ts` lines 77-84):

```ts
// Mount sources API routes
app.route('/', sourcesRoutes);

// Mount sessions and turns API routes
app.route('/', sessionsRoutes);
app.route('/', turnsRoutes);
app.route('/', agentsRoutes);
app.route('/', starsRoutes);
```

For Phase 09, static `starsRoutes` must be mounted before `sessionsRoutes` because `sessionsRoutes` contains a dynamic `/api/v1/sessions/:id` route.

**Static route and persistence pattern** (`ingest/api/stars.ts` lines 19-28):

```ts
starsRoutes.get('/api/v1/sessions/starred', (c) => {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT session_id FROM session_stars ORDER BY starred_at DESC',
  ).all() as { session_id: string }[];
  return c.json({
    session_ids: rows.map((r) => r.session_id),
  });
});
```

**Dynamic route that currently collides** (`ingest/api/sessions.ts` lines 228-258):

```ts
sessionsRoutes.get('/api/v1/sessions/:id', (c) => {
  const sessionId = c.req.param('id');
  if (!/^[a-zA-Z0-9:\-_.]{1,256}$/.test(sessionId)) {
    return c.json({ error: 'Invalid session ID format', sessionId }, 400);
  }
  const session = db.prepare(`... WHERE id = ?`).get(sessionId) as SessionRow | undefined;
  if (!session) {
    return c.json({ error: 'Session not found', sessionId }, 404);
  }
  return c.json(parseSessionRow(session));
});
```

**Composed Hono app test pattern** (`ingest/api/sessions.test.ts` lines 16-20):

```ts
function createApp() {
  const app = new Hono();
  app.route('/', sessionsRoutes);
  return app;
}
```

Use the same shape for `stars-route-order.test.ts`, but mount `starsRoutes` before `sessionsRoutes` and assert `GET /api/v1/sessions/starred` returns `200` with `{ session_ids: [...] }`. Use temp DB setup from `tests/unit/ingest/sessions-api.test.ts` lines 12-23.

**BFF contract must remain unchanged** (`app/api/agent-tools/[tool]/sessions/starred/route.ts` lines 12-20):

```ts
export async function GET(_request: NextRequest) {
  try {
    const res = await fetch(`http://localhost:${INGEST_PORT}/api/v1/sessions/starred`)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

### `lib/agent-tools/client-hooks.tsx`, `components/sessions/*`, and hook tests

**Analog:** `useToolSessions` load-more pattern in `lib/agent-tools/client-hooks.tsx`

**BFF-only fetch boundary** (`lib/agent-tools/client-hooks.tsx` lines 250-260):

```ts
async function fetchToolApi<T>(
  toolId: AgentToolId,
  path: string,
  query?: Record<string, string>,
): Promise<T> {
  const params = query ? '?' + new URLSearchParams(query).toString() : ''
  const res = await fetch(`/api/agent-tools/${toolId}${path}${params}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.json() as T
}
```

**Single-source pagination state and loadMore** (`lib/agent-tools/client-hooks.tsx` lines 277-341):

```ts
const [pagination, setPagination] = useState<{
  total: number
  limit: number
  offset: number
  hasMore: boolean
} | null>(null)
const [isLoadingMore, setIsLoadingMore] = useState(false)
const [currentOffset, setCurrentOffset] = useState(0)

const loadMore = useCallback(async () => {
  if (isLoadingMore) return
  const parsedQuery = JSON.parse(queryKey) as Record<string, string>
  const nextOffset = currentOffset
  setIsLoadingMore(true)
  try {
    const data = await fetchToolApi(..., {
      ...parsedQuery,
      offset: String(nextOffset),
      limit: String(pagination?.limit ?? 100),
      groupBy: 'agent,project',
    })
    setSessions(prev => [...prev, ...data.sessions])
    setPagination(data.pagination)
    setCurrentOffset(nextOffset + data.pagination.limit)
  } finally {
    setIsLoadingMore(false)
  }
}, [toolId, queryKey, currentOffset, isLoadingMore, pagination])
```

Apply this to `useAggregateSessions` with per-source state, not one global offset. Its current first-page-only behavior is at `lib/agent-tools/client-hooks.tsx` lines 500-604:

```ts
Promise.all(
  TOOL_IDS.map((toolId) =>
    fetchToolApi(..., { limit: '100', ...parsedQuery, groupBy: 'agent,project' })
      .then((d): AggregateToolResult => ({
        toolId,
        sessions: d.sessions,
        status: { toolId, status: 'loaded', count: d.sessions.length, total: d.pagination.total },
      }))
  ),
).then((results) => {
  const merged = results.flatMap((result) => result.sessions).sort(compareSessionsByFreshness)
  setSessions(merged)
  setTotalCount(sourceStatuses.reduce((sum, source) => sum + source.total, 0))
})
```

**Aggregate UI must use existing sentinel path** (`components/sessions/sessions-right-rail.tsx` lines 293-310, 441-451):

```tsx
useEffect(() => {
  if (!loadMore || !hasMore || isLoadingMore) return
  const el = sentinelRef.current
  if (!el) return
  const observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) loadMore()
  }, { threshold: 0.1 })
  observer.observe(el)
  return () => observer.disconnect()
}, [loadMore, hasMore, isLoadingMore])

{isLoadingMore && <div className="flex items-center justify-center py-2">...</div>}
{hasMore && !isLoadingMore && <div className="flex items-center justify-center py-2">...</div>}
<div ref={sentinelRef} className="h-px" />
```

Replace aggregate hard-coding (`components/sessions/sessions-right-rail.tsx` lines 62, 99-101):

```tsx
const { sessions, totalCount, groupCounts, sources, loading, error } = useAggregateSessions({ limit: '100' })
...
hasMore={false}
isLoadingMore={false}
```

with the same `hasMore`, `isLoadingMore`, and `loadMore` props used by the source rail.

**Hook test setup** (`tests/hooks/client-hooks.test.tsx` lines 1-36):

```ts
// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react'
const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ sessions: [], pagination: { total: 0, limit: 50, offset: 0, hasMore: false } }),
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
```

Extend this file for aggregate pagination. Mock three initial source calls, then `loadMore` calls only for sources whose stored `pagination.hasMore` is true. Assert merged sessions are de-duplicated by `session.id`, sorted by `updatedAt || endedAt || startedAt`, and `totalCount` remains the sum of source `pagination.total`.

### `components/replay/markdown-content.tsx` and `tests/unit/bff/markdown-content.test.tsx`

**Analog:** current `MarkdownContent` highlight helper, but not its top-level clone behavior.

**Keep text splitting helper** (`components/replay/markdown-content.tsx` lines 14-26):

```tsx
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightTextNode(text: string, query: string): ReactNode[] {
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-accent/30 text-foreground rounded-sm px-0.5">{part}</mark>
      : part,
  )
}
```

**Do not copy this unsafe insertion point** (`components/replay/markdown-content.tsx` lines 53-61):

```tsx
{searchQuery
  ? highlightNodes(
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>,
      searchQuery,
    )
  : <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>}
```

**Safe insertion point for Phase 09:** keep top-level `ReactMarkdown` children as the raw `content` string and do highlighting in `components` overrides after Markdown has parsed:

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    p({ children, ...props }) {
      return <p {...props}>{highlightChildren(children, searchQuery)}</p>
    },
    li({ children, ...props }) {
      return <li {...props}>{highlightChildren(children, searchQuery)}</li>
    },
    code({ children, ...props }) {
      return <code {...props}>{children}</code>
    },
  }}
>
  {content}
</ReactMarkdown>
```

**Render test pattern:** use the jsdom setup from `tests/hooks/client-hooks.test.tsx` lines 1-8 and render a component. Add cases for Markdown syntax plus search:

```ts
render(<MarkdownContent content={'**hello** `hello`'} searchQuery="hello" />)
expect(screen.getByText('hello')).toBeTruthy()
expect(container.querySelectorAll('mark').length).toBeGreaterThan(0)
```

No existing component render test directly covers replay blocks, so this is a role-match rather than exact analog.

### `components/replay/tool-formatters.ts`, `components/replay/tool-block.tsx`, and formatter tests

**Analog:** pure replay helper `components/replay/key-utils.ts` and its unit test.

**Pure utility location and export style** (`components/replay/key-utils.ts` lines 1-29):

```ts
import type { TraceActivity, TraceMessage, TraceTurn } from '@/types/trace'

export function getTurnKey(turn: TraceTurn, index = turn.index): string {
  return turn.id || `${turn.sessionId || 'session'}-turn-${turn.index ?? index}`
}

export function getActivityKey(activity: TraceActivity, index: number, turnIndex: number): string {
  if (activity.type === 'tool_call') {
    return activity.id || `tool-${activity.name}-${turnIndex}-${index}`
  }
  ...
}
```

Create `components/replay/tool-formatters.ts` next to `tool-block.tsx`; export a pure formatter that accepts `TraceToolCall` and returns a display model. Do not read files from disk.

**ToolBlock render insertion point** (`components/replay/tool-block.tsx` lines 67-85):

```tsx
{expanded && (
  <div className="px-4 pb-3 space-y-2">
    {tool.inputJson && (
      <div>
        <button ...>INPUT {isLongInput && (inputCollapsed ? '(expand)' : '(collapse)')}</button>
        <pre className={cn('text-[11px] font-mono ...')}>
          {formatJson(tool.inputJson)}
        </pre>
      </div>
    )}
  </div>
)}
```

Replace the raw-only input branch with a formatted branch:

```ts
const display = formatToolDisplay(tool)
// display.kind: 'raw-json' | 'claude-edit' | 'claude-multiedit' | 'claude-write' | 'patch'
```

**Activity dispatch must stay unchanged** (`components/replay/turn-card.tsx` lines 249-265):

```tsx
function ActivityBlock({ activity, turnIndex }: { activity: TraceActivity; turnIndex: number }) {
  switch (activity.type) {
    case 'tool_call':
      return <ToolBlock tool={activity} />
    case 'skill_use':
      return <SkillBlock skill={activity} />
    case 'subagent_link':
      return <SubagentBlock subagent={activity} parentTurnIndex={turnIndex} />
    ...
  }
}
```

The formatter belongs below `ToolBlock`, not in `TurnCard`, because `TurnCard` should only dispatch by activity type.

**Avoid nested button regression** (`components/replay/tool-block.tsx` lines 37-43 and `ERRORS_LEARNED.md` EL-001):

```tsx
<div
  role="button"
  tabIndex={0}
  onClick={() => setExpanded((prev) => !prev)}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((prev) => !prev) } }}
  className="w-full flex items-center gap-2 ..."
>
```

Keep this pattern when adding edit-specific copy buttons or toggles inside the header.

**Pure helper test style** (`tests/unit/bff/replay-key-utils.test.ts` lines 1-34):

```ts
import { describe, expect, it } from 'vitest'
import { getActivityKey } from '@/components/replay/key-utils'

describe('replay key utils', () => {
  it('uses activity type details plus turn/index when an activity id is nullish', () => {
    const activity = { type: 'tool_call', id: null, name: 'Read' } as unknown as TraceToolCall
    expect(getActivityKey(activity, 4, 8)).toBe('tool-Read-8-4')
  })
})
```

Use the same style for `tests/unit/bff/tool-formatters.test.ts`, with table cases for Claude `Edit`, `MultiEdit`, `Write`, Codex `apply_patch`, invalid JSON fallback, and copy text if formatter returns copy content.

### `ingest/parser/codex.ts` and `tests/unit/ingest/codex-parser.test.ts`

**Analog:** existing function/custom tool call parse pipeline.

**custom_tool_call pattern** (`ingest/parser/codex.ts` lines 541-577):

```ts
if (ri.type === 'custom_tool_call') {
  flushPendingUserResponseMessage();
  const callId = ri.call_id || `call-${lineNum}`;
  const name = ri.name || 'unknown';
  const inputJson = ri.arguments
    ? ri.arguments
    : ri.input
      ? JSON.stringify(ri.input)
      : '{}';

  const toolCall: TraceToolCall = {
    type: 'tool_call',
    id: callId,
    name,
    category: inferToolCategory(name),
    inputJson,
    resultEvents: [],
    status: 'pending',
    messageOrdinal: ordinal,
    sourceLine: lineNum,
  };
  toolCallMap.set(callId, toolCall);
  ...
}
```

**custom output pairing pattern** (`ingest/parser/codex.ts` lines 661-679):

```ts
if (ev.type === 'function_call_output' || ev.type === 'custom_tool_call_output') {
  flushPendingUserResponseMessage();
  const callId = ev.call_id;
  if (callId && toolCallMap.has(callId)) {
    const toolCall = toolCallMap.get(callId)!;
    const resultEvent: TraceToolResultEvent = {
      type: 'result_event',
      timestamp: parsed.timestamp,
      content: ev.output || ev.content || '',
      isPartial: ev.status !== 'completed',
    };
    toolCall.resultEvents.push(resultEvent);
    if (ev.status === 'completed') toolCall.status = 'success';
  }
}
```

**Category inference insertion point** (`ingest/parser/codex.ts` lines 933-941):

```ts
function inferToolCategory(name: string): ToolCategory {
  const lower = name.toLowerCase();
  if (lower.includes('bash') || lower.includes('shell')) return 'Bash';
  if (lower.includes('edit')) return 'Edit';
  if (lower.includes('read')) return 'Read';
  if (lower.includes('grep') || lower.includes('search')) return 'Grep';
  if (lower.includes('task')) return 'Task';
  if (lower.includes('agent')) return 'Agent';
  return 'Other';
}
```

Extend this with exact or explicit patch names before the generic fallback:

```ts
if (lower === 'apply_patch' || lower === 'patch' || lower.includes('file_edit')) return 'Edit';
if (lower.includes('patch')) return 'Edit';
```

**Parser test fixture pattern** (`tests/unit/ingest/codex-parser.test.ts` lines 25-29, 372-388):

```ts
function writeFixture(fileName: string, content: string): string {
  const filePath = join(tempDir, fileName);
  writeFileSync(filePath, content);
  return filePath;
}

const jsonl = [
  '{"type":"session_meta","session_meta":{"session_id":"codex-rp-002","model":"gpt-5"}}',
  '{"type":"response_item","response_item":{"type":"function_call","call_id":"call-rp-02","name":"bash","input":{"command":"ls -la"},"token_count":8}}',
].join('\n');
...
const parsed = JSON.parse(toolCalls[0].inputJson);
expect(parsed.command).toBe('ls -la');
```

Add a case with `type:"custom_tool_call"`, `name:"apply_patch"`, and string `input` or `arguments` containing `*** Begin Patch`; assert `category === 'Edit'` and result pairing remains intact if an output event is present.

### `ingest/sync/index.ts`, relationship storage, and backfill tests

**Analog:** existing relationship column writes in `writeSessionToDatabase` plus Codex relationship collection.

**Session relationship write pattern** (`ingest/sync/index.ts` lines 315-358):

```ts
UPDATE sessions SET
  ...
  root_session_id = ?,
  parent_session_id = ?,
  relationship_type = ?,
  ...
WHERE id = ?
```

```ts
parseResult.session.rootSessionId || null,
parseResult.session.parentSessionId || null,
parseResult.session.relationshipType || 'root',
```

**Insert path uses the same columns** (`ingest/sync/index.ts` lines 374-393):

```ts
INSERT INTO sessions (
  id, source, project, name, started_at, ended_at, status,
  root_session_id, parent_session_id, relationship_type,
  ...
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ...)
...
parseResult.session.rootSessionId || null,
parseResult.session.parentSessionId || null,
parseResult.session.relationshipType || 'root',
```

**Codex parse-time relationship pattern, not sufficient alone** (`ingest/sync/index.ts` lines 823-849):

```ts
const relationshipsByChild = typeof opts.limit === 'number'
  ? new Map<string, { parentSessionId: string; rootSessionId?: string }>()
  : await collectCodexRelationships(sources);
...
const relationship = relationshipsByChild.get(parseResult.session.id);
if (relationship) {
  parseResult.session.parentSessionId = relationship.parentSessionId;
  parseResult.session.rootSessionId = relationship.rootSessionId || relationship.parentSessionId;
  parseResult.session.relationshipType = 'subagent';
  parseResult.session.sourceSessionId = parseResult.session.sourceSessionId || parseResult.session.id;
}
```

Keep this for newly parsed child sessions, but add an idempotent DB backfill after relationship collection so already-indexed child rows are repaired too.

**Relationship collection pattern** (`ingest/sync/index.ts` lines 879-918):

```ts
async function collectCodexRelationships(
  sources: Array<{ path: string; error?: string; sessionCount: number }>
): Promise<Map<string, { parentSessionId: string; rootSessionId?: string }>> {
  const relationships = new Map<string, { parentSessionId: string; rootSessionId?: string }>();
  ...
  if (
    parsed?.type === 'event_msg' &&
    payload?.type === 'collab_agent_spawn_end' &&
    typeof payload.new_thread_id === 'string' &&
    typeof payload.sender_thread_id === 'string'
  ) {
    relationships.set(payload.new_thread_id, {
      parentSessionId: payload.sender_thread_id,
      rootSessionId: payload.sender_thread_id,
    });
  }
}
```

**Backfill shape to add near sync helpers:**

```ts
function backfillCodexRelationships(
  database: Database.Database,
  relationships: Map<string, { parentSessionId: string; rootSessionId?: string }>,
): void {
  const update = database.prepare(`
    UPDATE sessions
    SET parent_session_id = ?,
        root_session_id = ?,
        relationship_type = 'subagent',
        source_session_id = COALESCE(source_session_id, id)
    WHERE source = 'codex'
      AND id = ?
  `)
  const tx = database.transaction(() => {
    for (const [childId, relationship] of relationships) {
      update.run(relationship.parentSessionId, relationship.rootSessionId || relationship.parentSessionId, childId)
    }
  })
  tx()
}
```

The update is idempotent: running it repeatedly sets the same columns for the same `id` and does not duplicate rows.

**Schema and default list filtering** (`ingest/db/schema.sql` lines 26-29, `ingest/api/sessions.ts` lines 146-149):

```sql
root_session_id TEXT,
parent_session_id TEXT,
relationship_type TEXT CHECK(relationship_type IN ('root', 'subagent', 'fork', 'continuation')),
```

```ts
if (!includeChildren) {
  conditions.push('(relationship_type IS NULL OR relationship_type = ?)');
  params.push('root');
}
```

This means Codex child rows disappear from normal lists once `relationship_type = 'subagent'`.

**Existing relationship assertion pattern** (`tests/unit/ingest/phase8-regression.test.ts` lines 436-478):

```ts
writeSessionToDatabase({
  session: {
    id: childSessionId,
    source: 'codex',
    rootSessionId: parentSessionId,
    parentSessionId,
    relationshipType: 'subagent',
    sourceSessionId: childSessionId,
    ...
  },
  messages: [],
  activities: [],
  errors: [],
  warnings: [],
}, db);

const child = db.prepare(`
  SELECT parent_session_id, root_session_id, relationship_type, source_session_id
  FROM sessions
  WHERE id = ?
`).get(childSessionId)

expect(child.parent_session_id).toBe(parentSessionId);
expect(child.root_session_id).toBe(parentSessionId);
expect(child.relationship_type).toBe('subagent');
```

**DB fixture patterns:** use in-memory schema setup from `tests/unit/ingest/tool-persistence.test.ts` lines 26-32, or temp file DB setup from `tests/unit/ingest/sessions-api.test.ts` lines 12-23 when testing route handlers with `getDatabase()`.

## Shared Patterns

### BFF Boundary

**Source:** `lib/agent-tools/client-hooks.tsx` lines 13-14 and 250-260  
**Apply to:** all frontend hooks and stores

Client code fetches `/api/agent-tools/[tool]/...`; it must not call ingest directly. Star loading already follows this in `stores/starred-store.ts` lines 16-24:

```ts
const res = await fetch('/api/agent-tools/all/sessions/starred')
if (!res.ok) return
const data = await res.json()
set({ ids: new Set<string>(data.session_ids as string[]), loaded: true })
```

### Pagination Metadata

**Source:** `ingest/api/sessions.ts` lines 207-218  
**Apply to:** source and aggregate session lists

```ts
pagination: {
  total: countResult.total,
  limit: cappedLimit,
  offset,
  hasMore: offset + cappedLimit < countResult.total
}
```

Aggregate totals should sum source `pagination.total`, not loaded row counts.

### UI Activity Dispatch

**Source:** `components/replay/turn-card.tsx` lines 249-265  
**Apply to:** replay activity additions

Keep new edit rendering inside `ToolBlock` or `tool-formatters.ts`; do not add edit-specific branching to `ActivityBlock`.

### Relationship Contract

**Source:** `types/trace.ts` lines 91-104 and 246-253  
**Apply to:** parser, sync, sessions API, subagent replay

```ts
rootSessionId?: string;
parentSessionId?: string;
relationshipType?: 'root' | 'subagent' | 'fork' | 'continuation';
...
export interface TraceSubagentLink {
  type: 'subagent_link';
  subagentSessionId: string;
  subagentSource: TraceSource;
  relationship: 'spawned' | 'attached';
  messageOrdinal?: number;
}
```

Do not use `hide_single_turn` as a relationship substitute. If `TraceSubagentLink` metadata is expanded, update `types/trace.ts` and parser tests together.

### Test Fixture Helpers

**Source:** `tests/helpers/temp-fixture.ts` lines 13-28

```ts
export function createTempFixture(content: string, ext = '.jsonl'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));
  const filePath = path.join(dir, `fixture${ext}`);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

export function cleanupTempFixture(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.rmSync(dir, { recursive: true, force: true });
}
```

Use this for parser fixtures when a single file is enough. Use `phase8-regression.test.ts` helper style when tests need multiple named files in one temp directory.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `tests/unit/bff/markdown-content.test.tsx` | test | transform/render | No existing replay component render test; reuse jsdom setup from hook tests. |
| `ingest/sync/index.ts` backfill helper | service | batch CRUD | Existing sync writes relationships during session upsert, but no standalone idempotent backfill helper exists yet. |

## Metadata

**Analog search scope:** `ingest/`, `app/api/agent-tools/`, `lib/agent-tools/`, `components/replay/`, `components/sessions/`, `stores/`, `types/`, `tests/`  
**Files scanned:** 60+ via `rg --files` and targeted `rg -n`  
**Project instructions:** `CLAUDE.md` delegates to `AGENTS.md`; no `.claude/skills` or `.agents/skills` project skill files were present.  
**Pattern extraction date:** 2026-05-10
