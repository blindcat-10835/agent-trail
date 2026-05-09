# Agents Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add agent cards to the OpenClaw dashboard overview, displaying aggregated agent statistics from SQLite.

**Architecture:** Extend the existing ingest/sync pipeline to persist OpenClaw agent names extracted from file paths into a new `agent_name` column. Add a `GET /api/v1/agents` endpoint that aggregates sessions by agent name. Build frontend components (card, avatar, status meta) and integrate into the OpenClaw dashboard.

**Tech Stack:** SQLite (better-sqlite3), Hono (ingest API), Next.js App Router (BFF proxy), React hooks (Zustand-free data fetching), Tailwind v4 + shadcn/ui tokens.

---

### Task 1: DB Schema — Add `agent_name` column

**Files:**

- Modify: `ingest/db/schema.sql` (add column + index)
- Modify: `ingest/db/index.ts` (add migration step, bump target version)

- [ ] **Step 1: Add `agent_name` column to schema.sql**

In `ingest/db/schema.sql`, add after the `name TEXT,` line (around line 17):

```sql
  agent_name TEXT,
```

And add an index at the end of the indexes section (after line 206):

```sql
CREATE INDEX IF NOT EXISTS idx_sessions_agent_name ON sessions(agent_name);
```

- [ ] **Step 2: Add migration in `ingest/db/index.ts`**

In `runMigrations()` (line 130), bump `targetVersion` from `6` to `7`.

Add a new migration step at the end of the `migrationSteps` array (after the Claude/Codex cache invalidation step around line 210):

```ts
{
  desc: 'Add agent_name column to sessions',
  sql: 'ALTER TABLE sessions ADD COLUMN agent_name TEXT',
},
{
  desc: 'Add agent_name index',
  sql: 'CREATE INDEX IF NOT EXISTS idx_sessions_agent_name ON sessions(agent_name)',
},
{
  desc: 'Invalidate openclaw sessions cache to backfill agent_name',
  sql: "UPDATE sessions SET file_hash = NULL WHERE source = 'openclaw' AND agent_name IS NULL",
},
```

- [ ] **Step 3: Verify migration runs**

Run: `pnpm build` (or start dev server to trigger schema init).
Expected: No errors. Check console for "Running migrations: v6 → v7" and "✓ Add agent_name column to sessions".

- [ ] **Step 4: Commit**

```bash
git add ingest/db/schema.sql ingest/db/index.ts
git commit -m "feat(db): add agent_name column to sessions table"
```

---

### Task 2: Sync Layer — Persist agent_name from OpenClaw file paths

**Files:**

- Modify: `types/trace.ts` (add optional `agentName` to `TraceSession`)
- Modify: `ingest/sync/index.ts` (extract + persist agent_name)

- [ ] **Step 1: Add `agentName` to `TraceSession` type**

In `types/trace.ts`, add to the `TraceSession` interface (after `sourceVersion?: string;` around line 95):

```ts
  agentName?: string;
```

- [ ] **Step 2: Extract agent_name from file path in sync layer**

In `ingest/sync/index.ts`, add a new helper function after `extractProjectFromParsedSession` (after line 173):

```ts
/**
 * Extract agent name from OpenClaw file path.
 *
 * Path structure: {openclaw-dir}/agents/{agentName}/sessions/{file}.jsonl
 */
function extractAgentNameFromPath(filePath: string, sourceType: SyncSourceType): string | null {
  if (sourceType !== 'openclaw') return null
  const parts = path.dirname(filePath).split(path.sep)
  const agentsIdx = parts.lastIndexOf('agents')
  if (agentsIdx >= 0 && agentsIdx + 1 < parts.length) return parts[agentsIdx + 1]
  return null
}
```

- [ ] **Step 3: Set agentName on parseResult in the OpenClaw sync function**

In `syncOpenClawSessions` (around line 698), after the `extractSessionName` call, add:

