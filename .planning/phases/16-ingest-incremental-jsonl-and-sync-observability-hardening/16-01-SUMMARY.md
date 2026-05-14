---
phase: 16-ingest-incremental-jsonl-and-sync-observability-hardening
plan: 01
subsystem: ingest
tags: [sqlite, cursor, jsonl, sync]
requires:
  - phase: 15-ingest-sync-performance-hardening
    provides: pre-parse skip cache and sync metrics baseline
provides:
  - ingest_file_cursors schema and v11 migration foundation
  - file identity snapshots with inode/device
  - cursor decision helper for skip/incremental/full-reparse
affects: [ingest, sync, parser]
tech-stack:
  added: []
  patterns: [append-only cursor decision before parser work]
key-files:
  created: [tests/unit/ingest/sync-cursor.test.ts]
  modified: [ingest/db/schema.sql, ingest/db/index.ts, ingest/parser/types.ts, ingest/sync/index.ts, tests/unit/ingest/db-migration.test.ts]
key-decisions:
  - "Use source_type + file_path as cursor primary key so one physical log maps to one cursor."
  - "Require inode/device stability before using append-only parsing."
patterns-established:
  - "Cursor decision returns explicit skip_unchanged, incremental_append, or full_reparse result."
requirements-completed: [PERF-107, PERF-108]
duration: 15min
completed: 2026-05-15
---

# Phase 16-01 Summary

**Append-safe cursor foundation for Claude/Codex JSONL sync**

## Performance

- **Started:** 2026-05-14T15:06:50Z
- **Completed:** 2026-05-14T15:12:00Z
- **Tasks:** 4
- **Files modified:** 6

## Accomplishments

- Added `ingest_file_cursors` and migration target v11.
- Added cursor/snapshot/incremental parse types.
- Added safe cursor decisions for unchanged, append, force, truncate, identity change, parser version change, unreadable snapshot, invalid offset, and partial-line handling.

## Task Commits

1. **Cursor schema and decision foundation** - `b0ffc5e`

## Verification

- `pnpm vitest run tests/unit/ingest/db-migration.test.ts tests/unit/ingest/sync-cursor.test.ts tests/unit/ingest/sync-performance.test.ts` passed.
- `pnpm typecheck:ingest` passed.

## Deviations from Plan

None.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

16-02 can consume cursor decisions to select append parsers.

## Self-Check: PASSED

---
*Phase: 16-ingest-incremental-jsonl-and-sync-observability-hardening*
*Completed: 2026-05-15*
