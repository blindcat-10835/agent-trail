# Phase 16: Ingest Incremental JSONL and Sync Observability Hardening - Context

## Purpose

Phase 15 closed the incident-level memory amplification path: sync entrypoints are serialized/coalesced, watcher changes are path-scoped, unchanged historical files skip before parser work, and file hashing no longer reads full JSONL files into memory.

Phase 16 should complete the remaining optimization track from `.planning/debug/ingest-memory-performance-fix-policy.md`: append-only JSONL incremental parsing and production-grade sync observability.

## Source Inputs

- `.planning/debug/ingest-memory-performance-fix-policy.md`
- `.planning/phases/15-ingest-sync-performance-hardening/15-VERIFICATION.md`
- `.planning/phases/15-ingest-sync-performance-hardening/15-REVIEW.md`
- `ingest/src/sync-scheduler.ts`
- `ingest/sync/index.ts`
- `ingest/parser/codex.ts`
- `ingest/parser/claude.ts`
- `ingest/db/schema.sql`

## Already Solved In Phase 15

- Startup warmup, background sync, watcher changes, periodic resync, and manual sync route through `SyncScheduler`.
- Watcher debounce preserves changed paths and calls path-scoped sync.
- Unchanged files can skip before parser allocation using `file_path`, `file_size`, `file_mtime`, and parser cache version.
- `computeFileHash()` no longer uses whole-file `readFileSync()`.
- Path-scoped Codex sync does not run full `collectCodexRelationships()`.
- Health/status surfaces expose scheduler active/queued/reason/scope/duration/error and skipped/parsed metrics.

## Remaining Work

### P2: Append-only JSONL incremental parsing

Goal: an append to a large Claude/Codex JSONL should process only newly appended complete lines.

Expected design constraints:

- Store per-file cursor metadata, either on `sessions` or a dedicated ingest cursor table.
- Required cursor data: file path, file size, file mtime, last indexed offset, last indexed ordinal or line, file inode, file device, parser version.
- Detect truncate, rewrite, inode/device change, parser version change, and partial trailing line.
- Fall back to full file reparse whenever cursor safety is not proven.
- Keep fallback deterministic and compatible with existing parser output.

### P3: Production sync observability and throughput controls

Goal: debugging future high-memory/high-CPU incidents should not require `sample` and `lsof` as the first tools.

Expected design constraints:

- Extend scheduler/debug state with current file, current file size, current offset, write counts, largest file, max RSS sample, queue/coalesce behavior, and recent errors.
- Keep a bounded in-memory ring buffer of recent sync runs.
- Add a debug route such as `/api/v1/debug/sync` or an equivalent status surface.
- Emit one structured completion log per sync run.
- If parser concurrency or SQLite batching is introduced, it must be bounded by explicit config.

## Non-Goals

- Do not reintroduce concurrent unbounded sync work.
- Do not bypass the BFF trust boundary for frontend-facing routes.
- Do not replace the parser contract wholesale unless the plan proves compatibility.
- Do not optimize by increasing Node heap size.

## Suggested Plan Shape

1. Cursor schema and safety model.
2. Claude/Codex offset parser interfaces plus full-reparse fallback.
3. Append/upsert database write path for append-only updates.
4. Sync run history, debug endpoint, structured logs, and bounded throughput controls.
5. Regression and performance fixtures for append, truncate, rewrite, parser-version bump, partial line, and large-file behavior.

## Verification Expectations

- Existing Phase 15 performance tests keep passing.
- New tests prove append-only sync does not call full parser for already indexed lines.
- New tests prove unsafe cursor states fall back to full reparse.
- Migration tests cover old databases.
- Debug endpoint tests cover active run, recent history, errors, and RSS/write metrics.
- Full project `pnpm test:run`, `pnpm typecheck`, and `pnpm typecheck:ingest` pass before completion.
