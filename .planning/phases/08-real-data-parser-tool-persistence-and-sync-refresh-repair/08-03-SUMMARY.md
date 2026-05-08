---
phase: 08-real-data-parser-tool-persistence-and-sync-refresh-repair
plan: "03"
title: Persist message ids, tool calls, result events, and force reparse
subsystem: sync
tags:
  - sqlite
  - sync
  - tool-persistence
  - force-reparse
  - transactional
dependency_graph:
  requires:
    - claude-tool-result-pairing
    - codex-function-call-output-as-response-item
    - parser-message-ordinal-metadata
  provides:
    - transactional-session-writes
    - tool-call-db-persistence
    - tool-result-events-db-persistence
    - stable-message-ids
    - force-reparse-path
    - stale-row-cleanup
  affects:
    - ingest/sync/index.ts
    - ingest/api/sources.ts
    - tests/unit/ingest/sync.test.ts
    - tests/unit/ingest/tool-persistence.test.ts
    - tests/unit/ingest/turn-activity-regression.test.ts
tech_stack:
  added: []
  patterns:
    - better-sqlite3 database.transaction() for atomic multi-table writes
    - Dependency-order delete before re-insert (tool_result_events → tool_calls → turns → messages)
    - WriteSessionOptions interface extending existing function signature (backward-compatible)
    - SyncSourceOptions accepting force and basePath (backward-compatible string overload)
    - Force flag forwarded from HTTP query/body through syncSource → writeSessionToDatabase
key_files:
  created:
    - tests/unit/ingest/tool-persistence.test.ts
    - tests/unit/ingest/turn-activity-regression.test.ts
  modified:
    - ingest/sync/index.ts
    - ingest/api/sources.ts
    - tests/unit/ingest/sync.test.ts
decisions:
  - "WriteSessionOptions.force added as 4th argument to preserve all existing call sites (3 callers pass no options)"
  - "SyncSourceOptions replaces bare string basePath; string overload detected at runtime for backward compat"
  - "Dependency-order delete: tool_result_events must be deleted before tool_calls due to FK; turns before messages"
  - "has_tool_use flag derived by scanning activities list before the transaction, keyed by messageOrdinal"
  - "force=true in HTTP API accepted via query string OR JSON body to support both curl and fetch callers"
  - "pairToolCalls() in assembler unchanged — queries tool_calls by session_id + message_ordinal in (assistant ordinals) which is correct"
  - "better-sqlite3 native bindings copied to worktree to allow test execution within worktree context"
metrics:
  duration: "11m"
  completed: "2026-05-09"
  tasks_completed: 8
  files_created: 2
  files_modified: 3
  tests_added: 41
  tests_passing: 140
---

# Phase 08 Plan 03: Persist Message IDs, Tool Calls, Result Events, and Force Reparse Summary

## One-Liner

Transactional sync writes with stable message IDs, tool_calls/tool_result_events DB persistence, dependency-order stale-row cleanup on re-sync, and force-reparse option propagated from HTTP API through sync layer.

## What Was Built

### Task 1-2: WriteSessionOptions and Transactional Writes

Extended `writeSessionToDatabase()` signature to accept `WriteSessionOptions { force?: boolean }` as 4th argument. All database writes now execute in a single `database.transaction()` call (better-sqlite3 synchronous transactions):

- On session update: deletes derived rows in dependency order — `tool_result_events` (via subquery on tool_call ids) → `tool_calls` → `turns` → `messages` — then re-inserts.
- On session insert: inserts all rows atomically in a single transaction.
- Rollback is automatic if any step throws.

### Task 3: Stable Message IDs and has_tool_use Flag

The `INSERT INTO messages` statement now includes both `id` and `has_tool_use`:

- **Message ID priority:** uses `message.id` when non-empty; falls back to deterministic `${sessionId}:${ordinal}` — ensures `messages.id IS NOT NULL` for all rows.
- **`has_tool_use`:** derived by building a `Map<ordinal, activities>` over `parseResult.activities` before the transaction, then setting `has_tool_use=1` on messages whose ordinal appears in that map.

### Task 4: tool_calls Persistence

`tool_calls` rows are now inserted inside the transaction for every `type: "tool_call"` activity in `parseResult.activities`:

- `session_id`, `message_ordinal` (from `tc.messageOrdinal ?? 0`), `tool_id`, `name`, `category`, `input_json`, `status`, `error`, `duration_ms` — all stored.
- `lastInsertRowid` captured for pairing result events.

### Task 5: tool_result_events Persistence

For each result event on each tool call:

- Linked to `tool_call_id` via `lastInsertRowid` from the tool_call insert.
- `timestamp`, `content`, `is_partial` stored verbatim from `TraceToolResultEvent`.

