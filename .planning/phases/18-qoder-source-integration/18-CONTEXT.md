# Phase 18: Qoder Source Integration - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Qoder (desktop IDE assistant) as a fifth formal data source in agent-tracing-dashboard, enabling full-stack session browsing, turn replay, tool activity, subagent linkage, and token usage display from Qoder's local SQLite main database — alongside the existing OpenClaw, Claude Code, Codex, and OpenCode sources.

Qoder data lives in two on-disk locations, but only the SQLite main DB at `~/Library/Application Support/Qoder/SharedClientCache/cache/db/local.db` carries tokens, model, tool calls, and parent/child session relationships. The lightweight `~/.qoder/cache/projects/<project>/conversation-history/<session>/<session>.jsonl` is informationally insufficient and is NOT a primary or fallback source in this phase.

Cost is intentionally excluded: Qoder records only product-tier model keys (`ultimate` / `experts-ultimate`) and does not expose verifiable underlying provider/model billing.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**10 requirements are locked.** See `18-SPEC.md` for full requirements, boundaries, and 22 acceptance criteria.

Downstream agents MUST read `18-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Type system extension (`TraceSource`, `SourceToolId`, `SyncSourceType`, validation arrays, BFF tool registry)
- SQLite schema migration to widen source CHECK constraints (`sessions`, `subagent_links.source`, `subagent_links.subagent_source`, `ingest_file_cursors.source_type`)
- Qoder DB discovery (`QODER_DB_PATH`, `qoder_db_paths`, default macOS path) and validation
- Readonly SQLite row-reader parser mapping `chat_session` / `chat_record` / `chat_message` / `tool_result` / `token_info` / `model_info` / `parent_session_id` to canonical trace model
- Sync engine integration with per-session fingerprint skip cache
- Frontend tool registry, BFF adapter, route integration, source switcher entry
- Token aggregation with explicit double-count protection (`prompt + completion` only; `cached_tokens` exposed separately as cache-read)
- Model display from Qoder model key fallback chain (raw key, no provider/model mapping)
- Subagent linkage from `parent_session_id` / `parent_tool_call_id` with `TraceSubagentLink` records
- Session detail, turn replay (including tool calls, tool results, error tools)
- Activity rows for the seven observed Qoder tools (`read_file`, `search_file`, `grep_code`, `search_codebase`, `list_dir`, `run_in_terminal`, `Agent`)
- Documentation updates (`CONFIGURATION.md`, `API.md`, `services/ingest.md`, `ERRORS_LEARNED.md`)
- Unit tests for parser, sync, discovery, type registry, BFF route

**Out of scope (from SPEC.md):**
- Cost / USD estimation for Qoder
- Mapping `ultimate` / `experts-ultimate` to specific Anthropic / OpenAI / Gemini models
- Watcher-based real-time sync of `local.db` / `.db-wal` / `.db-shm`
- Live snapshot copy-then-read for hot-locked Qoder DB
- `chat_snapshot`, `task_tree`, `chat_working_space_file*` table reads
- Reading `chat_session.extra.firstTurnRulesPrompt` or large `extra` blobs into transcript
- Reading credentials/tokens (`machine_token.json`, `supabase_token`, `secret://` keys) — security hardline
- Writing back to Qoder's DB or any write `PRAGMA` against it
- Conversation-history JSONL as primary or fallback source

</spec_lock>

<decisions>
## Implementation Decisions

### Migration ordering vs Phase 17
- **D-01:** Phase 18 depends on Phase 17 OpenCode landing first. Phase 18's migration only adds `'qoder'` to the existing CHECK constraints (which already include `'opencode'` after Phase 17). Phase 18 PR is rebased onto a Phase-17-merged main before merging. Migration version number is the next sequential integer after Phase 17's migration.
- **D-02:** If Phase 17 has not landed when Phase 18 is ready to merge, Phase 18 holds — it does NOT defensively widen CHECK to include both `'opencode'` and `'qoder'` (would violate phase boundary and cause merge conflicts).

### Skip cache fingerprint storage
- **D-03:** Reuse the existing `sessions.file_hash` column (already present in schema; semantically extended by Phase 17 OpenCode to mean "source skip key"). Qoder writes `sha256("qoder-session-v1:<session_id>:<gmt_modified>:<message_count>:<max_message_gmt>")` into `file_hash`. No new column, no new table — only the CHECK widening migration. Rationale: aligns with Phase 17's pattern; skip comparison path is identical for all SQLite sources (`SELECT file_hash FROM sessions WHERE id=?`).
- **D-04:** Phase 18 must include the same NULL-flush step Phase 17 uses for its own source rows. Existing OpenClaw / Claude Code / Codex / OpenCode rows are NOT touched.
- **D-05:** Document the technical debt explicitly. Add `docs/skip-cache-naming-debt.md` covering: (1) `sessions.file_hash` column name vs current generic-skip-key semantics; (2) per-source fingerprint algorithms (JSONL = file content hash, OpenCode = `sha256(time_updated + message_count + part_count)`, Qoder = `sha256(qoder-session-v1:...)`); (3) future migration path to rename column to `source_skip_key` once all sources adopt the pattern. The doc is created in this phase.

