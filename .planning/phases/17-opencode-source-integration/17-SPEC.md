# Phase 17: OpenCode Source Integration — Specification

**Created:** 2026-05-17
**Ambiguity score:** 0.165 (gate: ≤ 0.20)
**Requirements:** 10 locked

## Goal

Add OpenCode (opencode CLI v1.15+) as a fourth formal data source in the agent-tracing-dashboard, enabling full-stack session browsing, turn replay, tool activity, reasoning blocks, token usage, cost display, and source switching — alongside the existing OpenClaw, Claude Code, and Codex sources.

## Background

The dashboard currently supports three agent data sources (OpenClaw, Claude Code, Codex), all parsed from JSONL files. OpenCode stores session data in a local SQLite database (`~/.local/share/opencode/opencode.db`) with a rich schema: `session` table with token/cost columns, `message` table with role/model/tokens, `part` table with typed content (text, tool, reasoning, step-start/finish, patch, file, subtask), and `project` table with worktree metadata.

A detailed investigation exists at `.planning/2026-05-17-opencode-source-integration-plan.md` covering the complete data model, mapping tables, and implementation sub-phases O-01 through O-06.

The user's local opencode DB contains 190 sessions, 4,655 messages, and 22,910 parts across 6 projects. OpenCode reports per-session cost, input/output/reasoning/cache-read/cache-write tokens, and supports subagent sessions via `session.parent_id`.

No existing code in the codebase handles OpenCode as a data source. The integration must extend the type system, ingest parser layer, sync engine, BFF proxy, frontend registry, and overview UI without destabilizing the three existing sources.

The cost/pricing feature is now complete for existing sources; opencode integration should also include cost display from opencode's source-reported values.

## Requirements

1. **Source identity and type system**: `opencode` is a valid value in `TraceSource`, `SourceToolId`, `SyncSourceType`, and all source validation arrays throughout the codebase.
   - Current: `TraceSource = 'openclaw' | 'claude-code' | 'codex'`; three hardcoded source IDs
   - Target: `TraceSource = 'openclaw' | 'claude-code' | 'codex' | 'opencode'`; all type unions, CHECK constraints, validation arrays, and whitelist entries accept `opencode`
   - Acceptance: TypeScript compilation passes; existing tests for openclaw/claude-code/codex still pass; `assertSourceToolId('opencode')` does not throw

2. **SQLite schema migration**: The ingest SQLite schema accommodates opencode sessions with their token channels and source-reported cost.
   - Current: `sessions` table stores `total_input_tokens`, `total_output_tokens`, `total_cache_read_tokens`, `total_cache_write_tokens` but no `reasoning_tokens` and no source-reported cost column
   - Target: Schema migration adds `reasoning_tokens` column (or equivalent) and source-reported cost fields (`source_cost_usd`, `cost_source`, `cost_pricing_status`) to sessions table; migration is additive and existing rows are unaffected
   - Acceptance: An existing local SQLite DB migrates without data loss; `SELECT reasoning_tokens, source_cost_usd, cost_source, cost_pricing_status FROM sessions LIMIT 1` succeeds without error

3. **OpenCode discovery and configuration**: Ingest discovers the local opencode SQLite DB through environment variable, config file, or built-in default.
   - Current: No opencode configuration exists in `tool-dirs.ts` or environment variables
   - Target: `OPENCODE_DB_PATH` env var or `opencode_db_paths` config key or default `~/.local/share/opencode/opencode.db` is resolved; discovery validates the file exists, is readable, and contains the expected tables (`session`, `message`, `part`, `project`)
   - Acceptance: `/api/v1/sources/opencode` returns the local DB path, session count, and `configured` status when DB exists; returns `empty` or `error` when DB is absent or schema mismatches

4. **SQLite readonly parser**: A new parser reads opencode sessions from the SQLite DB and produces canonical `ParseResult` objects.
   - Current: No opencode parser exists; all parsers read JSONL files
   - Target: `ingest/parser/opencode.ts` opens the DB readonly, queries session+message+part+project rows, maps them to `TraceSession`, `TraceMessage`, `TraceActivity` per the canonical mapping in `.planning/2026-05-17-opencode-source-integration-plan.md` §3.4; parser never reads `auth.json`; session IDs use `opencode:` prefix; `parent_id` maps to subagent relationship
   - Acceptance: Parser produces valid `ParseResult` for a synthetic SQLite fixture with text, tool, reasoning, patch, and step-start/finish parts; tool parts map to `TraceToolCall` with bash/read/edit/grep/task categories; reasoning parts map to `TraceThinkingBlock`; `parent_id` maps to `relationshipType: 'subagent'`

