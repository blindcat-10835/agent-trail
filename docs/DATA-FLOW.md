# Data Flow: JSON Files → Sessions → Turns

This document explains the full data pipeline — from raw JSONL files written by AI tools on disk, through the ingest service, into SQLite, and finally assembled into turns for the frontend.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LOCAL DISK (source files)                    │
│  ~/.claude/projects/{project}/{uuid}.jsonl  (Claude Code)           │
│  .openclaw/agents/{name}/sessions/*.jsonl   (OpenClaw)              │
│  {codex-dir}/*.jsonl                        (Codex)                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  chokidar file watcher + periodic resync
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   INGEST SERVICE (port 8078)                        │
│                                                                     │
│  1. Parser (claude.ts / openclaw.ts / codex.ts)                     │
│     JSONL line-by-line → ParseResult                                │
│     { session, messages[], activities[], errors[] }                 │
│                                                                     │
│  2. Sync Layer (sync/index.ts)                                      │
│     SHA-256 skip cache → writeSessionToDatabase()                   │
│     Emits SSE events: session_created / session_updated             │
│                                                                     │
│  3. SQLite DB (data/ingest.db, WAL mode)                            │
│     sessions / messages / tool_calls / turns / sync_status          │
│                                                                     │
│  4. REST API (Hono)                                                 │
│     GET /api/v1/sessions                                            │
│     GET /api/v1/sessions/:id/turns  ← runs assembler on demand     │
│     GET /api/v1/events              ← SSE invalidation stream       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  HTTP (BFF proxy, never direct)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              NEXT.JS BFF (app/api/agent-tools/[tool]/...)           │
│  Proxies to ingest; injects source= filter; caps limit to 100       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  fetch()
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                             │
│  Renders sessions list, session detail, turn-by-turn replay         │
│  Re-fetches on SSE invalidation events                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Source Files

Each AI tool writes its conversation history as JSONL files (one JSON object per line). The ingest service discovers these directories on startup via `ingest/sync/sources.ts`:

| Source | File location | Session ID |
|--------|--------------|------------|
| Claude Code | `~/.claude/projects/{encoded-cwd}/{uuid}.jsonl` | UUID extracted from filename |
| OpenClaw | `.openclaw/agents/{name}/sessions/{key}.jsonl` | `agent:{name}:{uuid}` key |
| Codex | `~/.codex/sessions/*.jsonl` | Filename-derived |

Each JSONL line carries a message with role (`user`, `assistant`, `system`, `tool_result`), content, timestamp, and optionally tool use blocks. Claude Code lines additionally carry a `uuid` and `parentUuid` for DAG relationship tracking.

---

## Stage 2: Parser

`ingest/parser/claude.ts`, `openclaw.ts`, `codex.ts` each implement the same contract: read a JSONL file line by line and produce a `ParseResult`:

```typescript
interface ParseResult {
  session: TraceSession      // metadata: id, source, project, timestamps, metrics
  messages: TraceMessage[]   // flat ordered list of all messages
  activities: TraceActivity[] // tool calls extracted from assistant content blocks
  errors: ParseError[]       // malformed line records
  warnings: string[]
}
```

**Key per-source handling:**
- **Claude Code**: UUID dedup (skip duplicate UUIDs), DAG resolution (`parentUuid` → relationship type), compact boundary detection (context window compression events)
- **OpenClaw**: Content block extraction, gateway-injected metadata stripping for display name extraction
- **Codex**: `turn_context` boundary detection for native turn markers

The parser does not touch the database — it only transforms bytes on disk into typed objects in memory.

---

## Stage 3: Sync Layer

`ingest/sync/index.ts:writeSessionToDatabase()` takes a `ParseResult` and writes it to SQLite. Before doing the full write, it checks a **skip cache**:

```
fileHash = SHA-256(file on disk)

if sessions.file_hash === fileHash:
    skip re-parse, only patch name/project if blank
    return early
else:
    upsert session row
    delete + re-insert all messages for that session
```

The skip cache prevents re-parsing unchanged files during periodic resyncs. A session's hash entry is deliberately NULLed by migrations when metadata schema changes (e.g., project path extraction was fixed) — this forces a re-parse on next sync.

After each write, the sync layer emits SSE events (`session_created` or `session_updated`) so connected browsers know to re-fetch.

---

## Stage 4: SQLite Database

`data/ingest.db` is a SQLite database with WAL mode enabled. WAL allows concurrent readers and a single writer — the file watcher can write while the HTTP API serves reads without blocking.

### Why the DB exists

Parsing JSONL files on every HTTP request would be far too slow and wasteful. The DB is the read model:

| Need | How DB solves it |
|------|-----------------|
| Fast session list with filters/sorting | Indexed `sessions` table — O(log n) queries with `source`, `project`, `started_at` indexes |
| Pagination across hundreds of sessions | SQL `LIMIT / OFFSET` with count query |
| Cross-session relationships | `parent_session_id` / `root_session_id` foreign keys enable subagent tree queries |
| Skip cache for incremental sync | `file_hash` column stores SHA-256; unchanged files are skipped entirely |
| Sync health tracking | `sync_status` table records last sync time and error per source type |
| Turn assembly input | `messages` table stores the flat ordered message list that the assembler reads |
| Tool call pairing | `tool_calls` and `tool_result_events` tables store tool invocations separately from messages |

### Schema summary

```
sessions          — one row per session file, with metadata and file provenance
messages          — flat ordered messages (session_id + ordinal), foreign key to sessions
tool_calls        — tool invocations linked to message_ordinal
tool_result_events — output events from tool calls
turns             — pre-computed turn rows (populated separately; assembler also builds on-demand)
sync_status       — per-source sync bookkeeping
```

---

## Stage 5: Turn Assembler

Turns are not stored in the JSON files — they are a derived view. The assembler (`ingest/turns/assembler.ts`) runs **at query time** when the frontend requests `/sessions/:id/turns`.

**Assembly algorithm:**

```
messages (ordered by ordinal)
  ↓ iterate
  user message   → close previous turn (if has assistant responses), open new turn
  assistant msg  → append to current turn's assistantMessages[]
  tool_result    → append to current turn's assistantMessages[]
  system/compact → add as activity event; mark turn as truncated if compact
  queued user    → merge into current user message (D-05: consecutive user msgs)
  ↓ post-process
  pairToolCalls()  → join tool_calls + tool_result_events onto each turn
  linkSubagents()  → find child sessions, add subagent_link activities to first turn
```

**Turn boundary rule (D-08):** Each user message opens a new turn. The previous turn closes when the next user message arrives. An incomplete final turn (no assistant response yet) is still included.

A `TraceTurn` looks like:

```typescript
{
  id: "sessionId-turn-0",
  index: 0,
  userMessage: TraceMessage,        // the human prompt
  assistantMessages: TraceMessage[], // all model/tool_result responses
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
|----------|----------------|
| `GET /api/v1/sessions` | Paginated session list, filterable by source/project/status |
| `GET /api/v1/sessions/:id` | Single session metadata |
| `GET /api/v1/sessions/:id/turns` | Turn-assembled view, paginated |
| `GET /api/v1/sessions/:id/messages` | Raw flat messages |
| `GET /api/v1/events` | SSE stream for global invalidation |
| `GET /api/v1/events/:sessionId` | SSE stream for per-session invalidation |

The frontend **never calls the ingest service directly** (D-07). Next.js BFF routes at `app/api/agent-tools/[tool]/...` proxy all requests, injecting `source={tool}` so each tool's data is scoped correctly. An additional per-request limit cap (100) is enforced at the BFF layer.

**Real-time update loop:**

```
1. Frontend subscribes to SSE at /api/agent-tools/{tool}/events
2. File watcher detects JSONL change on disk
3. Debounce (500ms) → syncSource() → parser → DB write
4. sseManager.emit('session_updated', ...) → SSE push to frontend
5. Frontend receives event → re-fetches session list / session detail
```

---

## Data Flow Summary

```
JSONL file (disk)
  → Parser: line-by-line → ParseResult { session, messages[], activities[] }
  → Skip cache check: SHA-256(file) vs sessions.file_hash
      [unchanged] → early return
      [changed]   → upsert session + delete/re-insert messages in SQLite
  → SSE event: session_created / session_updated → frontend refetch

On frontend request for /sessions/:id/turns:
  → assembleTurns(sessionId)
      → SELECT messages WHERE session_id ORDER BY ordinal
      → group by user-message boundary → TraceTurn[]
      → pairToolCalls: JOIN tool_calls + tool_result_events
      → linkSubagents: JOIN sessions WHERE parent_session_id
  → JSON response to BFF → JSON response to React
```

The DB is the bridge between the continuous file-watching ingest path and the on-demand HTTP read path. Without it, every request would require parsing all JSONL files from scratch.
