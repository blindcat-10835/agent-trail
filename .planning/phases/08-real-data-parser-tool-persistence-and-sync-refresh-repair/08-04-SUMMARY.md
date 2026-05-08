---
phase: 08-real-data-parser-tool-persistence-and-sync-refresh-repair
plan: "04"
title: Wire sync-first refresh through ingest API, BFF, and right rail
subsystem: frontend-sync
tags:
  - refresh
  - bff
  - sync
  - frontend
dependency_graph:
  requires:
    - transactional-session-writes
    - force-reparse-path
  provides:
    - aggregate-bff-sync-with-force
    - per-source-bff-sync-route
    - sync-tool-sessions-client-helper
    - sync-all-sessions-client-helper
    - sync-first-right-rail-refresh
    - sync-first-header-refresh
  affects:
    - app/api/sync/route.ts
    - app/api/agent-tools/[tool]/sync/route.ts
    - lib/agent-tools/client-hooks.tsx
    - components/sessions/sessions-right-rail.tsx
    - components/shell/shell-header.tsx
    - tests/hooks/client-hooks.test.tsx
    - tests/unit/bff/sync-route.test.ts
tech_stack:
  added: []
  patterns:
    - Sync-first refresh pattern (sync then notifySessionsRefresh/refetch)
    - BFF proxy layer for per-source and aggregate sync triggers
    - Disabled/spinning refresh button during sync to prevent overlapping requests
    - Per-source and aggregate sync helpers in client-hooks (BFF only)
key_files:
  created:
    - app/api/agent-tools/[tool]/sync/route.ts
    - tests/unit/bff/sync-route.test.ts
  modified:
    - app/api/sync/route.ts
    - lib/agent-tools/client-hooks.tsx
    - components/sessions/sessions-right-rail.tsx
    - components/shell/shell-header.tsx
    - tests/hooks/client-hooks.test.tsx
decisions:
  - "Per-source sync route uses assertSourceToolId to reject 'all' and unknown tool IDs at the BFF boundary"
  - "syncAllSessions() still notifySessionsRefresh() even when sync throws — preserves current session list"
  - "SourceSessionsRightRail calls sourceSessions.refetch() in finally block — sync error does not block UI update"
  - "Request type changed to plain Request (not NextRequest) in route handlers for testability without full Next.js runtime"
  - "force param forwarded as JSON body only when force=true — no body sent for normal refreshes"
metrics:
  duration: "14m"
  completed: "2026-05-08"
  tasks_completed: 6
  files_created: 2
  files_modified: 5
  tests_added: 19
  tests_passing: 406
---

# Phase 08 Plan 04: Wire Sync-First Refresh Through Ingest API, BFF, and Right Rail Summary

## One-Liner

Sync-first refresh pattern wired through aggregate and per-source BFF routes with client helpers, disabled button during sync, and error isolation — manual refresh now triggers ingest reindex before session list refetch.

## What Was Built

### Task 1: Ingest Sync API (Already Complete from Plan 03)

`POST /api/v1/sources/:type/sync` was already implemented in Plan 03 with full `force` support and response shape including `messagesInserted`, `sessionsInserted`, `sessionsUpdated`, `toolCallsInserted`, `toolResultEventsInserted`, and `errors`. No changes needed.

### Task 2: Aggregate BFF Sync Route

Updated `app/api/sync/route.ts`:

- Accepts `force` from query param (`?force=true`) or JSON body (`{ force: true }`)
- Loops all 3 source types (`openclaw`, `claude-code`, `codex`) calling ingest sync for each
- Returns `{ results, force }` — per-source results with sanitized errors
- Partial failure supported: one source failure doesn't abort others; failed source has `status: 'failed'` and `error` in the result
- Changed from `NextRequest` to plain `Request` for testability without full Next.js runtime

### Task 3: Per-Source BFF Sync Route

New `app/api/agent-tools/[tool]/sync/route.ts`:

- `POST /api/agent-tools/:tool/sync`
- Validates `[tool]` with `assertSourceToolId` — rejects `all` and unknown tool IDs with 400
- Accepts `force` from query param or body
- Proxies to `POST /api/v1/sources/:toolId/sync` via `fetchIngest()`
- Uses `sanitizeError()` on failures — never exposes internal paths or stack traces to frontend

