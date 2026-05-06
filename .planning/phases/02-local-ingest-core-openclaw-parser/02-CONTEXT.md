# Phase 2: Local Ingest Core + OpenClaw Parser - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the independent Node/TypeScript ingest service foundation (`ingest/`), including SQLite indexing, OpenClaw-specific source discovery and parser, and REST API for session/turn data. This replaces the current request-time JSONL scanning in `app/api/sessions/messages/route.ts` with a proper indexed, queryable data layer.

**Deliverables:**
- `ingest/` service — starts locally, exposes health/version/sources/events endpoints
- SQLite schema — sessions, messages, tool_calls, tool_result_events, turns, source metadata, sync state
- OpenClaw source discovery — default path + env/config override
- OpenClaw parser — session headers, messages, toolResult role, usage normalization, agent-scoped session ids, archive suffixes
- REST API — list OpenClaw sessions, return turn-first replay DTOs from SQLite
- SSE skeleton — endpoint exists and is connectable, no real push yet
- Dev setup — concurrently runs Next.js + ingest in single terminal

**Not in this phase:**
- Claude Code / Codex parsers (Phase 3)
- Full turn assembly with compact/queued/system boundary handling (Phase 3)
- File watcher / chokidar / real-time sync (Phase 6)
- SSE real push / invalidation (Phase 6)
- Frontend integration (Phase 4)

</domain>

<decisions>
## Implementation Decisions

### Ingest Service Architecture
- **D-01:** HTTP framework selection is Claude's discretion. Should be lightweight, TypeScript-native, with modern routing API.
- **D-02:** `ingest/` uses modular subdirectories by responsibility: `config/`, `db/`, `parser/`, `api/`, `sync/`, `types/`. Aligns with agentsview Go's `internal/` structure. Extensible for Phase 3 Claude/Codex parsers.
- **D-03:** Workspace relationship (pnpm workspace member vs independent package) is Claude's discretion. Must enable shared access to `types/trace.ts`.

### SQLite Schema & Data Layer
- **D-04:** Adapt agentsview's proven schema directly — `sessions`, `messages`, `tool_calls`, `tool_result_events` tables plus a new `turns` table. Field naming style adjusts to TypeScript conventions (camelCase). Not a full redesign.
- **D-05:** Use `better-sqlite3` as the SQLite driver. Synchronous API, best performance, zero configuration. Matches the local single-threaded service model.
- **D-06:** Skip migration infrastructure for Phase 2. Single init schema from SQL file. Migration tooling added in Phase 6 hardening.

### API Design & Turn Boundary
- **D-07:** REST endpoints follow agentsview-compatible structure with turns extension: `GET /api/v1/sessions`, `GET /api/v1/sessions/:id`, `GET /api/v1/sessions/:id/turns`, `GET /api/v1/sessions/:id/messages`, `GET /api/v1/sessions/:id/tool-calls`, `GET /api/v1/events` (SSE skeleton).
- **D-08:** Phase 2 turn assembly does basic grouping only — user message opens a new turn, subsequent assistant/tool_result messages belong to that turn. Complex boundary handling (compact, queued commands, system messages, multi-turn tool call pairing) deferred to Phase 3. Sufficient to validate turn-first DTO feasibility.
- **D-09:** SSE endpoint exists as skeleton (connectable, returns heartbeat), but does not push real data changes. Watcher + real SSE push implemented in Phase 6.

### Development Workflow
- **D-10:** Use `concurrently` to run Next.js and ingest service in a single terminal via `pnpm dev`. One command to start full development environment.
- **D-11:** Ingest service defaults to `localhost:8078`. Configurable via environment variable.

### Claude's Discretion
- HTTP framework selection (Hono, Express, or bare Node:http)
- ingest/ workspace relationship with main project (pnpm workspace member vs independent package)
- Source discovery implementation details (default path detection, env/config override mechanism)
- SQLite database file location
- Session ID generation format (path hash, content header, prefix strategy)
- Parse error reporting and logging verbosity
- OpenClaw parser internal implementation details (line-by-line streaming vs batch, error recovery strategy)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior Phase Context
- `.planning/phases/01-trace-contract-brownfield-reset/01-CONTEXT.md` — Trace contract decisions (D-01 through D-15), fixture strategy, preserved capabilities boundary

