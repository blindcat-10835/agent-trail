---
type: fix
title: OpenClaw token usage always shows zero
status: done
priority: p1
created: 2026-05-25
branch: fix/openclaw-token-zero
worktree: .worktree/fix-openclaw-token-zero
updated: 2026-05-25
---
## Description

OpenClaw source token usage (input/output tokens, cost) always displays as 0 across the dashboard. The parsing or aggregation pipeline for OpenClaw token data is likely broken or missing. Needs investigation into the JSONL parser, turn assembler, and DB schema to trace where the token values are lost.

## Acceptance criteria

- [ ] OpenClaw token usage displays correct non-zero values
- [ ] Token data flows correctly from JSONL parser through to the frontend
