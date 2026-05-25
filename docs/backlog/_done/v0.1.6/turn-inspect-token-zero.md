---
type: fix
title: Turn inspect shows zero input/output tokens for Codex and OpenCode
status: wip
priority: p1
created: 2026-05-25
updated: 2026-05-25
branch: fix/turn-inspect-token-zero
worktree: .worktree/fix-turn-inspect-token-zero
---

## Description

In the session detail page's turn inspector, Codex and OpenCode turns show 0 for both input and output tokens. The token values are either not being parsed from the source JSONL, not stored in the DB, or not returned by the API. Need to trace the full pipeline for each source.

Additionally, verify whether other sources (OpenClaw, Claude Code) have the same issue in turn inspect — the user wants confirmation across all sources.

## Investigation notes

- OpenClaw was already correct: `message.usage` is normalized onto `TraceMessage.tokenUsage`, persisted as `messages.token_usage_json`, and included by the turn assembler.
- Claude Code was already correct: `message.usage` is normalized onto `TraceMessage.tokenUsage`, including cache read/write fields, then persisted and assembled into turn usage.
- Codex had the issue: `token_count` events updated session metrics and daily rollups, but the last-token usage was not attached to any persisted message, so turn inspect aggregated 0 from messages.
- OpenCode had the issue: session totals were parsed from the `session` table, but real `message.data.tokens` values were ignored, so messages were persisted without `token_usage_json`.

## Acceptance criteria

- [ ] Codex turn inspect shows correct input/output token counts
- [ ] OpenCode turn inspect shows correct input/output token counts
- [ ] Verify and fix token display for all other sources (OpenClaw, Claude Code)
- [ ] Document which sources had the issue and which were already correct
