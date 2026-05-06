---
phase: 02-local-ingest-core-openclaw-parser
plan: 02b
type: execute
wave: 3
depends_on: [02-01, 02-02]
files_modified:
  - ingest/sync/index.ts
  - ingest/api/sources.ts
  - ingest/index.ts
autonomous: true
requirements:
  - DATA-03
  - SRC-01
user_setup: []

must_haves:
  truths:
    - "Parsed sessions can be written to SQLite database"
    - "API endpoint returns list of discovered OpenClaw sources with session counts"
    - "Sync endpoint triggers parsing and database storage for all OpenClaw sessions"
  artifacts:
    - path: "ingest/sync/index.ts"
      provides: "Database write layer and sync orchestration"
      exports: ["writeSessionToDatabase", "syncSource"]
      min_lines: 100
    - path: "ingest/api/sources.ts"
      provides: "REST API endpoints for source management"
      exports: ["sourcesRoutes"]
      min_lines: 60
  key_links:
    - from: "ingest/sync/index.ts"
      to: "ingest/db/index.ts"
      via: "call database insert functions"
      pattern: "getDatabase\\(\\)"
    - from: "ingest/api/sources.ts"
      to: "ingest/sync/sources.ts"
      via: "call discovery functions"
      pattern: "discoverOpenClawSources"
    - from: "ingest/api/sources.ts"
      to: "ingest/sync/index.ts"
      via: "call sync functions"
      pattern: "syncSource"

---

<objective>
Implement database storage layer and REST API for OpenClaw source sync, completing the ingest pipeline from parser to database to API.

Purpose: Connect the parser (from Plan 02-02) to the database layer (from Plan 02-01) and expose sync functionality via REST API. This completes the ingest data flow for OpenClaw sessions.

**Note on DATA-03 coverage**: Per user decision in 02-CONTEXT.md Deferred Ideas section, Claude Code and Codex parser support is deferred to Phase 3. This plan implements DATA-03 database storage and API for OpenClaw only (partial coverage). Full DATA-03 implementation across all three sources will be completed in Phase 3.

Output: Working database write layer that stores parsed sessions, REST API endpoints for source listing and sync triggering, and end-to-end ingest pipeline for OpenClaw data.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md

@.planning/phases/02-local-ingest-core-openclaw-parser/02-01-PLAN.md
@.planning/phases/02-local-ingest-core-openclaw-parser/02-02-PLAN.md
@ingest/db/schema.sql
@ingest/db/index.ts
</execution_context>

<context>
<interfaces>
<!-- From ingest/parser/types.ts - ParseResult from parser -->
```typescript
export interface ParseResult {
  session: TraceSession;
  messages: TraceMessage[];
  activities: TraceActivity[];
  errors: ParseError[];
  warnings: string[];
}
```

<!-- From ingest/db/index.ts - Database layer -->
```typescript
export function openDatabase(config: DatabaseConfig): Database.Database;
export function getDatabase(): Database.Database;
```
</interfaces>

<implementation_notes>
Database write responsibilities (from schema in Plan 02-01):
- sessions table: store session-level metadata
- messages table: store each message with session_id and ordinal
- tool_calls table: extract from message content, link via message_ordinal
- tool_result_events table: streaming result chunks (Phase 3)
- turns table: minimal grouping (Plan 02-03)

Session upsert strategy:
- Check if session exists by id
- If exists: update ended_at, message_count, metrics
- If new: insert with all fields
- Delete existing messages before re-inserting (simple update strategy)

Sync orchestration:
- Discover all OpenClaw sources (from Plan 02-02)
- For each source: enumerate session files
- For each file: parse (Plan 02-02) → write to database
- Aggregate results (sessions inserted/updated, errors)

API endpoints (per D-07):
- GET /api/v1/sources - List discovered sources
- GET /api/v1/sources/:type - Get sources by type (openclaw only in Phase 2)
- POST /api/v1/sources/:type/sync - Trigger sync
- GET /api/v1/events - SSE skeleton (connectable but no push)

