# Phase 10: Rich Ingest Metrics & Data Contracts - Research

**Researched:** 2026-05-12
**Domain:** SQLite aggregation queries, ingest REST endpoints, BFF proxy routes, turn assembler enrichment
**Confidence:** HIGH

## Summary

Phase 10 extends the ingest service (Hono on port 8078) with aggregate overview endpoints, enriched session/turn payloads, FTS5-based in-session search, and source capability metadata. All new endpoints follow existing Hono route group patterns (`ingest/api/*.ts`) and are proxied through the Next.js BFF (`app/api/agent-tools/[tool]/...`). The SQLite schema adds one column (`total_input_tokens`) and one FTS5 virtual table — both via the existing `runMigrations()` v9→v10 path. No new external dependencies are needed; the entire phase is implemented within the existing better-sqlite3 + Hono + vitest stack.

**Primary recommendation:** Build a new `ingest/api/overview.ts` route group with sub-routes for each aggregate endpoint. Extend the turn assembler to compute per-turn enrichment at query time. Add FTS5 as an external-content virtual table over `messages`. Mirror each new ingest route with a matching BFF proxy route. Test with isolated SQLite databases following the existing `sync.test.ts` pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- SQL aggregation in SQLite — GROUP BY / SUM / date filtering done in ingest queries; BFF passes results through unchanged
- Real-time SQL queries for time windows (today / 7d / 30d) — no materialized view tables; local SQLite handles the dataset size comfortably
- `all` source scope uses a single query without source filter (or UNION ALL when source-specific stats are needed); BFF `/api/agent-tools/all/...` aggregates cross-source
- Cost estimation: token counts with `cost: null` placeholder when source lacks price data; per-source model-price mapping is deferred to a future enhancement
- Add `total_input_tokens INTEGER` column to sessions alongside existing `total_output_tokens` — enables token breakdown for KPI cards and session rows
- New ingest Hono route group under `/api/v1/overview/` for aggregates, top models, top projects, timeline, starred, source capabilities
- New matching BFF proxy routes under `/api/agent-tools/[tool]/overview/...`
- Activity timeline built at query time from existing tables (sessions.started_at, sessions.status, sync_status.last_error, tool_calls) — no new activity_events table
- Source capability metadata as a static config map in ingest (openclaw → agents/automations/cost, claude-code → sessions/cost/activity, codex → sessions/activity) exposed via `/api/v1/overview/capabilities`
- Session display title: reuse existing `name` column (first user message) with fallback to `project + date` in frontend — no new summary column
- Per-turn enrichment (failure, truncated, warning status, activity counts) computed at query time in the turn assembler — no new turn columns
- Normalized activity rows: extend existing `TraceActivity` union with optional `durationMs`, `error`, `displayName` fields on `TraceToolCall` and other variants rather than a separate model
- In-session search (TURN-104): FTS5 index on messages.content with `LIKE` fallback; build FTS virtual table in migration
- Unit tests per new endpoint with golden fixtures — follow existing pattern in `ingest/api/sessions.test.ts`
- Migration test: verify v9→v10 migration on pre-existing DB without manual deletion
- Source filter tests: parameterized fixtures for openclaw / claude-code / codex / all
- No new test framework — continue with vitest

### the agent's Discretion
- Exact route path naming under `/api/v1/overview/`
- SQL query structure for each aggregate endpoint
- Error response format for new endpoints
- Pagination strategy for timeline and ranking endpoints
- FTS5 table structure details

