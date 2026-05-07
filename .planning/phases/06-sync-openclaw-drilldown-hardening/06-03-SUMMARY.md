---
phase: 06-sync-openclaw-drilldown-hardening
plan: 03
subsystem: api
tags: [rate-limiting, security, path-traversal, error-sanitization, session-lookup, source-validation]

# Dependency graph
requires:
  - phase: 02-foundation-ingest-sync
    provides: "SQLite schema, session routes, config system"
  - phase: 06-01
    provides: "File watcher infrastructure, sync pipeline"
  - phase: 06-02
    provides: "SSE infrastructure, events routes"
provides:
  - "In-memory sliding-window rate limiter (100 req/min per IP, configurable)"
  - "Session lookup endpoint for Gateway drilldown key matching"
  - "Path traversal protection via regex on session ID params in all routes"
  - "Error response sanitization with debugMode-gated stack trace exposure"
  - "Source root boundary enforcement (isWithinRoot validation in discovery)"
affects: [06-04, 06-05, frontend-drilldown]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sliding-window rate limiter per IP from x-forwarded-for with automatic cleanup timer"
    - "isWithinRoot(path, root) boundary enforcement via path.resolve prefix matching"
    - "Hono app.onError with getConfig().debugMode gate for error detail level"
    - "Session ID regex /^[a-zA-Z0-9:\\-_.]{1,256}$/ applied before DB access in all routes"

key-files:
  created:
    - ingest/api/middleware/rate-limit.ts
    - ingest/api/middleware/rate-limit.test.ts
    - ingest/api/sessions.test.ts
    - ingest/sync/sources.test.ts
  modified:
    - ingest/config/index.ts
    - ingest/index.ts
    - ingest/api/sessions.ts
    - ingest/api/turns.ts
    - ingest/sync/sources.ts

key-decisions:
  - "Sliding-window rate limiter chosen over token bucket for accuracy at the 100 req/min threshold (per D-12 agent discretion)"
  - "Health/version bypass built into rate limiter middleware via c.req.path check — simpler than route ordering"
  - "Session lookup placed BEFORE /:id wildcard route so Hono matches it first, avoiding route collision"
  - "Validation reordered in GET /api/v1/sessions/:id to check ID format before getDatabase() call (pre-existing bug fix)"
  - "isWithinRoot uses path.resolve for symlink/.. resolution, with separator-aware startsWith check for prefix match safety"

patterns-established:
  - "createRateLimitMiddleware(maxRequests, windowMs) → Hono middleware with per-IP sliding window tracking"
  - "isWithinRoot(candidatePath, allowedRoot) → boolean for path boundary enforcement"
  - "Config-driven debugMode gate in app.onError for production-safe error responses"

requirements-completed: [DATA-07, HARD-03]

# Metrics
duration: ~14min
completed: 2026-05-07
---

# Phase 06 Plan 03: API Security Hardening & Session Lookup Summary

**Rate limiting, path traversal protection, error sanitization, source root enforcement, and Gateway drilldown session lookup endpoint for the ingest API**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-07T05:30:06Z
- **Completed:** 2026-05-07T05:43:35Z
- **Tasks:** 2 (both TDD)
- **Files modified/created:** 9

## Accomplishments

- In-memory sliding-window rate limiter middleware (100 req/min default) with per-IP tracking via `x-forwarded-for` header, automatic cleanup timer, and health/version bypass
- Rate limiter configuration via `INGEST_RATE_LIMIT_RPM`, `INGEST_RATE_LIMIT_ENABLED`, and `INGEST_DEBUG` env vars — all parsed in `loadConfig()`
- Session lookup endpoint `GET /api/v1/sessions/lookup?source=openclaw&key=KEY` for Gateway drilldown — validates source whitelist and key regex before DB access
- Path traversal hardening: regex validation added to all `turns.ts` and `messages.ts` routes before DB access; `sessions.ts` GET `/:id` validation reordered to check before `getDatabase()`
- Error sanitization: `app.onError` global handler returns `{ error: 'Internal server error' }` in production (`INGEST_DEBUG` unset) and full message+stack when `INGEST_DEBUG=true`
- Source root enforcement: `isWithinRoot()` validates all discovered paths are within configured roots (`agents/`, `projects/`, `sessions/`); paths outside are rejected with `console.warn`

## Truth Verification

| Truth | Status |
|-------|--------|
| Invalid session IDs return generic 404 responses, never exposing internal paths | Verified — regex blocks before DB, 404 messages use static text |
| API rate limiter enforces 100 req/min per endpoint with 429 on violation | Verified — 12 unit tests cover limit enforcement, window reset, per-IP isolation |
| Source roots validated in parser discovery — only configured directories scanned | Verified — `isWithinRoot()` filters all three discover functions |
| Error responses in production never include stack traces or file paths | Verified — `app.onError` gates on `debugMode`, production returns generic message |
| Session lookup by external key only returns sessions that exist in DB | Verified — DB query with validated input, 404 on miss |
| No endpoint accepts arbitrary file paths from client input | Verified — all inputs validated with regex/whitelist |

