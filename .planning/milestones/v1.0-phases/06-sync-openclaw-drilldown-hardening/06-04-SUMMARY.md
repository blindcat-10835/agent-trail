---
phase: 06-sync-openclaw-drilldown-hardening
plan: 04
subsystem: api, ui
tags: [sse, eventsource, bff-proxy, gateway, drilldown, session-lookup, hooks, zustand]

# Dependency graph
requires:
  - phase: 06-02
    provides: SSE connection manager, global + per-session event streaming endpoints
  - phase: 06-03
    provides: session lookup endpoint, rate limiter, error sanitization
provides:
  - BFF SSE proxy routes for frontend EventSource consumption
  - Gateway session key → ingest session ID lookup via BFF proxy
  - useSSE hook with exponential backoff auto-reconnect
  - useIngestStatus hook with periodic health polling
  - IngestStatus HUD component showing ingest connection state
  - OpenClaw dashboard Gateway drilldown with View Replay links and disconnected states
affects: [06-05-privacy-performance-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BFF SSE passthrough: Next.js route proxies ingest text/event-stream with abort signal propagation"
    - "SSE invalidation pattern: events notify frontend to re-fetch; data NOT pushed inline"
    - "Exponential backoff reconnect: 3s base, max 15s, 10 retries for EventSource"
    - "Adapter interface extension: lookupSessionByKey added to AgentToolServerAdapter contract"
    - "HUD status indicator pattern: color-coded dot + label for ingest connectivity"

key-files:
  created:
    - app/api/agent-tools/[tool]/events/route.ts
    - app/api/agent-tools/[tool]/sessions/lookup/route.ts
    - components/hud/ingest-status.tsx
    - tests/hooks/client-hooks.test.tsx
    - tests/components/openclaw-dashboard.test.tsx
  modified:
    - lib/agent-tools/client-hooks.tsx
    - lib/agent-tools/server-adapter.ts
    - lib/agent-tools/openclaw/server-adapter.ts
    - lib/agent-tools/claude-code/server-adapter.ts
    - lib/agent-tools/codex/server-adapter.ts
    - app/(tool-shell)/[tool]/dashboard/openclaw-dashboard.tsx
    - components/hud/shell-status-bar.tsx

key-decisions:
  - "OpenClaw adapter lookupSessionByKey uses ingest lookup endpoint with source=openclaw; Claude/Codex return null (no Gateway integration per CONTEXT.md)"
  - "Gateway session keys truncated to 40 chars in dashboard display (threat model T-06-04-04)"
  - "KPI section remains skeleton placeholder — intentionally not connected to Gateway (per D-13)"
  - "Not yet indexed label is displayed (not hidden) for unmatched Gateway sessions (per CONTEXT.md D-10)"

patterns-established:
  - "BFF SSE proxy: text/event-stream passthrough with Node.js runtime, no-cache, X-Accel-Buffering: no"
  - "Gateway drilldown: fetch lookup per session via BFF proxy, best-effort matching"
  - "IngestStatus: self-contained component using useAgentTool + useIngestStatus, works across all tools"

requirements-completed: [OPEN-02, OPEN-03]

# Metrics
duration: 14min
completed: 2026-05-07
---

# Phase 06 Plan 04: Frontend SSE Hook, Gateway Drilldown & Ingest Status Summary

**BFF SSE proxy routes, EventSource subscriber hook with auto-reconnect, Gateway-to-ingest drilldown on OpenClaw dashboard, and shell status bar ingest connectivity indicator**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-07T05:49:03Z
- **Completed:** 2026-05-07T06:02:56Z
- **Tasks:** 3
- **Files modified/created:** 12 (5 created, 7 modified)

## Accomplishments

- BFF SSE proxy route at `/api/agent-tools/[tool]/events` forwards ingest `text/event-stream` to browser with abort signal propagation and Node.js runtime for long-lived connections
- BFF lookup proxy route at `/api/agent-tools/[tool]/sessions/lookup?key=` matches Gateway session keys to ingest session IDs, with 400 on missing key and 404 on no match
- `lookupSessionByKey` added to `AgentToolServerAdapter` interface — OpenClaw calls ingest, Claude/Codex return null (no Gateway integration)
- `useSSE` hook with `EventSource` auto-reconnect (exponential backoff: 3s×{1..5}, max 10 retries), support for both global and per-session event streams
- `useIngestStatus` hook with periodic health polling (connected/reconnecting/disconnected/loading) matching existing HUD status pattern
- `IngestStatus` component showing color-coded ingest connection state in shell status bar footer
- OpenClaw dashboard transformed from skeleton to live Gateway state display with GATEWAY DISCONNECTED/connecting/connected states, Gateway session cards with View Replay drilldown links, and "Not yet indexed" labels for unmatched sessions
- KPI/Agents/Skills/Cron/Activity sections kept as placeholders (per D-13)

## Task Commits

Each task was committed atomically (TDD — RED/GREEN per task):

1. **Task 1: BFF SSE Proxy Route + Server Adapter Lookup Extension**
   - `a088784` (test/RED): 3 adapter test files for lookupSessionByKey
   - `48c12a9` (feat/GREEN): events proxy route, lookup proxy route, adapter interface + implementations

2. **Task 2: useSSE Hook + useIngestStatus Hook + IngestStatus Component**
   - `e094bf6` (test/RED): hook export tests for useSSE and useIngestStatus
   - `122fce5` (feat/GREEN): useSSE, useIngestStatus, IngestStatus component, shell-status-bar wiring

3. **Task 3: OpenClaw Dashboard Drilldown Links + Gateway State Display**
   - `05bc15b` (test/RED): component tests for Gateway state display
   - `2349d82` (feat/GREEN): full dashboard with Gateway status, active sessions, View Replay, Not yet indexed

## Files Created/Modified

- `app/api/agent-tools/[tool]/events/route.ts` — BFF SSE proxy pass-through to ingest with abort signal, Node.js runtime, SSE headers
- `app/api/agent-tools/[tool]/sessions/lookup/route.ts` — BFF lookup proxy with key validation, OpenClaw-only Gateway matching
- `lib/agent-tools/server-adapter.ts` — Extended `AgentToolServerAdapter` interface with `lookupSessionByKey(key): Promise<TraceSession | null>`
- `lib/agent-tools/openclaw/server-adapter.ts` — Implemented `lookupSessionByKey` calling ingest `/api/v1/sessions/lookup?source=openclaw&key=...`
- `lib/agent-tools/claude-code/server-adapter.ts` — Stub `lookupSessionByKey` returning null (no Gateway integration)
- `lib/agent-tools/codex/server-adapter.ts` — Stub `lookupSessionByKey` returning null (no Gateway integration)
- `lib/agent-tools/client-hooks.tsx` — Added `useSSE` hook (EventSource with backoff reconnect) and `useIngestStatus` hook (health polling)
- `components/hud/ingest-status.tsx` — Color-coded HUD status indicator for ingest connectivity
- `components/hud/shell-status-bar.tsx` — Wired `<IngestStatus />` into footer left section
- `app/(tool-shell)/[tool]/dashboard/openclaw-dashboard.tsx` — Full Gateway state display with GATEWAY STATUS, ACTIVE GATEWAY SESSIONS drilldown
- `tests/hooks/client-hooks.test.tsx` — 4 hook export/type tests
- `tests/components/openclaw-dashboard.test.tsx` — 4 component tests for Gateway state and sections

## Decisions Made

- OpenClaw adapter's `lookupSessionByKey` catches "Session not found" errors and returns null (best-effort matching) rather than throwing — enables the "Not yet indexed" UI state
- Claude Code and Codex adapters return null from `lookupSessionByKey` (no Gateway integration per Phase 6 scope)
- Session keys truncated to 40 chars in dashboard display per threat model T-06-04-04
- KPI section intentionally remains skeleton — Gateway live KPI data not connected (per D-13, future phase)
- SSE proxy uses `request.signal` passthrough so browser disconnect propagates to ingest (no orphan connections)
- `useSSE` uses exponential backoff (3s base × retries capped at 5, max 15s) to prevent reconnection storms

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated vitest config to include .tsx test files**
- **Found during:** Task 2 RED phase
- **Issue:** vitest.config.ts only matched `*.test.ts` glob — React hook/component tests in `.tsx` files were excluded
- **Fix:** Added `tests/**/*.test.tsx` and `lib/**/*.test.tsx` to vitest `include` array
- **Files modified:** vitest.config.ts
- **Verification:** Tests in `tests/hooks/` and `tests/components/` discovered and executed
- **Committed in:** e094bf6 (Task 2 RED commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Config change was necessary for TDD flow. No scope creep.

## Issues Encountered

- `useRef<ReturnType<typeof setTimeout>>()` caused TS2554 in React 19 — fixed by providing explicit `undefined` initial value
- Pre-existing build failure: `(legacy)` and `(shell)` route groups conflict in Turbopack — unrelated to this plan's changes, not addressed
- Pre-existing test failure: `tests/fixtures/parser-regression/claude-compact-boundary.test.ts` — 1 test failing (isTruncated flag), unrelated to this plan

## Next Phase Readiness

- BFF SSE proxy routes operational — frontend can subscribe to ingest events without direct ingest access
- Gateway drilldown links functional when Gateway is connected and sessions are indexed
- IngestStatus indicator visible in shell status bar across all tools
- All 313 tests passing; typecheck clean
- Ready for Plan 06-05 (Privacy, Performance & Hardening)

---

*Phase: 06-sync-openclaw-drilldown-hardening*
*Completed: 2026-05-07*

## Self-Check: PASSED

- SUMMARY.md exists ✓
- All 6 commits verified (a088784, 48c12a9, e094bf6, 122fce5, 05bc15b, 2349d82) ✓
- All 5 created files verified ✓