### Deferred Ideas (OUT OF SCOPE)
- Per-source model-price mapping for real cost estimation (currently `cost: null`)
- OpenClaw agent live status from Gateway (OPEN-103 distinguishes ingest vs gateway; gateway connectivity is existing functionality)
- Automation data from local cron/schedule files — needs source-specific discovery first
- Client-side search fallback strategy (if FTS5 proves unnecessary for local dataset sizes)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-101 | Overview aggregates scoped to `all`, `openclaw`, `claude-code`, or `codex` including session/turn/project/token/cost totals for today/7d/30d | §Standard Stack (SQLite aggregates), §Architecture Patterns (overview route group), §Code Examples (aggregate query) |
| DATA-102 | Top model rankings scoped by source and time window, sortable by tokens or cost, with share percentage | §Architecture Patterns (top-N ranking), §Code Examples (top-models query) |
| DATA-103 | Top project rankings scoped by source and time window with session/turn/token/cost counts and rank weight | §Architecture Patterns (top-N ranking), §Code Examples (top-projects query) |
| DATA-104 | Recent starred sessions scoped by source or `all` with title, project, model, status, recency, starred timestamp | §Code Examples (starred query), uses existing `session_stars` table |
| DATA-105 | Mixed activity timeline scoped by source or `all`, covering session start/resume/finish/failure, parser/sync errors, automation events | §Architecture Patterns (timeline from existing tables), §Code Examples (timeline query) |
| DATA-106 | Source capability metadata telling frontend which overview modules are available per tool | §Architecture Patterns (static capability map), §Code Examples (capabilities endpoint) |
| TURN-101 | Session detail payload with display title, source, project, model, branch, cwd, status, duration, total turns, input/output tokens, cost | §Architecture Patterns (session enrichment), §Don't Hand-Roll (enriched mapper) |
| TURN-102 | Per-turn payload with stable index, times, duration, token usage, failure/truncated/warning status, activity counts | §Architecture Patterns (turn assembler enrichment), §Code Examples (enriched turn) |
| TURN-103 | Normalized activity rows across tools/skills/subagents/thinking/system with kind label, display name, path/target, status, duration, error body, expandable details | §Architecture Patterns (activity normalization), extends `TraceActivity` union |
| TURN-104 | In-session search across user/assistant/activity content with stable turn indices for navigation | §Architecture Patterns (FTS5 setup), §Code Examples (FTS5 migration) |
| TURN-105 | Long sessions through existing pagination/virtualization contract without losing HUD header/spine/activity/inspector data | Verified: existing pagination in turns route; enrichment is additive, no breakage |
| OPEN-101 | OpenClaw agent summaries with name, avatar/initials, status, session count, tool count, latest activity | Extends existing `/api/v1/agents` pattern in `ingest/api/agents.ts` |
| OPEN-102 | Automation summaries for tools with local automation data (job name, schedule, last run status/duration, next/recent marker) | Static config + stubs; real data deferred per CONTEXT.md |
| OPEN-103 | Distinguish ingest status, file watcher status, and Gateway live status in shell/status-bar | Extends existing `/health` and `/api/v1/sources/:type/status` patterns |
| TEST-101 | Ingest regression tests covering aggregate math, source filters, fallback values, migration behavior | §Validation Architecture, follows existing `sync.test.ts` isolated DB pattern |
| TEST-104 | Additive schema/index migration without manual DB deletion | §Code Examples (migration pattern), existing `runMigrations()` with try/catch |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Aggregate SQL queries (session/turn/token/cost counts by time window) | Ingest API (SQLite) | — | Data lives in SQLite; aggregation is a database concern |
| Top-N ranking queries (top models, top projects) | Ingest API (SQLite) | — | GROUP BY + ORDER BY + LIMIT is a SQL operation |
| Activity timeline construction | Ingest API (SQLite) | — | Queries across sessions, sync_status, tool_calls tables |
| FTS5 full-text search index | Ingest API (SQLite) | — | Virtual table lives alongside content tables |
| Source capability metadata | Ingest API (static config) | — | Static map; no database needed |
| BFF proxy routes | Next.js API Routes | — | Thin proxy layer; same pattern as existing `[tool]/sessions/route.ts` |
| Session payload enrichment | Ingest API (mapper) | — | `parseSessionRow()` already does this; extend it |
| Turn enrichment (failure, truncated, activity counts) | Ingest API (assembler) | — | Computed at query time in `assembleTurns()` |
| Activity row normalization | Ingest API (mapper) | — | Extends `TraceActivity` union; mapper transforms DB rows |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | ^11.8.1 (latest 12.9.0) | SQLite driver for ingest | Already in project; synchronous API, WAL support, FTS5 compatible [VERIFIED: package.json + npm registry] |
| Hono | ^4.6.16 (latest 4.12.18) | HTTP framework for ingest | Already in project; route groups used for all API endpoints [VERIFIED: package.json] |
| vitest | ^4.1.5 (latest 4.1.6) | Test framework | Already in project; all existing tests use it [VERIFIED: package.json] |
| SQLite FTS5 | Built-in | Full-text search | SQLite extension compiled into better-sqlite3 by default [ASSUMED — verify with `db.exec('SELECT fts5()')`] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @hono/node-server | (existing) | Node.js server adapter for Hono | Already used in `ingest/index.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| FTS5 virtual table | LIKE queries only | LIKE has no index support; FTS5 is 10-100x faster for content search [CITED: sqlite.org/fts5] |
| Real-time SQL aggregates | Materialized view tables | Local dataset is small (<10k sessions typically); real-time queries are fast enough per CONTEXT.md decision |

**Installation:**
```bash
# No new packages needed — all functionality uses existing stack
```

**Version verification:**
```bash
npm view better-sqlite3 version  # 12.9.0 (project uses ^11.8.1 — compatible)
npm view hono version            # 4.12.18 (project uses ^4.6.16 — compatible)
npm view vitest version          # 4.1.6 (project uses ^4.1.5 — compatible)
```

## Architecture Patterns

### System Architecture Diagram

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Next.js Frontend (:3000)                                            │
│  ┌─────────────────────────────────────────────────────┐            │
│  │ BFF Proxy Routes                                    │            │
│  │ /api/agent-tools/[tool]/overview/aggregates         │────────┐   │
│  │ /api/agent-tools/[tool]/overview/top-models         │────────┤   │
│  │ /api/agent-tools/[tool]/overview/top-projects       │────────┤   │
│  │ /api/agent-tools/[tool]/overview/timeline           │────────┤   │
│  │ /api/agent-tools/[tool]/overview/starred            │────────┤   │
│  │ /api/agent-tools/[tool]/overview/capabilities       │────────┤   │
│  │ /api/agent-tools/[tool]/sessions/[id] (enriched)    │────────┤   │
│  │ /api/agent-tools/[tool]/sessions/[id]/search        │────────┤   │
│  └─────────────────────────────────────────────────────┘        │   │
│         ↓ fetchIngest()                                          │   │
└──────────────────────────────────────────────────────────────────────┘
          │
          ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Ingest Service (:8078) — Hono                                      │
│  ┌────────────────────────────┐  ┌─────────────────────────────┐    │
│  │ Existing Routes            │  │ NEW: Overview Route Group    │    │
│  │ /api/v1/sessions           │  │ /api/v1/overview/aggregates  │    │
│  │ /api/v1/sessions/:id       │  │ /api/v1/overview/top-models  │    │
│  │ /api/v1/sessions/:id/turns │  │ /api/v1/overview/top-projects│    │
│  │ /api/v1/agents             │  │ /api/v1/overview/timeline    │    │
│  │ /api/v1/sessions/starred   │  │ /api/v1/overview/starred     │    │
│  └────────────────────────────┘  │ /api/v1/overview/capabilities│    │
│                                   │ /api/v1/sessions/:id/search  │    │
│                                   └─────────────────────────────┘    │
│         ↓                                                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ SQLite (WAL)                                                  │   │
│  │ sessions ← NEW: total_input_tokens column                     │   │
│  │ messages ← NEW: fts_messages_content (FTS5 virtual table)     │   │
│  │ tool_calls, tool_result_events, turns, sync_status            │   │
│  │ session_stars (already exists)                                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```text
ingest/
  api/
    overview.ts          # NEW: overview route group (aggregates, rankings, timeline, starred, capabilities)
    overview.test.ts     # NEW: tests for overview endpoints (isolated DB pattern)
    sessions.ts          # EXTEND: enriched session row mapper
    sessions.test.ts     # EXTEND: test enriched fields
    search.ts            # NEW: in-session search route (FTS5 + LIKE fallback)
    search.test.ts       # NEW: search endpoint tests
    agents.ts            # EXTEND: enriched agent summaries (OPEN-101)
  turns/
    assembler.ts         # EXTEND: per-turn enrichment (failure, truncated, activity counts)
  db/
    index.ts             # EXTEND: migration v9 → v10
    schema.sql           # EXTEND: add total_input_tokens column definition (canonical DDL)
