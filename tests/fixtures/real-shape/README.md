# Real-Shape Fixture Corpus

This directory contains **redacted** fixture snippets that preserve the structural
envelope of real Claude Code and Codex JSONL log files, without exposing actual
session content.

## Purpose

These fixtures exist to prevent fixture-vs-real-data regressions — situations where
tests pass on synthetic fixtures but the parser fails on real logs because the
real-world envelope structure differs.

## Rules

### What to Commit

- Redacted envelope lines that preserve field presence, types, and nesting structure.
- Minimal sequences demonstrating a specific parser behavior (tool_use + tool_result
  pair, compact boundary, thinking block, function_call_output, etc.).
- At most a handful of lines per fixture file — enough to exercise one behavior.

### What NOT to Commit

- Complete local session files (even partially redacted).
- Actual prompt text, user messages, or tool output from real sessions.
- Absolute paths to files on your machine.
- Filenames that are not clearly synthetic (e.g., no `index.ts`, `/Users/you/...`).
- API keys, tokens, environment variable values, or secrets of any kind.
- Model names that could leak vendor contract details beyond what is publicly known.

### Redaction Rules

| Field | Rule |
|-------|------|
| `uuid` | Replace with descriptive ID like `"rs-tool-use-01"` |
| `parentUuid` | Replace with matching descriptive ID |
| `message.content` (text) | Replace with `"[REDACTED]"` or a short synthetic label |
| `tool_use.input` | Replace argument values with `"[REDACTED]"` |
| `tool_result.content` | Replace with `"[REDACTED output]"` |
| `cwd`, `gitBranch` | Remove or replace with `/redacted/path` and `redacted-branch` |
| `timestamp` | Synthetic ISO timestamps are fine (e.g., `"2025-01-01T00:00:00Z"`) |
| `session.id` | Replace with `"rs-session-01"` style value |
| `call_id`, `tool_use_id` | Keep structurally real, use synthetic IDs like `"call_rs01"` |

### Envelope Fields to Preserve

The following fields are load-bearing for parser behavior and MUST be present in
the fixture with correct types (even if the value is synthetic or redacted):

- `type` — the discriminator field for both Claude and Codex records
- `uuid`, `parentUuid` — DAG structure in Claude records
- `call_id`, `tool_use_id` — tool call / tool result pairing
- `payload.type` — Codex payload type discriminator
- `session_id`, `turn_id` — Codex session / turn structure
- `timestamp` — for ordering and isTruncated detection
- `isCompactSummary` / `compact` / `compact.truncatedUuids` — compact boundary handling

## Directory Layout

```
real-shape/
  README.md            # This file
  claude/              # Redacted Claude Code JSONL snippets
    tool-result.jsonl  # tool_use + matching tool_result with tool_use_id
    thinking.jsonl     # thinking block interleaved with text
    compact.jsonl      # isCompactSummary / compact boundary record
  codex/               # Redacted Codex JSONL snippets
    function-call-output.jsonl  # function_call_output with output field
    custom-tool.jsonl           # custom_tool_call + custom_tool_call_output
    reasoning-web-search.jsonl  # reasoning and web_search_call (no unknown warnings)
```

## How to Add Fixtures

1. Copy the minimal lines from your local session that demonstrate the behavior.
2. Apply all redaction rules above.
3. Create a new `.jsonl` file in the appropriate subdirectory.
4. Add a test case in `tests/fixtures/parser-regression/real-shape.test.ts`.
5. Run `pnpm test:run tests/fixtures/parser-regression/real-shape.test.ts` to confirm.

## Investigation Reference

These fixtures were originally created from the 2026-05-08 investigation into
Claude session `606dac00-...`, Claude session `effac644-...`, Codex function/custom
tool sessions, and Claude subagent directory sessions. The investigation found that
real logs contain `tool_result`, `thinking`, and `isCompactSummary` records not
present in the earlier synthetic test fixtures.
