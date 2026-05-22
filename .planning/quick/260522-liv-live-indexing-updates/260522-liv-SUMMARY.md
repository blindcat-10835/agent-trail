---
status: complete
completed: 2026-05-22
commit: 3a2bd13
---

# Quick Task 260522-liv: Live Indexing Updates - Summary

## Result

The backlog issue is real. Ingest already emitted session and sync SSE events, but the composed `/api/v1/events` route could be shadowed by an old empty skeleton route, the BFF events route rejected the synthetic `all` shell scope, and no shell-level frontend subscription was wired to refresh dashboard/session data.

## Changes

- Removed the stale `/api/v1/events` skeleton from `ingest/api/sources.ts`, leaving the real SSE route as the only global event stream.
- Allowed `/api/agent-tools/all/events` to proxy global ingest SSE.
- Added `useIngestLiveUpdates()` to subscribe to SSE, coalesce matching source events, refresh ingest health, and dispatch the existing frontend refresh event.
- Made cached overview hooks refetch on that refresh event, so KPI/model/project/timeline/starred data updates without page reload.
- Added a shell header `INDEXING ...` chip driven by health/SSE state.
- Added regression tests for BFF event proxying, route composition, live hook refresh behavior, and overview cache refresh.

## Verification

- `node ./node_modules/vitest/vitest.mjs run tests/hooks/client-hooks.test.tsx tests/unit/bff/events-route.test.ts ingest/api/routes/events.test.ts` using the bundled Codex Node runtime: 38 tests passed.
- `pnpm typecheck`: passed.
- `pnpm typecheck:ingest`: passed.
- Targeted ESLint on touched files: passed.

## Notes

Full `pnpm lint` still fails on existing unrelated lint debt across the repository, including pre-existing React hook, `no-explicit-any`, and unused symbol findings outside this change.
