---
phase: 16-ingest-incremental-jsonl-and-sync-observability-hardening
status: clean
reviewed: 2026-05-15
depth: standard
files_reviewed: 15
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
scope:
  - ingest/db/schema.sql
  - ingest/db/index.ts
  - ingest/parser/types.ts
  - ingest/parser/claude.ts
  - ingest/parser/codex.ts
  - ingest/sync/index.ts
  - ingest/src/sync-scheduler.ts
  - ingest/index.ts
  - ingest/types.ts
  - ingest/api/overview.ts
  - ingest/api/sources.ts
  - ingest/config/index.ts
  - docs/CONFIGURATION.md
  - docs/services/ingest.md
  - tests/unit/ingest
---

# Phase 16 Code Review

## Result

Status: clean.

## Review Scope

Reviewed the Phase 16 ingest changes that affect cursor safety, incremental parser selection, append persistence, scheduler observability, debug API output, bounded config, and the related regression tests.

## Findings

No blocking, warning, or informational code findings were found in the reviewed Phase 16 scope.

## Residual Risk

- `pnpm test:run` is not green because `ingest/src/watcher.test.ts` fails during chokidar watch setup with `EMFILE: too many open files, watch`. The single-file rerun reproduces the same environment-level watcher failure.
- Existing replay currently assembles turns from `messages.turn_id` / `messages.turn_index` and activity tables at query time. Phase 16 append writes preserve those message boundaries and avoid deleting `turns`; it does not introduce new writes to the currently unused `turns` table.
- First append after upgrading an existing database may still full-reparse once for files that have no cursor row yet; subsequent safe appends use the incremental cursor path.

## Verification

- `pnpm vitest run tests/unit/ingest/sync-cursor.test.ts tests/unit/ingest/claude-incremental-parser.test.ts tests/unit/ingest/codex-incremental-parser.test.ts tests/unit/ingest/sync-incremental.test.ts tests/unit/ingest/sync-incremental-write.test.ts tests/unit/ingest/sync-observability.test.ts` - passed.
- `pnpm vitest run tests/unit/ingest/sync-performance.test.ts tests/unit/ingest/sync.test.ts tests/unit/ingest/sync-scheduler.test.ts ingest/api/overview.test.ts ingest/api/sources.test.ts tests/integration/ingest/api.test.ts` - passed.
- `pnpm typecheck:ingest` - passed.
- `pnpm typecheck` - passed.
- `pnpm test:run` - failed only in `ingest/src/watcher.test.ts` with `EMFILE: too many open files, watch`; single-file rerun reproduced the same failure.
