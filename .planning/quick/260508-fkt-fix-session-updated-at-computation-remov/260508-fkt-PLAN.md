---
phase: quick-260508-fkt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ingest/api/sessions.ts
  - lib/agent-tools/client-hooks.tsx
  - components/sessions/sessions-right-rail.tsx
  - tests/unit/ingest/sessions-api.test.ts
autonomous: true
requirements:
  - quick-fix:session-updated-at

must_haves:
  truths:
    - "Sessions sort by user-facing activity timestamps (started_at, ended_at, file_mtime), not by admin sync time (last_sync_at)"
    - "Recently-used sessions appear at the top of listings across all endpoints"
    - "Client-side freshness comparisons are consistent with server-side computed updated_at"
  artifacts:
    - path: "ingest/api/sessions.ts"
      provides: "UPDATED_AT_EXPR without last_sync_at"
      contains: "COALESCE(ended_at"
      not_contains: "last_sync_at"
    - path: "lib/agent-tools/client-hooks.tsx"
      provides: "getSessionFreshnessMs without lastSyncAt"
      lines: "function getSessionFreshnessMs"
    - path: "components/sessions/sessions-right-rail.tsx"
      provides: "getSessionFreshness without lastSyncAt"
    - path: "tests/unit/ingest/sessions-api.test.ts"
      provides: "Test verifies corrected sort order"
  key_links:
    - from: "ingest/api/sessions.ts UPDATED_AT_EXPR"
      to: "5 query locations (lines 58, 144, 156, 194)"
      via: "shared constant reference"
      pattern: "UPDATED_AT_EXPR"
    - from: "client-side sort"
      to: "server-side updated_at"
      via: "TraceSession.updatedAt field"
---

<objective>
Fix session `updated_at` computation to exclude administrative sync timestamps, ensuring sessions sort by user-facing activity time rather than batch-sync time.

**Purpose:** After a sync batch, `last_sync_at` was set to `new Date()` for all sessions, making every session's `updated_at` cluster around the same (recent) timestamp — destroying sort utility. The fix ensures sorting reflects actual session activity (start, end, file modification time).

**Output:** Corrected `UPDATED_AT_EXPR` in the ingest API, fixed client-side freshness functions, and updated test assertions.
</objective>

<execution_context>
@.opencode/get-shit-done/workflows/execute-plan.md
@.opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
All diagnosis complete. Three independent locations each include `last_sync_at` / `lastSyncAt` in freshness computation — each location must be fixed independently.

<interfaces>
From `ingest/api/sessions.ts`:
```typescript
const UPDATED_AT_EXPR =
  "MAX(COALESCE(ended_at, ''), COALESCE(started_at, ''), COALESCE(last_sync_at, ''), COALESCE(file_mtime, ''))";
```
Shared constant used in 5 query locations: lines 58, 144, 156, 194.

From `lib/agent-tools/client-hooks.tsx` (lines 419-430):
```typescript
function getSessionFreshnessMs(session: TraceSession): number {
  const dynamicSession = session as TraceSession & { updatedAt?, lastSyncAt? }
  return Math.max(
    toTime(dynamicSession.updatedAt),
    toTime(session.endedAt),
    toTime(session.startedAt),
    toTime(dynamicSession.lastSyncAt),  // ← REMOVE
  )
}
```

From `components/sessions/sessions-right-rail.tsx` (lines 270-281):
```typescript
function getSessionFreshness(session: TraceSession): string | null {
  const dynamicSession = session as TraceSession & { updatedAt?, lastSyncAt? }
  return getFreshestIso([
    dynamicSession.updatedAt,
    session.endedAt,
    session.startedAt,
    dynamicSession.lastSyncAt,  // ← REMOVE
  ])
}
```

From `tests/unit/ingest/sessions-api.test.ts` (lines 25-86):
Current test asserts buggy behavior — expects `last_sync_at` to dominate sort order.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Fix UPDATED_AT_EXPR in ingest API + update test expectations</name>
  <files>ingest/api/sessions.ts, tests/unit/ingest/sessions-api.test.ts</files>
  <action>
**File 1 — `ingest/api/sessions.ts` (line 16-17):**
Replace the `UPDATED_AT_EXPR` constant definition. Change from:
```
const UPDATED_AT_EXPR =
  "MAX(COALESCE(ended_at, ''), COALESCE(started_at, ''), COALESCE(last_sync_at, ''), COALESCE(file_mtime, ''))";
```
To:
```
const UPDATED_AT_EXPR =
  "MAX(COALESCE(ended_at, ''), COALESCE(started_at, ''), COALESCE(file_mtime, ''))";
```

This single change fixes all 5 query locations because they all reference the shared constant. No other code in this file needs modification — `last_sync_at` is still selected as a column for UI metadata display (e.g., "Last synced: ...") and `SessionRow.last_sync_at` / `parseSessionRow` still maps `lastSyncAt` — that field remains in the API response, it simply no longer contaminates the `updated_at` sort order.