```ts
parseResult.session.agentName = extractAgentNameFromPath(filePath, 'openclaw')
```

So the block becomes:

```ts
const parseResult = await parseOpenClawSession(filePath, candidate.project);
parseResult.session.name = extractSessionName(parseResult);
parseResult.session.project = extractProjectFromParsedSession(parseResult, candidate.project);
parseResult.session.agentName = extractAgentNameFromPath(filePath, 'openclaw');
const result = writeSessionToDatabase(parseResult, undefined, filePath, { force: opts.force });
```

- [ ] **Step 4: Persist agent_name in writeSessionToDatabase**

In `writeSessionToDatabase`, update the **INSERT** statement (around line 358). Add `agent_name` to the column list and add `?` to the VALUES list:

Change:

```sql
INSERT INTO sessions (
  id, source, project, name, started_at, ended_at, status,
  root_session_id, parent_session_id, relationship_type,
  message_count, user_message_count, total_output_tokens, has_tool_calls,
  parser_malformed_lines, is_truncated, termination_status,
  file_path, file_size, file_mtime, file_hash, last_sync_at,
  cwd, git_branch, source_session_id, source_version
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

To:

```sql
INSERT INTO sessions (
  id, source, project, name, started_at, ended_at, status,
  root_session_id, parent_session_id, relationship_type,
  message_count, user_message_count, total_output_tokens, has_tool_calls,
  parser_malformed_lines, is_truncated, termination_status,
  file_path, file_size, file_mtime, file_hash, last_sync_at,
  cwd, git_branch, source_session_id, source_version,
  agent_name
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

And add the value at the end of the `.run()` call (after `parseResult.session.sourceVersion || null`):

```ts
parseResult.session.agentName || null
```

Do the same for the **UPDATE** statement (around line 300). Add `agent_name = ?,` to the SET clause and add the value at the end of the `.run()` call:

Add after `source_version = ?,` in the SET clause:

```sql
agent_name = ?,
```

And add `parseResult.session.agentName || null` at the end of the `.run()` values array (before `parseResult.session.id`).

Also update the **skip cache UPDATE** (around line 250) to include `agent_name`:

Change:

```sql
UPDATE sessions SET
  file_size = ?,
  file_mtime = ?,
  last_sync_at = ?,
  name = CASE WHEN (name IS NULL OR name = '') THEN ? ELSE name END,
  project = CASE WHEN (project IS NULL OR project = '' OR project = 'default') THEN ? ELSE project END
WHERE id = ?
```

To:

```sql
UPDATE sessions SET
  file_size = ?,
  file_mtime = ?,
  last_sync_at = ?,
  name = CASE WHEN (name IS NULL OR name = '') THEN ? ELSE name END,
  project = CASE WHEN (project IS NULL OR project = '' OR project = 'default') THEN ? ELSE project END,
  agent_name = COALESCE(?, agent_name)
WHERE id = ?
```

And add `parseResult.session.agentName || null` to the `.run()` values, before the final `parseResult.session.id`.

- [ ] **Step 5: Verify sync populates agent_name**

Run: `pnpm dev` to start both services. Trigger a sync (POST `/api/agent-tools/openclaw/sync`). Then check the database:

```bash
sqlite3 .agents-tracing/data/tracing.db "SELECT DISTINCT agent_name FROM sessions WHERE source='openclaw' LIMIT 10"
```

Expected: Non-empty results showing agent names extracted from OpenClaw paths.

- [ ] **Step 6: Commit**

```bash
git add types/trace.ts ingest/sync/index.ts
git commit -m "feat(sync): extract and persist OpenClaw agent_name from file paths"
```

---

### Task 3: Ingest API — Add `GET /api/v1/agents` endpoint

**Files:**

- Create: `ingest/api/agents.ts`
- Create: `ingest/api/agents.test.ts`
- Modify: `ingest/index.ts` (mount new route)

- [ ] **Step 1: Write test for agents endpoint**

Create `ingest/api/agents.test.ts`:

```ts
/**
 * Agents API Tests — Param validation
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { agentsRoutes } from './agents.js'

function createApp() {
  const app = new Hono()
  app.route('/', agentsRoutes)
  return app
}

describe('GET /api/v1/agents — param validation', () => {
  it('should return 400 when source is missing', async () => {
    const app = createApp()
    const res = await app.request('/api/v1/agents')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('source')
  })

  it('should return 400 for invalid source', async () => {
    const app = createApp()
    const res = await app.request('/api/v1/agents?source=invalid')
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run ingest/api/agents.test.ts`
Expected: FAIL — module `./agents.js` not found.

- [ ] **Step 3: Implement agents route**

Create `ingest/api/agents.ts`:

```ts
/**
 * Agents API Routes
 *
 * REST API endpoint for listing agents aggregated from session data.
 * Groups sessions by agent_name and returns summary statistics.
 */

import { Hono } from 'hono'
import { getDatabase } from '../db'

export const agentsRoutes = new Hono()

export interface AgentRow {
  name: string
  session_count: number
  last_active_at: string | null
  latest_status: string
  tool_call_count: number
}

agentsRoutes.get('/api/v1/agents', (c) => {
  const source = c.req.query('source') as string

  if (!source) {
    return c.json({ error: 'source query parameter is required' }, 400)
  }

  if (!['openclaw', 'claude-code', 'codex'].includes(source)) {
    return c.json({ error: 'Invalid source parameter' }, 400)
  }

  const db = getDatabase()

  const rows = db.prepare(`
    SELECT
      s.agent_name AS name,
      COUNT(DISTINCT s.id) AS session_count,
      MAX(s.started_at) AS last_active_at,
      (
        SELECT s2.status
        FROM sessions s2
        WHERE s2.source = s.source
          AND s2.agent_name = s.agent_name
        ORDER BY COALESCE(s2.ended_at, s2.started_at) DESC
        LIMIT 1
      ) AS latest_status,
      COALESCE(
        (SELECT COUNT(*) FROM tool_calls tc WHERE tc.session_id IN (
          SELECT s3.id FROM sessions s3 WHERE s3.source = s.source AND s3.agent_name = s.agent_name
        )),
        0
      ) AS tool_call_count
    FROM sessions s
    WHERE s.source = ? AND s.agent_name IS NOT NULL
    GROUP BY s.agent_name
    ORDER BY last_active_at DESC
  `).all(source) as AgentRow[]

  return c.json({ agents: rows })
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run ingest/api/agents.test.ts`
Expected: PASS

- [ ] **Step 5: Mount route in ingest service**

In `ingest/index.ts`, add import (after the turns import around line 14):

```ts
import { agentsRoutes } from './api/agents.js'
```

And mount the route (after `app.route('/', turnsRoutes);` around line 80):

```ts
app.route('/', agentsRoutes)
```

- [ ] **Step 6: Commit**

```bash
git add ingest/api/agents.ts ingest/api/agents.test.ts ingest/index.ts
git commit -m "feat(ingest): add GET /api/v1/agents endpoint"
```

---

### Task 4: BFF Proxy — Add agents route

**Files:**

- Create: `app/api/agent-tools/[tool]/agents/route.ts`

- [ ] **Step 1: Create BFF proxy route**

Create `app/api/agent-tools/[tool]/agents/route.ts` following the existing pattern from `sessions/route.ts`:

```ts
/**
 * BFF API Proxy — GET /api/agent-tools/[tool]/agents
 *
 * Proxies agent list requests to the ingest service.
 * Automatically injects source filter based on the [tool] URL segment.
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertSourceToolId } from '@/lib/agent-tools/registry'
import { fetchIngest } from '@/lib/agent-tools/server-adapter'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params

  try {
    const toolId = assertSourceToolId(tool)
    const data = await fetchIngest<{ agents: unknown[] }>(
      `/api/v1/agents?source=${toolId}`,
    )
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify BFF proxy works**

Start dev server (`pnpm dev`), then:

```bash
curl http://localhost:3000/api/agent-tools/openclaw/agents
```

Expected: JSON response with `{ agents: [...] }` array.

- [ ] **Step 3: Commit**

```bash
git add app/api/agent-tools/\[tool\]/agents/route.ts
git commit -m "feat(bff): add agents proxy route for agent-tools"
```

---

### Task 5: Frontend types and hook

**Files:**

- Modify: `types/trace.ts` (add `AgentInfo` type)
- Modify: `lib/agent-tools/client-hooks.tsx` (add `useToolAgents` hook)

- [ ] **Step 1: Add `AgentInfo` type**

In `types/trace.ts`, add after the `TraceSourceMetadata` interface (around line 44):

```ts
/**
 * Agent summary aggregated from sessions
 */
export interface AgentInfo {
  name: string
  sessionCount: number
  lastActiveAt: string | null
  latestStatus: SessionStatus
  toolCallCount: number
}
```

- [ ] **Step 2: Add `useToolAgents` hook**

In `lib/agent-tools/client-hooks.tsx`, add the import for `AgentInfo`:

```ts
import type { AgentInfo } from '@/types/trace'
```

Then add the hook after `useSourceStatus` (around line 388):

```ts
/**
 * Hook: Fetch agents for a tool from ingest via BFF proxy.
 *
 * Returns aggregated agent statistics (session count, last active, status,
 * tool call count) grouped by agent_name.
 *
 * @param toolId - Current tool from AgentToolProvider
 * @returns { agents, loading, error }
 */
export function useToolAgents(toolId: AgentToolId) {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchToolApi<{ agents: AgentInfo[] }>(toolId, '/agents')
      .then((data) => {
        setAgents(data.agents)
        setError(null)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load agents'),
      )
      .finally(() => setLoading(false))
  }, [toolId])

  return { agents, loading, error }
}
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm build`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add types/trace.ts lib/agent-tools/client-hooks.tsx
git commit -m "feat(frontend): add AgentInfo type and useToolAgents hook"
```

