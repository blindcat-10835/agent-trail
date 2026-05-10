---
phase: 09-batch-2-session-replay-and-codex-subagent-relationship-fixes
plan: 02
subsystem: frontend/bff
tags: [frontend, bff-boundary, aggregate-pagination, sessions-right-rail]
dependency_graph:
  requires: []
  provides: [useAggregateSessions-pagination, aggregate-loadMore]
  affects: [sessions-right-rail]
tech_stack:
  added: [per-source pagination tracking, Map-based dedup, IntersectionObserver-driven loadMore]
  patterns: [TDD RED/GREEN cycle]
key_files:
  created: []
  modified:
    - lib/agent-tools/client-hooks.tsx
    - components/sessions/sessions-right-rail.tsx
    - tests/hooks/client-hooks.test.tsx
decisions:
  - Store paginationBySource as Partial<Record<SourceToolId, SourcePagination>> to track per-source offsets independently
  - Derive aggregate hasMore from any source with hasMore=true
  - loadMore fetches only sources with remaining pages, merges via Map keyed by session.id
  - totalCount stays derived from source pagination.total (indexed totals, not loaded rows)
metrics:
  duration: 3m
  completed: 2026-05-10
  tasks: 2
  files: 3
---

# Phase 09 Plan 02: All-source aggregate pagination Summary

Per-source offset/pagination state for aggregate session right rail — loadMore across three sources with dedup and freshness sort.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Commit | Message |
|--------|---------|
| c300657 | test(09-02): add failing aggregate pagination tests |
| ceba5aa | feat(09-02): implement per-source aggregate pagination with loadMore |

## TDD Gate Compliance

- RED gate: `c300657` — 2 tests failing (hasMore undefined, loadMore not a function)
- GREEN gate: `ceba5aa` — all 18 tests passing
- No REFACTOR gate needed — clean implementation

## What Was Built

### useAggregateSessions pagination (lib/agent-tools/client-hooks.tsx)

Extended the aggregate hook with per-source pagination tracking:

- `paginationBySource: Partial<Record<SourceToolId, SourcePagination>>` — stores `{total, limit, offset, hasMore}` per source after each fetch
- `hasMore` — derived from `Object.values(paginationBySource).some(p => p?.hasMore === true)`
- `isLoadingMore` — guard state to prevent concurrent loadMore calls
- `loadMore()` — fetches only sources where stored pagination has `hasMore=true`, using `offset = pagination.offset + pagination.limit`. Merges new sessions into prior via `Map<session.id>` for dedup, then sorts by `compareSessionsByFreshness`
- `refetch()` — re-runs the full initial aggregate fetch (reset)
- `totalCount` — sum of source `pagination.total` (indexed totals, not loaded rows)

### AggregateSessionsRightRail wiring (components/sessions/sessions-right-rail.tsx)

Updated to destructure and pass `hasMore`, `isLoadingMore`, `loadMore` from the hook into `SessionsRailContent`, replacing the previous `hasMore={false}` / `isLoadingMore={false}` hardcoded values. The existing `IntersectionObserver` sentinel in `SessionsRailContent` now triggers aggregate `loadMore`.

## Deferred Issues

Pre-existing typecheck errors (not caused by this plan):
- `tests/types.test.ts`: `GatewayStatus` not exported from `@/types/trace`
- `tests/unit/bff/markdown-content.test.tsx`: `toHaveAttribute` not recognized by vitest types

## Threat Flags

None — all fetches stay within BFF proxy boundary (`/api/agent-tools/[tool]/sessions`), no direct ingest calls added.

## Self-Check: PASSED

- All 3 modified files verified present
- Both commits (c300657, ceba5aa) verified in git log
- 18/18 tests passing
- No new typecheck errors introduced
