---
slug: session-name-project
status: executing
created: 2026-05-07
---

# Fix Session Name & Project Display

Label shows hash, project shows "default". Root cause: data pipeline doesn't extract name/cwd.

## Changes

1. `types/trace.ts` — Add `name?: string` to TraceSession
2. `ingest/db/index.ts` — Add migration for `name` column
3. `ingest/db/schema.sql` — Add migration comment
4. `ingest/sync/index.ts` — Extract name from first user message, project from file path
5. `ingest/api/sessions.ts` — Include `name` in SQL and parseSessionRow
6. `components/sessions/session-explorer-table.tsx` — Use `session.name` for label column
7. Column definitions (4 files) — Update header from 'LABEL' to 'SESSION'