### Task 4: Client Sync Helpers

Added two exported functions to `lib/agent-tools/client-hooks.tsx`:

**`syncToolSessions(toolId, options?)`**: Calls `POST /api/agent-tools/:toolId/sync` — per-source sync via BFF only. Accepts `{ force?: boolean }` option. Throws on non-ok response for caller error handling.

**`syncAllSessions(options?)`**: Calls `POST /api/sync` — aggregate sync via BFF only. Same error propagation contract.

Both functions call BFF routes exclusively, never ingest directly (per D-10).

### Task 5: Sync-First Refresh Controls

**`AggregateSessionsRightRail`**:
- Added `useState(false)` for `syncing` state
- `handleRefresh()` is now async: calls `syncAllSessions()`, then `notifySessionsRefresh()` in finally
- Sync error stored in `syncError` state, displayed in rail error area
- `notifySessionsRefresh()` always called even on sync failure (preserves current list)
- Refresh button disabled and shows `cursor-not-allowed opacity-50` + "Syncing…" tooltip while syncing

**`SourceSessionsRightRail`**:
- Same pattern with `syncToolSessions(sourceToolId)` instead
- `sourceSessions.refetch()` called in finally for session list reload
- Sync error shown until next successful refresh clears it

**`SessionsRailContent`**:
- Added optional `syncing?: boolean` prop to control button disabled state
- `RefreshCw` icon spins during both `loading` and `syncing`
- Button disabled with `cursor-not-allowed opacity-50` during sync

**`ShellHeader`**:
- Replaced direct `fetch('/api/sync', { method: 'POST' })` with `syncAllSessions()` helper
- Added error catch that still calls `notifySessionsRefresh()` — header refresh is best-effort

### Task 6: Tests

**`tests/hooks/client-hooks.test.tsx`** (8 new tests added, 14 total):

- `syncToolSessions()` calls correct BFF URL with POST method
- `syncToolSessions()` appends `?force=true` when option is set
- `syncToolSessions()` does not append force param when not set
- `syncToolSessions()` throws with error message on non-ok response
- `syncToolSessions()` error propagation contract (caller catches, preserves list)
- `syncAllSessions()` calls `/api/sync` with POST
- `syncAllSessions()` appends `?force=true` when option is set
- `syncAllSessions()` throws on non-ok response

**`tests/unit/bff/sync-route.test.ts`** (11 new tests):

- Per-source route calls `/api/v1/sources/:type/sync`
- Returns 200 with sync result on success
- Forwards `force=true` via query param to ingest
- No force in body when not requested
- Returns 400 for invalid tool `all`
- Returns 400 for unknown tool IDs
- Returns sanitized 502 error (not internal message) when ingest fails
- Aggregate route calls all 3 source types
- Aggregate route forwards `force=true` to all sources
- Aggregate route returns per-source results array with 3 entries
- Aggregate route returns partial results when one source fails (200 overall status)

Total tests: 406 passing (381 pre-existing + 25 new).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `app/api/sync/route.ts` used `NextRequest.nextUrl.searchParams` which is unavailable in test context**
- **Found during:** Task 6 BFF route test run
- **Issue:** Test mocked plain `Request` objects, but route called `request.nextUrl.searchParams.get('force')` — a property only on `NextRequest`. Tests failed with "Cannot read properties of undefined (reading 'searchParams')".
- **Fix:** Changed both sync routes to use `new URL(request.url)` for query param access, which works with both `NextRequest` and plain `Request`. Changed param type from `NextRequest` to `Request` (both extend the Fetch API Request contract).
- **Files modified:** `app/api/sync/route.ts`, `app/api/agent-tools/[tool]/sync/route.ts`
- **Commits:** 8fb0906

## Acceptance Criteria Verification

- [x] Right rail refresh for a source triggers ingest sync for that source before session list refetch
- [x] Aggregate refresh triggers all-source sync before list refetch
- [x] Header refresh keeps sync-first behavior and supports the same force forwarding
- [x] No client code calls `http://localhost:8078` directly — only BFF routes are called
- [x] Force sync can be invoked through BFF for post-parser-fix reindex verification

## Known Stubs

None. All sync flows are wired: frontend refresh button → BFF sync route → ingest source sync → session list refetch.

## Self-Check: PASSED
