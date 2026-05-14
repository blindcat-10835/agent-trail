---
phase: 15-ingest-sync-performance-hardening
plan: 02
subsystem: ingest
tags: [sync, parser, sqlite, hash, performance]
requires:
  - phase: 15-ingest-sync-performance-hardening
    provides: scheduler and path-aware watcher handoff from 15-01
provides:
  - path-scoped `syncPaths()`
  - pre-parse metadata skip
  - chunked file hashing without whole-file `readFileSync`
affects: [ingest, sync, codex, claude-code, openclaw]
tech-stack:
  added: []
  patterns: [pre-parse metadata skip, chunked sync hashing]
key-files:
  created:
    - tests/unit/ingest/sync-performance.test.ts
  modified:
    - ingest/sync/index.ts
    - tests/unit/ingest/sync.test.ts
    - tests/unit/ingest/codex-relationships.test.ts
key-decisions:
  - "Pre-parse skip uses file_path, file_size, file_mtime, and parser cache version."
  - "Hashing remains synchronous for compatibility but reads files in 1MB chunks instead of one whole Buffer."
patterns-established:
  - "Watcher hot path uses `syncPaths()` to avoid full source discovery and Codex relationship scans."
requirements-completed: [PERF-102, PERF-104, PERF-105, TEST-103]
duration: 1h
completed: 2026-05-14
---

# Phase 15 Plan 02: Path Sync + Pre-Parse Skip Summary

**Path-scoped sync with unchanged-file parser bypass and chunked file hashing**

## Performance

- **Duration:** 1h
- **Started:** 2026-05-14T12:50:00Z
- **Completed:** 2026-05-14T13:50:23Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added `syncPaths(sourceType, paths, options)` for changed-session-file sync.
- Added metrics for files considered, skipped before parse, parsed, and largest file size.
- Added pre-parse skip before parser allocation for unchanged files with current parser cache hash.
- Replaced `fs.readFileSync()` hashing with chunked `fs.readSync()` hashing.
- Prevented path-scoped Codex sync from running full `collectCodexRelationships()`.

## Task Commits

1. **Task 1-3: Path sync, pre-parse skip, chunked hash** - `0c71059` (`fix(15)`)

**Plan metadata:** pending docs commit

## Files Created/Modified

- `ingest/sync/index.ts` - sync metrics, pre-parse skip, `syncPaths()`, chunked hash.
- `tests/unit/ingest/sync-performance.test.ts` - path sync and pre-parse skip tests.
- `tests/unit/ingest/sync.test.ts` - global cleanup around sync tests.

## Decisions Made

- Full append-only JSONL cursor/upsert was deferred because P0/P1 remove the immediate amplification path.
- Chunked sync hash avoided an async rewrite of the existing synchronous DB write path.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial unit tests tried to spy on ESM `fs.existsSync` and use `openDatabase()` while `fs/promises` was mocked. The fix was to move performance-specific tests to a separate real-files test file.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 15-03. Sync work now produces metrics that health/debug surfaces can expose.

---
*Phase: 15-ingest-sync-performance-hardening*
*Completed: 2026-05-14*
