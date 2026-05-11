---
phase: 08-real-data-parser-tool-persistence-and-sync-refresh-repair
verified: 2026-05-09T06:38:00Z
status: human_needed
score: 5/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Verify actual 606dac00-4f36-40e2-89c8-da91416b6b39 Claude session has no key=null warnings and has structured tool blocks in replay"
    expected: "Browser console shows no 'key=null' warning when rendering session list or replay for this session; tool blocks show inputs and results"
    why_human: "Regression tests use synthetic sessions of the same class. The actual named local session requires the dev machine with RUN_REAL_SESSION_TESTS=1 and .local/real-session-corpus.json populated. Local corpus was absent in the worktree/CI context during plan execution."
  - test: "Verify effac644-0eb7-4fc8-9e60-6c8127d51eae Claude session is discoverable after force sync"
    expected: "Session appears in the claude-code session list after clicking the refresh button (which now calls sync before refetch)"
    why_human: "Same local corpus dependency. The force-sync discoverability behavior is tested deterministically for sessions of this class, but the actual named session requires the local environment."
  - test: "Verify right-rail refresh button spins and shows 'Syncing...' tooltip during sync, then refreshes session list"
    expected: "Clicking refresh in SourceSessionsRightRail shows a spinner, disables the button, calls ingest sync, then reloads the session list"
    why_human: "Frontend behavior (disabled state, spinner animation, error display) requires a running dev server and browser interaction — not verifiable with grep or test runner alone."
---

# Phase 8: Real-data Parser, Tool Persistence, and Sync Refresh Repair — Verification Report

**Phase Goal:** Fix real-data parser failures, persist tool calls/result events in SQLite, and wire sync-first refresh so manual refresh means "reindex then reload".

**Verified:** 2026-05-09T06:38:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Codex parser handles real `response_item.payload.function_call_output`, `custom_tool_call`, `custom_tool_call_output`; reasoning/web-search ignored without noisy warnings | VERIFIED | `ingest/parser/codex.ts` lines 343-365 (function_call_output as response_item), 426-491 (custom_tool_call), 481-491 (reasoning/web_search silent skip). 25/25 real-shape regression tests pass. |
| SC2 | Claude parser handles real `tool_result`, `thinking`, compact/system-boundary from actual `~/.claude` JSONL without relying on synthetic fixture shapes | VERIFIED | `ingest/parser/claude.ts` lines 88-302: toolCallMap pairing by tool_use_id, thinking block extraction via extractClaudeActivities, isCompactSummary gate at line 160. 5 new claude-parser regression tests pass. |
| SC3 | Sync writes stable `messages.id`, `tool_calls`, `tool_result_events` transactionally; re-sync replaces stale derived rows; turn assembly reads structured activities from SQLite | VERIFIED | `ingest/sync/index.ts` lines 277-443: database.transaction(), dependency-order DELETE (tool_result_events→tool_calls→turns→messages), stable ID logic at line 376-378, INSERT INTO tool_calls at line 399-427. `pairToolCalls()` in assembler reads from DB tables. 20 tool-persistence tests + 7 turn-activity-regression tests all pass. |
| SC4 | Manual refresh calls an ingest sync/resync endpoint before refetching sessions/turns; safe force-reparse path exists for parser/cache-version changes | VERIFIED | `sessions-right-rail.tsx`: AggregateSessionsRightRail calls `syncAllSessions()` then `notifySessionsRefresh()` in finally. SourceSessionsRightRail calls `syncToolSessions(sourceToolId)` then `sourceSessions.refetch()`. Per-tool BFF route at `app/api/agent-tools/[tool]/sync/route.ts` forwards force to ingest. Force bypasses hash skip at `ingest/sync/index.ts` line 240. 25 BFF/hooks tests pass. |
| SC5 | Real-data regression fixtures cover known Claude/Codex formats from 2026-05-08 investigation, synthetic-only fixtures corrected or labeled | VERIFIED | `tests/fixtures/real-shape/claude/`: tool-result.jsonl, thinking.jsonl, compact.jsonl. `tests/fixtures/real-shape/codex/`: function-call-output.jsonl, custom-tool.jsonl, reasoning-web-search.jsonl. README.md documents redaction rules. 25/25 real-shape.test.ts assertions pass. |
| SC6 | Reported sessions verify cleanly: no `key=null` for 606dac00, effac644 is discoverable, tool/result rows populated after reindex | UNCERTAIN | Deterministic regression tests cover the *class* of failure (null message IDs, discoverability, tool row population) using synthetic JSONL — and all 12 pass. The **actual named sessions** were not present in the worktree context (`local corpus manifest absent`). The named-session assertions require `.local/real-session-corpus.json` and `RUN_REAL_SESSION_TESTS=1`. UNCERTAIN is appropriate — not FAILED because the root cause is fixed and the class-level regression tests verify the fix is structurally correct. |

