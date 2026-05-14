---
phase: 16-ingest-incremental-jsonl-and-sync-observability-hardening
plan: 04
subsystem: ingest
tags: [observability, scheduler, debug-api, config]
requires:
  - phase: 16-ingest-incremental-jsonl-and-sync-observability-hardening
    provides: 16-01 through 16-03 incremental sync path
provides:
  - sync debug endpoint
  - scheduler active-run and recent-run history
  - structured sync completion logs
  - bounded throughput config docs
affects: [ingest, api, docs]
tech-stack:
  added: []
  patterns: [bounded in-memory run history, metadata-only debug payloads]
key-files:
  created: [tests/unit/ingest/config.test.ts, tests/unit/ingest/sync-observability.test.ts]
  modified: [ingest/src/sync-scheduler.ts, ingest/sync/index.ts, ingest/index.ts, ingest/config/index.ts, docs/CONFIGURATION.md, docs/services/ingest.md, tests/unit/ingest/sync-scheduler.test.ts, tests/integration/ingest/api.test.ts]
key-decisions:
  - "Keep parse concurrency default at 1; expose bounded config without enabling unbounded fan-out."
  - "Debug status reports metadata only: file path, size, offset, counters, RSS, and durations."
patterns-established:
  - "Scheduler owns run history and structured completion logging."
requirements-completed: [PERF-110, PERF-111, PERF-112, PERF-107, PERF-108, PERF-109]
duration: 45min
completed: 2026-05-15
---

# Phase 16-04 Summary

**Production-debuggable incremental ingest with active-run status, recent history, and bounded throughput config**

## Accomplishments

- Added active file/offset/RSS/write-count reporting through scheduler status.
- Added bounded recent-run history and `/api/v1/debug/sync`.
- Added one structured completion log per scheduler run.
- Added `INGEST_PARSE_CONCURRENCY`, `INGEST_SQLITE_BATCH_SIZE`, and `INGEST_SYNC_HISTORY_LIMIT` validation and docs.

## Task Commits

1. **Observability, debug API, config, docs** - `96946aa`

## Verification

- `pnpm vitest run tests/unit/ingest/sync-cursor.test.ts tests/unit/ingest/claude-incremental-parser.test.ts tests/unit/ingest/codex-incremental-parser.test.ts tests/unit/ingest/sync-incremental.test.ts tests/unit/ingest/sync-incremental-write.test.ts tests/unit/ingest/sync-observability.test.ts` passed.
- `pnpm vitest run tests/unit/ingest/sync-performance.test.ts tests/unit/ingest/sync.test.ts tests/unit/ingest/sync-scheduler.test.ts ingest/api/overview.test.ts ingest/api/sources.test.ts tests/integration/ingest/api.test.ts` passed.
- `pnpm typecheck:ingest` passed.
- `pnpm typecheck` passed.

## Deviations from Plan

No parser concurrency was enabled. The bounded config is present and documented, but runtime parsing remains serial by default.

## Issues Encountered

`pnpm test:run` failed only in `ingest/src/watcher.test.ts` with `EMFILE: too many open files, watch`; rerunning that single test file reproduced the same chokidar watch setup failure. Phase 16 targeted gates and typechecks passed.

## User Setup Required

None.

## Next Phase Readiness

Phase 16 is ready for verification/review. Remaining broad-suite blocker is environmental watcher resource behavior, not the incremental ingest path.

## Self-Check: PASSED

---
*Phase: 16-ingest-incremental-jsonl-and-sync-observability-hardening*
*Completed: 2026-05-15*