SSE skeleton implementation (per D-09):
- Return correct headers (Content-Type: text/event-stream)
- No real event streaming in Phase 2
- Frontend can establish connection but won't receive updates
- Real SSE push implemented in Phase 6
</implementation_notes>

<notes>
## DATA-03 Partial Coverage (Phase 2)

Per ROADMAP.md, DATA-03 requires: "Parse OpenClaw, Claude Code, and Codex session formats into canonical TraceSession model."

**Phase 2 scope (this plan):** Database storage and API for OpenClaw parser only
**Phase 3 scope:** Claude Code and Codex parsers + database storage + API

This deferment is documented in 02-CONTEXT.md Deferred Ideas section. Phase 3 will complete full DATA-03 coverage across all three sources.
</notes>

</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement database write layer for parsed sessions</name>
  <files>ingest/sync/index.ts</files>
  <read_first>
    - ingest/parser/openclaw.ts (ParseResult type)
    - ingest/parser/types.ts (ParseResult, ParseError types)
    - ingest/db/index.ts (database connection)
    - ingest/db/schema.sql (table structure)
  </read_first>
  <action>
Create ingest/sync/index.ts with database write operations:

```typescript
import Database from 'better-sqlite3';
import { getDatabase } from '../db';
import { ParseResult } from '../parser/types';
import { TraceSession, TraceMessage, TraceActivity } from '@/types/trace';

export interface SyncResult {
  sessionsInserted: number;
  sessionsUpdated: number;
  messagesInserted: number;
  errors: string[];
}

export function writeSessionToDatabase(parseResult: ParseResult, db?: Database.Database): SyncResult {
  const database = db || getDatabase();
  const errors: string[] = [];
  let sessionsInserted = 0;
  let sessionsUpdated = 0;
  let messagesInserted = 0;

  try {
    // Check if session already exists
    const existing = database.prepare(
      'SELECT id FROM sessions WHERE id = ?'
    ).get(parseResult.session.id) as { id: string } | undefined;

    if (existing) {
      // Update existing session
      database.prepare(`
        UPDATE sessions SET
          ended_at = ?,
          message_count = ?,
          user_message_count = ?,
          total_output_tokens = ?,
          has_tool_calls = ?,
          parser_malformed_lines = ?,
          is_truncated = ?,
          termination_status = ?
        WHERE id = ?
      `).run(
        parseResult.session.endedAt,
        parseResult.session.metrics.messageCount,
        parseResult.session.metrics.userMessageCount,
        parseResult.session.metrics.totalTokens || 0,
        parseResult.session.metrics.hasToolCalls ? 1 : 0,
        parseResult.session.metrics.parserMalformedLines,
        parseResult.session.metrics.isTruncated ? 1 : 0,
        parseResult.session.metrics.terminationStatus || '',
        parseResult.session.id
      );
      sessionsUpdated++;
    } else {
      // Insert new session
      database.prepare(`
        INSERT INTO sessions (
          id, source, project, started_at, ended_at, status,
          message_count, user_message_count, total_output_tokens, has_tool_calls,
          parser_malformed_lines, is_truncated, termination_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        parseResult.session.id,
        parseResult.session.source,
        parseResult.session.project,
        parseResult.session.startedAt,
        parseResult.session.endedAt,
        parseResult.session.status,
        parseResult.session.metrics.messageCount,
        parseResult.session.metrics.userMessageCount,
        parseResult.session.metrics.totalTokens || 0,
        parseResult.session.metrics.hasToolCalls ? 1 : 0,
        parseResult.session.metrics.parserMalformedLines,
        parseResult.session.metrics.isTruncated ? 1 : 0,
        parseResult.session.metrics.terminationStatus || ''
      );
      sessionsInserted++;
    }

    // Delete existing messages for this session (if updating)
    if (existing) {
      database.prepare('DELETE FROM messages WHERE session_id = ?').run(parseResult.session.id);
    }

    // Insert messages
    const insertMessage = database.prepare(`
      INSERT INTO messages (
        session_id, ordinal, role, content, timestamp, model,
        token_usage_json, source_file, source_line
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const message of parseResult.messages) {
      insertMessage.run(
        parseResult.session.id,
        message.ordinal,
        message.role,
        message.content,
        message.timestamp || null,
        message.model || '',
        message.tokenUsage ? JSON.stringify(message.tokenUsage) : '',
        message.sourceMetadata.sourceFile,
        message.sourceMetadata.sourceLine || null
      );
      messagesInserted++;
    }

    // Note: Tool calls and turns will be added in Phase 3
    // For Phase 2, we only store sessions and messages

  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Unknown error');
  }

  return {
    sessionsInserted,
    sessionsUpdated,
    messagesInserted,
    errors
  };
}

export async function syncSource(sourceType: 'openclaw', basePath?: string): Promise<SyncResult> {
  const { discoverOpenClawSources } = await import('./sources');
  const { parseOpenClawSession } = await import('../parser/openclaw');

  const sources = await discoverOpenClawSources({ workspacePath: basePath });
  const totalResult: SyncResult = {
    sessionsInserted: 0,
    sessionsUpdated: 0,
    messagesInserted: 0,
    errors: []
  };

  for (const source of sources) {
    if (source.error || source.sessionCount === 0) continue;

    try {
      // Find all session files in source path
      const fs = await import('fs/promises');
      const files = await fs.readdir(source.path);
      const sessionFiles = files.filter(f => f.endsWith('.jsonl'));

      for (const file of sessionFiles) {
        const filePath = `${source.path}/${file}`;
        const project = 'default'; // TODO: Extract project from path or config

        try {
          const parseResult = await parseOpenClawSession(filePath, project);
          const result = writeSessionToDatabase(parseResult);
          totalResult.sessionsInserted += result.sessionsInserted;
          totalResult.sessionsUpdated += result.sessionsUpdated;
          totalResult.messagesInserted += result.messagesInserted;
          totalResult.errors.push(...result.errors);
        } catch (err) {
          totalResult.errors.push(`Failed to parse ${filePath}: ${err}`);
        }
      }
    } catch (err) {
      totalResult.errors.push(`Failed to sync source ${source.path}: ${err}`);
    }
  }

  return totalResult;
}
```

Database write layer handles:
- Session upsert (insert or update)
- Message insertion with proper foreign keys
- Token usage stored as JSON string
- Source metadata (file path, line number) preserved
- Error tracking per file
- Batch sync for all discovered sources
  </action>
  <verify>
    <automated>grep -c "export function" ingest/sync/index.ts | xargs test 2 -eq</automated>
    <automated>grep "writeSessionToDatabase\|syncSource" ingest/sync/index.ts | wc -l | xargs test 2 -eq</automated>
    <automated>grep "getDatabase\|database\\.prepare" ingest/sync/index.ts | wc -l | xargs test 2 -ge</automated>
  </verify>
  <done>
- writeSessionToDatabase inserts sessions and messages
- Session upsert handles both new and existing sessions
- Messages linked to sessions via session_id foreign key
- Token usage serialized as JSON
- Source metadata preserved (file path, line number)
- syncSource orchestrates full source sync
- Error tracking per file and per source
  </done>
</task>

<task type="auto">
  <name>Task 2: Create REST API endpoints for source management</name>
  <files>ingest/api/sources.ts</files>
  <read_first>
    - ingest/sync/sources.ts (discovery functions)
    - ingest/sync/index.ts (sync functions)
    - ingest/index.ts (Hono app instance)
  </read_first>
  <action>
Create ingest/api/sources.ts with API routes:

```typescript
import { Hono } from 'hono';
import { discoverOpenClawSources, getSourceConfig } from '../sync/sources';
import { syncSource } from '../sync';

export const sourcesRoutes = new Hono();

// GET /api/v1/sources - List all discovered sources
sourcesRoutes.get('/api/v1/sources', async (c) => {
  try {
    const openclawSources = await discoverOpenClawSources();

    const sources = openclawSources.map(s => ({
      type: s.type,
      path: s.path,
      sessionCount: s.sessionCount,
      lastSyncAt: s.lastSyncAt || null,
      error: s.error || null,
      // Source health status taxonomy per FOUND-05/DATA-03:
      healthStatus: s.error ? 'error' : (s.sessionCount > 0 ? 'configured' : 'empty'),
      // 'configured' = path exists, sessions found
      // 'empty' = path exists, no sessions
      // 'error' = discovery or parse error occurred
      // Phase 3 will add 'indexing', 'parser-warning'
    }));

    return c.json({
      sources,
      total: sources.length
    });
  } catch (err) {
    return c.json({
      error: 'Failed to discover sources',
      message: err instanceof Error ? err.message : 'Unknown error'
    }, 500);
  }
});

// GET /api/v1/sources/:type - Get sources by type
sourcesRoutes.get('/api/v1/sources/:type', async (c) => {
  const type = c.req.param('type');

  if (type !== 'openclaw') {
    return c.json({
      error: 'Unsupported source type',
      message: `Type '${type}' not supported in Phase 2`
    }, 400);
  }

  try {
    const sources = await discoverOpenClawSources();

    return c.json({
      type,
      sources: sources.map(s => ({
        path: s.path,
        sessionCount: s.sessionCount,
        lastSyncAt: s.lastSyncAt || null,
        error: s.error || null
      }))
    });
  } catch (err) {
    return c.json({
      error: 'Failed to discover sources',
      message: err instanceof Error ? err.message : 'Unknown error'
    }, 500);
  }
});

// POST /api/v1/sources/:type/sync - Trigger sync for source type
sourcesRoutes.post('/api/v1/sources/:type/sync', async (c) => {
  const type = c.req.param('type');

  if (type !== 'openclaw') {
    return c.json({
      error: 'Unsupported source type',
      message: `Type '${type}' not supported in Phase 2`
    }, 400);
  }

  try {
    const result = await syncSource('openclaw');

    return c.json({
      type,
      syncResult: {
        sessionsInserted: result.sessionsInserted,
        sessionsUpdated: result.sessionsUpdated,
        messagesInserted: result.messagesInserted,
        errors: result.errors
      },
      status: 'completed'
    });
  } catch (err) {
    return c.json({
      error: 'Sync failed',
      message: err instanceof Error ? err.message : 'Unknown error'
    }, 500);
  }
});

// GET /api/v1/events - SSE skeleton endpoint (Phase 6 will implement real push)
sourcesRoutes.get('/api/v1/events', async (c) => {
  // Return SSE-compatible headers but no real events yet
  return c.newResponse(null, 200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
});
```

API endpoints provide:
- List all discovered sources with status
- Get sources by type (openclaw only in Phase 2)
- Trigger sync for source type
- SSE skeleton endpoint (connectable but no push)
- Error handling with clear messages
- Ingest status mapping (error/configured/empty)
  </action>
  <verify>
    <automated>grep -c "sourcesRoutes\\.(get|post)" ingest/api/sources.ts | xargs test 4 -eq</automated>
    <automated>grep "/api/v1/sources" ingest/api/sources.ts | wc -l | xargs test 4 -ge</automated>
    <automated>grep "text/event-stream" ingest/api/sources.ts | wc -l | xargs test 1 -eq</automated>
  </verify>
  <done>
- GET /api/v1/sources lists all discovered sources
- GET /api/v1/sources/:type gets sources by type
- POST /api/v1/sources/:type/sync triggers sync
- GET /api/v1/events returns SSE headers (skeleton)
- Error responses with proper status codes
- Ingest status included in source listings
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire API routes into main service</name>
  <files>ingest/index.ts</files>
  <read_first>
    - ingest/index.ts (current main entry point)
    - ingest/api/sources.ts (sourcesRoutes)
  </read_first>
  <action>
Update ingest/index.ts to register API routes:

```typescript
// Add import at top
import { sourcesRoutes } from './api/sources';

// After health/version endpoints, add:
app.route('/', sourcesRoutes);
```

This makes all sources routes available at:
- GET /api/v1/sources
- GET /api/v1/sources/:type
- POST /api/v1/sources/:type/sync
- GET /api/v1/events

The routes are mounted at root path, so they inherit the base Hono app.
  </action>
  <verify>
    <automated>grep "sourcesRoutes\|from './api/sources'" ingest/index.ts | wc -l | xargs test 2 -eq</automated>
  </verify>
  <done>
- sourcesRoutes imported into main app
- Routes mounted at root path
- All endpoints accessible via curl/browser
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Complete OpenClaw ingest pipeline with database storage and REST API endpoints</what-built>
  <how-to-verify>
1. Ensure ingest service is running: `node ingest/index.js` (or restart if already running)
2. Discover OpenClaw sources:
   - `curl http://localhost:8078/api/v1/sources`
   - Should show source type 'openclaw', path to agents dir, session count
   - If WORKSPACE_PATH not set, should show error
3. Set WORKSPACE_PATH if needed:
   - `WORKSPACE_PATH=/path/to/openclaw/workspace node ingest/index.js`
   - Or export env var before starting
4. Trigger sync:
   - `curl -X POST http://localhost:8078/api/v1/sources/openclaw/sync`
   - Should return syncResult with sessionsInserted, messagesInserted
   - Check for errors in response
5. Verify database populated:
   - `sqlite3 data/ingest.db "SELECT COUNT(*) FROM sessions;"`
   - `sqlite3 data/ingest.db "SELECT COUNT(*) FROM messages;"`
   - Should show non-zero counts if sessions exist
6. Query specific session:
   - `sqlite3 data/ingest.db "SELECT id, source, project, started_at, message_count FROM sessions LIMIT 5;"`
7. Verify SSE endpoint exists (skeleton):
   - `curl http://localhost:8078/api/v1/events`
   - Should return 200 with text/event-stream content-type
   - No actual events expected in Phase 2
8. Test source-specific endpoint:
   - `curl http://localhost:8078/api/v1/sources/openclaw`
   - Should list OpenClaw sources only
9. Test error handling:
   - `curl http://localhost:8078/api/v1/sources/claude-code`
   - Should return 400 with "not supported in Phase 2" message
  </how-to-verify>
  <resume-signal>Type "approved" if source discovery works, sync populates database, and API endpoints return correct data. Describe any issues.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| API Client → Ingest Service | REST API over HTTP (localhost only) |
| Ingest Service → SQLite | Database write operations |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-09 | D | Database writes | mitigate | Use prepared statements for all queries (better-sqlite3 default). Validate foreign key relationships. Transaction wrapping for multi-table writes (Phase 6). |
| T-02-10 | E | Sync API endpoint | mitigate | POST /api/v1/sources/:type/sync can be abused to trigger heavy work. Add rate limiting in Phase 6. For Phase 2, localhost-only exposure is sufficient mitigation. |
| T-02-11 | S | SSE endpoint | accept | Read-only, no sensitive data exposed. Skeleton implementation in Phase 2 has no real push. |

## Verification Summary

All SQL queries use prepared statements (better-sqlite3 default), preventing SQL injection. Sync endpoint is localhost-only in Phase 2. SSE endpoint is read-only skeleton.
</threat_model>

<verification>
## Phase Verification

- [ ] Parsed sessions written to sessions table
- [ ] Parsed messages written to messages table
- [ ] Session-message foreign key relationship works
- [ ] Token usage stored as JSON and retrieved correctly
- [ ] Source metadata (file path, line number) preserved
- [ ] GET /api/v1/sources returns correct structure
- [ ] POST /api/v1/sources/openclaw/sync populates database
- [ ] Database queries return expected results
- [ ] SSE endpoint returns correct headers
- [ ] Error handling for missing WORKSPACE_PATH
- [ ] Error handling for invalid session files
- [ ] TypeScript compilation succeeds
</verification>

<success_criteria>
1. **Database Storage**: Parsed sessions and messages stored in SQLite with proper relationships and foreign keys
2. **API Integration**: REST endpoints provide source listing and sync triggering
3. **End-to-End Pipeline**: Parser → Database → API flow works end-to-end for OpenClaw data
4. **Error Handling**: Malformed files tracked but don't crash service, errors reported in API responses
5. **SSE Skeleton**: SSE endpoint exists and is connectable (real push deferred to Phase 6)
</success_criteria>

<output>
After completion, create `.planning/phases/02-local-ingest-core-openclaw-parser/02-02b-SUMMARY.md`
</output>
