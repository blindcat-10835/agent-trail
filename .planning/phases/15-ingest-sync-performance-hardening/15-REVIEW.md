---
phase: 15-ingest-sync-performance-hardening
status: clean
reviewed: 2026-05-14
scope:
  - ingest/src/sync-scheduler.ts
  - ingest/src/watcher.ts
  - ingest/index.ts
  - ingest/api/sources.ts
  - ingest/api/overview.ts
  - ingest/sync/index.ts
  - ingest/types.ts
  - tests/unit/ingest/sync-scheduler.test.ts
  - tests/unit/ingest/sync-performance.test.ts
---

# Phase 15 Code Review

## Result

Status: clean after one review fix.

## Findings

### Fixed: active full-source duplicates were queued instead of coalesced

Severity: warning  
Files: `ingest/src/sync-scheduler.ts`, `tests/unit/ingest/sync-scheduler.test.ts`  
Fix commit: `a6fd6a1`

The initial scheduler implementation coalesced duplicate requests only while they were still queued. Once a matching full-source request became active, the queue key had already been removed, so a periodic request for the same source/options could queue an immediate duplicate run. That avoided overlap but still allowed back-to-back repeated full-source parsing on large JSONL files.

The fix tracks active queue items by key and returns the active run's Promise for duplicate requests. The regression test proves a periodic duplicate attaches to the background run and does not enqueue or call `syncSource` a second time.

## Residual Risk

Append-only JSONL cursor parsing is intentionally deferred. The current phase removes the observed memory amplification by serializing/coalescing sync entrypoints, preserving watcher paths, skipping unchanged files before parser work, and removing whole-file hash reads from the hot path. If real-world profiling still shows active-session append cost is high, the next optimization should add DB cursor fields and incremental line parsing.

## Verification

- `pnpm vitest run tests/unit/ingest/sync-scheduler.test.ts ingest/src/watcher.test.ts` - passed, 20 tests.
- `pnpm typecheck:ingest` - passed.
- `pnpm vitest run tests/unit/ingest tests/integration/ingest ingest/api ingest/src` - passed, 338 tests.
- `pnpm test:run` - passed, 53 files / 538 tests; 1 skipped file / 1 skipped test.
- `pnpm typecheck` - passed.
