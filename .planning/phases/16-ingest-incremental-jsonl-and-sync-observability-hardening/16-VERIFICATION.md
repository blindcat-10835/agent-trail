---
phase: 16-ingest-incremental-jsonl-and-sync-observability-hardening
status: passed
verified: 2026-05-15
requirements:
  - PERF-107
  - PERF-108
  - PERF-109
  - PERF-110
  - PERF-111
  - PERF-112
---

# Phase 16 Verification

## Goal

Complete the remaining Phase 15 optimization track by making active Claude/Codex JSONL appends incremental, making cursor fallback safe, and expanding sync observability from last-run status to production-debuggable run history.

## Checks

| Requirement | Status | Evidence |
|-------------|--------|----------|
| PERF-107 | passed | `decideCursorSync()` selects `incremental_append` only when cursor metadata proves append-only growth; Claude/Codex append parsers read from cursor byte offsets through the last complete JSONL line. |
| PERF-108 | passed | Cursor decisions detect missing cursor, force, snapshot failure, truncate, inode/device change, parser version change, invalid offset, same-size rewrite, and trailing partial lines; unsafe states fall back or skip without corrupting rows. |
| PERF-109 | passed | `appendSessionDeltaToDatabase()` writes messages, tool calls, result events, subagent links, and message turn boundary columns idempotently without deleting existing session-derived rows; replay regressions cover assembled turns and activities. |
| PERF-110 | passed | `/api/v1/debug/sync` and scheduler debug status expose active file, size, offset, recent run history, write counts, largest file, max RSS sample, duration, queue/coalesce state, and recent errors without JSONL content. |
| PERF-111 | passed | Scheduler emits one structured `ingest_sync_complete` JSON log per successful or failed run with reason, scope, files, write counts, duration, queue/coalesce, fallback, RSS, and error counters. |
| PERF-112 | passed | `INGEST_PARSE_CONCURRENCY`, `INGEST_SQLITE_BATCH_SIZE`, and `INGEST_SYNC_HISTORY_LIMIT` are validated with bounded ranges; runtime parsing remains serial by default. |

## Automated Evidence

- `pnpm vitest run tests/unit/ingest/db-migration.test.ts tests/unit/ingest/sync-cursor.test.ts tests/unit/ingest/sync-performance.test.ts` - passed.
- `pnpm vitest run tests/unit/ingest/claude-incremental-parser.test.ts tests/unit/ingest/codex-incremental-parser.test.ts tests/unit/ingest/sync-incremental.test.ts` - passed.
- `pnpm vitest run tests/unit/ingest/claude-parser.test.ts tests/unit/ingest/codex-parser.test.ts tests/fixtures/parser-regression/real-shape.test.ts tests/fixtures/parser-regression/claude-compact-boundary.test.ts tests/fixtures/parser-regression/codex-subagent-dag.test.ts` - passed.
- `pnpm vitest run tests/unit/ingest/db-migration.test.ts tests/unit/ingest/sync-incremental-write.test.ts tests/unit/ingest/sync-incremental.test.ts tests/unit/ingest/tool-persistence.test.ts tests/unit/ingest/turn-activity-regression.test.ts tests/unit/ingest/sync-performance.test.ts tests/unit/ingest/sync.test.ts` - passed.
- `pnpm vitest run tests/unit/ingest/sync-observability.test.ts tests/unit/ingest/sync-scheduler.test.ts tests/unit/ingest/config.test.ts tests/integration/ingest/api.test.ts ingest/api/overview.test.ts ingest/api/sources.test.ts` - passed.
- `pnpm typecheck:ingest` - passed.
- `pnpm typecheck` - passed.

## Broad Suite Note

`pnpm test:run` currently fails only in `ingest/src/watcher.test.ts` because chokidar emits `EMFILE: too many open files, watch` before expected file event callbacks fire. Rerunning `pnpm vitest run ingest/src/watcher.test.ts` reproduces the same watcher setup failure. This is recorded as an environment-level broad-suite blocker; the targeted Phase 16 cursor, parser, writer, scheduler, API, replay, and typecheck gates passed.

## Result

Phase 16 passed. The original P2/P3 ingest optimization scope is complete: safe appends no longer require repeated full JSONL reparses, cursor safety falls back conservatively, append writes are idempotent, and sync behavior is observable through structured logs and debug status.

## Follow-Up

Investigate the `ingest/src/watcher.test.ts` `EMFILE` broad-suite blocker before treating the full project test suite as green.