### Canonical Trace Contract
- `types/trace.ts` — Complete canonical trace types (TraceSource, TraceSession, TraceTurn, TraceMessage, TraceActivity, TraceToolCall, etc.). Ingest service and parsers MUST output these types.

### Reference Implementation
- `../references/agentsview/internal/db/schema.sql` — Proven SQLite schema to adapt (sessions, messages, tool_calls, tool_result_events tables, indexes, triggers)
- `../references/agentsview/internal/parser/openclaw.go` — OpenClaw parser behavior reference (toolResult handling, usage normalization, agent-scoped session ids, archive suffixes)
- `../references/agentsview/internal/parser/types.go` — AgentType, AgentDef, Registry structure reference
- `../references/agentsview/internal/config/` — Source discovery and configuration patterns
- `../references/agentsview/internal/server/` — REST API handler structure reference
- `../references/agentsview/internal/service/` — Service orchestration reference
- `../references/agentsview/internal/sync/` — Sync engine reference (Phase 6 watcher will need this)

### Research
- `.planning/research/AGENTSVIEW-DATA-SCHEME.md` — agentsview data pipeline analysis, recommended adaptation strategy
- `.planning/research/STACK.md` — Tech stack selection rationale (Node/TypeScript ingest + SQLite + REST/SSE)
- `.planning/research/SUMMARY.md` — Project research synthesis

### Code Being Replaced
- `app/api/sessions/messages/route.ts` — Current temporary JSONL scanner (last 30 lines, OpenClaw only). This file remains functional during Phase 2 but will be superseded by ingest API.

### Existing Code (preserved)
- `gateway/types.ts` — Gateway WebSocket protocol types (preserved, not referenced by ingest)
- `gateway/adapter-types.ts` — Dashboard display types (preserved)
- `lib/parseFixture.ts` — Phase 1 stub parser (superseded by real ingest parsers)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `types/trace.ts` — Complete canonical trace contract (292 lines). Ingest service imports and outputs these types. All parser output must conform to TraceSession, TraceTurn, TraceMessage, TraceActivity, etc.
- `lib/parseFixture.ts` — Phase 1 stub that reads JSONL line-by-line. Streaming pattern (readline + createReadStream) can be reused in real parser. The stub itself is replaced.
- `app/api/sessions/messages/route.ts` — Current OpenClaw session file discovery logic (WORKSPACE_PATH derivation, agent directory traversal, session key parsing) provides useful reference for source discovery implementation.
- `gateway/` — Preserved as-is. Ingest service does not reference Gateway types.

### Established Patterns
- TypeScript strict mode — ingest service should follow project TS strict mode
- `@/*` path alias — types/trace.ts accessible as `@/types/trace`
- pnpm — single package manager, no npm/yarn
- Test infrastructure — `tests/` directory with Vitest/Jest (Phase 1 established test pattern)

### Integration Points
- `ingest/` is a new top-level directory — first new major code area since project rebranding
- Frontend (Phase 4) will call ingest REST API at `localhost:8078/api/v1/`
- `pnpm dev` script needs to launch both processes via concurrently
- Phase 3 will add Claude/Codex parsers into the `ingest/parser/` module structure

</code_context>

<specifics>
## Specific Ideas

- Ingest service port 8078 is user's explicit choice (not 3001)
- SSE skeleton must be connectable (not just a stub that returns 404) — frontend should be able to establish EventSource connection even if no real events flow
- Turn grouping in Phase 2 is intentionally minimal: scan messages by ordinal, open new turn at each user message, collect subsequent non-user messages. This validates the turn-first DTO without solving edge cases that Phase 3 handles.

</specifics>

<deferred>
## Deferred Ideas

- File watcher / chokidar integration — Phase 6 (DATA-04)
- SSE real push and invalidation — Phase 6 (DATA-06)
- Full turn assembly (compact boundary, queued commands, system message handling, multi-turn tool call pairing) — Phase 3 (TURN-01 through TURN-06)
- Migration infrastructure — Phase 6 hardening
- Frontend integration with ingest API — Phase 4 (UI-05)
- API safety constraints (path whitelisting, no arbitrary file reads) — Phase 6 (DATA-07)

</deferred>

---

*Phase: 02-Local Ingest Core + OpenClaw Parser*
*Context gathered: 2026-05-06*
