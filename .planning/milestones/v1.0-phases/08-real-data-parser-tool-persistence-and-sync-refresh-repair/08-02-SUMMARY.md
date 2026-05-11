---
phase: 08-real-data-parser-tool-persistence-and-sync-refresh-repair
plan: "02"
title: Repair Claude and Codex parsers for real JSONL formats
subsystem: parser
tags:
  - parser
  - claude-code
  - codex
  - real-jsonl
  - tool-result-pairing
  - thinking-blocks
  - compact-boundary
dependency_graph:
  requires:
    - real-shape-fixture-corpus
    - codex-parser-real-payload-fixes
  provides:
    - claude-tool-result-pairing
    - claude-thinking-block-extraction
    - claude-is-compact-summary-boundary
    - codex-function-call-output-as-response-item
    - codex-input-json-normalization
    - parser-message-ordinal-metadata
  affects:
    - types/trace.ts
    - ingest/parser/types.ts
    - ingest/parser/claude.ts
    - ingest/parser/codex.ts
    - tests/unit/ingest/claude-parser.test.ts
    - tests/unit/ingest/codex-parser.test.ts
tech_stack:
  added: []
  patterns:
    - Tool-call/result pairing by id at parse time (toolCallMap pattern)
    - Discriminated content block scanning for thinking/tool_use/tool_result
    - isCompactSummary boolean gate in addition to type="compact" check
    - Parser-owned messageOrdinal for sync layer persistence
key_files:
  created: []
  modified:
    - types/trace.ts
    - ingest/parser/types.ts
    - ingest/parser/claude.ts
    - ingest/parser/codex.ts
    - tests/unit/ingest/claude-parser.test.ts
    - tests/unit/ingest/codex-parser.test.ts
decisions:
  - "TraceToolCall.messageOrdinal promoted to canonical type as optional field — sync correctness requires it at the model level"
  - "isCompactSummary: true treated as compact boundary alongside type='compact' — real Claude logs use the former"
  - "tool_result-only user records emit role=tool_result, not user — prevents false user turn boundaries in assembler"
  - "Codex function_call_output as response_item (not event_msg) handled — some Codex versions emit this shape"
  - "extractClaudeToolCalls kept as deprecated shim — delegates to extractClaudeActivities"
metrics:
  duration: "12m"
  completed: "2026-05-09"
  tasks_completed: 4
  files_created: 0
  files_modified: 6
  tests_added: 8
  tests_passing: 58
---

# Phase 08 Plan 02: Repair Claude and Codex Parsers for Real JSONL Formats Summary

## One-Liner

Claude tool_result pairing, thinking block extraction, isCompactSummary boundary, Codex function_call_output-as-response_item, and messageOrdinal metadata for sync persistence.

## What Was Built

### Task 1: Parser Activity Metadata Types

Extended the canonical trace contract and parser-internal types to carry message-level metadata needed for sync persistence:

- **`types/trace.ts`**: Added `messageOrdinal?: number` and `sourceLine?: number` to `TraceToolCall` — optional fields so the sync layer can write `tool_calls.message_ordinal` without requiring database schema changes
- **`ingest/parser/types.ts`**: Added `ParserToolCallMeta` helper interface documenting the intent; extended `ClaudeJsonlLine` content block union to include `thinking`, `tool_use_id`, `content`, and `is_error` fields for the new parsers

### Task 2: Codex Parser Repairs

Three behavioral fixes in `ingest/parser/codex.ts`:

1. **`function_call_output` as `response_item`**: Some Codex versions emit the tool result directly as a `response_item` with `type: "function_call_output"` rather than via `event_msg`. Added a handler before the `function_call` branch that pairs it to the matching tool call by `call_id`.

2. **`inputJson` normalization**: `function_call` and `custom_tool_call` entries now read `ri.arguments` (string) with fallback to `JSON.stringify(ri.input)` (object) — handles both the stringified-arguments shape and the raw-input-object shape from real Codex API responses.

3. **`messageOrdinal` + `sourceLine`**: Both `function_call` and `custom_tool_call` tool calls now carry `messageOrdinal: ordinal` and `sourceLine: lineNum` at creation time.

### Task 3: Claude Parser Repairs

Four behavioral fixes in `ingest/parser/claude.ts`:

1. **`isCompactSummary: true` compact boundary**: Real Claude session logs emit `isCompactSummary: true` on the record (not always `type: "compact"` exclusively). The compact gate now checks `parsed.type === 'compact' || parsed.isCompactSummary === true`, and prefers `compact.truncatedUuids` with fallback to a top-level `truncatedUuids` array.

