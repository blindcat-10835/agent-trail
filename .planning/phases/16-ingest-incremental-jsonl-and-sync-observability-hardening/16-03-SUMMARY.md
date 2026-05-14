---
phase: 16-ingest-incremental-jsonl-and-sync-observability-hardening
plan: 03
subsystem: ingest
tags: [sqlite, append-writer, idempotency, replay]
requires:
  - phase: 16-ingest-incremental-jsonl-and-sync-observability-hardening
    provides: 16-02 IncrementalParseDelta producers
provides:
  - idempotent append delta writer
  - cursor update in same transaction as append writes
  - unique indexes for append replay safety
affects: [ingest, sqlite, replay]
tech-stack:
  added: []
  patterns: [transactional cursor advancement after durable append writes]
key-files:
  created: [tests/unit/ingest/sync-incremental-write.test.ts]
  modified: [ingest/db/schema.sql, ingest/db/index.ts, ingest/sync/index.ts, tests/unit/ingest/db-migration.test.ts, tests/unit/ingest/turn-activity-regression.test.ts]
key-decisions:
  - "Use unique indexes for tool calls, result events, and subagent links to make delta replay idempotent."
  - "Advance ingest_file_cursors only after append rows commit."
patterns-established:
  - "Full replacement writer remains the fallback; append writer never deletes existing session-derived rows."
requirements-completed: [PERF-109, PERF-112]
duration: 40min
completed: 2026-05-15
---

# Phase 16-03 Summary

**Incremental append deltas persist idempotently without whole-session delete/reinsert**

## Accomplishments

- Added unique idempotency constraints for `tool_calls`, `tool_result_events`, and `subagent_links`.
- Added `appendSessionDeltaToDatabase()` for message/tool/result/subagent append writes.
- Updated full parse fallback to seed/update cursor rows with fallback reason.
- Added replay regression proving append-written rows assemble into turns and activities.

## Task Commits

1. **Append writer and idempotency constraints** - `99cdc3d`

## Verification

- `pnpm vitest run tests/unit/ingest/db-migration.test.ts tests/unit/ingest/sync-incremental-write.test.ts tests/unit/ingest/sync-incremental.test.ts tests/unit/ingest/tool-persistence.test.ts tests/unit/ingest/turn-activity-regression.test.ts tests/unit/ingest/sync-performance.test.ts tests/unit/ingest/sync.test.ts` passed.
- `pnpm typecheck:ingest` passed.

## Deviations from Plan

None.

## Issues Encountered

Fixed a cursor decision default-parameter bug where `getDatabase()` could run before fallback parsing when a snapshot was unavailable.

## User Setup Required

None.

## Next Phase Readiness

16-04 can expose scheduler/debug status and final regression gates.

## Self-Check: PASSED

---
*Phase: 16-ingest-incremental-jsonl-and-sync-observability-hardening*
*Completed: 2026-05-15*
