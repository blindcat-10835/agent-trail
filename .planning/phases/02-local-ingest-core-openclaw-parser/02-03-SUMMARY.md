---
phase: 02-local-ingest-core-openclaw-parser
plan: 03
subsystem: api
tags: [hono, better-sqlite3, rest, sessions, turns, messages]

# Dependency graph
requires:
  - phase: 02-01
    provides: "OpenClaw parser output (sessions/messages in SQLite)"
  - phase: 02-02b
    provides: "Sources API routes mounted in ingest/index.ts"
provides:
  - "Session listing and detail REST endpoints"
  - "Turn-first retrieval with user/assistant message grouping"
  - "Message retrieval with role filtering and pagination"
  - "Minimal turn assembler (D-08: basic user-message boundary grouping)"
affects: ["frontend-shell", "turn-replay-ui", "claude-codex-parsers"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hono sub-routers for API resource groups (sessionsRoutes, turnsRoutes, sourcesRoutes)"
    - "Prepared statements with parameterized queries for all DB access"
    - "Snake_case DB columns → camelCase API response mapping"
    - "Pagination contract: { total, limit, offset, hasMore }"

key-files:
  created:
    - ingest/turns/assembler.ts (161 lines)
    - ingest/api/sessions.ts (183 lines)
    - ingest/api/turns.ts (225 lines)
  modified:
    - ingest/index.ts (+6 lines for route imports and mounting)

key-decisions:
  - "Turn assembly uses basic user-message boundary grouping per D-08 (complex boundaries deferred to Phase 3)"
  - "System messages filtered in assembler (Phase 3 will handle compact/queued system boundaries)"
  - "All threat mitigations (T-02-13, T-02-14, T-02-15) implemented as input validation in API handlers"
  - "Session ID format validated against alphanumeric regex; limit/offset reject negative values; role filter whitelisted"

patterns-established:
  - "API resource modules export Hono sub-routers mounted at app.route('/', ...)"
  - "parseMessageRow / parseSessionRow helpers convert snake_case DB rows to camelCase DTOs"
  - "Session existence verified before turn/message queries (404 if missing)"
  - "Pagination capped at max 1000 to prevent resource exhaustion"

requirements-completed: [DATA-05]

# Metrics
duration: 9 min
completed: 2026-05-06
---

# Phase 2 Plan 3: Sessions & Turns REST API Summary

**REST API for session browsing with filtering/pagination, turn-first retrieval with user/assistant grouping, and message access with role filtering**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-06T08:45:45Z
- **Completed:** 2026-05-06T08:54:54Z
- **Tasks:** 5 (4 auto + 1 checkpoint)
- **Files modified:** 4

## Accomplishments

- Session listing with filtering (source, project, status), sorting (started_at/ended_at), and pagination
- Session detail retrieval by ID with all metadata (metrics, timestamps, status)
- Turn assembler implementing D-08 minimal grouping: user messages start turns, assistant/tool_result appended
- Turn retrieval per session with pagination and single-turn access
- Message retrieval with ordinal ordering, role filtering, and pagination
- All threat mitigations (T-02-13 through T-02-16) implemented as input validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Minimal turn assembler** - `ed1cdb7` (feat)
2. **Task 2: Sessions API endpoints** - `4195b3c` (feat)
3. **Task 3: Turns & messages API endpoints** - `0bbe75d` (feat)
4. **Task 4: Wire routes into main service** - `c4bf4ee` (feat)
5. **Task 5: Checkpoint human-verify** — approved

**Plan metadata:** (this commit)

## Files Created/Modified

- `ingest/turns/assembler.ts` — Turn assembler: groups messages into turns by user message boundaries, calculates durations, captures token usage
- `ingest/api/sessions.ts` — Sessions REST API: list with filters/pagination, detail by ID, snake→camelCase mapping
- `ingest/api/turns.ts` — Turns & messages REST API: turn-first retrieval, message listing with role filter, pagination
- `ingest/index.ts` — Main entry: imports and mounts sessionsRoutes + turnsRoutes

## Endpoints Implemented

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/sessions` | GET | List sessions with filters (source, project, status), pagination, sorting |
| `/api/v1/sessions/:id` | GET | Get session detail by ID |
| `/api/v1/sessions/:id/turns` | GET | Get turns for session with pagination |
| `/api/v1/sessions/:id/turns/:index` | GET | Get specific turn by index |
| `/api/v1/sessions/:id/messages` | GET | Get messages for session with role filter, pagination |

## Decisions Made

- Turn assembly follows D-08 minimal grouping: user message opens new turn, subsequent assistant/tool_result messages appended. System messages filtered. Complex boundary handling deferred to Phase 3.
- All API response fields use camelCase (TypeScript convention), converting from snake_case DB columns
- Pagination contract: `{ total, limit, offset, hasMore }` consistent across all list endpoints
- Limit capped at 1000 for all endpoints (T-02-14 resource exhaustion prevention)

## Deviations from Plan

None — plan executed as written with threat model mitigations applied inline.

### Threat Mitigations Applied

The plan's `<threat_model>` specified mitigations for T-02-13 through T-02-16. These were implemented directly during task execution:

- **T-02-13 (Session ID validation):** Session ID format validated via regex `/^[a-zA-Z0-9:\-_.]{1,256}$/` before query
- **T-02-14 (Limit/offset safety):** Negative values rejected with 400; limit capped at 1000
- **T-02-15 (Role whitelisting):** Role filter validated against `['user', 'assistant', 'system', 'tool_result']`; invalid values return 400
- **T-02-16 (Pagination enforcement):** All list endpoints default to paginated output with capped limits

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `activities: []` | `ingest/turns/assembler.ts` | 85 | Phase 3 will populate with tool calls, skills, subagents |
| `sourceType: 'openclaw'` (hardcoded) | `ingest/turns/assembler.ts` | 131 | TODO: Get from session join in Phase 3 |
| `sourceType: 'openclaw'` (hardcoded) | `ingest/api/turns.ts` | 218 | TODO: Get from session join in Phase 3 |
| `turns: []` | `ingest/api/sessions.ts` | 166 | Turns loaded separately via `/sessions/:id/turns` |

## Issues Encountered

- Multiline SQL template literals caused verification regex `SELECT.*FROM sessions` to not match across lines — verified manually that 3 `FROM sessions` references exist (2 data SELECTs + 1 COUNT)
- `grep "assembleTurns"` matched 3 lines (import + 2 usages) instead of plan-expected 2 — plan's own code produces 3 occurrences

## Next Phase Readiness

- All REST endpoints for Phase 2 data browsing operational
- Turn assembler ready for Phase 3 enhancement (compact boundaries, tool call pairing, system messages)
- Frontend can begin integration with these session/turn/message endpoints in Phase 4
- Next plan: 02-04 (TypeScript build verification and ingest service hardening)

---

*Phase: 02-local-ingest-core-openclaw-parser*
*Completed: 2026-05-06*