---

### Task 6: Agent card components

**Files:**

- Create: `components/dashboard/agent-status-meta.ts`
- Create: `components/dashboard/agent-avatar.tsx`
- Create: `components/dashboard/agent-card.tsx`

- [ ] **Step 1: Create status meta mapping**

Create `components/dashboard/agent-status-meta.ts`:

```ts
/**
 * Agent status → visual meta mapping
 *
 * Maps session statuses to display labels and semantic color tokens.
 */

export const AGENT_STATUS_META: Record<
  string,
  { label: string; color: string }
> = {
  active: { label: 'ACTIVE', color: 'var(--color-accent)' },
  idle: { label: 'IDLE', color: 'var(--color-muted-foreground)' },
  aborted: { label: 'ABORTED', color: 'var(--color-destructive)' },
  error: { label: 'ERROR', color: 'var(--color-destructive)' },
  unknown: { label: 'UNKNOWN', color: 'var(--color-muted-foreground)' },
}
```

- [ ] **Step 2: Create agent avatar component**

Create `components/dashboard/agent-avatar.tsx`:

```tsx
'use client'

/**
 * Agent avatar — first-character glyph with status-colored border
 */

interface AgentAvatarProps {
  name: string
  statusColor?: string
  size?: number
}

export function AgentAvatar({ name, statusColor, size = 32 }: AgentAvatarProps) {
  const glyph = name.charAt(0).toUpperCase()

  return (
    <div
      className="flex items-center justify-center rounded border font-mono font-bold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        borderColor: statusColor ?? 'var(--color-border)',
        color: statusColor ?? 'var(--color-foreground)',
      }}
    >
      {glyph}
    </div>
  )
}
```

