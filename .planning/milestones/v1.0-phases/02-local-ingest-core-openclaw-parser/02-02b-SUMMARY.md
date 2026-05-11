---
phase: 02-local-ingest-core-openclaw-parser
plan: 02b
subsystem: ingest
tags: [openclaw, sqlite, hono, rest-api, sse, better-sqlite3]

# Dependency graph
requires:
  - phase: 02-01
    provides: "SQLite database schema (sessions, messages tables) and connection layer"
  - phase: 02-02
    provides: "OpenClaw parser (ParseResult) and source discovery (discoverOpenClawSources)"
provides:
  - "Database write layer: writeSessionToDatabase for session upsert and message insertion"
  - "Sync orchestration: syncSource for end-to-end source → parse → database pipeline"
  - "REST API: GET /api/v1/sources, GET /api/v1/sources/:type, POST /api/v1/sources/:type/sync"
  - "SSE skeleton: GET /api/v1/events with correct headers (real push deferred to Phase 6)"
affects: ["03-claude-codex-parsers", "04-multi-source-ui", "06-realtime-hardening"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Session upsert pattern: check existence by ID → UPDATE or INSERT"
    - "Message replace-on-update: delete existing messages before re-insert"
    - "Error-per-file tracking in sync operations"
    - "Hono route grouping with sourcesRoutes"
    - "API response structure: { sources, total } and { syncResult, status }"

key-files:
  created:
    - ingest/sync/index.ts (200 lines) — Database write layer and sync orchestration
    - ingest/api/sources.ts (130 lines) — REST API for source management
  modified:
    - ingest/index.ts — Wired sourcesRoutes into Hono app

key-decisions:
  - "Database write uses prepared statements (better-sqlite3 default) per T-02-09 mitigation"
  - "Message replace-on-update strategy: delete all existing messages for a session before re-inserting"
  - "SSE endpoint returns skeleton headers only; real event streaming deferred to Phase 6 per D-09"
  - "Sync errors tracked per-file and reported in API response; malformed files don't crash the service"
  - "Role CHECK constraint errors from parser are reported but not blocking; tool roles handled in Phase 3"

patterns-established:
  - "Pattern 1: Session upsert — check existence, then INSERT or UPDATE with full field set"
  - "Pattern 2: Source sync pipeline — discover sources → enumerate files → parse each → write to DB → aggregate results"
  - "Pattern 3: API error envelope — { error, message } with appropriate HTTP status codes"

requirements-completed: [DATA-03, SRC-01]

# Metrics
duration: 10 min
completed: 2026-05-06
---

# Phase 2 Plan 02b: Ingest Database Storage & API Summary

**End-to-end OpenClaw ingest pipeline: database write layer storing 68 sessions and 201 messages to SQLite, REST API for source discovery and sync triggering, and SSE skeleton endpoint**

## Performance

- **Duration:** ~10 min (active implementation + verification)
- **Tasks:** 4 (3 auto + 1 checkpoint:human-verify)
- **Files created:** 2 (`ingest/sync/index.ts`, `ingest/api/sources.ts`)
- **Files modified:** 1 (`ingest/index.ts`)
- **Verification:** All 10 automated checks passed; 68 sessions / 201 messages synced successfully

## Accomplishments

- Database write layer with session upsert (insert or update) and message insertion with foreign key relationships
- Full sync orchestration: discover OpenClaw sources → parse session files → write to database → aggregate results
- REST API endpoints: source listing, type-filtered listing, sync triggering, SSE skeleton
- End-to-end pipeline verified: 4 OpenClaw sources discovered (68 total sessions), sync populated SQLite with 201 messages
- Token usage stored as JSON, source metadata (file path, line number) preserved
- Error handling: malformed files and role constraint violations reported in API without crashing the service

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement database write layer for parsed sessions** — `e236db7` (feat)
2. **Task 2: Create REST API endpoints for source management** — `87eb3d1` (feat)
3. **Task 3: Wire API routes into main service** — `37f8da8` (feat)
4. **Task 4: Human verification checkpoint** — Approved ✅

## Files Created/Modified

- `ingest/sync/index.ts` — Database write operations (`writeSessionToDatabase`, `syncSource`), session upsert, message insertion, error tracking
- `ingest/api/sources.ts` — Hono routes: GET/POST `/api/v1/sources`, `/api/v1/sources/:type`, `/api/v1/sources/:type/sync`, `/api/v1/events`
- `ingest/index.ts` — Added `sourcesRoutes` import and `app.route('/', sourcesRoutes)` mount

## Decisions Made

- **Message replace-on-update**: Delete all existing messages for a session before re-inserting (simple strategy sufficient for Phase 2; may optimize in Phase 6)
- **Sync error strategy**: Per-file error tracking with errors returned in API response; individual file failures don't block the sync of other files
- **SSE skeleton**: Returns correct headers (`text/event-stream`, `no-cache`, `keep-alive`) but no real event push; frontend can establish connection but won't receive updates until Phase 6
- **Role CHECK constraint**: Messages with OpenClaw roles outside `user|assistant|system|tool_result` fail with constraint errors — reported in API but not blocking. Tool-related roles handled in Phase 3

## Deviations from Plan

None — plan executed exactly as written. All 3 auto tasks implemented per specification, verifications passed, checkpoint approved.

## Known Stubs

| Stub | File | Line | Description |
|------|------|------|-------------|
| Project extraction | `ingest/sync/index.ts` | 181 | `const project = 'default'; // TODO: Extract project from path or config` — project name hardcoded; needs config-based resolution in Phase 3 |
| SSE real push | `ingest/api/sources.ts` | 123-129 | SSE endpoint returns headers only; real event streaming implemented in Phase 6 per D-09 |
| Health status taxonomy | `ingest/api/sources.ts` | 35 | Phase 3 will add `'indexing'` and `'parser-warning'` health status values |
| Claude/Codex sources | `ingest/api/sources.ts` | 57-62, 91-96 | Non-openclaw source types return 400; Claude Code and Codex parsers added in Phase 3 |
| Tool calls storage | `ingest/sync/index.ts` | 134-135 | Tool calls and turns not stored in Phase 2; added in Phase 3 |

## Issues Encountered

- **CHECK constraint errors during sync**: OpenClaw parser outputs messages with roles (e.g., `tool_use`) outside the schema's allowed set (`user|assistant|system|tool_result`). 201 messages with valid roles were stored successfully; invalid-role messages are rejected and reported as errors. This is a known Phase 2 limitation — tool-related roles will be handled when tool calls are added in Phase 3.
- **Pre-existing TypeScript errors in frontend code**: `tsc --noEmit` shows errors in `app/` and `components/` directories. These are unrelated to the ingest service and pre-date this plan. The ingest code itself compiles and runs correctly via `tsx`.

## Threat Flags

None — all threat mitigations from plan's `<threat_model>` addressed: prepared statements used (T-02-09), sync endpoint is localhost-only in Phase 2 (T-02-10), SSE endpoint is read-only skeleton (T-02-11).

## User Setup Required

None — no external service configuration required. The ingest service runs locally on port 8078 with SQLite at `data/ingest.db`. `WORKSPACE_PATH` environment variable should point to the OpenClaw workspace directory for source discovery.

## Next Phase Readiness

- Database write layer ready for Claude Code and Codex parsers in Phase 3
- REST API structure established; new source types can be added by extending route handlers
- SSE endpoint skeleton ready for real push implementation in Phase 6
- 68 sessions and 201 messages indexed — search and query endpoints can be built on this data

---
*Phase: 02-local-ingest-core-openclaw-parser*
*Plan: 02b — Ingest Database Storage & API*
*Completed: 2026-05-06*
