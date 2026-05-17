# Phase 17: OpenCode Source Integration - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Add OpenCode (opencode CLI v1.15+) as a fourth formal data source, enabling full-stack session browsing, turn replay, tool activity, reasoning blocks, token usage, cost display, and overview integration — alongside the existing OpenClaw, Claude Code, and Codex sources.

OpenCode stores data in a local SQLite database (`~/.local/share/opencode/opencode.db`), not JSONL files. This requires a new SQLite reader parser instead of the existing JSONL parser pattern.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**10 requirements are locked.** See `17-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `17-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Type system extension (`TraceSource`, `SourceToolId`, `SyncSourceType`, validation arrays)
- SQLite schema migration for reasoning tokens and source-reported cost
- OpenCode DB discovery, validation, and configuration
- Readonly SQLite parser mapping opencode rows to canonical trace model
- Sync engine integration for opencode source
- Frontend tool registry, BFF adapter, and route integration
- Cost display from opencode source-reported values
- Overview aggregate integration for opencode source
- Session detail and turn replay for opencode sessions
- Documentation updates
- Unit and integration tests for parser, sync, and BFF

**Out of scope (from SPEC.md):**
- Snapshot/Git object reading — complex Git object parsing, not needed for transcript replay
- `session_diff` JSON as transcript source — diff visualization is a separate feature
- `todo` table integration — task tracking is not transcript data
- `auth.json` reading — security hardline, never read provider credentials
- `opencode export` CLI calls in production — only used for generating test fixtures
- Incremental/append sync for opencode — first version uses full-parse per session with skip-cache
- Watcher-based real-time sync for opencode DB — first version relies on periodic/manual sync
- Custom opencode-specific UI components — opencode uses shared shell, overview, sessions, replay

</spec_lock>

<decisions>
## Implementation Decisions

### SQLite Reader Strategy
- **D-01:** Connection lifecycle — open DB readonly at start of each sync run, close after completion. Stateless, consistent with existing JSONL parser pattern.
- **D-02:** Skip cache — use `session.time_updated + message count + part count` as composite skip key. Reuses existing skip cache mechanism. Unchanged sessions are skipped before parser work.
- **D-03:** WAL lock handling — catch `SQLITE_BUSY`, retry up to 3 times with 100ms delay. If still busy after retries, skip that session and log a warning. Does not crash ingest or abort the entire sync run.
- **D-04:** Schema guard — on DB open, check that `session`, `message`, `part`, `project` tables exist. Do NOT check column names — avoids brittleness across opencode versions.

### Part-to-Activity Mapping
- **D-05:** Turn boundary — user message starts a turn; all subsequent assistant messages + their parts belong to that turn until the next user message. Same as claude-code/codex parser convention.
- **D-06:** `tool` parts → `TraceToolCall` with category mapping: `bash`→Bash, `read`→Read, `edit`/`write`/`patch`→Edit, `grep`/`glob`→Grep, `task`/`subtask`→Task. Reuse the same `inferClaudeToolCategory` pattern from `ingest/parser/claude.ts`.
- **D-07:** `reasoning` parts → `TraceThinkingBlock`.
- **D-08:** `patch` parts → `TraceToolCall` with category `Edit`, tool name `"patch"`, files array as `inputJson`. Consistent with how Claude Code shows file edits.
- **D-09:** `step-start` and `step-finish` → `TraceSystemEvent` with subtype `step-start`/`step-finish`. Shows step boundaries and token/cost checkpoints in replay.
- **D-10:** `subtask` parts → `TraceSubagentLink` if referencing a session ID; otherwise `TraceSystemEvent`.
- **D-11:** `file` parts → message attachment placeholder in content, not a standalone activity.

### Schema Migration Strategy
- **D-12:** Migration approach — rebuild table (create new table with updated CHECK including `opencode`, copy data, drop old, rename). Affects 3 tables: `sessions`, `subagent_links`, `file_cursors`. Consistent with Phase 10 migration pattern.
- **D-13:** New columns — add `source_cost_usd REAL`, `cost_source TEXT`, `cost_pricing_status TEXT` to `sessions` table only. No new token columns; reasoning tokens can use existing `total_cache_read_tokens` pattern or be stored in a JSON field if needed later.

