---
phase: 05-turn-replay-ui
plan: 01
subsystem: Data Layer — BFF Pagination + Replay Store + Turns Hook
tags: [pagination, zustand, react-hooks, bff-proxy, tdd]
requires: []
provides:
  - paginated-turns-api
  - useSessionTurns-hook
  - useReplayStore-state
  - shadcn-scroll-area
  - shadcn-tooltip
affects:
  - app/api/agent-tools/[tool]/sessions/[sessionId]/turns
  - lib/agent-tools/*/server-adapter
  - lib/agent-tools/client-hooks
  - stores/replay-store
tech-stack:
  added:
    - "@tanstack/react-virtual"
    - "@testing-library/react"
    - "@testing-library/jest-dom"
    - "jsdom"
    - "shadcn scroll-area component"
    - "shadcn tooltip component"
  patterns:
    - "BFF proxy pagination passthrough"
    - "Zustand Set-based immutable state"
    - "fetchToolApi hook pattern"
    - "vitest jsdom environment for React hook tests"
key-files:
  created:
    - stores/replay-store.ts
    - tests/unit/bff/turns-pagination.test.ts
    - tests/unit/bff/replay-store-hooks.test.ts
    - components/ui/scroll-area.tsx
    - components/ui/tooltip.tsx
  modified:
    - lib/agent-tools/server-adapter.ts
    - lib/agent-tools/openclaw/server-adapter.ts
    - lib/agent-tools/claude-code/server-adapter.ts
    - lib/agent-tools/codex/server-adapter.ts
    - app/api/agent-tools/[tool]/sessions/[sessionId]/turns/route.ts
    - lib/agent-tools/client-hooks.tsx
decisions:
  - "BFF layer caps limit at 100 for safety (ingest caps at 1000)"
  - "Offset and limit validated as non-negative integers at BFF layer before adapter passthrough"
  - "Scroll position keyed by sessionId in replay store for back-navigation restoration"
  - "Filter 'all' clears all active filters instead of selecting all categories"
  - "useSessionTurns no-ops when sessionId is null (returns empty state, no fetch)"
  - "Adapter default offset=0, limit=50 when query params not provided"
metrics:
  duration: 12m 36s
  completed_date: 2026-05-06T20:31:57Z
  task_count: 2
  file_count: 11
  test_count: 18
  total_tests_passing: 197
  commits: 4
---

# Phase 5 Plan 1: BFF Pagination + Replay Data Foundation

Extended the BFF turns API with offset/limit pagination passthrough to ingest, created the Zustand ReplayStore for shared scroll/filter/expand/search state, and built the `useSessionTurns` data hook that all replay UI components will depend on.

## TDD Gate Compliance

| Gate  | Phase  | Commit      | Description                                    |
|-------|--------|-------------|------------------------------------------------|
| RED   | Task 1 | `1da3f2b`   | Failing tests for turns offset/limit pagination |
| GREEN | Task 1 | `ce6988a`   | Implement TurnsQueryParams, TurnsListResult, adapter/route pagination |
| RED   | Task 2 | `f3e5968`   | Failing tests for useReplayStore and useSessionTurns |
| GREEN | Task 2 | `198ac30`   | Implement Zustand store, hook, dependencies |

## Completed Tasks

### Task 1: BFF turns API + server adapter pagination

| Aspect       | Implementation                                                                       |
|-------------|-------------------------------------------------------------------------------------|
| **Adapters** | All 3 adapters (openclaw, claude-code, codex) forward `offset`/`limit` to ingest    |
| **Route**    | BFF parses `?offset=N&limit=M`, validates non-negative integers, caps limit at 100  |
| **Error handling** | 400 for invalid params, sanitized errors via existing `sanitizeError()`         |
| **Defaults** | Adapter defaults to offset=0, limit=50 if no query params                          |
| **Types**    | `TurnsQueryParams`, `TurnsListResult` added to adapter interface                    |

### Task 2: ReplayStore + useSessionTurns hook

| Aspect       | Implementation                                                                   |
|-------------|----------------------------------------------------------------------------------|
| **Store**    | Zustand store with scrollPositions, expandedTurns (Set), activeFilters (Set), search state |
| **Hook**     | `useSessionTurns(toolId, sessionId, query?)` returns `{ turns, pagination, loading, error, refetch }` |
| **Null sessionId** | No-op when sessionId is null — returns empty array, no fetch                   |
| **Dependencies** | `@tanstack/react-virtual`, shadcn `scroll-area`, shadcn `tooltip` installed     |
| **Test infra** | `@testing-library/react`, `jsdom` for jsdom-based React hook tests             |

## Deviations from Plan

None — plan executed exactly as written. All 5 adapter behaviors and 8 store/hook behaviors implemented and tested.

## Known Stubs

None. All implemented code is functional data plumbing with no placeholder values.

## Threat Flags

None. Both threat model mitigations (T-05-01 input validation, T-05-02 error sanitization) are implemented as specified.

## Verification Results

- `pnpm typecheck` — **PASS** (0 errors)
- `vitest run` — **197 tests passing** (17 test files)
- All files created/modified verified on disk
- All 4 commits verified in git history

## Self-Check: PASSED

- All 11 key files found on disk
- All 4 commits (1da3f2b, ce6988a, f3e5968, 198ac30) verified in git log
- pnpm typecheck returns no errors
- Full test suite passes (197/197)