**Score:** 5/6 truths verified (SC6 requires human)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/fixtures/real-shape/README.md` | Redaction and fixture selection rules | VERIFIED | Exists, 88 lines, "What NOT to Commit" section covers complete local sessions, redaction rules table present |
| `tests/fixtures/real-shape/claude/tool-result.jsonl` | Claude tool_use + tool_result fixture | VERIFIED | Exists |
| `tests/fixtures/real-shape/claude/thinking.jsonl` | Claude thinking block fixture | VERIFIED | Exists |
| `tests/fixtures/real-shape/claude/compact.jsonl` | Claude isCompactSummary fixture | VERIFIED | Exists |
| `tests/fixtures/real-shape/codex/function-call-output.jsonl` | Codex function_call_output fixture | VERIFIED | Exists |
| `tests/fixtures/real-shape/codex/custom-tool.jsonl` | Codex custom_tool_call fixture | VERIFIED | Exists |
| `tests/fixtures/real-shape/codex/reasoning-web-search.jsonl` | Codex reasoning/web_search fixture | VERIFIED | Exists |
| `tests/fixtures/parser-regression/real-shape.test.ts` | Default CI-safe real-shape parser regression | VERIFIED | Exists, 25 tests, contains `function_call_output` (7 occurrences), all pass |
| `tests/local/real-session-corpus.test.ts` | Opt-in local corpus smoke tests | VERIFIED | Exists, contains `RUN_REAL_SESSION_TESTS` guard at line 54, skip-by-default behavior verified |
| `.local/real-session-corpus.example.json` | Schema with fake paths/IDs | VERIFIED | Exists at `tests/local/real-session-corpus.example.json` |
| `.gitignore` | `.local/real-session-corpus.json` ignored | VERIFIED | Line 55 of .gitignore |
| `package.json` | `test:real-sessions` script | VERIFIED | Line 18 of package.json |
| `ingest/parser/codex.ts` | Real Codex response_item payload support | VERIFIED | Contains `function_call_output` (8 occurrences), `custom_tool_call`, `custom_tool_call_output`, silent skip for `reasoning` and `web_search_call` |
| `ingest/parser/claude.ts` | Real Claude content block support | VERIFIED | Contains `tool_result` (10 occurrences), `toolCallMap`, `isCompactSummary`, `extractClaudeActivities`, `thinking` block extraction |
| `ingest/sync/index.ts` | Transactional writeSessionToDatabase with tool persistence | VERIFIED | Contains `tool_result_events` (5 occurrences), `WriteSessionOptions.force`, `database.transaction()`, stable ID logic |
| `tests/unit/ingest/tool-persistence.test.ts` | DB assertions for message ids and tool rows | VERIFIED | Exists, 20 tests, contains `tool_calls`, all pass |
| `tests/unit/ingest/turn-activity-regression.test.ts` | assembleTurns returns tool activities | VERIFIED | Exists, 7 tests, all pass |
| `app/api/agent-tools/[tool]/sync/route.ts` | Per-tool BFF sync route | VERIFIED | Exists, contains `fetchIngest` (2 occurrences), `assertSourceToolId`, force forwarding |
| `components/sessions/sessions-right-rail.tsx` | Right rail sync-first refresh | VERIFIED | Contains `onRefresh` (5 occurrences), `syncToolSessions`, `syncAllSessions`, `syncing` state, disabled button |
| `lib/agent-tools/client-hooks.tsx` | syncToolSessions and syncAllSessions helpers | VERIFIED | Both exported at lines 199 and 228, only call BFF routes |
| `app/api/sync/route.ts` | Aggregate BFF sync route | VERIFIED | Loops all 3 source types, forwards force, returns per-source results |
| `tests/unit/ingest/phase8-regression.test.ts` | Non-local regression assertions | VERIFIED | Exists, 12 tests, contains `messages.id` (5 occurrences), all pass |
| `.planning/phases/08-real-data-parser-tool-persistence-and-sync-refresh-repair/08-VERIFICATION-NOTES.md` | Manual/local verification record | VERIFIED | Exists, contains `606dac00` (3 occurrences), DB assertion summaries, command outcomes |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `sessions-right-rail.tsx` | `client-hooks.tsx` | `syncAllSessions() / syncToolSessions()` import | WIRED | Both functions imported at line 10-11 and called in handleRefresh |
| `sessions-right-rail.tsx` → `right-rail.tsx` | `shell-frame.tsx` | import chain | WIRED | right-rail.tsx imports SessionsRightRail; shell-frame.tsx imports RightRail |
| `shell-header.tsx` | `client-hooks.tsx` | `syncAllSessions()` | WIRED | Line 4 import, line 20 call with notifySessionsRefresh fallback |
| `client-hooks.tsx` | `/api/agent-tools/:tool/sync` | `fetch()` POST | WIRED | Line 204 in syncToolSessions |
| `client-hooks.tsx` | `/api/sync` | `fetch()` POST | WIRED | Line 232 in syncAllSessions |
| `app/api/agent-tools/[tool]/sync/route.ts` | `fetchIngest(/api/v1/sources/:type/sync)` | `fetchIngest()` | WIRED | Line 54-59 |
| `app/api/sync/route.ts` | `fetchIngest(/api/v1/sources/:type/sync)` | `fetchIngest()` for all 3 types | WIRED | Lines 48-55 in SOURCE_TYPES loop |
| `ingest/api/sources.ts` | `syncSource()` | POST handler at line 107 | WIRED | Line 129: `syncSource(type, { force })` |
| `syncSource()` | `writeSessionToDatabase()` | `{ force: opts.force }` | WIRED | Lines 605, 671, 741 in 3 source sync functions |
| `writeSessionToDatabase()` | `database.transaction()` | `database.transaction(writeTransaction)` | WIRED | Line 277 |
| `assembleTurns()` | `tool_calls` table | `pairToolCalls()` SQL query | WIRED | Lines 194-244 in assembler.ts — real DB query confirmed |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `ingest/turns/assembler.ts` | `TraceToolCall activities` | `tool_calls` + `tool_result_events` DB tables | Yes — real SQL queries at lines 205-226 | FLOWING |
| `components/replay/tool-block.tsx` | `tool.inputJson`, `tool.resultEvents`, `tool.status` | Rendered from props populated by `useSessionTurns` → BFF → `assembleTurns()` → DB | Yes — data flows from DB through assembler to component | FLOWING |
| `ingest/sync/index.ts` | `tool_calls` rows | `parseResult.activities` filtered by `type === 'tool_call'` | Yes — `tc.messageOrdinal`, `tc.inputJson`, `tc.resultEvents` all written transactionally | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| tool-persistence tests pass | `pnpm test:run tests/unit/ingest/tool-persistence.test.ts` | 20 passed (0 failed) | PASS |
| phase8 regression tests pass | `pnpm test:run tests/unit/ingest/phase8-regression.test.ts` | 12 passed (0 failed) | PASS |
| real-shape parser regression tests pass | `pnpm test:run tests/fixtures/parser-regression/real-shape.test.ts` | 25 passed (0 failed) | PASS |
| turn-activity regression tests pass | `pnpm test:run tests/unit/ingest/turn-activity-regression.test.ts` | 7 passed (0 failed) | PASS |
| BFF sync route + client hooks tests pass | `pnpm test:run tests/unit/bff/sync-route.test.ts tests/hooks/client-hooks.test.tsx` | 25 passed (0 failed) | PASS |
| All ingest tests pass | `pnpm test:run tests/unit/ingest/` | 152 passed, 11 files (0 failed) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description (abbreviated) | Status | Evidence |
|------------|---------------|--------------------------|--------|---------|
| DATA-02 | 08-03 | SQLite WAL/FTS5 index including tool_calls and tool_result_events | PARTIAL | WAL enabled. tool_calls/tool_result_events tables added and written transactionally. FTS5 full-text search NOT added in Phase 8 (broader scope across phases). Core tool_calls/tool_result_events sub-requirement addressed. |
| DATA-04 | 08-03, 08-04 | file watching, debounce, skip cache, parse error recording | PARTIAL | Skip cache (file_hash) and force bypass implemented. Chokidar watcher and debounce are pre-existing; sources.ts shows watcher status integration. Phase 8 adds force-reparse path through all layers. |
| DATA-05 | 08-03, 08-04 | REST API: sources, sessions, session detail, turns, messages, tools, sync/resync | PARTIAL | sync endpoint enhanced with force in Phase 8. sessions/turns/messages APIs pre-existing. tools endpoint not separately added in Phase 8 but tool_calls accessible via turns. |
| SRC-02 | 08-01, 08-02 | Claude Code parser: uuid/parentUuid DAG, compact/system boundary, subagent mapping | PARTIAL | Phase 8 adds tool_result pairing, thinking block extraction, isCompactSummary boundary. DAG/subagent mapping pre-existing. |
| SRC-03 | 08-01, 08-02 | Codex parser: response_item, function_call/function_call_output, custom_tool_call | SATISFIED | All listed Codex types now handled including function_call_output (both shapes), custom_tool_call/output, reasoning/web_search silent skip. |
| SRC-04 | 08-02 | All parsers output canonical Message, ToolCall, ToolResultEvent, SubagentLink | PARTIAL | Claude and Codex now output TraceToolCall with messageOrdinal and TraceToolResultEvent. OpenClaw pre-existing. |
| SRC-05 | 08-02 | parser records is_truncated, parser_malformed_lines, source_version, cwd/git_branch | PARTIAL | is_truncated set via compact boundary. cwd/git_branch from session context. termination_status and parser_malformed_lines count pre-existing. |
| TURN-01 | 08-03 | turn-first read model aggregating assistant response, tool calls, activities | SATISFIED (for tool calls) | assembleTurns() + pairToolCalls() now reads tool_calls from SQLite. Turn assembly confirmed by 7 turn-activity-regression tests. |
| TURN-03 | 08-01, 08-02, 08-03 | Tool call paired with results by tool_use_id/call_id, concurrent tools, multi-result events | SATISFIED | toolCallMap pairing at parse time (claude.ts, codex.ts), tool_result_events linked to tool_call_id via lastInsertRowid, pairToolCalls queries by message_ordinal IN (assistant ordinals). |
| TURN-06 | 08-02 | compact/queued/interruption boundary events retained in data model | SATISFIED | isCompactSummary compact boundary produces system message + isTruncated. Assembler handles system/compact/queued boundaries (pre-existing plus Phase 8 isCompactSummary gate). |
| REPLAY-01 | 08-03, 08-04 | Session replay displays turns with tool/skill/subagent activity, expandable | PARTIAL | Backend data now flows to assembly correctly. Frontend tool-block.tsx renders tool name/category/input/result/status/duration. Full UI verification requires running dev server (human item). |
| REPLAY-03 | pre-existing, 08-03 | Tool block shows name/category, input JSON, result/status/error/duration, copy | SATISFIED | components/replay/tool-block.tsx confirmed: status dot, duration display, inputJson formatted, resultEvents mapped, copy button produces structured output. |
| HARD-01 | 08-01, 08-05 | Parser fixture tests cover tool calls, compact boundary, truncated tail, malformed | SATISFIED | tests/fixtures/real-shape/ covers all listed categories. tests/fixtures/parser-regression/real-shape.test.ts 25 assertions. phase8-regression.test.ts 12 end-to-end assertions. |

**Note on REQUIREMENTS.md traceability table:** The traceability table in REQUIREMENTS.md was not updated to reflect Phase 8 contributions — all Phase 8 requirements still show their original Phase 2/3/5/6 assignment with "Pending" status. This is a documentation debt, not a code issue.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ingest/parser/codex.ts` | 117, 790, 796, 811, 814, 830 | `return null` | Info | Appropriate parser behavior for unrecognized/non-message lines — not stubs. Internal to `extractCodexMessage()` helper function. |
| `ingest/parser/claude.ts` | 693, 696 | `return null` | Info | Appropriate parser behavior for records without message payload — not stubs. |

