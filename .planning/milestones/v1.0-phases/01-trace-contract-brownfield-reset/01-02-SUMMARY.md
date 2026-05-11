---
phase: 01-trace-contract-brownfield-reset
plan: 02
title: "Fixture Corpus and Golden File Testing Infrastructure"
one_liner: "Created 6 fixture files (OpenClaw/Claude/Codex), parseFixture() utility, and golden file tests"
subsystem: "data-layer"
tags: ["fixtures", "testing", "parser-infrastructure", "golden-files"]
dependency_graph:
  requires: ["01-01-types"]
  provides: ["01-03-preserved-capabilities"]
  affects: ["02-ingest-core"]
tech_stack:
  added:
    - "Vitest golden file testing pattern"
    - "parseFixture() utility for JSONL parsing"
    - "Fixture corpus structure (fixtures/{source}/*.jsonl)"
  patterns:
    - "Line-by-line JSONL parsing with readline/createInterface"
    - "Golden file testing: input → parse → expect(result).toEqual(expected)"
    - "Source-specific fixture naming: {source}-{scenario}.jsonl"
key_files:
  created:
    - path: "fixtures/openclaw/conversation.jsonl"
      purpose: "Synthetic OpenClaw conversation fixture (4 messages)"
    - path: "fixtures/openclaw/tool-call.jsonl"
      purpose: "Synthetic OpenClaw tool call fixture (4 messages)"
    - path: "fixtures/claude-code/valid_session.jsonl"
      purpose: "Claude Code valid session (copied from agentsview)"
    - path: "fixtures/claude-code/tool_call_pending.jsonl"
      purpose: "Claude Code tool call pending (copied from agentsview)"
    - path: "fixtures/codex/standard_session.jsonl"
      purpose: "Codex standard session (copied from agentsview)"
    - path: "fixtures/codex/function_calls.jsonl"
      purpose: "Codex function calls (copied from agentsview)"
    - path: "lib/parseFixture.ts"
      purpose: "Minimal parser validator for fixture testing"
    - path: "tests/fixtures.test.ts"
      purpose: "Golden file tests for all 6 fixtures"
    - path: "scripts/generate-golden.ts"
      purpose: "Automated golden file generation utility"
  modified:
    - path: "fixtures/openclaw/conversation.jsonl"
      change: "Fixed malformed JSON (missing closing brace in line 4)"
metrics:
  duration_seconds: 214
  completed_date: "2026-05-05T20:21:06Z"
  tasks_completed: 3
  files_created: 17 (6 JSONL + 6 golden + 1 parser + 1 test + 1 script + 2 OpenClaw fixtures)
  tests_added: 7
  tests_passing: 7
---

# Phase 01 Plan 02: Fixture Corpus and Golden File Testing Infrastructure

## Summary

Created the fixture corpus and minimal parser validation infrastructure for Phase 1. Established golden file testing patterns that will be used in Phase 2-3 for parser development. Fixed one malformed JSON line in OpenClaw conversation fixture.

## Tasks Completed

### Task 1: Copy and create fixture files ✅

**Created fixture directory structure:**
- `fixtures/openclaw/` - 2 synthetic fixtures
- `fixtures/claude-code/` - 2 fixtures copied from agentsview
- `fixtures/codex/` - 2 fixtures copied from agentsview

**Fixture files created:**
1. `fixtures/openclaw/conversation.jsonl` (4 lines) - Synthetic OpenClaw conversation
2. `fixtures/openclaw/tool-call.jsonl` (4 lines) - Synthetic OpenClaw with tool calls
3. `fixtures/claude-code/valid_session.jsonl` (4 lines) - Copied from agentsview
4. `fixtures/claude-code/tool_call_pending.jsonl` (2 lines) - Copied from agentsview
5. `fixtures/codex/standard_session.jsonl` (3 lines) - Copied from agentsview
6. `fixtures/codex/function_calls.jsonl` (4 lines) - Copied from agentsview

**Golden JSON stubs created:**
- All 6 `*.golden.json` files with stub TraceSession structure

**Commit:** `2171aac` - feat(01-02): create fixture corpus with 6 JSONL and 6 golden JSON stubs

### Task 2: Implement parseFixture() function ✅

**Created `lib/parseFixture.ts`:**
- Line-by-line JSONL reading using `readline/createInterface`
- Malformed line counting without crashing (mitigates T-1-01 DoS threat)
- Returns minimal TraceSession stub with message count
- Comprehensive error handling and documentation

**Key implementation details:**
```typescript
export async function parseFixture(
  filePath: string,
  sourceType: TraceSource
): Promise<TraceSession>
```

**Commit:** `52ac9a1` - feat(01-02): implement parseFixture() function with line-by-line JSONL reading

### Task 3: Create golden file tests ✅

**Created `tests/fixtures.test.ts`:**
- 3 describe blocks (OpenClaw, Claude Code, Codex)
- 7 test cases covering all fixtures
- Helper functions for loading golden fixtures
- Error handling test for malformed JSONL lines