### Subagent link UI surfacing
- **D-06:** Three-pronged surfacing for `parent_session_id` + `parent_tool_call_id`:
  1. **Persist** — write `TraceSubagentLink` row to `subagent_links` table with `relationship_type='subagent'`, `source='qoder'`, `subagent_source='qoder'`. `messageOrdinal` is derived by reverse-lookup: find the parent session's `chat_message` whose tool call's `toolCallId` matches `parent_tool_call_id`, and use its sequential ordinal.
  2. **Parent transcript inline link** — in the parent session's replay UI, the `Agent` tool call row (the one whose `toolCallId == parent_tool_call_id`) renders a clickable "→ subagent session" link that navigates to `/qoder/sessions/<child-session-id>`.
  3. **Child session header back-link** — child session detail header shows a "Spawned by <parent session title>" badge linking back to the parent session.
- **D-07:** The child session is independently registered in the `sessions` table (its own row, normal `qoder:<child-id>` canonical ID). The subagent_links row is the relational glue, not a substitute for the row.

### Test fixture strategy
- **D-08:** Hand-build a synthetic SQLite fixture via a script. Location: `tests/fixtures/qoder/build-fixture.ts`. Uses `better-sqlite3` raw DDL + INSERT statements. Output: `tests/fixtures/qoder/local.db` (gitignored binary) and a stable JSON manifest committed alongside (`tests/fixtures/qoder/MANIFEST.json`) describing what each row represents.
- **D-09:** Fixture coverage (minimum):
  - 1 root session (`session_type='task'`, no `parent_session_id`)
  - 1 subagent session (linked by `parent_session_id` + `parent_tool_call_id` to root's `Agent` tool call)
  - 7 tool messages covering each observed Qoder tool: `read_file`, `search_file`, `grep_code`, `search_codebase`, `list_dir`, `run_in_terminal`, `Agent`
  - 1 tool with `toolCallStatus = 'ERROR'` exercising the error path
  - 1 assistant message with `token_info` containing all four fields (`prompt_tokens`, `completion_tokens`, `cached_tokens`, `max_input_tokens`)
  - 1 user message
  - 1 message with malformed JSON in `tool_result` (parser warning case)
- **D-10:** Synthetic-only — never sanitize a real user DB. Keeps zero privacy risk and means anyone can run the parser tests without having Qoder installed locally.

### Claude's Discretion
- Exact parser file organization (single `ingest/parser/qoder.ts` vs split into `qoder/reader.ts` + `qoder/mapper.ts` + `qoder/normalizer.ts`)
- Migration version number (depends on what Phase 17 takes)
- DB lock retry policy details (3×100ms aligned with Phase 17 D-03 is the default; tweak if Qoder shows different lock characteristics in practice)
- Prepared-statement strategy inside the parser (cache vs per-call)
- Exact JSON shape of `MANIFEST.json` for the test fixture
- Exact link/back-link visual treatment in replay UI (within shadcn radix-nova design tokens)
- Whether the "skip-cache-naming-debt" doc is a standalone file or a section appended to `docs/db-schema.md` (recommendation: standalone for discoverability, but not a requirement)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Specification (locked requirements)
- `.planning/phases/18-qoder-source-integration/18-SPEC.md` — 10 locked requirements, boundaries, 22 acceptance criteria, ambiguity report. MUST read before planning.

### Qoder Data Model Investigation
- `.planning/2026-05-17-qoder-source-integration-plan.md` — Complete investigation: schema (§2.4 `chat_session`, §2.5 `chat_record`, §2.6 `chat_message`), token semantics (§2.6, §2.7), model keys (§2.7), tool result shape (§2.8), subagent relationship (§2.9), parser/reader strategy (§3.3), sync layer (§3.4), privacy hardline (§5.4). Primary reference for parser implementation.

### Phase 17 OpenCode (sister phase — same SQLite-source pattern)
- `.planning/phases/17-opencode-source-integration/17-SPEC.md` — Reference for full-stack source-integration scope and acceptance criteria shape
- `.planning/phases/17-opencode-source-integration/17-CONTEXT.md` — D-01 connection lifecycle, D-02 skip cache (sessions.file_hash reuse), D-03 WAL retry, D-04 schema guard. Phase 18 inherits the architectural pattern.
- `.planning/phases/17-opencode-source-integration/17-01-PLAN.md` — Reference for CHECK widening migration steps (replacement-table pattern + NULL-flush of own-source rows + index/FTS5/FK rebuild)
- `.planning/phases/17-opencode-source-integration/17-02-PLAN.md` — Reference for skip-cache key generation and SHA-256 hashing pattern
- `.planning/phases/17-opencode-source-integration/17-03-PLAN.md` — Reference for SQLite reader main loop and skip comparison

### Existing Source Patterns
- `ingest/parser/claude.ts` — Reference parser; `inferClaudeToolCategory()` is reused via shared helper for Qoder tool category mapping (per SPEC §7)
- `ingest/parser/codex.ts` — Subagent link handling reference
- `lib/agent-tools/codex/server-adapter.ts` — Simplest BFF adapter pattern to replicate for Qoder
- `lib/agent-tools/codex/definition.ts` — Tool definition pattern (capabilities, nav, UI profile)

### Schema and Migration
- `ingest/db/schema.sql:14,172,258` — Three CHECK constraints to widen for `'qoder'` (sessions.source, subagent_links.source, ingest_file_cursors.source_type); also `subagent_links.subagent_source` per SPEC §1
- `ingest/db/schema.sql:48` — `sessions.file_hash` column reused as fingerprint storage (per D-03)
- `ingest/db/index.ts` — Migration history; Phase 10 + Phase 17's migrations are the reference for additive schema changes; replacement-table pattern preserves indexes/FTS5/FKs
- `ingest/db/index.ts:118` — `expectedTables` list (no change needed; tables remain the same)

### Cost / Pricing (excluded from Qoder; explicit guards required)
- `ingest/pricing/model-pricing.ts` — Source-agnostic pricing registry; Qoder code paths must short-circuit `pricingStatus = 'unknown'` before reaching this
- `types/trace.ts` — Canonical trace types (`TraceActivity`, `TraceToolCall`, `TraceThinkingBlock`, `TraceSystemEvent`, `TraceSubagentLink`, `TokenUsage`)

### Source Integration Points (all need `'qoder'` added; mirror Phase 17's edit list)
- `types/trace.ts:22` — `TraceSource` union
- `lib/agent-tools/types.ts:18` — `SourceToolId` union
- `lib/agent-tools/registry.ts` — `AGENT_TOOL_DEFINITIONS`, `TOOL_IDS`, `SHELL_TOOL_IDS`, `getAllDefinitions()`
- `ingest/sync/index.ts:63` — `SyncSourceType`
- `ingest/sync/index.ts` — `syncSource()` and `parseFullCandidate()` dispatches
- `ingest/sync/sources.ts` — `getSourceConfig()` dispatch
- `ingest/api/overview.ts` — `VALID_SOURCES`
- `ingest/api/sources.ts` — `SOURCE_TYPES` + `discoverByType()`
- `ingest/api/sessions.ts` — source whitelist
- `ingest/config/tool-dirs.ts` — `TOOL_DIR_REGISTRY`
- `ingest/config/capabilities.ts` — `SOURCE_CAPABILITIES.qoder` entry
- `ingest/index.ts` — startup/scheduler source arrays
- `app/api/sync/route.ts` — BFF sync `SOURCE_TYPES`

### Architecture and Conventions
- `docs/ARCHITECTURE.md` — Dual-service architecture, BFF proxy, trust boundaries
- `docs/DATA-FLOW.md` — Parser → SQLite → Turns → Frontend pipeline
- `docs/API.md` — Ingest REST/SSE + BFF proxy routes
- `docs/db-schema.md` — Current SQLite schema reference
- `docs/CONFIGURATION.md` — Env var convention (must be updated to include `QODER_DB_PATH`, `qoder_db_paths`)
- `docs/services/ingest.md` — Ingest service documentation (must be updated to mention SQLite reader)
- `ERRORS_LEARNED.md` — Historical pitfalls; must add Qoder credential-hardline entry and "JSONL is insufficient" entry

### New documentation created in this phase
- `docs/skip-cache-naming-debt.md` — NEW per D-05; documents `sessions.file_hash` column name vs generic-skip-key semantics, per-source fingerprint algorithms, future rename path

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `inferClaudeToolCategory()` in `ingest/parser/claude.ts` — Tool name → category mapping; works for Qoder's seven observed tools per SPEC §7 (`read_file` → Read, `search_file`/`grep_code`/`search_codebase` → Grep, `list_dir` → Read, `run_in_terminal` → Bash, `Agent` → Agent)
- `buildSourceScopedSessionParams()` in `lib/agent-tools/server-adapter.ts` — BFF adapter helper; pass `SOURCE = 'qoder'`
- Skip cache mechanism in `ingest/sync/index.ts` — `sessions.file_hash` column is the comparison key; Phase 17 has already extended its semantics to "source skip key" and Phase 18 inherits this pattern
- `writeSessionToDatabase()` in `ingest/sync/index.ts` — Canonical write path; the Qoder parser's `ParseResult` flows in here unchanged
- `SOURCE_CAPABILITIES` pattern in `ingest/config/capabilities.ts` — Accepts new keys at runtime; Qoder entry: `sessions: true, replay: true, activity: true, subagents: true, cost: false, office: false, workspace: false, approvals: false`
- `SourceSwitcher` component renders dynamically from `getAllDefinitions()` — adding Qoder to the registry surfaces it in the switcher with no UI code changes
- `WatcherConfig.sourceDirs: Map<SyncSourceType, string[]>` — source-agnostic; Qoder's `local.db` path can register here even though Phase 18 does not implement watcher-based sync (deferred)
- `subagent_links` table machinery — already exists for OpenClaw/Codex; the Qoder parser writes rows in the same shape

### Established Patterns
- Stateless parser pattern: open → parse → close per sync run (Phase 17 D-01; Phase 18 inherits)
- `ParseResult { session, messages, activities, errors, warnings }` — universal parser return shape
- Session ID prefixing: `qoder:${rawSessionId}` for global uniqueness (project-wide convention)
- BFF proxy: frontend never connects directly to ingest (project-wide ADR D-07)
- Source validation: `assertSourceToolId()` / `assertAgentToolId()` throw for unknown tools
- SQLite migration versioning: sequential integer versions in `ingest/db/index.ts`
- Replacement-table pattern for CHECK widening: create `*_new` table → copy → drop → rename → rebuild indexes/FTS5 triggers/FKs (Phase 17 PLAN 17-01 is the exact reference)
- WAL lock handling: 3 retries × 100ms then skip-with-warning (Phase 17 D-03; Phase 18 default unless Qoder lock characteristics differ in practice)

### Integration Points
- Parser output → `writeSessionToDatabase()` → canonical SQLite → BFF → frontend (unchanged path)
- Source discovery → `getSourceConfig()` → `discoverByType()` → sync trigger (extended for Qoder file-path discovery instead of JSONL recursion)
- Tool definition registry → `SourceSwitcher` + route validation + BFF routing (registry-driven, mechanical addition)
- Subagent surfacing → `subagent_links` table + parent message ordinal lookup + child session header (per D-06)
- Skip comparison → `SELECT file_hash FROM sessions WHERE id=?` then equality check (per D-03; aligned with Phase 17)

</code_context>

<specifics>
## Specific Ideas

- The technical debt around `sessions.file_hash` (column name no longer matches its semantics) is real but not urgent. Capturing it in `docs/skip-cache-naming-debt.md` is a deliberate trade-off: prefer consistency with Phase 17 over a phase-boundary-violating column rename.
- Subagent link UI should mirror how the user mentally models "this Agent call spawned a child session" — inline at the call site, not buried in a side panel. The three-pronged approach (table + parent inline + child back-link) makes the relationship discoverable from either end.
- Hand-built synthetic fixture is the only privacy-safe option; sanitize is too risky given that `chat_message.content`, `parameters`, and `tool_result` can contain arbitrary user input.

</specifics>

<deferred>
## Deferred Ideas

- Watcher-based real-time sync of Qoder `local.db` / `.db-wal` / `.db-shm` — chokidar wiring + debounce; can layer on top of Phase 18's periodic sync without re-architecting
- Live snapshot copy-then-read for hot-locked Qoder DB — VACUUM INTO snapshot or filesystem-level copy then read; addresses lock contention if it becomes a real-world problem
- Conversation-history JSONL as fallback when SQLite DB is missing — JSONL lacks tokens/model/tools so it's degraded data, but might be valuable for users who have Qoder installed but DB is locked
- Renaming `sessions.file_hash` to `sessions.source_skip_key` once all sources have adopted the pattern — captured in `docs/skip-cache-naming-debt.md`
- `chat_snapshot` / `task_tree` / `chat_working_space_file*` table reads — adjacent Qoder tables outside transcript scope
- Backfill of historical Qoder cost from any external API — billing reconciliation is a cross-source concern, not Qoder-specific

</deferred>

---

*Phase: 18-qoder-source-integration*
*Context gathered: 2026-05-18*