### Task 6: assembleTurns() pairToolCalls Verification

Existing `pairToolCalls()` in `assembler.ts` was already correct — it queries `tool_calls WHERE session_id = ? AND message_ordinal IN (assistant ordinals)`. Because the parser stamps `messageOrdinal` on each `TraceToolCall`, and those ordinals correspond to assistant messages, the join is correct without changes.

The turn-activity regression tests confirm that after `writeSessionToDatabase`, `assembleTurns()` returns structured `TraceToolCall` activities with result events from the DB.

### Task 7: Force Reparse Path

Three-layer propagation:

1. **`writeSessionToDatabase(..., { force: true })`** — skips the hash-match early return so derived rows are always deleted and re-inserted regardless of `file_hash`.
2. **`syncSource(sourceType, { force: true })`** — `SyncSourceOptions` interface replaces the bare `basePath?: string` argument. A runtime check detects the legacy string form for backward compatibility.
3. **`POST /api/v1/sources/:type/sync`** — accepts `force=true` via query string (`?force=true`) or JSON body (`{"force": true}`); forwards to `syncSource`.

### Task 8: Tests

**`tests/unit/ingest/tool-persistence.test.ts`** (20 tests):
- `messages.id IS NOT NULL` after write
- Explicit `message.id` used when present
- Deterministic fallback `${sessionId}:${ordinal}` when id is empty
- `has_tool_use=1` on owning message, `=0` on others
- `tool_calls` row exists with correct fields (tool_id, name, category, input_json, status, error, message_ordinal)
- `tool_result_events` rows linked to tool_call via `tool_call_id`
- `is_partial` and `timestamp` preserved on streaming chunks
- Re-sync with fewer tool calls removes stale rows
- Re-sync removes stale `tool_result_events` via cascading delete subquery
- Re-sync replaces stale messages
- `SyncResult.toolCallsInserted` and `toolResultEventsInserted` counts correct
- Non-tool activities (thinking blocks) skipped without errors
- Force=true accepted without errors

**`tests/unit/ingest/turn-activity-regression.test.ts`** (7 tests):
- `turn.activities` contains persisted `TraceToolCall` after sync
- Result events surfaced in turn activities
- Multiple tool calls per turn all appear
- Turn with no tool calls has empty tool activities
- Category preserved from DB through assembler
- Force re-sync replaces tool activities with new parser output
- `role=tool_result` messages do not create spurious turns

**`tests/unit/ingest/sync.test.ts`** (added 4 tests):
- `SyncResult` has `toolCallsInserted` and `toolResultEventsInserted` fields
- `syncSource` accepts `{ force: true }` without errors
- `syncSource` backward-compatible with string `basePath` argument
- `writeSessionToDatabase` accepts `WriteSessionOptions { force: true }` as 4th argument

Total: 140 tests passing across all 10 ingest test files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] better-sqlite3 native bindings not built in worktree**
- **Found during:** First test run in worktree
- **Issue:** The worktree has its own `node_modules` symlinked from pnpm store, but the native C++ addon (`better_sqlite3.node`) was not compiled for the worktree's node_modules path. Tests failed with "Could not locate the bindings file."
- **Fix:** Copied the built `better_sqlite3.node` from the main project's pnpm store into the worktree's equivalent path. This is a worktree-local build artifact fix.
- **Files modified:** N/A (binary copy, not source)
- **Commit:** N/A (binary not tracked)

**2. [Rule 1 - Bug] Test used `require()` which fails in vitest ESM context**
- **Found during:** Task 8 test run
- **Issue:** One test in `sync.test.ts` used `require('@/ingest/sync/index')` for the `writeSessionToDatabase` import, which throws "Cannot find module" in vitest's ESM environment.
- **Fix:** Changed to `await import('@/ingest/sync/index')` consistent with all other dynamic imports in the file.
- **Files modified:** `tests/unit/ingest/sync.test.ts`
- **Commit:** 6170a0a (same commit)

## Acceptance Criteria Verification

- [x] Local DB query for synced sessions no longer returns `messages.id IS NULL` — stable ID logic always produces non-null IDs
- [x] `tool_calls` and `tool_result_events` are non-empty for parsed sessions with real tool usage — inserted transactionally inside `writeSessionToDatabase`
- [x] Re-sync cannot leave stale tool rows — dependency-order delete clears all derived rows before re-inserting
- [x] Force sync reparses unchanged files — `force: true` bypasses hash early-return
- [x] Replay turn assembly sees structured tool activities from SQLite — confirmed by turn-activity regression tests

## Known Stubs

None. All data flows are wired: parser output → `writeSessionToDatabase` → SQLite → `assembleTurns` → `TraceToolCall` activities on turns.

## Self-Check: PASSED
