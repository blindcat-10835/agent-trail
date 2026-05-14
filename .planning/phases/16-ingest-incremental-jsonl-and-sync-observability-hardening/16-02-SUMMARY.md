---
phase: 16-ingest-incremental-jsonl-and-sync-observability-hardening
plan: 02
subsystem: ingest
tags: [parser, incremental, claude-code, codex]
requires:
  - phase: 16-ingest-incremental-jsonl-and-sync-observability-hardening
    provides: 16-01 cursor decision foundation
provides:
  - Claude append parser
  - Codex append parser
  - sync candidate selection for incremental_append
affects: [ingest, sync, parser]
tech-stack:
  added: []
  patterns: [range-bounded JSONL parsing, full-reparse fallback on missing context]
key-files:
  created: [tests/unit/ingest/claude-incremental-parser.test.ts, tests/unit/ingest/codex-incremental-parser.test.ts, tests/unit/ingest/sync-incremental.test.ts]
  modified: [ingest/parser/claude.ts, ingest/parser/codex.ts, ingest/sync/index.ts]
key-decisions:
  - "Incremental parsers read only the supplied byte range and drop trailing partial lines."
  - "Missing turn/tool context returns requiresFullReparse instead of partial writes."
patterns-established:
  - "Append parser outputs IncrementalParseDelta and never writes directly."
requirements-completed: [PERF-107, PERF-108, PERF-112]
duration: 35min
completed: 2026-05-15
---

# Phase 16-02 Summary

**Claude and Codex append parsers that consume only newly appended complete JSONL lines**

## Accomplishments

- Added `parseClaudeSessionAppend()` and `parseCodexSessionAppend()`.
- Added byte-range JSONL readers that do not scan historical lines before the cursor offset.
- Wired safe cursor decisions to append parser selection in sync.

## Task Commits

1. **Incremental parser implementation** - `4fc7059`

## Verification

- `pnpm vitest run tests/unit/ingest/claude-incremental-parser.test.ts tests/unit/ingest/codex-incremental-parser.test.ts tests/unit/ingest/sync-incremental.test.ts` passed.
- `pnpm vitest run tests/unit/ingest/claude-parser.test.ts tests/unit/ingest/codex-parser.test.ts tests/fixtures/parser-regression/real-shape.test.ts tests/fixtures/parser-regression/claude-compact-boundary.test.ts tests/fixtures/parser-regression/codex-subagent-dag.test.ts` passed.
- `pnpm typecheck:ingest` passed.

## Deviations from Plan

Parser internals were not fully rewritten into a shared state-machine abstraction; the append path reuses existing helpers where practical and keeps full parser public behavior unchanged.

## Issues Encountered

Fixed one TypeScript nullable dedup check in Codex append parsing.

## User Setup Required

None.

## Next Phase Readiness

16-03 can persist `IncrementalParseDelta` with idempotent append writes.

## Self-Check: PASSED

---
*Phase: 16-ingest-incremental-jsonl-and-sync-observability-hardening*
*Completed: 2026-05-15*
