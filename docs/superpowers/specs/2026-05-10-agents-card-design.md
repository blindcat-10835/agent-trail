# Agents Card for OpenClaw Overview

**Date**: 2026-05-10
**Status**: Draft

## Background

The OpenClaw dashboard overview currently shows an `<EmptyState>` placeholder in the AGENTS section. The old ovao project had `OverviewAgentCard` components displaying agent name, status, avatar, and current tool via a WebSocket gateway. We need to bring agent cards back, adapted to the current ingest/SQLite data model.

## Decision: Static Aggregation

Agent cards will display **static aggregated statistics** from SQLite, not real-time status. No SSE/polling mechanism is needed. Rationale: current data comes from file-based JSONL parsing, not a live gateway. Real-time status can be added incrementally later.

## Data Flow

```
OpenClaw JSONL files
  → Parser extracts agentName from path (.../agents/{agentName}/sessions/{uuid}.jsonl)
  → Sync layer persists agentName to sessions.agent_name column
  → GET /api/v1/agents aggregates by agent_name
  → BFF proxy forwards to frontend
  → AgentCard grid renders in OpenClaw dashboard
```

## Modifications

### 1. DB Schema — `ingest/db/schema.sql`

Add column to `sessions` table:

```sql
agent_name TEXT,  -- OpenClaw agent name extracted from file path
```

Add index:

```sql
CREATE INDEX IF NOT EXISTS idx_sessions_agent_name ON sessions(agent_name);
```

Migration in `ingest/db/index.ts` via `runMigrations()`.

### 2. Sync Layer — `ingest/sync/index.ts`

The OpenClaw parser already extracts `context.agentName` from file paths (line 147-153). The sync layer currently discards it. Modify the upsert logic to write `context.agentName` to the new `agent_name` column.

### 3. Ingest API — `ingest/api/agents.ts` (new file)

`GET /api/v1/agents?source=openclaw`

SQL aggregation:

```sql
SELECT
  agent_name AS name,
  COUNT(*) AS session_count,
  MAX(started_at) AS last_active_at,
  -- latest session status via subquery
  tool_call_count via JOIN on tool_calls
FROM sessions
LEFT JOIN tool_calls ON tool_calls.session_id = sessions.id
WHERE source = ? AND agent_name IS NOT NULL
GROUP BY agent_name
ORDER BY last_active_at DESC
```

Returns `AgentInfo[]`.

### 4. BFF Proxy — `app/api/agent-tools/[tool]/agents/route.ts` (new file)

Standard BFF pattern: forward request to ingest `/api/v1/agents?source={tool}`, return JSON response. Follows existing pattern in `sessions/route.ts`.

### 5. Types — `types/trace.ts`

```ts
export interface AgentInfo {
  name: string;
  sessionCount: number;
  lastActiveAt: string | null;
  latestStatus: TraceSession['status'];
  toolCallCount: number;
}
```

### 6. Frontend Hook — `lib/agent-tools/client-hooks.tsx`

Add `useToolAgents(toolId)` hook following the same pattern as `useToolSessions()`. Fetches from BFF `/api/agent-tools/{tool}/agents`.

### 7. Components — `components/dashboard/` (3 new files)

#### `agent-card.tsx` — `AgentCard`

Props: `{ agent: AgentInfo }`. Renders:
- Agent name (bold, prominent)
- Status indicator dot + label derived from `latestStatus`
- Session count
- Last active time (relative, e.g. "2h ago")
- Tool call count

Styled as a bordered card matching existing dashboard aesthetic (cyberpunk HUD style, `bg-card`, `border-border`). Reference: ovao's `OverviewAgentCard` but simplified for static data.

#### `agent-avatar.tsx` — `AgentAvatar`

Props: `{ name: string; size?: number }`. Renders first character of agent name as a styled glyph. No emoji/avatarUrl support in this iteration.

#### `agent-status-meta.ts` — `AGENT_STATUS_META`

Maps session statuses (`active`, `idle`, `aborted`, `error`, `unknown`) to `{ label, color }` using semantic tokens.

### 8. Dashboard — `openclaw-dashboard.tsx`

Replace AGENTS section `<EmptyState>` (line 42-49) with:

```tsx
const { agents, loading: agentsLoading } = useToolAgents(toolId)

// In JSX:
<section>
  <h2>AGENTS</h2>
  {agentsLoading ? <Spinner /> :
   agents.length === 0 ? <EmptyState heading="NO AGENT DATA" /> :
   <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
     {agents.map(agent => <AgentCard key={agent.name} agent={agent} />)}
   </div>
  }
</section>
```

## Scope Exclusions

- Real-time agent status (working/tool_calling/speaking) — future enhancement
- Agent avatar URL / emoji — not available from file-based data
- Agent drawer (click-to-expand detail panel) — separate feature
- Claude Code / Codex agent extraction — OpenClaw only for now
- Agents API filtering/pagination — YAGNI for local dev tool

## File Change Summary

| File | Action |
|------|--------|
| `ingest/db/schema.sql` | Modify: add `agent_name` column + index |
| `ingest/db/index.ts` | Modify: add migration |
| `ingest/sync/index.ts` | Modify: persist `agentName` |
| `ingest/api/agents.ts` | New: agents aggregation endpoint |
| `ingest/api/index.ts` | Modify: register agents route |
| `app/api/agent-tools/[tool]/agents/route.ts` | New: BFF proxy |
| `types/trace.ts` | Modify: add `AgentInfo` type |
| `lib/agent-tools/client-hooks.tsx` | Modify: add `useToolAgents` hook |
| `components/dashboard/agent-card.tsx` | New: agent card component |
| `components/dashboard/agent-avatar.tsx` | New: agent avatar component |
| `components/dashboard/agent-status-meta.ts` | New: status mapping |
| `openclaw-dashboard.tsx` | Modify: replace EmptyState with card grid |
