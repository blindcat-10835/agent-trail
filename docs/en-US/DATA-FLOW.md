# Data Flow: JSONL Files → Sessions → Turns

This document explains the complete data pipeline — from raw JSONL files that AI tools write to local disk, through the ingest service, into SQLite, and finally assembled into turns for the frontend.

---

## Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     Local Disk (source files)                        │
│  ~/.claude/projects/{project}/{uuid}.jsonl   (Claude Code)          │
│  .openclaw/agents/{name}/sessions/*.jsonl    (OpenClaw)             │
│  {codex-dir}/*.jsonl                         (Codex)                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  chokidar file watcher + periodic full resync
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   INGEST Service (port 8078)                         │
│                                                                     │
│  1. Parser (claude.ts / openclaw.ts / codex.ts)                     │
│     Line-by-line JSONL → ParseResult                                │
│     { session, messages[], activities[], errors[] }                 │
│                                                                     │
│  2. Sync layer (sync/index.ts)                                      │
│     SHA-256 skip cache → writeSessionToDatabase()                   │
│     Emits SSE events: session_created / session_updated             │
│                                                                     │
│  3. SQLite DB (data/ingest.db, WAL mode)                            │
│     sessions / messages / tool_calls / turns / sync_status          │
│                                                                     │
│  4. REST API (Hono)                                                 │
│     GET /api/v1/sessions                                            │
│     GET /api/v1/sessions/:id/turns  ← runs assembler on demand      │
│     GET /api/v1/events              ← SSE invalidation stream       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  HTTP (via BFF proxy; frontend does not call directly)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│           NEXT.JS BFF (app/api/agent-tools/[tool]/...)              │
│  Proxies to ingest; injects source= filter; caps limit at 100       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  fetch()
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Frontend (React)                               │
│  Renders sessions list, session detail, turn-by-turn replay         │
│  Re-fetches on SSE invalidation events                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Source Files

Each AI tool writes conversation history to JSONL files (one JSON object per line). The ingest service discovers these directories on startup:

- Scan directories are centralised by the **tool directory registry** in `ingest/config/tool-dirs.ts`, resolved with priority: environment variable > config file (`~/.agent-trail/config.json`, with legacy `~/.agents-tracing/config.json` fallback) > built-in defaults.
- Discoverers (`ingest/sync/sources.ts`) read the directory list from `IngestConfig.toolDirs`; each source can be configured with multiple directories.

| Source | Default path | Session ID |
| --- | --- | --- |
| Claude Code | `~/.claude/projects/{encoded-cwd}/{uuid}.jsonl` | UUID extracted from filename |
| OpenClaw | `~/.openclaw/agents/{name}/sessions/{key}.jsonl` | `agent:{name}:{uuid}` |
| Codex | `~/.codex/sessions/*.jsonl` | Derived from filename |

Each JSONL line contains a message with role (`user`, `assistant`, `system`, `tool_result`), content, timestamp, and optional tool call blocks. Claude Code lines also carry `uuid` and `parentUuid` for DAG relationship tracking.

---

## Stage 2: Parser

`ingest/parser/claude.ts`, `openclaw.ts`, `codex.ts` each implement the same interface: read a JSONL file line-by-line and produce a `ParseResult`:

```typescript
interface ParseResult {
  session: TraceSession      // metadata: id, source, project, timestamps, metrics
  messages: TraceMessage[]   // flat ordered list of all messages
  activities: TraceActivity[] // tool calls extracted from assistant content blocks
  errors: ParseError[]       // malformed line records
  warnings: string[]
}
```

**Source-specific handling:**

- **Claude Code**: UUID dedup (skip duplicate UUIDs), DAG parsing (`parentUuid` → relationship type), compact boundary detection (context window compression events)
- **OpenClaw**: Content block extraction, gateway-injected metadata prefix stripping for display name
- **Codex**: `turn_context` boundary detection, leveraging native turn markers

Parsers do not touch the database — they only convert bytes on disk to typed in-memory objects.

---

## Stage 3: Sync Layer

`writeSessionToDatabase()` in `ingest/sync/index.ts` receives a `ParseResult` and writes it to SQLite. Before performing a full write, it checks the **skip cache**:

```text
fileHash = SHA-256(file on disk)
cacheKey = "{PARSER_CACHE_VERSION}:{source}:{fileHash}"

if sessions.file_hash === cacheKey:
    skip re-parse, only backfill name/project if empty
    return early
else:
    upsert session row
    delete and re-insert all messages for this session
```

The skip cache prevents re-parsing unchanged files during periodic resyncs. When metadata schema changes occur (e.g. project path extraction logic fix), migration scripts set the affected session's `file_hash` to NULL, forcing a re-parse on the next sync.

After each write, the sync layer emits SSE events (`session_created` or `session_updated`) to notify connected browsers to re-fetch.

---

## Stage 4: SQLite Database

`data/ingest.db` is a WAL-mode SQLite database. WAL allows concurrent readers and a single writer — the file watcher's writes do not block the HTTP API's read service.

### Why a DB

Parsing JSONL files from scratch on every HTTP request would be far too slow. The DB is the read model:

| Need | How the DB solves it |
| --- | --- |
| Fast session list filtering/sorting | Indexes on `source`, `project`, `started_at` on the `sessions` table — O(log n) queries |
| Pagination across hundreds of sessions | SQL `LIMIT / OFFSET` with count queries |
| Cross-session relationship queries | `parent_session_id` / `root_session_id` foreign keys for subagent tree queries |
| Incremental sync skip cache | `file_hash` column stores SHA-256; unchanged files are skipped |
| Sync health tracking | `sync_status` table records last sync time and errors per source type |
| Turn assembly input | `messages` table stores flat ordered message list for the assembler to read |
| Tool call pairing | `tool_calls` and `tool_result_events` tables store tool invocations and their output independently |

### Schema Overview

```text
sessions            — one row per session file, with metadata and file provenance
messages            — flat ordered messages (session_id + ordinal), FK to sessions
tool_calls          — tool invocations, linked to message_ordinal
tool_result_events  — output events from tool calls
turns               — pre-computed turn rows (also built on demand by the assembler)
sync_status         — sync state record per source
```

---

## Stage 5: Turn Assembler

Turns are not stored in JSON files — they are a derived view. The assembler (`ingest/turns/assembler.ts`) runs at **query time**, triggered when the frontend requests `/sessions/:id/turns`.

**Assembly algorithm:**

```text
messages (sorted by ordinal)
  ↓ walk one by one
  user message       → close previous turn (if it had assistant responses), open new turn
  assistant message  → append to current turn's assistantMessages[]
  tool_result        → append to current turn's assistantMessages[]
  system/compact     → add as activity event; if compact, mark turn as isTruncated
  queued user        → merge into current user message (D-05: consecutive user messages merged)
  ↓ post-processing
  pairToolCalls()    → JOIN tool_calls + tool_result_events, attach to matching turn
  linkSubagents()    → find child sessions, add subagent_link activity on first turn
```

**Turn boundary rules (D-08):** Each user message opens a new turn; the next user message closes the previous turn. A trailing turn with no assistant response is still included.

`TraceTurn` structure:

```typescript
{
  id: "sessionId-turn-0",
  index: 0,
  userMessage: TraceMessage,         // the human's question
  assistantMessages: TraceMessage[], // all model responses and tool_result
  activities: TraceActivity[],       // tool calls, system events, subagent links
  startedAt, endedAt, durationMs,
  tokenUsage,
  isTruncated?,
}
```

---

## Stage 6: REST API → BFF → Frontend

The ingest service exposes a Hono REST API on port 8078:

| Endpoint | What it returns |
| --- | --- |
| `GET /api/v1/sessions` | Paginated session list, filterable by source/project/status |
| `GET /api/v1/sessions/search` | Cross-session message-body search returning session-level candidates |
| `GET /api/v1/sessions/:id` | Single session metadata |
| `GET /api/v1/sessions/:id/search` | In-session message-body search returning message-level hits |
| `GET /api/v1/sessions/:id/turns` | Turn assembly view, with pagination |
| `GET /api/v1/sessions/:id/messages` | Raw flat message list |
| `GET /api/v1/events` | Global invalidation SSE stream |
| `GET /api/v1/events/:sessionId` | Per-session invalidation SSE stream |

The frontend **never calls the ingest service directly** (D-07). The Next.js BFF routes `app/api/agent-tools/[tool]/...` proxy all requests, auto-injecting `source={tool}` to scope data per tool. The BFF layer additionally caps per-request `limit` at 100.

**Real-time update cycle:**

```text
1. Frontend subscribes to SSE: /api/agent-tools/{tool}/events
2. File watcher detects JSONL changes on disk
3. Debounce (500ms) → syncSource() → parser → DB write
4. sseManager.emit('session_updated', ...) → SSE pushed to frontend
5. Frontend receives event → re-fetch session list / session detail
```

---

## Data Flow Summary

```text
JSONL file (disk)
  → Parser: line-by-line parse → ParseResult { session, messages[], activities[] }
  → Skip cache check: SHA-256(file) vs sessions.file_hash
      [unchanged] → return early
      [changed] → upsert session + delete & re-insert messages into SQLite
  → SSE events: session_created / session_updated → frontend re-fetch

When frontend requests /sessions/:id/turns:
  → assembleTurns(sessionId)
      → SELECT messages WHERE session_id ORDER BY ordinal
      → Group by user message boundaries → TraceTurn[]
      → pairToolCalls: JOIN tool_calls + tool_result_events
      → linkSubagents: JOIN sessions WHERE parent_session_id
  → JSON response to BFF → JSON response to React
```

**The DB is the bridge connecting the continuous file-watcher write path and the on-demand HTTP read path. Without the DB, every request would need to parse all JSONL files from scratch.**
