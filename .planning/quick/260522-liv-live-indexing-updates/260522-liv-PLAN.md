---
status: in_progress
created: 2026-05-22
slug: live-indexing-updates
---

# Quick Task 260522-liv: Live Indexing Updates

## Goal

Investigate `docs/backlog/live-indexing-updates.md`, confirm whether dashboard/session data stays stale while ingest indexing runs, and implement the smallest durable fix.

## Findings To Validate

- Ingest already emits SSE invalidation events from sync writes and sync completion.
- The app-level `/api/v1/events` route may be shadowed by an older skeleton route in `ingest/api/sources.ts`.
- Frontend exports `useSSE`, but current dashboard and sessions data paths do not subscribe to it.
- Overview cached data hooks do not currently refetch on the global refresh event.

## Tasks

1. Repair the SSE delivery path.
   - Files: `ingest/api/sources.ts`, `app/api/agent-tools/[tool]/events/route.ts`
   - Action: remove the stale skeleton route and allow synthetic `all` scope to proxy global ingest SSE.
   - Verify: route tests prove `/api/v1/events` emits the real connected event and BFF `/all/events` proxies.

2. Wire frontend live invalidation.
   - Files: `lib/agent-tools/client-hooks.tsx`, `components/shell/shell-header.tsx`, `app/globals.css`
   - Action: add a live updates hook that subscribes to SSE, dispatches refreshes for matching source events, refreshes ingest health state, and shows an indexing chip.
   - Verify: hook tests prove matching SSE events trigger refresh and cached overview data refetches.

3. Run targeted validation.
   - Files: affected tests and typecheck where feasible.
   - Action: run focused Vitest suites and TypeScript checks.
   - Verify: no regressions in SSE, client hooks, and BFF routes.
