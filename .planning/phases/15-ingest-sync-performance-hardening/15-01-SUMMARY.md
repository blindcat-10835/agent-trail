---
phase: 15-ingest-sync-performance-hardening
plan: 01
subsystem: ingest
tags: [sync, watcher, scheduler, performance]
requires:
  - phase: 10-rich-ingest-metrics
    provides: existing ingest schema, sync APIs, watcher, and health status surfaces
provides:
  - path-aware watcher callback contract
  - serialized/coalesced ingest sync scheduler
  - scheduler-routed startup, watcher, background, periodic, and manual sync entrypoints
affects: [ingest, sync, watcher, health]
tech-stack:
  added: []
  patterns: [single in-process sync scheduler, path-scoped watcher handoff]
key-files:
  created:
    - ingest/src/sync-scheduler.ts
    - tests/unit/ingest/sync-scheduler.test.ts
  modified:
    - ingest/index.ts
    - ingest/src/watcher.ts
    - ingest/src/watcher.test.ts
    - ingest/api/sources.ts
    - ingest/types.ts
key-decisions:
  - "Watcher now emits changed paths instead of discarding them at debounce flush."
  - "Startup warmup runs before watcher start; background, watcher, periodic, and manual sync go through the scheduler."
patterns-established:
  - "All ingest sync entrypoints use scheduler enqueue methods rather than starting parallel full syncs directly."
requirements-completed: [PERF-101, PERF-102, PERF-103, PERF-106]
duration: 1h
completed: 2026-05-14
---

# Phase 15 Plan 01: Sync Scheduler + Watcher Path Handoff Summary

**Serialized ingest sync entrypoints with path-aware watcher handoff and periodic no-reentry protection**

## Performance

- **Duration:** 1h
- **Started:** 2026-05-14T12:50:00Z
- **Completed:** 2026-05-14T13:50:23Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added `createSyncScheduler()` with active/queued status, coalescing, duration, error, and sync metrics fields.
- Changed watcher debounce from source-only callback to `sourceType + paths`.
- Routed startup warmup, background sync, watcher changes, periodic resync, and manual source sync through scheduler control.
- Tightened coalescing so duplicate requests also attach to an already active matching sync run instead of queueing an immediate duplicate full-source run.

## Task Commits

1. **Task 1-3: Scheduler, watcher path handoff, entrypoint routing** - `0c71059` (`fix(15)`)
2. **Code review fix: Active-run duplicate coalescing** - `a6fd6a1` (`fix(15)`)

**Plan metadata:** pending docs commit

## Files Created/Modified

- `ingest/src/sync-scheduler.ts` - in-process sync scheduler.
- `ingest/src/watcher.ts` - path-aware debounce callback and separate periodic callback.
- `ingest/index.ts` - scheduler creation, health status enrichment, startup order change.
- `ingest/api/sources.ts` - manual sync route uses scheduler when service context exists.
- `ingest/src/watcher.test.ts` - path payload and periodic callback expectations.
- `tests/unit/ingest/sync-scheduler.test.ts` - scheduler serialization/coalescing/error tests.

## Decisions Made

- Scheduler is local in-process state; no external queue or dependency was added.
- Watcher is created during startup but started only after warmup to avoid foreground indexing overlap.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 15-02. The sync layer can now receive path-scoped work from scheduler/watcher.

---
*Phase: 15-ingest-sync-performance-hardening*
*Completed: 2026-05-14*
