# Phase 16: Ingest Incremental JSONL and Sync Observability Hardening - Research

**Gathered:** 2026-05-14  
**Primary input:** `.planning/phases/16-ingest-incremental-jsonl-and-sync-observability-hardening/16-CONTEXT.md`

## Complexity Verdict And Skill Routing

This phase is high-complexity backend data-pipeline work. It touches persistent schema, parser contracts, sync orchestration, SQLite write semantics, observability APIs, and performance regression tests.

Correct workflow skill:

- Use `gsd-plan-phase` now, with research first.
- Use `gsd-execute-phase 16` later to implement the generated plans.
- Do not use `gsd-ui-phase`: there is no frontend interaction/design contract in this scope.
- Do not use `gsd-ai-integration-phase`: this phase indexes AI tool logs but does not build an AI system.
- Do not use `gsd-debug` unless Phase 16 execution reveals a new runtime failure.

## Current Code Map

### Scheduler And Entrypoints

- `ingest/src/sync-scheduler.ts`
  - Serializes sync work.
  - Coalesces duplicate active/queued full-source and path requests.
  - Exposes last-run style status: active reason/scope, queued reasons, duration, skipped/parsed metrics, last error.
  - Does not keep a bounded recent-run history.
  - Does not track current file, current offset, max RSS, write counts, or coalesce counts.

- `ingest/index.ts`
  - Creates `SyncScheduler` with `syncSource` and `syncPaths`.
  - Routes startup warmup, background full sync, watcher path sync, periodic sync, and manual sync through scheduler.
  - `/health` returns `sync.scheduler`.

- `ingest/api/overview.ts` and `ingest/api/sources.ts`
  - Existing status endpoints expose scheduler status under overview/source status.
  - There is no dedicated `/api/v1/debug/sync` endpoint.

### Sync And Storage

- `ingest/sync/index.ts`
  - `PARSER_CACHE_VERSION` is a private constant.
  - `SyncResult.metrics` currently tracks files considered, skipped before parse, parsed, and largest file bytes.
  - `shouldSkipBeforeParse()` skips unchanged files before parser work when `file_size`, `file_mtime`, and parser cache version match.
  - `parseAndWriteCandidate()` still invokes whole-file parser for changed Claude/Codex files.
  - `writeSessionToDatabase()` computes a streaming SHA-256, then deletes and reinserts all derived rows for an existing session.
  - Derived delete order is `tool_result_events`, `tool_calls`, `subagent_links`, `turns`, `messages`.

- `ingest/db/schema.sql` and `ingest/db/index.ts`
  - Current schema is at `user_version = 10`.
  - `sessions` stores file path, file size, file mtime, file hash, and last sync time.
  - No cursor table exists.
  - No persisted sync run history table exists. Phase 16 can use bounded in-memory history unless persistent history is explicitly needed later.

### Parsers

- `ingest/parser/claude.ts`
  - `parseClaudeSession(filePath, project)` streams the entire file line by line.
  - Parser state includes ordinal, DAG maps, compact boundaries, truncated UUIDs, current turn, tool-call map, token totals, cwd/git metadata.
  - Helper functions are mostly private.

- `ingest/parser/codex.ts`
  - `parseCodexSession(filePath, project)` streams the entire file line by line.
  - Parser state includes ordinal, session metadata, current turn, current model, token dedup map, pending user response, and tool-call maps.
  - A pure offset parse cannot be safe without supplying prior parser state or emitting a dedicated delta shape.

## Key Planning Findings

1. Cursor support should use a dedicated table, not more nullable columns on `sessions`. One file maps to one cursor, while one parser result maps to one session. A table also lets fallback state be explicit without overloading `file_hash`.

2. Cursor safety must be decided before parser invocation. The decision needs `file_path`, `source_type`, `file_size`, `file_mtime`, `file_inode`, `file_device`, `parser_version`, and `last_indexed_offset`.

3. Appends should parse only complete lines. If the file ends with a partial JSONL line, the parser must parse through the last complete newline and leave the cursor at the previous complete byte offset.

4. Incremental parser output should be a delta contract, not a partial `ParseResult` pretending to be a full session. Result events can arrive after their tool call, so the delta writer must be able to attach result events to existing `tool_calls.tool_id`.

5. Full fallback remains mandatory. Cursor mismatch, truncate/rewrite, inode/device change, parser version change, missing cursor, force sync, or parser-state ambiguity must call the existing full parser and replacement writer.

6. Append/upsert write logic must be idempotent. It should use existing unique keys where available: `messages(session_id, ordinal)`, `turns(session_id, turn_index)`, and tool call lookup by `(session_id, tool_id)`.

7. Observability should live in scheduler/debug plumbing, not in parser globals. Current file, file size, offset, rows written, max RSS, run reason, queue/coalesce counts, and recent errors are per-run concerns.