5. **Sync integration**: Ingest sync engine indexes opencode sessions through the existing `writeSessionToDatabase` pipeline.
   - Current: `syncSource()` dispatches only to openclaw/claude-code/codex handlers
   - Target: `syncSource('opencode')` uses the SQLite reader instead of JSONL directory recursion; session-level skip key based on `session.time_updated`, message count, and part count avoids re-parsing unchanged sessions; `file_path` stores DB path with raw session ID; WAL lock conflicts are handled with retry-or-skip without crashing
   - Acceptance: `POST /api/v1/sources/opencode/sync` indexes opencode sessions into the canonical DB; re-running sync is idempotent (no duplicate rows); force sync re-parses all sessions; busy/locked opencode DB does not crash the ingest service

6. **Frontend registry and routing**: The frontend recognizes opencode as a source and serves its routes.
   - Current: `AGENT_TOOL_DEFINITIONS` has entries for all, openclaw, claude-code, codex only
   - Target: `lib/agent-tools/opencode/definition.ts` defines capabilities, nav, and UI profile; `server-adapter.ts` wraps BFF calls with `source=opencode`; registry includes opencode in `TOOL_IDS` and `SHELL_TOOL_IDS`; `SOURCE_CAPABILITIES.opencode` is configured
   - Acceptance: `/opencode/dashboard`, `/opencode/sessions`, `/opencode/sessions/:id`, `/opencode/activity` resolve without 404; source switcher includes opencode; BFF routes accept `opencode` as a valid tool parameter

7. **Cost display integration**: OpenCode source-reported cost appears in overview, sessions table, and session detail.
   - Current: Cost display uses the ingest pricing registry for openclaw/claude-code/codex; no source-reported cost path exists
   - Target: When `source = 'opencode'` and `source_cost_usd` is not null, overview aggregates and session detail display the opencode-reported cost; `cost = 0` with non-zero tokens is labeled `reported_zero` (not hidden or estimated); cost sorting works for opencode sessions; `cost_pricing_status` field drives display labels
   - Acceptance: Overview aggregate cost totals include opencode reported values; sessions table shows cost for opencode sessions; cost-sort includes opencode without false `$0.00` for sessions with `reported_zero`

8. **Overview and aggregate integration**: Overview aggregates, top models, top projects, and activity timeline include opencode data.
   - Current: Overview queries filter by `openclaw`/`claude-code`/`codex` sources only
   - Target: OpenCode sessions contribute to `all` aggregates and appear in `source=opencode` scoped queries; opencode model display uses `providerID/modelID` format; token totals include reasoning and cache channels consistently
   - Acceptance: `GET /api/v1/overview/aggregates?source=opencode` returns valid totals; `GET /api/v1/overview/aggregates?source=all` includes opencode data; top models endpoint returns opencode models with correct token/cost breakdowns

9. **Session detail and turn replay**: Session detail and turn replay work correctly for opencode sessions.
   - Current: No opencode sessions exist in the canonical DB; replay UI only tested with openclaw/claude-code/codex data shapes
   - Target: Session detail shows opencode session header (title, project, model, agent, tokens, cost, duration); turn replay renders user text, assistant text, reasoning blocks, tool calls with input/output, and step boundaries; subagent sessions are linked via parent session navigation
   - Acceptance: Opening an opencode session detail page renders without error; turn replay shows at least one user turn and one assistant turn with tool calls; clicking a subagent link navigates to the parent session

10. **Documentation update**: Project documentation reflects opencode as a fourth source.
    - Current: Docs mention three sources only; `docs/CONFIGURATION.md` has no `OPENCODE_DB_PATH`; `docs/API.md` examples show only openclaw/claude-code/codex
    - Target: `docs/CONFIGURATION.md` documents `OPENCODE_DB_PATH` and `opencode_db_paths`; `docs/API.md` includes opencode in source examples; `docs/db-schema.md` documents new cost columns; `docs/services/ingest.md` mentions opencode SQLite reader
    - Acceptance: No doc file says "three sources" without also mentioning opencode; `OPENCODE_DB_PATH` appears in configuration docs

## Boundaries

**In scope:**
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

**Out of scope:**
- Snapshot/Git object reading — complex Git object parsing, not needed for transcript replay
- `session_diff` JSON as transcript source — diff visualization is a separate feature
- `todo` table integration — task tracking is not transcript data, can be added as activity type later
- `auth.json` reading — security hardline, never read provider credentials
- `opencode export` CLI calls in production — only used for generating test fixtures
- Incremental/append sync for opencode — first version uses full-parse per session with skip-cache; incremental sync can be added after baseline is stable
- Watcher-based real-time sync for opencode DB — first version relies on periodic/manual sync; can add WAL file watcher later
- Custom opencode-specific UI components — opencode uses the same shared shell, overview, sessions, and replay components as other sources