No blockers or warnings found. All `return null` instances are valid parser exit points, not empty implementations.

---

### Human Verification Required

#### 1. Named Session 606dac00 — key=null and Tool Blocks

**Test:** With dev servers running (`pnpm dev` on :3000, ingest on :8078), add `606dac00-4f36-40e2-89c8-da91416b6b39` to `.local/real-session-corpus.json` with tag `claude-key-null-risk`. Run `RUN_REAL_SESSION_TESTS=1 pnpm test:real-sessions`. Then open the session in the browser, navigate to replay, and open browser DevTools console.

**Expected:** (a) `RUN_REAL_SESSION_TESTS=1 pnpm test:real-sessions` passes the `claude-key-null-risk` tag assertions — `count(*) = count(id)` for messages after force sync. (b) Browser console shows no `Warning: Each child in a list should have a unique "key" prop` or `key=null` for this session.

**Why human:** The actual session file lives only on the developer's machine. The worktree CI context had no local corpus manifest. Class-level regression tests confirmed the fix is structurally correct; the specific session requires the local environment.

---

#### 2. Named Session effac644 — Discoverability After Force Sync

**Test:** With dev servers running, add `effac644-0eb7-4fc8-9e60-6c8127d51eae` to `.local/real-session-corpus.json` with tag `claude-discoverability`. Run `RUN_REAL_SESSION_TESTS=1 pnpm test:real-sessions`. Alternatively: navigate to the claude-code session list, click refresh, and confirm the session appears.

**Expected:** Session row exists in the sessions table after initial sync and after force sync. Session appears in the claude-code session list in the UI.

**Why human:** Same local corpus dependency as above.

---

#### 3. Right-Rail Refresh — Spinner and Sync-First Behavior

**Test:** With dev servers running, open the sessions right rail for any source (e.g., codex). Click the refresh button.

**Expected:** The refresh button immediately shows a spinner and becomes disabled ("cursor-not-allowed opacity-50", tooltip changes to "Syncing…"). After the ingest sync completes, the session list reloads. If sync fails, the current list is preserved and an error state is visible.

**Why human:** Frontend interaction state (disabled button, animate-spin CSS class, error display) requires a browser and running dev server.

---

### Gaps Summary

No gaps. All 6 roadmap success criteria are either VERIFIED (SC1-SC5) or UNCERTAIN pending local-session human verification (SC6). SC6's root causes are demonstrably fixed by deterministic tests — the uncertainty is purely whether the actual named session files on the developer's machine will show the same behavior as the synthetic regression tests confirm.

---

_Verified: 2026-05-09T06:38:00Z_
_Verifier: Claude (gsd-verifier)_