8. Any concurrency or batching must be explicit config. The current implementation is serial and safe; Phase 16 should not introduce background worker pools unless bounded with `INGEST_PARSE_CONCURRENCY` and `INGEST_SQLITE_BATCH_SIZE`.

## Proposed Technical Shape

### Cursor Table

Add `ingest_file_cursors`:

- `source_type TEXT NOT NULL`
- `file_path TEXT NOT NULL`
- `session_id TEXT`
- `file_size INTEGER NOT NULL`
- `file_mtime TEXT`
- `file_inode INTEGER`
- `file_device INTEGER`
- `parser_version TEXT NOT NULL`
- `last_indexed_offset INTEGER NOT NULL DEFAULT 0`
- `last_indexed_line INTEGER NOT NULL DEFAULT 0`
- `last_message_ordinal INTEGER NOT NULL DEFAULT -1`
- `last_turn_index INTEGER NOT NULL DEFAULT -1`
- `last_success_at TEXT`
- `last_fallback_reason TEXT`
- primary key `(source_type, file_path)`

### Cursor Decision

Create a helper that returns one of:

- `skip_unchanged`
- `incremental_append`
- `full_reparse`

Required full-reparse reasons:

- no cursor
- `force=true`
- current size is smaller than cursor offset
- current inode/device differs from cursor
- parser version differs from cursor
- file snapshot cannot be read
- parser state is missing for a source that needs it

### Incremental Parse Delta

Introduce an internal parser/sync type such as `IncrementalParseDelta`:

- `sessionId`
- `sourceType`
- `messages`
- `toolCalls`
- `toolResultEvents` keyed by `toolId` or `callId`
- `subagentLinks`
- `sessionPatch`
- `metricsDelta`
- `cursorUpdate` with complete-line offset and line count
- `warnings` and `errors`

### Append/Upsert Writer

Add a separate write path, for example `appendSessionDeltaToDatabase(delta, sourceFile, cursorDecision)`.

Required behavior:

- Upsert `messages` by `(session_id, ordinal)` or deterministic message id.
- Upsert `tool_calls` by `(session_id, tool_id)`; add a unique index if required.
- Insert result events only when not already present for the resolved tool call. If no stable event key exists, use a deterministic generated key or a uniqueness strategy based on `(tool_call_id, timestamp, content, is_partial)`.
- Upsert `subagent_links` using a uniqueness strategy around `(session_id, subagent_session_id, relationship, message_ordinal)`.
- Update session metrics additively or by recalculating cheap DB aggregates after append.
- Update cursor only after the DB transaction succeeds.

### Observability

Extend scheduler state with:

- current file path
- current file size
- current offset
- write counts
- largest file bytes
- max RSS sample
- duration
- queue/coalesce counts
- recent run history ring buffer
- recent errors

Add `/api/v1/debug/sync` for the richer payload. Keep `/health` backward compatible.

## Validation Architecture

Validation must prove both the fast path and fallback path.

Required automated checks:

- Migration test creates `ingest_file_cursors` and needed unique indexes on old databases.
- Cursor decision tests cover unchanged, append, truncate, rewrite, inode/device change, parser version change, missing cursor, force sync, and partial trailing line.
- Incremental parser tests prove Claude and Codex append parsing reads only new complete lines.
- Incremental parser tests prove unsafe cursor states call the full parser.
- Append/upsert tests prove messages, tool calls, result events, subagent links, turns or turn boundaries are idempotent across repeated append syncs.
- Sync tests prove `syncPaths()` uses incremental parse for safe appends and full parse for fallback.
- Scheduler/debug tests prove active run, recent history, current file/offset, write counts, max RSS, queue/coalesce behavior, structured run errors, and completion logs are exposed.
- Existing Phase 15 tests stay green.

Suggested command set:

- `pnpm vitest run tests/unit/ingest/db-migration.test.ts tests/unit/ingest/sync-cursor.test.ts`
- `pnpm vitest run tests/unit/ingest/claude-incremental-parser.test.ts tests/unit/ingest/codex-incremental-parser.test.ts`
- `pnpm vitest run tests/unit/ingest/sync-incremental-write.test.ts tests/unit/ingest/sync-performance.test.ts tests/unit/ingest/sync.test.ts`
- `pnpm vitest run tests/unit/ingest/sync-scheduler.test.ts ingest/api/overview.test.ts ingest/api/sources.test.ts tests/integration/ingest/api.test.ts`
- `pnpm typecheck:ingest`
- `pnpm test:run`

Manual/local validation:

- Start `pnpm dev:ingest`.
- Append a complete JSONL line to a large Claude and Codex file.
- Confirm `/api/v1/debug/sync` reports current file, offset movement, rows written, and recent history.
- Confirm RSS remains bounded compared with a full reparse, and no duplicate messages/tool calls/result events are created after repeating the same append sync.