## Constraints

- OpenCode DB must be opened **readonly** (`new Database(path, { readonly: true, fileMustExist: true })`) — never write to the opencode DB
- Parser must handle `SQLITE_BUSY` (opencode running concurrently) with retry-or-skip, not crash
- Session canonical IDs use `opencode:` prefix to avoid collision with existing session IDs
- `auth.json` is a hard exclusion — no code path may read it
- Token double-counting: use `session` table totals for session aggregate, `message.data.tokens` for turn attribution; never sum both
- `cost = 0` with non-zero tokens must be preserved as `reported_zero`, not discarded or re-estimated
- DB CHECK constraints currently only allow three source values — migration must handle constraint relaxation safely
- opencode `model` field is JSON (`{"id":"...", "providerID":"..."}`) requiring parse, not a plain string
- Existing openclaw/claude-code/codex tests must continue to pass without modification

## Acceptance Criteria

- [ ] `assertSourceToolId('opencode')` does not throw; TypeScript compilation passes
- [ ] Existing openclaw/claude-code/codex parser, sync, BFF, and replay tests pass without modification
- [ ] SQLite schema migration is additive — existing rows are preserved
- [ ] `/api/v1/sources/opencode` returns configured status and session count when local opencode DB exists
- [ ] `POST /api/v1/sources/opencode/sync` indexes opencode sessions into canonical DB
- [ ] Re-running sync is idempotent — no duplicate messages, tool calls, or turns
- [ ] Parser maps opencode parts (text, tool, reasoning, patch, step-start/finish) to canonical activity types
- [ ] `parent_id` sessions are linked with `relationshipType: 'subagent'`
- [ ] `/opencode/dashboard`, `/opencode/sessions`, `/opencode/sessions/:id`, `/opencode/activity` render without 404
- [ ] Source switcher includes opencode as the fourth option
- [ ] Overview aggregates include opencode data in both `source=opencode` and `source=all` queries
- [ ] OpenCode reported cost appears in overview, sessions table, and session detail
- [ ] `cost = 0` with non-zero tokens is labeled `reported_zero`, not hidden or re-estimated
- [ ] Session detail renders opencode session header with title, project, model, agent, tokens, duration
- [ ] Turn replay shows user text, assistant text, reasoning blocks, and tool calls for opencode sessions
- [ ] Busy/locked opencode DB does not crash the ingest service
- [ ] Parser never reads `auth.json`
- [ ] Documentation no longer says "three sources" without mentioning opencode

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                      |
|--------------------|-------|------|--------|--------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Full-stack integration, clear deliverables |
| Boundary Clarity   | 0.88  | 0.70 | ✓      | Explicit exclusion list with reasoning     |
| Constraint Clarity | 0.80  | 0.65 | ✓      | Readonly SQLite, WAL lock, auth.json ban   |
| Acceptance Criteria| 0.70  | 0.70 | ✓      | 18 core pass/fail criteria                 |
| **Ambiguity**      | 0.165 | ≤0.20| ✓      |                                            |

## Interview Log

| Round | Perspective     | Question summary                           | Decision locked                                              |
|-------|-----------------|--------------------------------------------|--------------------------------------------------------------|
| 1     | Researcher      | Where is opencode data stored?             | SQLite DB at `~/.local/share/opencode/opencode.db`          |
| 1     | Researcher      | What's the data format?                    | SQLite with session/message/part/project tables              |
| 1     | Researcher      | Phase scope?                               | Full-stack complete support (all 6 sub-phases)              |
| 2     | Simplifier      | Include all 6 sub-phases?                  | Yes, O-01 through O-06 all included                          |
| 2     | Simplifier      | Cost storage: generic or opencode-only?    | Cost/pricing integration now included (was deferred)        |
| 2     | Simplifier      | Parent session mapping?                    | Map `parent_id` as `subagent` relationship                  |
| 3     | Boundary Keeper | Acceptance criteria granularity?           | Core-level pass/fail criteria, not per-sub-phase             |
| 3     | Boundary Keeper | Confirm exclusions?                        | Snapshot, session_diff, todo, auth.json, export CLI excluded |

---

*Phase: 17-opencode-source-integration*
*Spec created: 2026-05-17*
*Next step: /gsd-discuss-phase 17 — implementation decisions (parser architecture, sync strategy, cost wiring, UI audit)*
