---
status: complete
slug: session-name-project
created: 2026-05-07
---

# Fix Session Name & Project Display: Complete

## Root Cause
The ingest sync layer hardcoded `project = 'default'` for all three sources and TraceSession had no `name` field. The frontend tried to derive label from turns (empty in list view) and fell back to truncated session ID hash.

## Changes

### Data Layer (ingest pipeline)
- `types/trace.ts`: Added `name?: string` to TraceSession
- `ingest/db/schema.sql` + `ingest/db/index.ts`: Migration v2 adds `name TEXT` column to sessions table
- `ingest/sync/index.ts`:
  - `extractSessionName()`: derives name from first user message in parse result
  - `extractProjectFromPath()`: decodes project per source type (Claude path → cwd, OpenClaw → agent name, Codex → dir name)
  - All three sync functions now set `session.name` and `session.project` before writing to DB
  - INSERT statement includes `name` column
- `ingest/api/sessions.ts`: All 3 SQL queries include `name`, parseSessionRow returns it

### Frontend
- `session-explorer-table.tsx`: `deriveLabel()` uses `session.name`, falls back to ID hash
- `deriveProject()`: simplified to filter "default" only (data now comes from pipeline)
- Column header: 'LABEL' → 'SESSION' across all 4 tool definitions

## Note
Existing sessions in DB won't have `name` until re-synced. The DB migration adds the column as nullable.

Commit: `394dbcb`
