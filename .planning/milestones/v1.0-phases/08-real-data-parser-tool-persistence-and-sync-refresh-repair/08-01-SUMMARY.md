---
phase: 08-real-data-parser-tool-persistence-and-sync-refresh-repair
plan: "01"
title: Real-shape fixture corpus and opt-in local session harness
subsystem: test-infrastructure
tags:
  - fixtures
  - local-corpus
  - privacy
  - parser-regression
dependency_graph:
  requires: []
  provides:
    - real-shape-fixture-corpus
    - opt-in-local-corpus-harness
    - codex-parser-real-payload-fixes
  affects:
    - ingest/parser/codex.ts
    - tests/fixtures/parser-regression/
tech_stack:
  added: []
  patterns:
    - Redacted real-shape JSONL fixture corpus with documented rules
    - Opt-in env-gated local corpus smoke tests (RUN_REAL_SESSION_TESTS=1)
key_files:
  created:
    - tests/fixtures/real-shape/README.md
    - tests/fixtures/real-shape/claude/tool-result.jsonl
    - tests/fixtures/real-shape/claude/thinking.jsonl
    - tests/fixtures/real-shape/claude/compact.jsonl
    - tests/fixtures/real-shape/codex/function-call-output.jsonl
    - tests/fixtures/real-shape/codex/custom-tool.jsonl
    - tests/fixtures/real-shape/codex/reasoning-web-search.jsonl
    - tests/fixtures/parser-regression/real-shape.test.ts
    - .local/real-session-corpus.example.json
    - tests/local/real-session-corpus.test.ts
  modified:
    - ingest/parser/codex.ts
    - .gitignore
    - package.json
decisions:
  - "Fixtures use redacted synthetic IDs and [REDACTED] placeholders — never commit real prompt/output content"
  - "Codex reasoning and web_search_call silently ignored (no canonical message produced) — prevents unknown-type warning spam"
  - "Codex custom_tool_call treated identically to function_call (same TraceToolCall pipeline)"
  - "function_call_output content uses ev.output || ev.content fallback to handle both real and synthetic fixtures"
  - "Local corpus test uses for...of at module scope (not inside describe) to avoid illegal continue statement"
metrics:
  duration: "6m"
  completed: "2026-05-08"
  tasks_completed: 7
  files_created: 10
  files_modified: 3
  tests_added: 25
  tests_passing: 66
---

# Phase 08 Plan 01: Real-Shape Fixture Corpus and Opt-in Local Session Harness Summary

## One-Liner

Privacy-safe redacted fixture corpus covering Claude tool_result/thinking/compact and Codex function_call_output/custom_tool_call/reasoning formats, with structural regression tests and an env-gated local corpus harness.

## What Was Built

### Fixture Corpus (`tests/fixtures/real-shape/`)

Seven committed fixtures documenting the real JSONL envelope shapes observed in the 2026-05-08 investigation:

- **Claude `tool-result.jsonl`**: assistant `tool_use` block with `id: toolu_rs01` + user `tool_result` with matching `tool_use_id`
- **Claude `thinking.jsonl`**: assistant message with `thinking` block interleaved with `text`
- **Claude `compact.jsonl`**: `isCompactSummary: true` compact boundary with `truncatedUuids` array and surrounding messages
- **Codex `function-call-output.jsonl`**: `function_call` + `function_call_output` using `output` field (not `content`)
- **Codex `custom-tool.jsonl`**: `custom_tool_call` + `custom_tool_call_output` envelope
- **Codex `reasoning-web-search.jsonl`**: `reasoning` and `web_search_call` response_item types

All fixtures use synthetic IDs (`rs-*`), `[REDACTED]` content, and `/redacted/path` paths per the rules in `README.md`.

### Parser Regression Tests (`tests/fixtures/parser-regression/real-shape.test.ts`)

25 structural assertions covering all 6 fixture files. Tests assert:

- Parser does not throw
- No unknown-type warnings for known real payload types
- Tool calls and tool results pair by ID
- Compact boundary produces system message + `isTruncated: true`
- thinking blocks produce at least one assistant message
- Messages are preserved before and after compact boundary

### Opt-in Local Corpus Harness

- **`.local/real-session-corpus.example.json`**: Schema with comments and fake paths/IDs for users to copy
- **`tests/local/real-session-corpus.test.ts`**: Skip-by-default, activates with `RUN_REAL_SESSION_TESTS=1`; loads `.local/real-session-corpus.json` manifest; skips per-session if file absent; asserts structural invariants + tag-conditional checks (`has-tool-calls`, `has-subagent`, `has-compact`)
- **`.gitignore`**: `.local/real-session-corpus.json` added
- **`package.json`**: `test:real-sessions` script added

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Codex `function_call_output` used `ev.content` but real logs use `ev.output`**
- **Found during:** Task 3 (running regression test)
- **Issue:** The Codex parser read `ev.content || ''` for `function_call_output` result events, but real Codex JSONL logs use the `output` field. Result events had empty content.
- **Fix:** Changed to `ev.output || ev.content || ''` — falls back gracefully for older synthetic fixtures
- **Files modified:** `ingest/parser/codex.ts` (line ~413)
- **Commit:** 4f75c7d

**2. [Rule 2 - Missing Functionality] Codex `custom_tool_call` not handled**
- **Found during:** Task 3
- **Issue:** `custom_tool_call` response_item type fell through to the "unknown" warning branch, produced no `TraceToolCall`, and emitted a warning for every occurrence
- **Fix:** Added `custom_tool_call` handler before the unknown-type fallback; follows identical pipeline as `function_call` (TraceToolCall + toolCallMap + dedup)
- **Files modified:** `ingest/parser/codex.ts`
- **Commit:** 4f75c7d

**3. [Rule 2 - Missing Functionality] Codex `custom_tool_call_output` not handled**
- **Found during:** Task 3
- **Issue:** `custom_tool_call_output` event_msg type was not handled; paired `custom_tool_call` result events were never populated
- **Fix:** Extended `event_msg` handler to cover both `function_call_output` and `custom_tool_call_output` with the same pairing logic
- **Files modified:** `ingest/parser/codex.ts`
- **Commit:** 4f75c7d

**4. [Rule 2 - Missing Functionality] Codex `reasoning` and `web_search_call` produced unknown-type warning spam**
- **Found during:** Task 3
- **Issue:** Both `reasoning` and `web_search_call` are real Codex response_item types that fell through to the "Skipping unknown response_item type" warning branch. Sessions with many reasoning steps would hit the warning limit.
- **Fix:** Added explicit silent-skip handlers for both types before the unknown-type fallback. `reasoning` is internal model content (no canonical message). `web_search_call` is logged separately by `event_msg`.
- **Files modified:** `ingest/parser/codex.ts`
- **Commit:** 4f75c7d

## Self-Check: PASSED

All created files exist and all commits are present.
