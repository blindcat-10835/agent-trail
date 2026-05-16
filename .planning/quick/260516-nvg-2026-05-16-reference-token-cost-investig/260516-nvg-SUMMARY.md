---
quick_id: 260516-nvg
status: complete
completed: 2026-05-16
commit: a8f60fe
---

# Quick Task 260516-nvg Summary

## Goal

Repair token calculation for OpenClaw, Claude Code, and Codex after reviewing the local token/cost investigation notes.

## Changes

- Extended canonical token metrics to include cache read, cache write, reasoning, total tokens, and additive/overlap usage semantics.
- Added session-level SQLite columns and v13 migration for cache/read/write/reasoning/authoritative total token summaries.
- Updated Claude Code parsing to count Anthropic `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, and `cache_read_input_tokens` as additive channels.
- Updated Codex parsing to preserve `cached_input_tokens`, `reasoning_output_tokens`, and upstream `total_tokens` with overlap semantics.
- Fixed incremental append writes so Codex `token_count` deltas update session totals even when no message row carries token usage, while preserving replay idempotency.
- Updated session, overview, model, project, and turn aggregation paths to use authoritative totals with legacy input/output fallback.
- Added parser, migration, and append-writer regression tests for the corrected token channels.

## Verification

- `pnpm typecheck:ingest`
- `pnpm vitest run tests/unit/ingest/claude-parser.test.ts tests/unit/ingest/codex-parser.test.ts tests/unit/ingest/codex-incremental-parser.test.ts tests/unit/ingest/sync-incremental-write.test.ts tests/unit/ingest/db-migration.test.ts`
- `pnpm vitest run ingest/api/overview.test.ts tests/unit/ingest/sessions-api.test.ts tests/unit/ingest/sync.test.ts tests/unit/ingest/sync-incremental.test.ts tests/unit/ingest/tool-persistence.test.ts tests/unit/ingest/turns.test.ts`
- `pnpm typecheck`
