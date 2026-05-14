# Phase 15 Validation Strategy

**Phase:** 15 - Ingest Sync Performance Hardening  
**Created:** 2026-05-14  
**Source:** `15-RESEARCH.md`

## Critical Failure Modes

1. Watcher still discards changed paths and triggers full source sync.
2. Periodic resync still starts while another sync is active.
3. Startup background sync and watcher sync overlap.
4. Unchanged files still enter parser before skip logic.
5. Large JSONL files are still hashed with whole-file `readFileSync()`.
6. Health/debug output still reports idle while scheduler is active.

## Required Checks

- Unit test watcher path payload and debounce batching.
- Unit test scheduler serialization and coalescing.
- Unit test path-scoped sync classification and non-session-file ignore behavior.
- Unit test pre-parse skip prevents parser mocks from being called.
- Static or unit check that `computeFileHash()` uses streaming read or that hash is not invoked for unchanged hot-path files.
- Ingest typecheck.
- Existing ingest unit and integration tests.

## Acceptance Gate

Phase 15 is complete only when all Phase 15 plans pass their listed verification commands and the debug policy acceptance criteria in `.planning/debug/ingest-memory-performance-fix-policy.md` are satisfied for P0/P1 scope.