- [ ] **Step 3: Create agent card component**

Create `components/dashboard/agent-card.tsx`:

```tsx
'use client'

/**
 * Agent card for the OpenClaw dashboard overview
 *
 * Displays agent name, session count, status indicator, last active time,
 * and tool call count. Adapted from ovao's OverviewAgentCard for static data.
 */

import type { AgentInfo } from '@/types/trace'
import { AgentAvatar } from './agent-avatar'
import { AGENT_STATUS_META } from './agent-status-meta'

interface AgentCardProps {
  agent: AgentInfo
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'never'
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function AgentCard({ agent }: AgentCardProps) {
  const meta = AGENT_STATUS_META[agent.latestStatus] ?? AGENT_STATUS_META.unknown

  return (
    <div className="border border-border bg-card p-3 flex flex-col gap-2 hover:bg-accent/5 transition-colors">
      {/* Header row: avatar + name + status */}
      <div className="flex items-center gap-2.5">
        <AgentAvatar name={agent.name} statusColor={meta.color} />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold truncate">{agent.name}</span>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: meta.color }}
            />
            <span
              className="text-[10px] font-medium tracking-[0.1em] uppercase"
              style={{ color: meta.color }}
            >
              {meta.label}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border">
        <span>
          <span className="font-mono text-foreground font-bold">{agent.sessionCount}</span>{' '}
          session{agent.sessionCount !== 1 ? 's' : ''}
        </span>
        <span className="text-border">|</span>
        <span>
          <span className="font-mono text-foreground font-bold">{agent.toolCallCount}</span>{' '}
          tools
        </span>
        <span className="text-border">|</span>
        <span>{formatRelativeTime(agent.lastActiveAt)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify components render**

Start dev server (`pnpm dev`). The components won't be visible yet (not integrated), but verify no import/type errors in the build:

```bash
pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/agent-status-meta.ts components/dashboard/agent-avatar.tsx components/dashboard/agent-card.tsx
git commit -m "feat(components): add AgentCard, AgentAvatar, and status meta"
```

---

### Task 7: Integrate agents into OpenClaw dashboard

**Files:**

- Modify: `app/(tool-shell)/[tool]/dashboard/openclaw-dashboard.tsx`

- [ ] **Step 1: Replace EmptyState with agent card grid**

In `openclaw-dashboard.tsx`, add imports at the top:

```ts
import { useToolAgents } from '@/lib/agent-tools/client-hooks'
import { AgentCard } from '@/components/dashboard/agent-card'
```

Replace the AGENTS section (lines 42-49) from:

```tsx
{/* Agent Cards — skeleton, empty */}
<section>
  <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
    AGENTS
  </h2>
  <EmptyState
    heading="NO AGENT DATA"
    body="Agent data will be populated from local file data sources in Phase 6+."
  />
</section>
```

To:

```tsx
{/* Agent Cards */}
<section>
  <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
    AGENTS
  </h2>
  {agentsLoading ? (
    <div className="flex justify-center py-8">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
    </div>
  ) : agents.length === 0 ? (
    <EmptyState
      heading="NO AGENT DATA"
      body="Agent data will be populated from local file data sources in Phase 6+."
    />
  ) : (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
      {agents.map((agent) => (
        <AgentCard key={agent.name} agent={agent} />
      ))}
    </div>
  )}
</section>
```

And add the hook call inside the component, after the `useToolSessions` line:

```ts
const { agents, loading: agentsLoading } = useToolAgents(toolId)
```

- [ ] **Step 2: Verify in browser**

1. Start dev server: `pnpm dev`
2. Navigate to `http://localhost:3000/openclaw/dashboard`
3. Expected: AGENTS section shows agent cards with name, session count, status indicator, last active time, and tool count.

- [ ] **Step 3: Commit**

```bash
git add app/\(tool-shell\)/\[tool\]/dashboard/openclaw-dashboard.tsx
git commit -m "feat(dashboard): integrate agent cards into OpenClaw overview"
```
