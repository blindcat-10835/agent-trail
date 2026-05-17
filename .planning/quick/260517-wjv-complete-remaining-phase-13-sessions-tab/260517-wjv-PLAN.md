---
quick_id: 260517-wjv
slug: complete-remaining-phase-13-sessions-tab
status: complete
created: 2026-05-17
---

# Quick Task 260517-wjv: Complete Remaining Phase 13 Sessions Table Gaps

## Goal

Close the concrete Phase 13 gaps found in the Sessions table and Trace Detail v2 implementation:

- Sessions list must use backend search/filter/sort/pagination instead of fetching a fixed large page and sorting locally.
- `SORT · ACTIVITY` must have real behavior.
- Session rows must expose branch, summary, model, input/output token split, duration, and activity counts where data exists.
- Detail must load more than the first 100 turns.
- Long trace rendering must use virtualization or pagination without layout collapse.

## Tasks

1. Extend ingest sessions API query support and response enrichment.
   - Files: `ingest/api/sessions.ts`, `tests/unit/ingest/sessions-api.test.ts`, `types/trace.ts`
   - Verify: targeted sessions API tests pass.

2. Wire Sessions list to backend query/pagination and render missing fields.
   - Files: `components/sessions/sessions-list-page.tsx`, `lib/agent-tools/client-hooks.tsx`, `app/globals.css`
   - Verify: typecheck catches prop/type regressions.

3. Fix detail pagination and long-session trace rendering.
   - Files: `app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx`, `components/replay/trace-thread.tsx`, `lib/agent-tools/client-hooks.tsx`, `app/globals.css`
   - Verify: targeted hook and typecheck/tests pass.

## Checks

- `pnpm vitest run tests/unit/ingest/sessions-api.test.ts`
- `pnpm vitest run tests/hooks/client-hooks.test.tsx`
- `pnpm typecheck`
- `pnpm typecheck:ingest`