### Cost Mixed Display Strategy
- **D-14:** Cost source priority — when `source_cost_usd` is not null for opencode sessions, use the source-reported value. `cost_source` column marks `'source-reported'`. For other sources, continue using pricing registry estimates.
- **D-15:** `reported_zero` — when opencode reports `cost = 0` but has non-zero tokens, set `cost_pricing_status = 'reported_zero'`. Display as `$0.00` without `~` prefix (it's exact, not estimated). Never silently replace with pricing registry estimate.
- **D-16:** UI distinction — use `~` prefix for pricing registry estimates (e.g., `~$1.23`), no prefix for source-reported values (e.g., `$1.23`). Consistent with existing Phase 12 `~` prefix for partial pricing.
- **D-17:** `source=all` aggregation — mix both cost sources: opencode sessions use source-reported cost, other sources use pricing registry estimates. Sum all for total. The `pricingStatus` field in overview aggregates should reflect the mix.

### the agent's Discretion
- Exact parser file organization (single file vs split into reader/mapper/normalizer)
- DB query structure (prepared statements vs raw queries)
- Skip key hash algorithm
- Exact migration version number
- How `file` parts are rendered in message content
- Whether to query `session_message` table for agent-switched/model-switched events
- Exact tool name display format for opencode tools in replay UI

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Specification
- `.planning/phases/17-opencode-source-integration/17-SPEC.md` — 10 locked requirements, boundaries, acceptance criteria. MUST read before planning.

### OpenCode Data Model Investigation
- `.planning/2026-05-17-opencode-source-integration-plan.md` — Complete investigation of opencode SQLite schema, canonical mapping tables (§3.4), implementation sub-phases (O-01 to O-06), testing strategy, and risk analysis. This is the primary reference for the parser implementation.

### Existing Source Patterns
- `ingest/parser/claude.ts` — Reference parser for activity mapping: `inferClaudeToolCategory()` for tool category mapping, `TraceToolCall`/`TraceThinkingBlock`/`TraceSubagentLink` construction patterns
- `ingest/parser/codex.ts` — Reference for subagent link handling and incremental parse structure
- `lib/agent-tools/codex/server-adapter.ts` — Simplest BFF adapter pattern to replicate for opencode
- `lib/agent-tools/codex/definition.ts` — Tool definition pattern including capabilities, nav, UI profile

### Schema and Migration
- `ingest/db/schema.sql` — Current schema with 3 CHECK constraints that need updating (lines 14, 172, 258)
- `ingest/db/index.ts` — Migration history; Phase 10 migration (v9→v10) is the reference for additive schema changes

### Cost/Pricing
- `ingest/pricing/model-pricing.ts` — Source-agnostic pricing registry; `estimateModelCost()` for model-name-based cost estimation
- `types/trace.ts` — Canonical trace types: `TraceActivity`, `TraceToolCall`, `TraceThinkingBlock`, `TraceSystemEvent`, `TraceSubagentLink`, `TokenUsage`

### Source Integration Points (all must be updated for `opencode`)
- `types/trace.ts:22` — `TraceSource` union type
- `lib/agent-tools/types.ts:18` — `SourceToolId` union type
- `lib/agent-tools/registry.ts` — `AGENT_TOOL_DEFINITIONS`, `TOOL_IDS`, `SHELL_TOOL_IDS`, `getAllDefinitions()`
- `ingest/sync/index.ts:63` — `SyncSourceType` type alias
- `ingest/sync/index.ts:1710` — `syncSource()` dispatch
- `ingest/sync/index.ts:1844` — `parseFullCandidate()` dispatch
- `ingest/sync/sources.ts:277` — `getSourceConfig()` dispatch
- `ingest/api/overview.ts:27` — `VALID_SOURCES` array
- `ingest/api/sources.ts:22` — `SOURCE_TYPES` array + `discoverByType()` dispatch
- `ingest/api/sessions.ts:36` — source whitelist
- `ingest/config/tool-dirs.ts` — `TOOL_DIR_REGISTRY` array
- `ingest/config/capabilities.ts` — `SOURCE_CAPABILITIES` map
- `ingest/index.ts:76,267` — source arrays for startup/scheduler
- `app/api/sync/route.ts:4` — BFF sync `SOURCE_TYPES`

### Architecture and Conventions
- `docs/ARCHITECTURE.md` — Dual-service architecture, BFF proxy, trust boundaries
- `docs/DATA-FLOW.md` — JSONL → Parser → SQLite → Turns → Frontend data pipeline
- `docs/API.md` — Ingest REST/SSE endpoints + BFF proxy routes
- `docs/db-schema.md` — SQLite 6-table structure, indexes, foreign keys
- `ERRORS_LEARNED.md` — Historical pitfalls to avoid

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `inferClaudeToolCategory()` in `ingest/parser/claude.ts` — Same tool name→category mapping works for opencode (bash, read, edit, write, grep, glob, task all have identical names)
- `buildSourceScopedSessionParams()` in `lib/agent-tools/server-adapter.ts` — BFF adapter helper; just pass `SOURCE = 'opencode'`
- Skip cache mechanism in `ingest/sync/index.ts` — Session-level skip with composite key; adapt for SQLite session metadata
- `writeSessionToDatabase()` in `ingest/sync/index.ts` — Canonical write path; all parsers feed into this
- `SOURCE_CAPABILITIES` pattern in `ingest/config/capabilities.ts` — `Record<string, ...>` accepts new keys at runtime
- `SourceSwitcher` component — dynamically renders from `getAllDefinitions()`, not hardcoded to 3 sources
- `WatcherConfig.sourceDirs: Map<SyncSourceType, string[]>` — source-agnostic watcher, no hardcoded logic

### Established Patterns
- Stateless parser pattern: open → parse → close per sync run
- `ParseResult { session, messages, activities, errors, warnings }` — all parsers return this
- Session ID prefixing: `opencode:${rawSessionId}` for global uniqueness
- BFF proxy: frontend never connects directly to ingest
- Source validation: `assertSourceToolId()` / `assertAgentToolId()` throws for unknown tools
- Migration versioning: sequential integer versions in `ingest/db/index.ts`

### Integration Points
- Parser output → `writeSessionToDatabase()` → canonical SQLite → BFF → frontend
- Source discovery → `getSourceConfig()` → `discoverByType()` → sync trigger
- Tool definition registry → `SourceSwitcher` + route validation + BFF routing
- Overview aggregates → `VALID_SOURCES` guard → per-source queries → BFF → UI

</code_context>

<specifics>
## Specific Ideas

- Part-to-activity mapping should stay consistent with how Claude Code displays activities in the replay UI — same tool categories, same visual treatment
- `step-start`/`step-finish` as system events give structure to long assistant responses (each LLM API call becomes a visible boundary)
- The `~` prefix convention from Phase 12 cost display extends naturally: `~` = estimated by pricing registry, no prefix = source-reported exact value

</specifics>

<deferred>
## Deferred Ideas

- Incremental/append sync for opencode DB — after baseline is stable, can add cursor-based incremental reads for changed sessions only
- Watcher-based real-time sync for `opencode.db`/`opencode.db-wal` — can monitor WAL file changes with chokidar, trigger sync on change
- `todo` table integration — opencode's todo items could map to a new activity type or automation data in a future phase
- `session_diff` JSON visualization — diff summaries could power a file-change view in session detail
- Snapshot/Git object reading — file snapshots could enable before/after diff views
- `opencode export --sanitize` for automated test fixture generation

</deferred>

---

*Phase: 17-opencode-source-integration*
*Context gathered: 2026-05-17*
