---
phase: 04-multi-source-frontend-shell-session-explorer
plan: 02
subsystem: api
tags: [bff-proxy, ingest, nextjs-api-routes, server-adapter, nextjs, typescript]

# Dependency graph
requires:
  - phase: 04-01
    provides: AgentToolId types, registry, assertAgentToolId, per-tool definitions
  - phase: 02-local-ingest-core-openclaw-parser
    provides: ingest REST API at localhost:8078 (/api/v1/sessions, /api/v1/sessions/:id/messages, /api/v1/sessions/:id/turns)
provides:
  - BFF API proxy routes at /api/agent-tools/[tool]/health, /sessions, /sessions/[sessionId], /sessions/[sessionId]/messages, /sessions/[sessionId]/turns
  - Server adapter interface (AgentToolServerAdapter) with shared fetchIngest(), sanitizeError(), validateSessionId()
  - Three per-tool server adapters (openclaw, claude-code, codex) with source-aware listSessions()
  - Five legacy redirect pages preserving existing bookmarks (/dashboard, /sessions, /activity, /office, /workspace → /openclaw/*)
affects: [04-03-shell-migration, 04-04-session-explorer, 04-05-aggregate-landing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BFF Proxy: Next.js API routes proxy ingest service at localhost:8078; frontend never calls ingest directly (same-origin, no CORS)"
    - "Server Adapter: Per-tool adapters implement AgentToolServerAdapter with source-injected listSessions(); single route handler dispatches via assertAgentToolId()"
    - "Error Sanitization: sanitizeError() strips internal details; validateSessionId() uses regex /^[a-zA-Z0-9:\\-_.]{1,256}$/ at trust boundaries"
    - "Caching: ISR revalidate=30s for session lists, no-store for session detail (per UI-SPEC)"
    - "Legacy Redirects: Server-component redirect() from next/navigation (307 Temporary Redirect)"

key-files:
  created:
    - lib/agent-tools/server-adapter.ts - Base adapter interface, fetchIngest(), sanitizeError(), validateSessionId()
    - lib/agent-tools/openclaw/server-adapter.ts - OpenClaw ingest adapter (source=openclaw)
    - lib/agent-tools/claude-code/server-adapter.ts - Claude Code ingest adapter (source=claude-code)
    - lib/agent-tools/codex/server-adapter.ts - Codex ingest adapter (source=codex)
    - app/api/agent-tools/[tool]/health/route.ts - GET health proxy
    - app/api/agent-tools/[tool]/sessions/route.ts - GET sessions list proxy
    - app/api/agent-tools/[tool]/sessions/[sessionId]/route.ts - GET single session proxy
    - app/api/agent-tools/[tool]/sessions/[sessionId]/messages/route.ts - GET messages proxy
    - app/api/agent-tools/[tool]/sessions/[sessionId]/turns/route.ts - GET turns proxy
    - app/(legacy)/dashboard/page.tsx - Legacy redirect → /openclaw/dashboard
    - app/(legacy)/sessions/page.tsx - Legacy redirect → /openclaw/sessions
    - app/(legacy)/activity/page.tsx - Legacy redirect → /openclaw/activity
    - app/(legacy)/office/page.tsx - Legacy redirect → /openclaw/office
    - app/(legacy)/workspace/page.tsx - Legacy redirect → /openclaw/workspace
  modified: []

key-decisions:
  - "Server adapters inject source query param at the adapter layer, keeping API routes tool-agnostic — no `if toolId === 'openclaw'` branching in route handlers (per D-08)"
  - "Session list caching uses ISR revalidate=30s on fetchIngest calls rather than NextResponse headers — aligns with UI-SPEC strategy for session freshness"
  - "Session detail uses cache: 'no-store' on fetchIngest calls to always reflect fresh ingest data"
  - "Legacy redirects use redirect() (307 Temporary Redirect) instead of permanentRedirect() (308) — routes may return in future phases (per D-05)"
  - "Session ID validation regex /^[a-zA-Z0-9:\\-_.]{1,256}$/ matches ingest's own validation to catch invalid IDs at the BFF boundary (per T-04-04)"

patterns-established:
  - "BFF Proxy Pattern: Next.js route handlers in app/api/agent-tools/[tool]/... validate tool param via assertAgentToolId(), dispatch to singleton per-tool adapter, return NextResponse.json() with sanitized errors"
  - "Server Adapter Singleton: Each tool exports a singleton adapter instance (e.g., openclawAdapter) — created once at module load, reused across all requests"
  - "Error Boundary: try/catch in every API route → sanitizeError() strips internals → { error: string, code: number } response shape"

requirements-completed: [UI-03, UI-05]

# Metrics
duration: 12min
completed: 2026-05-07
---

# Phase 4 Plan 2: BFF Proxy API Routes and Server Adapters Summary

**BFF API proxy layer proxying ingest service (port 8078) through 5 Next.js route handlers with per-tool server adapters, centralized error sanitization, session ID validation, and ISR caching; plus 5 legacy redirect pages preserving existing bookmarks with 307 redirects to /openclaw/***

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-06T23:50:00Z
- **Completed:** 2026-05-07T00:02:00Z
- **Tasks:** 2
- **Files created:** 14

## Accomplishments

- Created 4 server adapter files establishing the BFF data access layer: base interface (`AgentToolServerAdapter`) with shared fetch utility (`fetchIngest`), error sanitizer (`sanitizeError`), and session ID validator (`validateSessionId`); plus 3 per-tool adapters (openclaw, claude-code, codex) that inject source-aware query params into ingest API calls
- Implemented 5 unified BFF API route handlers under `app/api/agent-tools/[tool]/` that dispatch to per-tool adapters via `assertAgentToolId()` — single handler serves all 3 tools with no tool-conditional branching
- Added 5 legacy redirect pages preserving existing bookmarks with seamless 307 redirects from `/dashboard`, `/sessions`, `/activity`, `/office`, `/workspace` to their `/openclaw/*` equivalents
- Applied threat model mitigations: tool param validation (T-04-03), sessionId regex validation (T-04-04), error sanitization stripping internals (T-04-05), limit capping at 100 (T-04-06)
- Established Next.js ISR caching strategy: session lists revalidate every 30 seconds; session detail uses no-store for always-fresh data

## Task Commits

1. **Task 1: Create base server adapter interface and shared ingest fetch utility** - `24ee026` (feat)
2. **Task 2: Create BFF API proxy routes and add legacy redirects** - `001ef8f` (feat)

## Files Created/Modified

- `lib/agent-tools/server-adapter.ts` — Base adapter interface (`AgentToolServerAdapter`), `fetchIngest<T>()` with Next.js caching options, `sanitizeError()`, `validateSessionId()`, `sanitizeLimit()`, `SessionListResult` type
- `lib/agent-tools/openclaw/server-adapter.ts` — OpenClaw adapter: `createOpenClawAdapter()` injecting `source=openclaw` into listSessions queries
- `lib/agent-tools/claude-code/server-adapter.ts` — Claude Code adapter: `createClaudeCodeAdapter()` injecting `source=claude-code`
- `lib/agent-tools/codex/server-adapter.ts` — Codex adapter: `createCodexAdapter()` injecting `source=codex`
- `app/api/agent-tools/[tool]/health/route.ts` — GET health check proxied to ingest `/health`
- `app/api/agent-tools/[tool]/sessions/route.ts` — GET session list with query params forwarded to ingest; adapter lookup map dispatches per tool
- `app/api/agent-tools/[tool]/sessions/[sessionId]/route.ts` — GET single session detail; 404 if not found
- `app/api/agent-tools/[tool]/sessions/[sessionId]/messages/route.ts` — GET session messages
- `app/api/agent-tools/[tool]/sessions/[sessionId]/turns/route.ts` — GET session turns
- `app/(legacy)/dashboard/page.tsx` — Legacy redirect `/dashboard` → `/openclaw/dashboard` (307)
- `app/(legacy)/sessions/page.tsx` — Legacy redirect `/sessions` → `/openclaw/sessions` (307)
- `app/(legacy)/activity/page.tsx` — Legacy redirect `/activity` → `/openclaw/activity` (307)
- `app/(legacy)/office/page.tsx` — Legacy redirect `/office` → `/openclaw/office` (307)
- `app/(legacy)/workspace/page.tsx` — Legacy redirect `/workspace` → `/openclaw/workspace` (307)

## Decisions Made

- Server adapters inject `source` query param at the adapter layer, keeping API routes tool-agnostic — no `if toolId === 'openclaw'` branching in route handlers (per D-08)
- Session list caching uses ISR `revalidate=30s` on `fetchIngest` calls rather than NextResponse headers — aligns with UI-SPEC strategy for session freshness
- Session detail uses `cache: 'no-store'` on `fetchIngest` calls to always reflect fresh ingest data
- Legacy redirects use `redirect()` (307 Temporary Redirect) instead of `permanentRedirect()` (308) — routes may return in future phases (per D-05)
- Session ID validation regex `/^[a-zA-Z0-9:\-_.]{1,256}$/` matches ingest's own validation to catch invalid IDs at the BFF boundary (per T-04-04)
- `validateSessionId()` throws `SessionValidationError` which `sanitizeError()` converts to 400 — other errors become 502 to avoid leaking ingest internals

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `sanitizeLimit()` helper for limit param capping**

- **Found during:** Task 1
- **Issue:** Plan specified limit capping at 100 per threat model T-04-06 but the adapter code template showed no helper for parsing and capping the `limit` query parameter before forwarding to ingest
- **Fix:** Created `sanitizeLimit()` helper in `server-adapter.ts` that parses the raw limit string, defaults to 50, caps at 100 (MAX_LIMIT). Each adapter's `listSessions()` calls this before building URLSearchParams.
- **Files modified:** `lib/agent-tools/server-adapter.ts`, `lib/agent-tools/openclaw/server-adapter.ts`, `lib/agent-tools/claude-code/server-adapter.ts`, `lib/agent-tools/codex/server-adapter.ts`
- **Committed in:** `24ee026` (Task 1 commit)

**2. [Rule 3 - Blocking] Added `SESSION_ID_RE` constant and `validateSessionId()` helper**

- **Found during:** Task 1
- **Issue:** Plan specified sessionId validation with regex `/^[a-zA-Z0-9:\-_.]{1,256}$/` but the adapter code template didn't include the validation helper — each adapter would need to duplicate the regex check
- **Fix:** Created `SESSION_ID_RE` constant and `validateSessionId()` function in `server-adapter.ts`. Created `SessionValidationError` class extending Error with `code` property. Each adapter calls `validateSessionId()` before proxying. `sanitizeError()` intercepts `SessionValidationError` and returns 400.
- **Files modified:** `lib/agent-tools/server-adapter.ts`, `lib/agent-tools/openclaw/server-adapter.ts`, `lib/agent-tools/claude-code/server-adapter.ts`, `lib/agent-tools/codex/server-adapter.ts`
- **Committed in:** `24ee026` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - Blocking)
**Impact on plan:** Both auto-fixes implement threat model mitigations specified in the plan but missing from code templates. Essential for correctness and security. No scope creep.

## Issues Encountered

None — implementation proceeded as planned. Pre-existing TypeScript errors in `components/shell/shell-frame.tsx` (missing shell-header, sidebar-nav, shell-status-bar, right-rail imports) are from Plan 04-01 stubs and are not related to this plan's work.

## User Setup Required

None — no external service configuration required. The BFF proxy routes connect to the existing ingest service at `localhost:8078`.

## Next Phase Readiness

- BFF API proxy routes ready for frontend data hooks (useToolSessions, useSessionDetail) in Plan 04-04 Session Explorer
- Server adapters provide clean abstraction for all subsequent waves — no need to revisit ingest API mapping
- Legacy redirects ready for immediate use — existing bookmarks transparently route to new `/openclaw/*` paths
- Ready for Wave 3 (Plan 04-03): Shell migration and source switcher — routes are available, shells can now consume `/api/agent-tools/[tool]/...` endpoints

---

*Phase: 04-multi-source-frontend-shell-session-explorer*
*Completed: 2026-05-07*

## Self-Check: PASSED

- All 14 key files verified on disk (server adapters, API routes, legacy redirects)
- Both task commits (`24ee026`, `001ef8f`) present in git log
- TypeScript compilation passes (`npx tsc --noEmit`) — no errors in plan files (pre-existing errors in components/shell/ are from Plan 04-01 stubs)
- No unexpected file deletions in any commit
- SUMMARY.md committed