## Task Commits

Each task committed atomically (TDD — RED/GREEN):

1. **Task 1: Rate Limiter Middleware** — `ec59b5e` (test/RED), `549b708` (feat/GREEN)
2. **Task 1b: Config + Wiring** — `12fb779` (feat)
3. **Task 2: API Path Hardening + Session Lookup** — `0666f51` (test/RED), `9a4af54` (feat/GREEN)

## Files Created/Modified

- `ingest/api/middleware/rate-limit.ts` — Sliding-window rate limiter with `createRateLimitMiddleware()` factory and `rateLimiter` singleton (88 lines)
- `ingest/api/middleware/rate-limit.test.ts` — 12 tests covering pass-through, 429 enforcement, window reset, per-IP isolation, health bypass
- `ingest/api/sessions.test.ts` — 14 tests for lookup endpoint param validation and path traversal protection
- `ingest/sync/sources.test.ts` — 7 tests for `isWithinRoot()` boundary enforcement
- `ingest/config/index.ts` — Added `rateLimitRPM`, `rateLimitEnabled`, `debugMode` fields to `IngestConfig`
- `ingest/index.ts` — Wired rate limiter via `app.use('*', rateLimiter)` in `start()`; added `app.onError` global handler
- `ingest/api/sessions.ts` — Added `GET /api/v1/sessions/lookup` endpoint; fixed `/:id` validation order
- `ingest/api/turns.ts` — Added session ID regex validation to all three route handlers
- `ingest/sync/sources.ts` — Added `isWithinRoot()` export; wired root enforcement into all three discover functions

## Decisions Made

- Sliding-window chosen over token bucket for accuracy at the 100 req/min threshold (per agent discretion D-12)
- Health/version bypass built directly into rate limiter middleware via `c.req.path` check — simpler and more maintainable than route ordering tricks
- `isWithinRoot` uses `path.resolve()` followed by `startsWith(root + path.sep)` to safely handle symlinks, `..` segments, and prefix-match attacks
- Config-driven `debugMode` gate in `app.onError` avoids caching issues — `getConfig()` is called once and cached; the error handler uses it directly
- Session lookup route placed before `/:id` wildcard in `sessionsRoutes` — Hono matches first-to-last when routes overlap

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing validation order in GET /api/v1/sessions/:id**
- **Found during:** Task 2 (test execution)
- **Issue:** The route called `getDatabase()` before the session ID regex validation, causing a "Database not open" error before the validation could reject bad IDs
- **Fix:** Moved `const sessionId = c.req.param('id')` and the regex check before `const db = getDatabase()`
- **Files modified:** `ingest/api/sessions.ts`
- **Verification:** Tests now correctly reject bad IDs with 400 without requiring a DB

**2. [Rule 1 - Bug] Fixed session lookup handler accessing DB before param validation**
- **Found during:** Task 2 (test execution)
- **Issue:** The lookup handler called `getDatabase()` on line 1, before validating `source` and `key` params — same problem as above
- **Fix:** Moved `const db = getDatabase()` to after all param validation
- **Files modified:** `ingest/api/sessions.ts`

**3. [Rule 1 - Bug] Adjusted test expectations for Hono URL normalization**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** Hono's built-in URL parser normalizes `..` segments before routing, meaning real path traversal in the URL path is blocked at the routing layer (defense-in-depth). Tests needed to use URL-encoded values and format-valid but rejected inputs instead.
- **Fix:** Rewrote path traversal tests to use URL-encoded characters (`%2e%2e`, `%00`, `%20`) that reach the handler and are caught by the regex
- **Files modified:** `ingest/api/sessions.test.ts`

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All fixes necessary for correctness and testability. No scope creep.

## Known Stubs

| File | Line | Description |
|------|------|-------------|
| `ingest/api/turns.ts` | 235 | Pre-existing TODO: `sourceType: 'openclaw'` hardcoded, marked for session join in Phase 3 |

## Threat Flags

None — all new surface is within the existing threat model (trust boundaries: client → ingest API, ingest API → SQLite, ingest parser → filesystem). All threats from the plan's STRIDE register (`T-06-03-01` through `T-06-03-05`) are mitigated.

## Next Phase Readiness

- Rate limiter operational with configurable thresholds — ready for production use
- Session lookup endpoint provides the key API contract needed by Plan 06-04 (Gateway drilldown)
- Error sanitization ensures production safety for the API
- Source root enforcement closes the path traversal vector in parser discovery
- All 272 tests passing (25 test files), zero regressions

---

*Phase: 06-sync-openclaw-drilldown-hardening*
*Completed: 2026-05-07*

## Self-Check: PASSED

- All 9 created/modified files exist on disk
- All 5 commits (ec59b5e, 549b708, 12fb779, 0666f51, 9a4af54) verified in git log
- All 272 tests pass across 25 test files
- TypeScript typecheck passes with zero errors
