---
phase: 08-real-data-parser-tool-persistence-and-sync-refresh-repair
plan: "05"
title: Target-session verification and regression closure
subsystem: test-verification
tags:
  - verification
  - target-sessions
  - regression
  - phase8-closure
dependency_graph:
  requires:
    - real-shape-fixture-corpus
    - claude-tool-result-pairing
    - codex-function-call-output-as-response-item
    - transactional-session-writes
    - stable-message-ids
    - force-reparse-path
    - sync-first-right-rail-refresh
  provides:
    - phase8-regression-test-suite
    - extended-local-corpus-phase8-tags
    - phase8-verification-notes
  affects:
    - tests/unit/ingest/phase8-regression.test.ts
    - tests/local/real-session-corpus.test.ts
    - .planning/phases/08-real-data-parser-tool-persistence-and-sync-refresh-repair/08-VERIFICATION-NOTES.md
tech_stack:
  added: []
  patterns:
    - In-memory SQLite + temp JSONL files for deterministic end-to-end regression tests
    - DB-backed tag-conditional assertions in opt-in local corpus harness
    - count(*) = count(id) pattern for NULL id regression coverage
key_files:
  created:
    - tests/unit/ingest/phase8-regression.test.ts
    - .planning/phases/08-real-data-parser-tool-persistence-and-sync-refresh-repair/08-VERIFICATION-NOTES.md
  modified:
    - tests/local/real-session-corpus.test.ts
decisions:
  - "Phase 8 regression tests use temp JSONL files + in-memory SQLite to avoid local corpus dependency — runs in CI without RUN_REAL_SESSION_TESTS"
  - "force sync test asserts tool_calls count = 1 (not > 1) to detect spurious duplicates from multiple force-sync calls"
  - "Local corpus harness tag additions use createCorpusTestDb helper pattern consistent with existing unit tests"
  - "claude-subagent tag is explicitly scoped to claude-code source only — identical behavior to has-subagent but with semantic specificity"
  - "Verification notes document skipped local corpus as expected outcome — not a failure condition"
metrics:
  duration: "8m"
  completed: "2026-05-09"
  tasks_completed: 5
  files_created: 2
  files_modified: 1
  tests_added: 12
  tests_passing: 152
---

# Phase 08 Plan 05: Target-Session Verification and Regression Closure Summary

## One-Liner

Deterministic end-to-end regression test suite for Phase 8 fixes (null message IDs, tool persistence, force sync discoverability) plus DB-backed local corpus tag extensions.

## What Was Built

### Task 1: Phase 8 Regression Test Suite (`tests/unit/ingest/phase8-regression.test.ts`)

12 end-to-end regression tests covering all user-reported failures, organized into 6 describe groups:

**Group 1: messages.id non-null (606dac00 class)**
- Claude JSONL parsed and synced: `COUNT(*) = COUNT(id)` assertion on messages table
- Codex JSONL parsed and synced: same assertion

**Group 2: Claude tool_result pairing**
- `tool_use` in assistant + `tool_result` in user produces `tool_calls` row (tool_id, name) and `tool_result_events` row (content)
- Force sync re-populates tool_calls exactly once — no duplicates

**Group 3: Codex function_call_output**
- `function_call` + `event_msg function_call_output` produces `tool_calls.count > 0` and `tool_result_events.count > 0`
- `function_call_output` as `response_item` (not event_msg) also pairs correctly

**Group 4: Codex custom_tool_call**
- `custom_tool_call` + `event_msg custom_tool_call_output` produces structured tool call with result events in DB

**Group 5: Session discoverability (effac644 class)**
- Session in sessions table by id after initial sync
- Session still discoverable after force sync (the regression behavior)
- Session appears in list-style SELECT after force sync

**Group 6: assembleTurns surfaces tool activities from DB**
- Claude session: `assembleTurns()` returns turns with tool call activities including result events
- Codex session: same

All tests use temporary JSONL files (created in `beforeEach` tmpdir, deleted in `afterEach`) and in-memory SQLite. No external services or real session files required.

### Task 2: Local Corpus Harness Phase 8 Tags

Extended `tests/local/real-session-corpus.test.ts` with 5 new tag handlers:

| Tag | Source | Assertion |
|-----|--------|-----------|
| `claude-key-null-risk` | claude-code | `COUNT(*) = COUNT(id)` for messages after force sync |
| `claude-discoverability` | claude-code | Session in sessions table after initial sync + force sync |
| `codex-function-output` | codex | `tool_calls > 0` and `tool_result_events > 0` after sync |
| `codex-custom-tool` | codex | `tool_calls > 0` after sync |
| `claude-subagent` | claude-code | At least one `subagent_link` activity |

Added `createCorpusTestDb()` helper and imported `writeSessionToDatabase`, `better-sqlite3`, `readFileSync` for DB-backed assertions. All new tag handlers skip gracefully when source doesn't match or file is absent.

### Task 3: Force Reparse Verification

Force reparse verification is embedded in the phase8-regression.test.ts tests:
- `writeSessionToDatabase(parseResult, db, undefined, { force: true })` called explicitly in multiple tests
- `force: true` path verified to: delete derived rows, re-insert all tool data, not duplicate records, keep session discoverable

### Task 4: 08-VERIFICATION-NOTES.md

Recorded in `.planning/phases/08-real-data-parser-tool-persistence-and-sync-refresh-repair/08-VERIFICATION-NOTES.md`:
- All commands run and their results
- DB assertion summaries with exact SQL for each regression class
- Local corpus skipped (no manifest present) — documented as expected
- Manual smoke test steps for when dev servers are available
- Phase 8 completion table mapping each reported issue to its plan and fix

### Task 5: Manual Smoke (Dev Server Not Running)

Steps documented in `08-VERIFICATION-NOTES.md` for when dev servers are available. The smoke test covers:
- Target Claude session replay showing structured tool blocks
- Browser console `key=null` warning absence
- Force sync via right-rail refresh button showing spinner
- Session reappearance after force sync

## Deviations from Plan

None — plan executed as written. The force reparse verification (Task 3) is fully covered by the regression tests in Task 1, as planned.

## Known Stubs

None. All regression tests assert real behavior end-to-end through parser → sync → DB → (assembleTurns where applicable).

## Threat Flags

None. This plan only adds test files and documentation — no new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

All created files exist and all commits are present:
- `aa3212d` test(08-05): add phase8 regression tests for null message ids and tool persistence
- `d63f38c` feat(08-05): extend local corpus harness with Phase 8 target-session tags
- `ab19ed6` docs(08-05): add Phase 8 verification notes with DB assertion summaries

Files verified:
- `tests/unit/ingest/phase8-regression.test.ts` — EXISTS
- `tests/local/real-session-corpus.test.ts` — EXISTS (modified)
- `.planning/phases/08-real-data-parser-tool-persistence-and-sync-refresh-repair/08-VERIFICATION-NOTES.md` — EXISTS

Test counts:
- Phase 8 regression tests: 12 new tests, all passing
- Total ingest tests: 152 passing (11 test files)
