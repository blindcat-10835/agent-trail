---
phase: quick-260508-fkt
plan: 01
type: quick-fix
autonomous: true
date: "2026-05-08"
duration: "~2 min"

key-files:
  modified:
    - ingest/api/sessions.ts
    - tests/unit/ingest/sessions-api.test.ts
    - lib/agent-tools/client-hooks.tsx
    - components/sessions/sessions-right-rail.tsx

tech-stack:
  patterns:
    - shared constant reference (UPDATED_AT_EXPR) for single-point fix across 5 query locations
    - COALESCE + MAX for timestamp freshness computation
  removed:
    - last_sync_at from UPDATED_AT_EXPR SQL expression
    - lastSyncAt from client-side Math.max() freshness computation
    - lastSyncAt from client-side getFreshestIso() freshness computation

decisions:
  - "last_sync_at is retained in SELECT columns and SessionRow type for UI metadata display — it is only excluded from freshness/sort computations"

commits:
  - hash: "85f2240"
    message: "fix(quick-260508-fkt): remove last_sync_at from session updated_at computation"
  - hash: "1a89b1c"
    message: "fix(quick-260508-fkt): remove lastSyncAt from client-side session freshness"

requirements_completed:
  - quick-fix:session-updated-at
---

# Quick Fix: Remove last_sync_at from session updated_at computation

**One-liner:** Excluded batch-sync timestamps (`last_sync_at`) from session freshness/sort computations, ensuring sessions sort by user-facing activity time (start/end/file modification) instead of clustering around administrative sync times.

## What Was Done

### Problem

After a sync batch, `last_sync_at` was set to `new Date()` for every session, which caused all sessions' `updated_at` to cluster around the same recent timestamp — destroying sort utility. Sessions no longer sorted meaningfully by actual activity.

### Root Cause

Three independent locations each included `last_sync_at` / `lastSyncAt` in the freshness computation:

1. **Server-side:** `UPDATED_AT_EXPR` in `ingest/api/sessions.ts` included `COALESCE(last_sync_at, '')` in the `MAX()` expression, affecting all 5 query locations that reference this shared constant.
2. **Client-side (hooks):** `getSessionFreshnessMs()` in `lib/agent-tools/client-hooks.tsx` included `toTime(dynamicSession.lastSyncAt)` in its `Math.max()` call.
3. **Client-side (UI):** `getSessionFreshness()` in `components/sessions/sessions-right-rail.tsx` included `dynamicSession.lastSyncAt` in its `getFreshestIso()` array.

### Fix Applied

**Task 1 — Server-side (commit `85f2240`):**
- Removed `COALESCE(last_sync_at, '')` from `UPDATED_AT_EXPR` — now computes freshness as: `MAX(COALESCE(ended_at, ''), COALESCE(started_at, ''), COALESCE(file_mtime, ''))`
- Updated test expectations: session `newer-start-stale-sync` (started 2025-01-01) now correctly sorts before `older-start-recent-sync` (started 2024-01-01, but with recent sync)
- Updated test description to reflect the corrected behavior
- `last_sync_at` remains SELECTed as a column and mapped in `parseSessionRow` — still available in API responses for UI metadata

**Task 2 — Client-side (commit `1a89b1c`):**
- Removed `toTime(dynamicSession.lastSyncAt)` from `getSessionFreshnessMs()` in `client-hooks.tsx`
- Removed `dynamicSession.lastSyncAt` from the array in `getSessionFreshness()` in `sessions-right-rail.tsx`
- Cleaned up type assertions to remove unused `lastSyncAt?: string | null` fields

### Verification

| Check | Status |
|-------|--------|
| `npx vitest run tests/unit/ingest/sessions-api.test.ts` | PASS (1/1) |
| `npx tsc --noEmit` | PASS (no errors) |
| `UPDATED_AT_EXPR` no longer references `last_sync_at` | PASS |
| Client-side freshness functions exclude `lastSyncAt` | PASS |
| `lastSyncAt` retained in API responses/type for metadata | PASS |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — no new endpoints, auth paths, or security surface introduced. This is a pure removal of a data point from sort computation.

## Known Stubs

None — no stubs introduced. All changes are removals of existing data points from freshness computations.

## Self-Check: PASSED

All modified files exist and contain expected changes. Both commits exist in git history.
