---
quick_id: 260515-tn5
status: complete
completed: 2026-05-15
commit: 24df3f4
---

# Quick Task 260515-tn5 Summary

## Goal

Implement Codex regular full sync as directory consistency checking without a source-wide relationship JSONL scan, and change the periodic resync fallback to 15 minutes while preserving manual refresh.

## Changes

- Removed the up-front `collectCodexRelationships(sources)` call from regular `syncCodexSource()`.
- Added local Codex relationship collection from parsed full-session and incremental append results.
- Added lightweight DB-backed relationship consistency backfill from `subagent_links`, so manual/periodic full sync can repair stale child session rows without reading all Codex JSONL content.
- Changed default `INGEST_RESYNC_INTERVAL_MS` from 5 minutes to 15 minutes.
- Updated ingest docs in Chinese and English to describe scheduler/path-scoped sync and directory-consistency resync behavior.

## Verification

- `pnpm vitest run tests/unit/ingest/sync-performance.test.ts tests/unit/ingest/codex-relationships.test.ts tests/unit/ingest/sync.test.ts`
- `pnpm vitest run tests/unit/ingest/sync-incremental-write.test.ts tests/unit/ingest/sync-incremental.test.ts tests/unit/ingest/sync-cursor.test.ts tests/unit/ingest/codex-incremental-parser.test.ts tests/unit/ingest/sync-scheduler.test.ts ingest/src/watcher.test.ts tests/unit/bff/sync-route.test.ts`
- `pnpm typecheck:ingest`
- `pnpm typecheck`