**Created `scripts/generate-golden.ts`:**
- Automated golden file generation utility
- Runs parseFixture on all fixtures and writes output
- Used to populate golden JSON files

**Golden files populated:**
- All 6 golden JSON files now contain actual parseFixture() output
- messageCount correctly reflects lines in each fixture
- Tests verify exact output match

**Commit:** `71771d3` - feat(01-02): create golden file tests for all 6 fixtures
**Commit:** `0184d14` - feat(01-02): populate golden JSON files and add generation script

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed malformed JSON in conversation.jsonl**
- **Found during:** Golden file generation
- **Issue:** Line 4 had malformed JSON: `{"role":"assistant":"I'll fetch...}` missing closing brace
- **Fix:** Changed to `{"role":"assistant","content":"I'll fetch...}`
- **Files modified:** `fixtures/openclaw/conversation.jsonl`
- **Commit:** `0184d14`
- **Impact:** parserMalformedLines decreased from 1 to 0, test now passes without warnings

## Threat Mitigation

**T-1-01 (DoS): Malformed JSONL handling**
- **Mitigation implemented:** parseFixture() uses try/catch for JSON.parse errors, counts malformed lines in `parserMalformedLines`, continues parsing without crashing
- **Verification:** Error handling test in `tests/fixtures.test.ts` confirms malformed lines are tracked
- **Test result:** Fixed malformed line in conversation.jsonl, now 0 malformed lines

**T-1-02 (Tampering): Hardcoded fixture paths**
- **Mitigation implemented:** All fixture paths in tests are hardcoded strings, no user input
- **Verification:** `loadGoldenFixture()` and `parseFixtureFromPath()` use fixed directory names

**T-1-03 (Information Disclosure): Test data only**
- **Status:** Accepted - golden JSON files contain sample sessions, not real user data
- **Verification:** All fixtures are synthetic or copied from agentsview reference implementation

## Test Results

**All 7 tests passing:**
```
Test Files  1 passed (1)
     Tests  7 passed (7)
  Start at  04:20:49
  Duration  195ms (transform 29ms, setup 0ms, import 40ms, tests 11ms, environment 0ms)
```

**Test breakdown:**
- OpenClaw fixtures: 2 tests (conversation, tool-call)
- Claude Code fixtures: 2 tests (valid_session, tool_call_pending)
- Codex fixtures: 2 tests (standard_session, function_calls)
- Error handling: 1 test (malformed JSONL graceful handling)

## Known Stubs

**Phase 1 minimal implementation (expected):**
- `parseFixture()` returns stub TraceSession with placeholder values:
  - `id: "stub-session-id"`
  - `project: "test-project"`
  - `status: "unknown"`
  - `turns: []`
  - `userMessageCount: 0`
  - `hasToolCalls: false`

**Phase 2-3 will implement real parsers:**
- Source-specific parsing logic (OpenClaw/Claude/Codex protocols differ)
- Turn extraction from message sequences
- Tool call detection and categorization
- User message counting
- Status inference from session end state

## Next Steps for Plan 03

**Plan 03 will:**
1. Document preserved OpenClaw overview capabilities
2. Identify which Gateway-dependent features remain in Phase 1
3. Create capability mapping table for Phase 2-3 migration
4. Ensure no regression in existing OpenClaw dashboard functionality

**Fixture corpus ready for:**
- Phase 2 parser development (OpenClaw parser implementation)
- Phase 3 parser development (Claude/Codex parser implementation)
- Golden file regression testing as parsers evolve

## Self-Check: PASSED

**Created files verified:**
- ✓ `fixtures/openclaw/conversation.jsonl` - 4 lines, valid JSONL
- ✓ `fixtures/openclaw/tool-call.jsonl` - 4 lines, valid JSONL
- ✓ `fixtures/claude-code/valid_session.jsonl` - 4 lines, valid JSONL
- ✓ `fixtures/claude-code/tool_call_pending.jsonl` - 2 lines, valid JSONL
- ✓ `fixtures/codex/standard_session.jsonl` - 3 lines, valid JSONL
- ✓ `fixtures/codex/function_calls.jsonl` - 4 lines, valid JSONL
- ✓ `lib/parseFixture.ts` - 69 lines, exports parseFixture
- ✓ `tests/fixtures.test.ts` - 108 lines, 7 tests
- ✓ `scripts/generate-golden.ts` - 29 lines, utility script

**Commits verified:**
- ✓ `2171aac` - Task 1 commit exists
- ✓ `52ac9a1` - Task 2 commit exists
- ✓ `71771d3` - Task 3 commit exists
- ✓ `0184d14` - Checkpoint completion commit exists

**Tests verified:**
- ✓ All 7 tests pass
- ✓ Golden files populated with actual parseFixture() output
- ✓ No malformed lines detected (fixed in conversation.jsonl)

---

**Plan completed successfully in 214 seconds (3 minutes 34 seconds)**