**File 2 — `tests/unit/ingest/sessions-api.test.ts` (lines 75-86):**
Update the test to expect corrected (non-last_sync_at-contaminated) sort order. With `last_sync_at` removed from `UPDATED_AT_EXPR`, session 'newer-start-stale-sync' (started 2025-01-01) is fresher than 'older-start-recent-sync' (started 2024-01-01). Replace lines 81-85:

From:
```typescript
    expect(body.sessions.map((session: { id: string }) => session.id)).toEqual([
      'older-start-recent-sync',
      'newer-start-stale-sync',
    ])
    expect(body.sessions[0].updatedAt).toBe('2026-05-07T11:00:00.000Z')
```
To:
```typescript
    expect(body.sessions.map((session: { id: string }) => session.id)).toEqual([
      'newer-start-stale-sync',
      'older-start-recent-sync',
    ])
    expect(body.sessions[0].updatedAt).toBe('2025-01-01T00:00:00.000Z')
```

Also update the test description on line 25 from `'sorts by the freshest known timestamp for updated_at'` to `'sorts by user-facing activity timestamps for updated_at (excluding last_sync_at)'`.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/ingest/sessions-api.test.ts</automated>
  </verify>
  <done>Sessions API test passes with corrected sort order: newer session (by started_at) appears first, not the one with recent admin sync</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Remove lastSyncAt from client-side freshness comparisons</name>
  <files>lib/agent-tools/client-hooks.tsx, components/sessions/sessions-right-rail.tsx</files>
  <action>
**File 1 — `lib/agent-tools/client-hooks.tsx` (lines 419-430):**
Remove `toTime(dynamicSession.lastSyncAt)` from the `Math.max()` call in `getSessionFreshnessMs()`. Also clean up the type assertion to remove the `lastSyncAt` field since it's no longer needed.

Change from:
```typescript
function getSessionFreshnessMs(session: TraceSession): number {
  const dynamicSession = session as TraceSession & {
    updatedAt?: string | null
    lastSyncAt?: string | null
  }
  return Math.max(
    toTime(dynamicSession.updatedAt),
    toTime(session.endedAt),
    toTime(session.startedAt),
    toTime(dynamicSession.lastSyncAt),
  )
}
```
To:
```typescript
function getSessionFreshnessMs(session: TraceSession): number {
  const dynamicSession = session as TraceSession & {
    updatedAt?: string | null
  }
  return Math.max(
    toTime(dynamicSession.updatedAt),
    toTime(session.endedAt),
    toTime(session.startedAt),
  )
}
```

**File 2 — `components/sessions/sessions-right-rail.tsx` (lines 270-281):**
Remove `dynamicSession.lastSyncAt` from the array passed to `getFreshestIso()` in `getSessionFreshness()`. Clean up the type assertion similarly.

Change from:
```typescript
function getSessionFreshness(session: TraceSession): string | null {
  const dynamicSession = session as TraceSession & {
    updatedAt?: string | null
    lastSyncAt?: string | null
  }
  return getFreshestIso([
    dynamicSession.updatedAt,
    session.endedAt,
    session.startedAt,
    dynamicSession.lastSyncAt,
  ])
}
```
To:
```typescript
function getSessionFreshness(session: TraceSession): string | null {
  const dynamicSession = session as TraceSession & {
    updatedAt?: string | null
  }
  return getFreshestIso([
    dynamicSession.updatedAt,
    session.endedAt,
    session.startedAt,
  ])
}
```

No other references to `lastSyncAt` exist in these files. `lastSyncAt` remains available on the `TraceSession` type and API response — it's just excluded from freshness calculations.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>TypeScript compilation passes with no errors. Both client-side freshness functions compute activity-based freshness without admin sync contamination.</done>
</task>

</tasks>

<verification>
1. `npx vitest run tests/unit/ingest/sessions-api.test.ts` — all tests pass with corrected assertions
2. `npx tsc --noEmit` — no type errors
3. Manual sanity: after deploying, sessions in the explorer should sort by actual activity time (started_at / ended_at / file_mtime), not cluster around sync timestamps
</verification>

<success_criteria>
- `UPDATED_AT_EXPR` no longer references `last_sync_at`
- Client-side freshness functions (`getSessionFreshnessMs`, `getSessionFreshness`) no longer include `lastSyncAt`
- Unit test passes with corrected expectations (newer session by started_at sorts first, not sync-time session)
- `lastSyncAt` remains in API responses and retains its type for UI metadata — it is only excluded from freshness computations
</success_criteria>

<output>
After completion, create `.planning/quick/260508-fkt-fix-session-updated-at-computation-remov/260508-fkt-SUMMARY.md`
</output>