app/api/agent-tools/[tool]/
  overview/
    aggregates/route.ts  # NEW: BFF proxy for overview aggregates
    top-models/route.ts  # NEW: BFF proxy for top models
    top-projects/route.ts # NEW: BFF proxy for top projects
    timeline/route.ts    # NEW: BFF proxy for activity timeline
    starred/route.ts     # NEW: BFF proxy for starred sessions
    capabilities/route.ts # NEW: BFF proxy for source capabilities
  sessions/[sessionId]/
    search/route.ts      # NEW: BFF proxy for in-session search
types/
  trace.ts               # EXTEND: add optional fields to TraceActivity variants
lib/agent-tools/
  server-adapter.ts      # EXTEND: add overview adapter methods to interface
  all/server-adapter.ts  # EXTEND: implement overview methods for 'all' scope
  openclaw/server-adapter.ts # EXTEND: implement overview methods
  claude-code/server-adapter.ts # EXTEND: implement overview methods
  codex/server-adapter.ts # EXTEND: implement overview methods
```

### Pattern 1: Overview Route Group (ingest/api/overview.ts)
**What:** A single Hono route group file registering all `/api/v1/overview/*` endpoints.
**When to use:** All new aggregate/ranking/timeline endpoints.
**Example:**
```typescript
// Source: established pattern from ingest/api/sessions.ts + ingest/api/agents.ts
import { Hono } from 'hono';
import { getDatabase } from '../db';

export const overviewRoutes = new Hono();

// GET /api/v1/overview/aggregates?source=openclaw&window=7d
overviewRoutes.get('/api/v1/overview/aggregates', (c) => {
  const source = c.req.query('source') as string | null;
  const window = c.req.query('window') || '7d';
  const db = getDatabase();

  // Validate source param
  if (source && !['openclaw', 'claude-code', 'codex'].includes(source)) {
    return c.json({ error: 'Invalid source parameter' }, 400);
  }

  const whereClause = source ? `WHERE source = ?` : '';
  const params = source ? [source] : [];

  // Time window → date filter
  const dateFilter = getDateFilter(window);
  const fullWhere = dateFilter
    ? (source ? `WHERE source = ? AND ${dateFilter}` : `WHERE ${dateFilter}`)
    : whereClause;

  const result = db.prepare(`
    SELECT
      COUNT(*) as session_count,
      COUNT(DISTINCT project) as project_count,
      SUM(message_count) as message_count,
      COALESCE(SUM(total_output_tokens), 0) as output_tokens,
      COALESCE(SUM(total_input_tokens), 0) as input_tokens
    FROM sessions
    ${fullWhere}
  `).get(...params);

  return c.json({ aggregates: result });
});
```

### Pattern 2: Top-N Ranking with Source Scoping
**What:** GROUP BY + ORDER BY + LIMIT queries with optional source filter.
**When to use:** Top models (DATA-102), top projects (DATA-103).
**Example:**
```typescript
// GET /api/v1/overview/top-models?source=claude-code&window=30d&limit=10
overviewRoutes.get('/api/v1/overview/top-models', (c) => {
  const source = c.req.query('source') as string | null;
  const window = c.req.query('window') || '7d';
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
  const db = getDatabase();

  // Validate
  if (source && !['openclaw', 'claude-code', 'codex'].includes(source)) {
    return c.json({ error: 'Invalid source parameter' }, 400);
  }

  const conditions: string[] = [];
  const params: any[] = [];

  if (source) { conditions.push('s.source = ?'); params.push(source); }

  const dateCondition = getDateCondition('s.started_at', window);
  if (dateCondition) conditions.push(dateCondition);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Total for share percentage
  const totalRow = db.prepare(`
    SELECT COALESCE(SUM(total_output_tokens), 0) + COALESCE(SUM(total_input_tokens), 0) as total_tokens
    FROM sessions s ${whereClause}
  `).get(...params) as { total_tokens: number };

  const models = db.prepare(`
    SELECT
      m.model as name,
      COUNT(DISTINCT s.id) as session_count,
      COALESCE(SUM(s.total_output_tokens), 0) as output_tokens,
      COALESCE(SUM(s.total_input_tokens), 0) as input_tokens,
      COALESCE(SUM(s.total_output_tokens), 0) + COALESCE(SUM(s.total_input_tokens), 0) as total_tokens
    FROM sessions s
    JOIN messages m ON m.session_id = s.id AND m.model IS NOT NULL
    ${whereClause}
    GROUP BY m.model
    ORDER BY total_tokens DESC
    LIMIT ?
  `).all(...params, limit);

  const result = models.map(m => ({
    ...m,
    sharePercent: totalRow.total_tokens > 0
      ? Math.round((m.total_tokens / totalRow.total_tokens) * 10000) / 100
      : 0,
  }));

  return c.json({ models: result });
});
```

### Pattern 3: BFF Proxy Route (app/api/agent-tools/[tool]/overview/...)
**What:** Thin Next.js route handler that validates `[tool]`, calls ingest via `fetchIngest`, and sanitizes errors.
**When to use:** All new overview BFF routes.
**Example:**
```typescript
// app/api/agent-tools/[tool]/overview/aggregates/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { assertSourceToolId } from '@/lib/agent-tools/registry'
import { fetchIngest, sanitizeError } from '@/lib/agent-tools/server-adapter'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params
  try {
    const toolId = assertSourceToolId(tool)
    const qs = request.nextUrl.searchParams.toString()
    const data = await fetchIngest(
      `/api/v1/overview/aggregates?source=${toolId}&${qs}`,
      { cache: 'no-store' },
    )
    return NextResponse.json(data)
  } catch (err) {
    const { error, code } = sanitizeError(err)
    return NextResponse.json({ error }, { status: code })
  }
}
```

### Pattern 4: FTS5 External Content Virtual Table
**What:** FTS5 virtual table over `messages.content` with triggers to keep index in sync.
**When to use:** In-session search (TURN-104).
**Example:**
```sql
-- Source: SQLite FTS5 docs (devdocs.io/sqlite/fts5)
-- Created in migration v9 → v10

-- Create FTS5 virtual table indexing message content
CREATE VIRTUAL TABLE IF NOT EXISTS fts_messages_content
USING fts5(content, content='messages', content_rowid=rowid);

-- Triggers to keep FTS index in sync with messages table
CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO fts_messages_content(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO fts_messages_content(fts_messages_content, rowid, content)
  VALUES ('delete', old.rowid, old.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO fts_messages_content(fts_messages_content, rowid, content)
  VALUES ('delete', old.rowid, old.content);
  INSERT INTO fts_messages_content(rowid, content) VALUES (new.rowid, new.content);
END;
```

**Query pattern:**
```typescript
// FTS5 search with LIKE fallback
function searchSessionContent(sessionId: string, query: string, db: Database.Database) {
  // Sanitize query — FTS5 has special syntax
  const sanitizedQuery = query.replace(/["'*]/g, '').trim();

  try {
    // Try FTS5 first
    const ftsResults = db.prepare(`
      SELECT m.id, m.ordinal, m.role, m.turn_index, m.content,
             snippet(fts_messages_content, -1, '>>>', '<<<', '...', 32) as snippet
      FROM fts_messages_content fts
      JOIN messages m ON m.rowid = fts.rowid
      WHERE fts_messages_content MATCH ? AND m.session_id = ?
      ORDER BY m.ordinal ASC
    `).all(sanitizedQuery, sessionId);
    return ftsResults;
  } catch {
    // Fallback to LIKE if FTS5 query fails (special chars, etc.)
    return db.prepare(`
      SELECT id, ordinal, role, turn_index, content
      FROM messages
      WHERE session_id = ? AND content LIKE ?
      ORDER BY ordinal ASC
    `).all(sessionId, `%${sanitizedQuery}%`);
  }
}
```

### Pattern 5: Turn Assembler Enrichment
**What:** Extend `assembleTurns()` to compute per-turn failure status, truncated flag, warning status, and activity counts at query time.
**When to use:** TURN-102, TURN-103.
**Example:**
```typescript
// Extend the finalizeTurn() function or add a post-processing step
function enrichTurn(turn: TraceTurn): EnrichedTraceTurn {
  const activityCounts = {
    toolCalls: turn.activities.filter(a => a.type === 'tool_call').length,
    skills: turn.activities.filter(a => a.type === 'skill_use').length,
    subagents: turn.activities.filter(a => a.type === 'subagent_link').length,
    thinking: turn.activities.filter(a => a.type === 'thinking').length,
    system: turn.activities.filter(a => a.type === 'system').length,
  };

  const hasFailure = turn.activities.some(a =>
    a.type === 'tool_call' && a.status === 'error'
  );

  const hasWarning = turn.activities.some(a =>
    a.type === 'system' && a.subtype === 'system_message'
  );

  return {
    ...turn,
    activityCounts,
    failureStatus: hasFailure ? 'error' : 'success',
    truncated: turn.isTruncated || false,
    warningStatus: hasWarning,
  };
}
```

### Pattern 6: Source Capability Static Config
**What:** A static config map in ingest that declares which features each source supports.
**When to use:** DATA-106, OPEN-101, OPEN-102.
**Example:**
```typescript
// ingest/api/overview.ts or ingest/config/capabilities.ts
const SOURCE_CAPABILITIES: Record<string, SourceCapabilities> = {
  openclaw: {
    agents: true,
    automations: true,
    cost: true,
    activity: true,
    sessions: true,
    replay: true,
  },
  'claude-code': {
    agents: false,
    automations: false,
    cost: true,
    activity: true,
    sessions: true,
    replay: true,
  },
  codex: {
    agents: false,
    automations: false,
    cost: false,
    activity: true,
    sessions: true,
    replay: true,
  },
};

// GET /api/v1/overview/capabilities
overviewRoutes.get('/api/v1/overview/capabilities', (c) => {
  return c.json({
    capabilities: SOURCE_CAPABILITIES,
    sources: Object.keys(SOURCE_CAPABILITIES),
  });
});
```

### Anti-Patterns to Avoid
- **Don't create a materialized overview table:** Real-time SQL queries are fast enough for local datasets. Materialized tables add sync complexity and stale data risk.
- **Don't add enrichment columns to the schema:** Per-turn failure/truncated/warning/activity counts should be computed at query time in the assembler, not stored in new columns. This keeps the schema simple and avoids stale data on re-parse.
- **Don't bypass BFF:** All new endpoints must go through BFF proxy routes, following the D-07 trust boundary. The frontend never calls ingest directly.
- **Don't hand-roll FTS5 sync:** Use SQLite triggers (AFTER INSERT/DELETE/UPDATE on messages) to keep the FTS5 index in sync. Manual sync will drift.
- **Don't hard-code time windows as column values:** Use `datetime('now')` and date arithmetic in queries. Time windows are `today` (since midnight), `7d` (7 days ago), `30d` (30 days ago).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full-text search | LIKE-based search loop | SQLite FTS5 virtual table | FTS5 supports tokenization, ranking, snippets; LIKE is O(n) per query |
| Time window filtering | Application-level date math | SQLite `datetime('now', '-7 days')` | SQLite handles timezone consistency and date comparison |
| Aggregate calculations | JavaScript reduce over fetched rows | SQL `GROUP BY` + `SUM` + `COUNT` | Database aggregation is faster and handles nulls correctly |
| Migration idempotency | Custom version tracking | `PRAGMA user_version` + try/catch | Existing `runMigrations()` pattern handles this perfectly |
| Source scoping in BFF | Per-route if/else for each tool | `assertSourceToolId()` + adapter dispatch | Existing pattern in `registry.ts` |

**Key insight:** The entire phase is an exercise in extending existing patterns — new Hono routes follow `sessions.ts` patterns, new BFF routes follow `[tool]/sessions/route.ts` patterns, new migrations follow `runMigrations()` patterns, and new tests follow `sync.test.ts` patterns.

## Common Pitfalls

### Pitfall 1: FTS5 Not Available in better-sqlite3 Build
**What goes wrong:** Assuming FTS5 is compiled into better-sqlite3 by default.
**Why it happens:** Most pre-built binaries include FTS5, but custom builds or older versions might not.
**How to avoid:** Verify at startup with `db.exec('SELECT fts5()')` wrapped in try/catch. Provide LIKE fallback if FTS5 is unavailable.
**Warning signs:** `no such module: fts5` error at runtime.

### Pitfall 2: FTS5 External Content Table Out of Sync
**What goes wrong:** The FTS5 index doesn't match the messages table because triggers were created after existing data was already present.
**Why it happens:** SQLite triggers only fire on DML after trigger creation; they don't backfill.
**How to avoid:** After creating the FTS5 virtual table and triggers in migration, run `INSERT INTO fts_messages_content(fts_messages_content) VALUES('rebuild')` to index existing content.
**Warning signs:** Search returns 0 results for content that definitely exists in messages.

### Pitfall 3: Migration v9→v10 Breaking Existing DB
**What goes wrong:** A migration step fails on an existing DB and leaves the DB in an inconsistent state.
**Why it happens:** `ALTER TABLE ADD COLUMN` fails if column already exists; `CREATE VIRTUAL TABLE` fails if it already exists.
**How to avoid:** Wrap each migration step in try/catch (existing pattern). Check `PRAGMA user_version` before running. The target version should only be set after all steps succeed.
**Warning signs:** `duplicate column name` or `already exists` errors — these are actually OK if caught and logged as "already applied."

### Pitfall 4: Aggregate Queries Returning NULL Instead of 0
**What goes wrong:** `SUM()` on an empty result set returns `NULL`, not `0`. `total_input_tokens` column is new and NULL for all existing rows.
**Why it happens:** SQLite `SUM()` returns NULL when no rows match. New `total_input_tokens` column starts as NULL for existing sessions.
**How to avoid:** Always use `COALESCE(SUM(col), 0)` in aggregate queries. When adding `total_input_tokens`, set `DEFAULT 0` in the column definition.
**Warning signs:** Frontend shows `null` instead of `0` for token counts on the overview page.

### Pitfall 5: `all` Source Scope Bypassing BFF Filter
**What goes wrong:** BFF route for `/api/agent-tools/all/...` passes `source=all` to ingest, which is not a valid source value.
**Why it happens:** `all` is a synthetic shell scope, not an ingest source. The `assertSourceToolId()` function rejects it.
**How to avoid:** For `all` scope, either: (a) call the ingest endpoint without a `source` query param, or (b) use the `allAdapter` that doesn't inject `source=`. Follow the existing `all/server-adapter.ts` pattern.
**Warning signs:** 400 error from ingest when switching to "All Sources" view.

### Pitfall 6: Token Breakdown Missing for Existing Sessions
**What goes wrong:** The new `total_input_tokens` column is NULL for all sessions parsed before the migration.
**Why it happens:** Parsers before v10 didn't extract or store `total_input_tokens`.
**How to avoid:** After adding the column, invalidate the skip cache for sessions that lack input token data: `UPDATE sessions SET file_hash = NULL WHERE total_input_tokens IS NULL`. This forces re-parse on next sync, which will populate the new field.
**Warning signs:** Overview shows `input_tokens: 0` for all historical sessions even though they have `output_tokens > 0`.

## Code Examples

Verified patterns from the project codebase and official documentation:

### Aggregate Query with Time Window and Source Filter
```typescript
// Based on existing sessions.ts query pattern + CONTEXT.md decisions
function getDateCondition(column: string, window: string): string | null {
  switch (window) {
    case 'today':
      return `${column} >= datetime('now', 'start of day')`;
    case '7d':
      return `${column} >= datetime('now', '-7 days')`;
    case '30d':
      return `${column} >= datetime('now', '-30 days')`;
    default:
      return null;
  }
}

// Usage in aggregate endpoint
const result = db.prepare(`
  SELECT
    COUNT(*) as session_count,
    COUNT(DISTINCT project) as project_count,
    SUM(user_message_count) as turn_count,
    COALESCE(SUM(total_output_tokens), 0) as output_tokens,
    COALESCE(SUM(total_input_tokens), 0) as input_tokens
  FROM sessions
  WHERE source = ? AND started_at >= datetime('now', '-7 days')
`).get('claude-code');
```
[Pattern from: `ingest/api/sessions.ts` WHERE clause building, `docs/db-schema.md` column names]

### Migration v9 → v10
```typescript
// Based on existing runMigrations() pattern in ingest/db/index.ts
// Add these steps to the migrationSteps array, increment targetVersion to 10

{
  desc: 'Add total_input_tokens column to sessions',
  sql: 'ALTER TABLE sessions ADD COLUMN total_input_tokens INTEGER DEFAULT 0',
},
{
  desc: 'Create FTS5 virtual table for message content search',
  sql: `CREATE VIRTUAL TABLE IF NOT EXISTS fts_messages_content
        USING fts5(content, content='messages', content_rowid=rowid)`,
},
{
  desc: 'Create FTS sync trigger for INSERT',
  sql: `CREATE TRIGGER IF NOT EXISTS messages_fts_ai AFTER INSERT ON messages BEGIN
          INSERT INTO fts_messages_content(rowid, content) VALUES (new.rowid, new.content);
        END`,
},
{
  desc: 'Create FTS sync trigger for DELETE',
  sql: `CREATE TRIGGER IF NOT EXISTS messages_fts_ad AFTER DELETE ON messages BEGIN
          INSERT INTO fts_messages_content(fts_messages_content, rowid, content)
          VALUES ('delete', old.rowid, old.content);
        END`,
},
{
  desc: 'Create FTS sync trigger for UPDATE',
  sql: `CREATE TRIGGER IF NOT EXISTS messages_fts_au AFTER UPDATE ON messages BEGIN
          INSERT INTO fts_messages_content(fts_messages_content, rowid, content)
          VALUES ('delete', old.rowid, old.content);
          INSERT INTO fts_messages_content(rowid, content) VALUES (new.rowid, new.content);
        END`,
},
{
  desc: 'Rebuild FTS5 index from existing messages',
  sql: `INSERT INTO fts_messages_content(fts_messages_content) VALUES('rebuild')`,
},
{
  desc: 'Invalidate skip cache to backfill total_input_tokens',
  sql: `UPDATE sessions SET file_hash = NULL WHERE total_input_tokens IS NULL OR total_input_tokens = 0`,
},
```
[Pattern from: `ingest/db/index.ts` runMigrations(), SQLite FTS5 docs (devdocs.io/sqlite/fts5)]

### Starred Sessions Query
```typescript
// Uses existing session_stars table (ingest/api/stars.ts)
// GET /api/v1/overview/starred?source=openclaw&limit=20
overviewRoutes.get('/api/v1/overview/starred', (c) => {
  const source = c.req.query('source') as string | null;
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const db = getDatabase();

  const conditions: string[] = [];
  const params: any[] = [];

  if (source && ['openclaw', 'claude-code', 'codex'].includes(source)) {
    conditions.push('s.source = ?');
    params.push(source);
  }

  const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

  const starred = db.prepare(`
    SELECT s.id, s.name, s.source, s.project, s.status, s.started_at,
           ss.starred_at, s.total_output_tokens, s.total_input_tokens,
           ${UPDATED_AT_EXPR} as updated_at
    FROM session_stars ss
    JOIN sessions s ON s.id = ss.session_id
    WHERE 1=1 ${whereClause}
    ORDER BY ss.starred_at DESC
    LIMIT ?
  `).all(...params, limit);

  return c.json({ starred: starred.map(parseStarredSessionRow) });
});
```
[Pattern from: `ingest/api/stars.ts` session_stars table, `ingest/api/sessions.ts` UPDATED_AT_EXPR]

### Activity Timeline Query
```typescript
// Built at query time from existing tables per CONTEXT.md decision
// GET /api/v1/overview/timeline?source=all&limit=50
overviewRoutes.get('/api/v1/overview/timeline', (c) => {
  const source = c.req.query('source') as string | null;
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  const db = getDatabase();

  // Union of session lifecycle events + sync errors
  // (No new activity_events table — per CONTEXT.md decision)
  const sourceFilter = source && ['openclaw', 'claude-code', 'codex'].includes(source)
    ? `AND source = ?` : '';
  const params = source && ['openclaw', 'claude-code', 'codex'].includes(source)
    ? [source, source, limit] : [limit];

  const timeline = db.prepare(`
    SELECT * FROM (
      SELECT id, source, project, name, started_at as event_time,
             'session_started' as event_type, status, NULL as error_message
      FROM sessions
      WHERE started_at IS NOT NULL ${sourceFilter}

      UNION ALL

      SELECT source_type as id, source_type as source, '' as project, '' as name,
             last_full_sync_at as event_time,
             'sync_error' as event_type, 'error' as status, last_error as error_message
      FROM sync_status
      WHERE last_error IS NOT NULL
    )
    ORDER BY event_time DESC
    LIMIT ?
  `).all(...params);

  return c.json({ timeline });
});
```
[Pattern from: `docs/db-schema.md` sessions + sync_status tables]

### Enriched Session Row Mapper
```typescript
// Extends existing parseSessionRow() in ingest/api/sessions.ts
// Adds fields needed for TURN-101: display title, input/output tokens, duration, turn count

function parseEnrichedSessionRow(row: EnrichedSessionRow): EnrichedTraceSession {
  const base = parseSessionRow(row); // Existing mapper
  return {
    ...base,
    // TURN-101 enrichment
    displayTitle: row.name || `${row.project} — ${row.started_at?.split('T')[0] || 'unknown'}`,
    cwd: row.cwd || undefined,
    gitBranch: row.git_branch || undefined,
    durationMs: row.started_at && row.ended_at
      ? new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()
      : null,
    totalTurns: row.turn_count || row.user_message_count,
    inputTokens: row.total_input_tokens || 0,
    outputTokens: row.total_output_tokens || 0,
    estimatedCost: null, // Placeholder per CONTEXT.md decision
  };
}
```
[Pattern from: `ingest/api/sessions.ts` parseSessionRow(), `types/trace.ts` TraceSession]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LIKE queries for text search | SQLite FTS5 full-text search | SQLite 3.9.0 (2015) | FTS5 is now standard; supports tokenization, snippets, ranking |
| Materialized aggregate tables | Real-time SQL aggregation | Local datasets remain small | For <10k sessions, GROUP BY queries run in <10ms |
| Storing computed enrichment columns | Query-time enrichment in mappers/assemblers | This phase | Avoids schema bloat and stale data on re-parse |

**Deprecated/outdated:**
- FTS3/FTS4: Replaced by FTS5 in SQLite 3.9.0. Use FTS5 for new virtual tables. [CITED: sqlite.org/fts5]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FTS5 is compiled into better-sqlite3 binary by default | Standard Stack | Search endpoint would need LIKE-only fallback at startup |
| A2 | Local dataset size (<10k sessions) makes real-time aggregate queries fast enough (<100ms) | Architecture Patterns | Would need to add materialized overview table or cache |
| A3 | Existing `total_output_tokens` in sessions represents summed output tokens across all messages | Multiple | Token breakdown would be incorrect in UI |
| A4 | `messages.model` column is populated for most sessions, enabling top-models ranking | Code Examples | Top-models would show empty results for sources that don't populate it |
| A5 | `sessions.started_at` is ISO 8601 formatted for SQLite datetime comparison | Code Examples | Time-window filtering would fail silently |

## Open Questions

1. **FTS5 availability in better-sqlite3**
   - What we know: better-sqlite3 typically compiles with FTS5 enabled
   - What's unclear: Whether the specific version used (^11.8.1) guarantees FTS5
   - Recommendation: Add a startup check in `initSchema()` that verifies FTS5 via `SELECT fts5()`; fall back to LIKE if unavailable

2. **Top models data source**
   - What we know: `messages.model` column exists but may not be populated for all sources
   - What's unclear: Whether OpenClaw and Codex parsers populate `model` on messages
   - Recommendation: Check parsers; if `model` is sparse, consider aggregating from `messages.model WHERE model IS NOT NULL` with a fallback to session-level model

3. **Turn count accuracy**
   - What we know: `getTurnCount()` uses `COUNT(DISTINCT turn_index)` or falls back to user message count
   - What's unclear: Whether `user_message_count` accurately represents turns (queued commands are merged)
   - Recommendation: For the enriched session payload, use `getTurnCount()` which handles both stored and heuristic boundaries

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v22+ | — |
| pnpm | Package manager | ✓ | (project uses pnpm) | — |
| SQLite (via better-sqlite3) | Data layer | ✓ | ^11.8.1 | — |
| FTS5 extension | In-session search | Likely ✓ | Built-in | LIKE fallback |
| Hono | Ingest HTTP | ✓ | ^4.6.16 | — |
| vitest | Testing | ✓ | ^4.1.5 | — |

**Missing dependencies with no fallback:**
- None identified — all required tools are available in the existing stack.

**Missing dependencies with fallback:**
- FTS5 extension: If not compiled into better-sqlite3, fall back to LIKE-based search. The migration creates FTS5 tables in try/catch, and the search route attempts FTS5 first, falling back to LIKE on error.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.5 |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm vitest run tests/unit/ingest/` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-101 | Overview aggregates return correct counts for today/7d/30d by source | unit | `pnpm vitest run ingest/api/overview.test.ts -t 'aggregates'` | ❌ Wave 0 |
| DATA-102 | Top models ranking with share percentage | unit | `pnpm vitest run ingest/api/overview.test.ts -t 'top-models'` | ❌ Wave 0 |
| DATA-103 | Top projects ranking with token/cost counts | unit | `pnpm vitest run ingest/api/overview.test.ts -t 'top-projects'` | ❌ Wave 0 |
| DATA-104 | Starred sessions scoped by source | unit | `pnpm vitest run ingest/api/overview.test.ts -t 'starred'` | ❌ Wave 0 |
| DATA-105 | Activity timeline from sessions + sync_status | unit | `pnpm vitest run ingest/api/overview.test.ts -t 'timeline'` | ❌ Wave 0 |
| DATA-106 | Source capability metadata | unit | `pnpm vitest run ingest/api/overview.test.ts -t 'capabilities'` | ❌ Wave 0 |
| TURN-101 | Enriched session payload fields | unit | `pnpm vitest run ingest/api/sessions.test.ts -t 'enriched'` | ❌ Wave 0 |
| TURN-102 | Per-turn enrichment (failure, truncated, activity counts) | unit | `pnpm vitest run tests/unit/ingest/turns.test.ts -t 'enrichment'` | ✅ existing |
| TURN-103 | Normalized activity rows | unit | `pnpm vitest run tests/unit/ingest/turns.test.ts -t 'activity'` | ✅ existing |
| TURN-104 | FTS5 search + LIKE fallback | unit | `pnpm vitest run ingest/api/search.test.ts` | ❌ Wave 0 |
| TURN-105 | Long session pagination with enriched fields | unit | `pnpm vitest run tests/perf/long-session.test.ts` | ✅ existing |
| OPEN-101 | Agent summaries with enriched fields | unit | `pnpm vitest run ingest/api/agents.test.ts -t 'enriched'` | ✅ existing |
| OPEN-102 | Automation summaries stub | unit | `pnpm vitest run ingest/api/overview.test.ts -t 'automations'` | ❌ Wave 0 |
| OPEN-103 | Status distinction (ingest/watcher/gateway) | unit | `pnpm vitest run ingest/api/overview.test.ts -t 'status'` | ❌ Wave 0 |
| TEST-101 | Aggregate math, source filters, fallbacks | unit | `pnpm vitest run ingest/api/overview.test.ts` | ❌ Wave 0 |
| TEST-104 | Migration v9→v10 additive and idempotent | integration | `pnpm vitest run tests/unit/ingest/sync.test.ts -t 'migration'` | ✅ existing |

### Sampling Rate
- **Per task commit:** `pnpm vitest run ingest/api/overview.test.ts`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `ingest/api/overview.test.ts` — covers DATA-101..106, OPEN-101..103, TEST-101
- [ ] `ingest/api/search.test.ts` — covers TURN-104
- [ ] Extend `ingest/api/sessions.test.ts` — covers TURN-101 enriched fields
- [ ] Extend `tests/unit/ingest/turns.test.ts` — covers TURN-102 enrichment tests

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local-only service, no auth required |
| V3 Session Management | no | No user sessions |
| V4 Access Control | yes | BFF source scoping (`assertSourceToolId`) prevents cross-source data leakage |
| V5 Input Validation | yes | All query params validated before SQL; `source` whitelisted; `limit`/`offset` clamped |
| V6 Cryptography | no | No crypto operations in this phase |

### Known Threat Patterns for Ingest API + SQLite

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via query params | Tampering | Parameterized queries (better-sqlite3 `.prepare().get(params)`) — existing pattern |
| Source filter bypass | Information disclosure | Whitelist `source` param against `['openclaw', 'claude-code', 'codex']` — existing pattern |
| FTS5 query injection | Tampering | Sanitize search query: strip FTS5 special characters (`"`, `*`, `+`, `AND`, `OR`, `NOT`) before passing to MATCH |
| Unbounded result set | Denial of service | Cap `limit` param (max 100 for BFF, max 1000 for ingest) — existing pattern |
| Session ID path traversal | Tampering | Validate session ID format with regex `^[a-zA-Z0-9:\-_.]{1,256}$` — existing pattern |

## Sources

### Primary (HIGH confidence)
- Codebase: `ingest/db/index.ts`, `ingest/api/sessions.ts`, `ingest/api/agents.ts`, `ingest/api/stars.ts`, `ingest/turns/assembler.ts`, `lib/agent-tools/server-adapter.ts`, `app/api/agent-tools/[tool]/sessions/route.ts`, `types/trace.ts`, `docs/db-schema.md`, `docs/API.md`
- `/websites/devdocs_io_sqlite` — FTS5 virtual table creation, external content tables, triggers, rebuild command
- `/wiselibs/better-sqlite3` — prepare(), exec(), pragma() API patterns

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions — verified against codebase patterns
- REQUIREMENTS.md — verified against phase scope

### Tertiary (LOW confidence)
- A1 (FTS5 availability): [ASSUMED] based on better-sqlite3 common builds; needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already in project, versions verified against npm registry
- Architecture: HIGH — follows established patterns in codebase (Hono route groups, BFF proxy, runMigrations)
- Pitfalls: HIGH — based on known SQLite/better-sqlite3 behaviors verified via Context7 and official docs
- FTS5 specifics: MEDIUM — FTS5 API confirmed via Context7 but runtime availability needs verification

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (stable — all libraries are mature and patterns are established)
