# Phase 3: Claude/Codex Parsers + Turn Assembly — Research

**Generated:** 2026-05-06
**Discovery Level:** 1 (Quick Verification — established codebase patterns exist, reference implementations available)

## Technical Approach

### Parser Architecture (Claude Code & Codex)

**Discovery finding:** The existing `ingest/parser/openclaw.ts` provides a proven pattern:
1. `parseXxxSession(filePath, project) → Promise<ParseResult>` as the main entry point
2. Line-by-line JSONL parsing via `readline.createInterface`
3. Internal helper: `extractSessionContext()` for path metadata, `parseMessage()` for canonical conversion
4. Error resilience: catch per-line, accumulate in `ParseError[]`, never fail the whole parse
5. Output `ParseResult { session: TraceSession, messages: TraceMessage[], activities: TraceActivity[], errors, warnings }`

This pattern is replicated verbatim for Claude and Codex parsers per CONTEXT.md D-13 ("保持与 discoverOpenClawSources() 一致的模式"). No architectural divergence needed.

### Claude Code Parser Specifics

**DAG/fork/continuation (D-01):** The `TraceSession` already supports `parentSessionId`, `rootSessionId`, and `relationshipType` (`'root' | 'subagent' | 'fork' | 'continuation'`). Claude's `parentUuid` maps directly. The DB schema (`sessions` table) already has `parent_session_id`, `root_session_id`, `relationship_type` columns.

**Streaming UUID dedup (D-03):** Claude Code JSONL emits the same message across multiple lines as streaming progress. Use a `Map<uuid, message>` accumulator; only keep the first occurrence of each UUID. This is a simple in-memory dedup within a single parse session — no cross-session state needed.

**Compact/system boundaries (D-02):** When Claude emits compact/system events, the parser stores them as standalone `TraceMessage` with `role: 'system'`. The existing assembler already skips system messages (line 49: `if (message.role === 'system') { continue; }`). Phase 3's assembler enhancement (D-10) will:
- Store system/compact messages independently
- Mark preceding messages as `is_truncated` when compact occurs
- Expose a flag for UI fold/unfold

**Subagent mapping (D-04):** Subagent sessions are separate JSONL files. The parent session's tool call stores `subagent_session_id`; the child session's `parent_session_id` points to parent, with `relationship_type = 'subagent'`. This maps cleanly to the existing `TraceSubagentLink` activity type and DB foreign keys.

**Queued command (D-05):** Multiple queued user commands in sequence → merge into a single `TraceMessage` with concatenated content during turn assembly.

### Codex Parser Specifics

**turn_context boundaries (D-06):** Codex's `response_item` (role: "user") naturally starts a new turn. The `turn_context` provides model name. This is simpler than Claude's pure message stream — no boundary inference needed.

**response_item mapping (D-07):** Direct 1:1 mapping:
- `input_text` → `TraceMessage(role: 'user')`
- `text` → `TraceMessage(role: 'assistant')`
- `function_call` → `TraceToolCall`
- `function_call_output` → `TraceToolResultEvent`

**spawn_agent (D-08):** Same subagent reference pattern as Claude. The `function_call` contains a `subagent_session_id` marker.

**token_count dedup (D-09):** Unlike Claude's UUID-based dedup, Codex uses `token_count` to detect streaming progress. If a message has the same content but higher `token_count`, replace the previous version. This is functionally equivalent to UUID dedup but keyed differently.

### Turn Assembler Enhancement

**Current state:** `ingest/turns/assembler.ts` implements basic user-message boundary grouping. System messages are skipped (`continue` on line 49). Tool results are appended as assistant context (not properly paired).

**Required enhancements (D-10, D-11):**
1. **Compact boundaries:** When compact event detected, set `is_truncated: true` on preceding messages. Store compact/system messages independently.
2. **System messages:** Continue storing as independent messages but don't include in turn message lists by default.
3. **Queued commands:** Merge consecutive user messages into one when separated by queued markers.
4. **Tool call pairing:** Match `tool_use_id` / `call_id` between tool_call activities and tool_result messages. Populate `tool_calls.resultEvents` and `tool_result_events` table.
5. **Subagent linking:** Create `TraceSubagentLink` activities when subagent_session_id is present.

### Source Discovery

**Current state:** `ingest/sync/sources.ts` has `discoverOpenClawSources()` with the pattern: env var → directory listing → file counting → error handling.

**New functions (D-12, D-13):**
- `discoverClaudeSources()`: Default path `~/.claude/sessions/`, overridable via `CLAUDE_SESSIONS_PATH` env var. List JSONL files.
- `discoverCodexSources()`: Default path `~/.codex/sessions/`, overridable via `CODEX_SESSIONS_PATH` env var. List JSONL files.
- Both follow the same `DiscoveredSource[]` return type pattern.
- Update `getSourceConfig()` and `getSourcePath()` switch statements.

### DB Schema

**No schema changes needed.** The Phase 2 schema already accounts for:
- `sessions.parent_session_id`, `root_session_id`, `relationship_type` — subagent/DAG support
- `messages.has_tool_use` — tool call indicator
- `tool_calls` and `tool_result_events` — tool pairing storage
- `sessions.is_truncated`, `termination_status` — compact/error state
- `sessions.parser_malformed_lines` — error tracking

### Testing Strategy

Fixture tests replicate the OpenClaw pattern in `tests/fixtures/`. Claude and Codex golden fixtures should be selected from `../references/agentsview/internal/parser/testdata/` covering:
- DAG/fork/continuation
- Compact boundary
- Queued commands
- Streaming duplicates
- function_call + spawn_agent
- Malformed line recovery

## Open Questions

None — all technical decisions are locked in CONTEXT.md (D-01 through D-13). Implementation follows established Phase 2 patterns with no divergence.

## Validation Architecture

All parsers output `ParseResult { session, messages, activities, errors, warnings }`. Verification dimensions:

| Dimension | Strategy |
|-----------|----------|
| Parser output correctness | Fixture golden tests comparing ParseResult against expected canonical output |
| DAG/fork resolution | Test multi-session Claude fixtures with parent-child relationships |
| Streaming dedup | Fixture with duplicate UUIDs, assert only first retained |
| Tool call pairing | Verify tool_calls.resultEvents populated, tool_result_events linked |
| Turn assembly | Verify assembleTurns() output matches expected turn boundaries |
| Subagent linking | Verify parent.session_id → child.parent_session_id chain |
| Error recovery | Malformed line fixture: parse succeeds, errors array populated |
| Source discovery | Verify discoverXxxSources() returns correct session counts |
