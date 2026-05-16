---
quick_id: 260516-nvg
status: planned
created: 2026-05-16
---

# Quick Task 260516-nvg: Token Accounting Repair

## Goal

Fix session token calculation so OpenClaw, Claude Code, and Codex preserve their real token channel semantics instead of collapsing everything to input/output only.

## Scope

- Extend canonical token/session metrics with cache, reasoning, and authoritative total fields.
- Update Claude parser to include cache creation and cache read tokens.
- Update Codex parser to preserve cached input, reasoning output, and upstream total token semantics.
- Add session summary columns and migrations for the new token channels.
- Fix incremental append writes so Codex token_count deltas update session totals.
- Update overview/session APIs to use authoritative total token totals with backward-compatible fallback.
- Add targeted regression coverage.

## Verification

- Targeted parser and sync tests for Claude/Codex token accounting.
- Ingest typecheck.
