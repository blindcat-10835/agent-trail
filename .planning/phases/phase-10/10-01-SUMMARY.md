---
phase: 10-rich-ingest-metrics
plan: 01
subsystem: database
tags: [sqlite, fts5, migration, schema, capabilities]

# Dependency graph
requires: []
provides:
  - "total_input_tokens column on sessions table (INTEGER NOT NULL DEFAULT 0)"
  - "fts_messages_content FTS5 virtual table with INSERT/DELETE/UPDATE sync triggers"
  - "SOURCE_CAPABILITIES static config map for per-tool feature flags"
affects: [10-02, 10-03, 10-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [fts5-external-content, migration-step-array]

key-files:
  created:
    - ingest/config/capabilities.ts
  modified:
    - ingest/db/index.ts
    - ingest/db/schema.sql

key-decisions:
  - "FTS5 external content mode over messages table avoids data duplication"
  - "Skip cache invalidation forces re-parse to backfill total_input_tokens"
  - "Source capabilities as static config map, no database access needed"

patterns-established:
  - "FTS5 external content virtual table with sync triggers for full-text search"
  - "Migration step: add column + invalidate skip cache for backfill"
  - "Static capability config per source for frontend module gating"

requirements-completed: [TEST-104, DATA-106]

# Metrics
duration: 2min
completed: 2026-05-12
---

# Phase 10 Plan 01: Schema Migration & Capabilities Summary

**SQLite migration v9→v10 adding total_input_tokens column and FTS5 virtual table, plus source capability config map**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-11T17:53:33Z
- **Completed:** 2026-05-11T17:55:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Migration v9→v10 adds `total_input_tokens` column to sessions with DEFAULT 0, enabling token breakdown KPIs
- FTS5 virtual table `fts_messages_content` created with external content mode over `messages`, plus INSERT/DELETE/UPDATE sync triggers and initial rebuild
- Skip cache invalidated for sessions missing input tokens, forcing re-parse to backfill
- Source capability config map exported with per-tool feature flags for agents, automations, cost, activity, sessions, replay

## Task Commits

Each task was committed atomically:

1. **Task 1: Add migration v9→v10 with total_input_tokens and FTS5** - `f01f3df` (feat)
2. **Task 2: Create source capability config map** - `5287884` (feat)

## Files Created/Modified
- `ingest/db/index.ts` - Migration v9→v10: targetVersion=10, 7 new migration steps (column, FTS5 table, 3 triggers, rebuild, skip cache invalidation)
- `ingest/db/schema.sql` - Canonical DDL: added total_input_tokens column, FTS5 virtual table, and sync trigger definitions
- `ingest/config/capabilities.ts` - New file: SourceCapabilities interface and SOURCE_CAPABILITIES config map for openclaw/claude-code/codex

## Decisions Made
- FTS5 uses external content mode (`content='messages'`) to avoid data duplication — the virtual table references messages table directly
- Skip cache invalidation (`file_hash = NULL`) ensures existing sessions get re-parsed to populate total_input_tokens
- Source capabilities are pure static config — no database lookup needed, exported as a simple Record<string, SourceCapabilities>

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema migration v10 is in place — Plans 02/03/04 can now build aggregate queries referencing total_input_tokens and use FTS5 for search
- SOURCE_CAPABILITIES ready for import by overview endpoints (Plan 02)
- Existing db-migration test updated to expect v10

---
*Phase: 10-rich-ingest-metrics*
*Completed: 2026-05-12*
