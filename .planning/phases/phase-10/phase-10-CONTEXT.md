# Phase 10: Rich Ingest Metrics & Data Contracts - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the ingest service (SQLite schema, aggregate queries, new REST endpoints) and BFF proxy routes to expose the enriched session/turn/overview data required by the v1.1 HUD redesign. The frontend does not change in this phase — the deliverable is a data plane that Phase 11-13 can consume through existing BFF patterns.

Covers: DATA-101..106, TURN-101..105, OPEN-101..103, TEST-101, TEST-104.

</domain>

<decisions>
## Implementation Decisions

### Aggregation Query Architecture
- SQL aggregation in SQLite — GROUP BY / SUM / date filtering done in ingest queries; BFF passes results through unchanged
- Real-time SQL queries for time windows (today / 7d / 30d) — no materialized view tables; local SQLite handles the dataset size comfortably
- `all` source scope uses a single query without source filter (or UNION ALL when source-specific stats are needed); BFF `/api/agent-tools/all/...` aggregates cross-source
- Cost estimation: token counts with `cost: null` placeholder when source lacks price data; per-source model-price mapping is deferred to a future enhancement

### Schema & Migration Strategy
- Add `total_input_tokens INTEGER` column to sessions alongside existing `total_output_tokens` — enables token breakdown for KPI cards and session rows
- New ingest Hono route group under `/api/v1/overview/` for aggregates, top models, top projects, timeline, starred, source capabilities
- New matching BFF proxy routes under `/api/agent-tools/[tool]/overview/...`
- Activity timeline built at query time from existing tables (sessions.started_at, sessions.status, sync_status.last_error, tool_calls) — no new activity_events table
- Source capability metadata as a static config map in ingest (openclaw → agents/automations/cost, claude-code → sessions/cost/activity, codex → sessions/activity) exposed via `/api/v1/overview/capabilities`

### Session & Turn Enrichment
- Session display title: reuse existing `name` column (first user message) with fallback to `project + date` in frontend — no new summary column
- Per-turn enrichment (failure, truncated, warning status, activity counts) computed at query time in the turn assembler — no new turn columns
- Normalized activity rows: extend existing `TraceActivity` union with optional `durationMs`, `error`, `displayName` fields on `TraceToolCall` and other variants rather than a separate model
- In-session search (TURN-104): FTS5 index on messages.content with `LIKE` fallback; build FTS virtual table in migration

### Testing & Verification Strategy
- Unit tests per new endpoint with golden fixtures — follow existing pattern in `ingest/api/sessions.test.ts`
- Migration test: verify v9→v10 migration on pre-existing DB without manual deletion
- Source filter tests: parameterized fixtures for openclaw / claude-code / codex / all
- No new test framework — continue with vitest

### the agent's Discretion
- Exact route path naming under `/api/v1/overview/`
- SQL query structure for each aggregate endpoint
- Error response format for new endpoints
- Pagination strategy for timeline and ranking endpoints
- FTS5 table structure details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ingest/db/index.ts` — `runMigrations()` with `PRAGMA user_version` pattern (currently v9, will increment to v10)
- `ingest/db/schema.sql` — canonical DDL, 8 tables (sessions, messages, tool_calls, tool_result_events, subagent_links, turns, sync_status, session_stars)
- `ingest/api/sessions.ts` — session listing/detail routes with filtering, pagination, sorting patterns
- `ingest/api/stars.ts` — star/unstar routes, `session_stars` table
- `ingest/api/agents.ts` — agent summary routes (OpenClaw-specific)
- `app/api/agent-tools/[tool]/` — BFF proxy routes with `assertSourceToolId`, `requireSourceScopedSession` patterns
- `types/trace.ts` — canonical trace model (TraceSession, TraceTurn, TraceActivity union, TokenUsage)

### Established Patterns
- Hono route groups with `getDatabase()` singleton
- `SessionRow` interface → `parseSessionRow()` mapper pattern for DB→API conversion
- BFF: `assertSourceToolId(tool)` → adapter call → `sanitizeError` catch
- Migrations: `ALTER TABLE ADD COLUMN` wrapped in try/catch for idempotent application
- Updated-at computed as `MAX(COALESCE(ended_at, ''), COALESCE(started_at, ''), COALESCE(file_mtime, ''))`

### Integration Points
- New routes register on the existing Hono app in `ingest/index.ts`
- New BFF routes go under `app/api/agent-tools/[tool]/overview/`
- Schema changes go through `runMigrations()` incrementing `user_version`
- FTS5 virtual table creation in migration for messages content search
- `session_stars` table already exists for starred sessions endpoint

</code_context>

<specifics>
## Specific Ideas

- Overview aggregates must support source-scoped AND `all` queries for today, 7 days, and 30 days
- Top models ranking should include token total and share percentage, sortable by tokens or cost
- Top projects ranking includes session count, turn count, token totals, estimated cost, relative rank weight
- Mixed activity timeline covers session start/resume/finish/failure, parser/sync errors, and automation events
- Session detail payload needs enriched fields for HUD header: display title, source, project, model, branch, cwd, status, duration, total turns, input/output tokens, estimated cost
- Turn payload needs: stable index, started/ended time, duration, input/output token usage, failure/truncated/warning status, activity counts
- Activity rows normalized across tools/skills/subagents/thinking/system events
- Source capability metadata drives frontend module availability (agents/automations only for OpenClaw)

</specifics>

<deferred>
## Deferred Ideas

- Per-source model-price mapping for real cost estimation (currently `cost: null`)
- OpenClaw agent live status from Gateway (OPEN-103 distinguishes ingest vs gateway; gateway connectivity is existing functionality)
- Automation data from local cron/schedule files — needs source-specific discovery first
- Client-side search fallback strategy (if FTS5 proves unnecessary for local dataset sizes)

</deferred>
