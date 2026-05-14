# Phase 16 Pattern Map

## Existing Patterns To Preserve

| New/Changed Area | Closest Existing Analog | Pattern To Reuse |
|------------------|-------------------------|------------------|
| Cursor migration | `ingest/db/index.ts`, `ingest/db/schema.sql`, `tests/unit/ingest/db-migration.test.ts` | Additive migration steps, tolerate duplicate-column/table errors, bump `user_version`, test old DB upgrade. |
| Sync decision helper | `shouldSkipBeforeParse()` in `ingest/sync/index.ts` | Decide cheap file metadata before parser allocation. Keep `force=true` override. |
| Candidate parsing | `parseAndWriteCandidate()` in `ingest/sync/index.ts` | Centralize per-file sync flow and merge `SyncResult` metrics. |
| Path-scoped sync | `syncPaths()` in `ingest/sync/index.ts` | Restrict watcher hot path to explicit files under configured roots. |
| Scheduler status | `ingest/src/sync-scheduler.ts` | Keep state in the scheduler, expose via immutable `getStatus()` snapshots. |
| Health/status routes | `/health`, `/api/v1/overview/status`, `/api/v1/sources/:type/status` | Add fields without removing existing response keys. |
| Parser tests | `tests/unit/ingest/claude-parser.test.ts`, `tests/unit/ingest/codex-parser.test.ts` | Use temp JSONL fixtures and assert canonical parser output. |
| Sync performance tests | `tests/unit/ingest/sync-performance.test.ts` | Mock parser modules to prove parser invocation counts. |
| Activity persistence | `tests/unit/ingest/tool-persistence.test.ts`, `tests/unit/ingest/turn-activity-regression.test.ts` | Assert SQLite rows and replay assembly, not only `SyncResult` counters. |

## Files Likely To Change

- `ingest/db/schema.sql`
- `ingest/db/index.ts`
- `ingest/parser/types.ts`
- `ingest/parser/claude.ts`
- `ingest/parser/codex.ts`
- `ingest/sync/index.ts`
- `ingest/src/sync-scheduler.ts`
- `ingest/types.ts`
- `ingest/index.ts`
- `ingest/api/overview.ts`
- `ingest/api/sources.ts`
- optional `ingest/api/debug.ts`
- `ingest/config/index.ts`
- `docs/CONFIGURATION.md`
- `docs/services/ingest.md`
- new tests under `tests/unit/ingest/`

## Execution Notes

- Keep the existing full parser and replacement writer as the fallback path.
- Do not delete Phase 15 pre-parse skip; cursor append is an additional fast path for changed files.
- Prefer a dedicated cursor module or helper section in `ingest/sync/index.ts` before extracting broader abstractions.
- Keep `/health` compatible; put richer incident diagnostics under `/api/v1/debug/sync` or under an additive `sync.debug` object.
- Avoid unbounded worker pools. If batching is introduced, parse and validate numeric env vars in `ingest/config/index.ts`.