2. **`tool_result` user record pairing**: Added a `toolCallMap` (keyed by `tool_use_id`) that accumulates tool calls as they are created. When a user message contains only `tool_result` blocks, the parser:
   - Decodes string/array/object content from each `tool_result` block
   - Attaches a `TraceToolResultEvent` to the matching `TraceToolCall` via `tool_use_id`
   - Updates tool call status to `success` (or `error` if `is_error: true`)
   - Emits a `role: "tool_result"` `TraceMessage` instead of a `role: "user"` turn — prevents false user-turn boundaries in the assembler

3. **`thinking` block extraction**: Renamed `extractClaudeToolCalls` to `extractClaudeActivities` which returns both `toolCalls` and `thinkingBlocks`. `thinking` content blocks are now emitted as `TraceThinkingBlock` activities with `content` and `isRedacted` fields — retained for replay-accessible data, not silently dropped.

4. **`messageOrdinal` + `sourceLine`** on `tool_use` blocks: `extractClaudeActivities` now accepts `messageOrdinal` parameter and stamps it on each `TraceToolCall`.

### Task 4: New Regression Tests

Added 8 new tests to `tests/unit/ingest/claude-parser.test.ts` and `tests/unit/ingest/codex-parser.test.ts`:

**Claude parser (5 new):**
- Tool_result pairs `resultEvents` to prior `tool_use` by `tool_use_id`
- Tool-result-only user records produce `role=tool_result` (not user)
- Thinking blocks extracted as `TraceThinkingBlock` with correct content
- `isCompactSummary: true` sets `isTruncated` and produces system message
- `tool_use` `messageOrdinal` matches the owning assistant message ordinal

**Codex parser (3 new):**
- `function_call_output` as `response_item` pairs to tool call result
- `inputJson` normalized from `input` object field (not only `arguments` string)
- `messageOrdinal` and `sourceLine` set on `function_call` entries

Total test count: 58 (50 from Plan 01 + 8 new).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Functionality] `extractClaudeToolCalls` needed to become `extractClaudeActivities` to return thinking blocks**
- **Found during:** Task 3 implementation
- **Issue:** Plan mentioned extracting thinking blocks but the existing function only returned tool calls. Renaming while keeping a deprecated shim prevented breaking existing callers.
- **Fix:** Renamed to `extractClaudeActivities` returning `{ toolCalls, thinkingBlocks }`. Kept `extractClaudeToolCalls` as deprecated delegator for backward compatibility.
- **Files modified:** `ingest/parser/claude.ts`
- **Commit:** c6394e4

**2. [Rule 2 - Missing Functionality] `ClaudeJsonlLine` content block type missing `thinking`, `tool_use_id`, `content`, `is_error` fields**
- **Found during:** Task 3 typecheck
- **Issue:** TypeScript reported errors accessing `block.thinking`, `block.tool_use_id` etc. — the content block union in `ClaudeJsonlLine` didn't include these real Claude block fields.
- **Fix:** Extended the content block union in `ingest/parser/types.ts` to include all real-shape fields: `thinking?`, `tool_use_id?`, `content?`, `is_error?`.
- **Files modified:** `ingest/parser/types.ts`
- **Commit:** c6394e4

## Acceptance Criteria Verification

- [x] Codex `function_call_output` under `response_item.payload` creates a result event on the matching call — handled via new response_item branch
- [x] Codex `custom_tool_call` / `custom_tool_call_output` appears as structured tool call/result pair — already done in Plan 01, messageOrdinal added
- [x] Claude `tool_result` blocks pair with prior `tool_use.id` — new toolCallMap pairing
- [x] Claude `thinking` is retained in replay-accessible data and not silently dropped — emitted as TraceThinkingBlock
- [x] Claude real compact summary records preserved as compact/system boundary — isCompactSummary gate
- [x] Every parser-created tool call has enough metadata for sync to write `tool_calls.message_ordinal` — messageOrdinal + sourceLine on all tool calls

## Self-Check: PASSED

All modified files exist and all commits are present:
- `76f1127` feat(08-02): add messageOrdinal/sourceLine to TraceToolCall and ParserToolCallMeta helper
- `8a9906e` feat(08-02): repair Codex parser for real JSONL formats
- `c6394e4` feat(08-02): repair Claude parser for real JSONL content block shapes
- `5398b2d` test(08-02): add regression tests for repaired parser behavior
