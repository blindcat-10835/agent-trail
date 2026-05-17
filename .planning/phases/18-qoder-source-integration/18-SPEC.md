# Phase 18: Qoder Source Integration — Specification

**Created:** 2026-05-18
**Ambiguity score:** 0.147 (gate: ≤ 0.20)
**Requirements:** 10 locked

## Goal

Add Qoder (desktop IDE assistant) as a fifth formal data source in agent-tracing-dashboard, enabling full-stack session browsing, turn replay, tool activity, subagent linkage, and token usage display from Qoder's local SQLite main database — alongside the existing OpenClaw, Claude Code, Codex, and OpenCode sources. Cost is intentionally excluded from this phase: Qoder records only product-tier model keys (`ultimate` / `experts-ultimate`) and does not expose verifiable underlying provider/model billing.

## Background

The dashboard currently supports four agent data sources (OpenClaw, Claude Code, Codex, OpenCode). Qoder is a desktop IDE-style AI assistant whose session data is split across two on-disk locations:

- A lightweight `~/.qoder/cache/projects/<project>/conversation-history/<session>/<session>.jsonl` containing only `role` and `message.content[].text` — no tokens, model, tool calls, or parent/child session relationships.
- The full canonical record in Qoder's main SQLite database at `~/Library/Application Support/Qoder/SharedClientCache/cache/db/local.db`, with tables `chat_session`, `chat_record`, `chat_message`, `chat_snapshot`, etc.

A detailed investigation exists at [`.planning/2026-05-17-qoder-source-integration-plan.md`](.planning/2026-05-17-qoder-source-integration-plan.md) covering schema, token semantics, model keys, tool result shape, subagent relationships, and migration strategy.

The local `chat_message` table contains 27 assistant rows with `token_info`, 75 tool rows with `tool_result`, 5 user rows, and 4 sessions whose `chat_session.parent_session_id` / `parent_tool_call_id` link child sessions back to parent `Agent` tool calls. `chat_message.model_info.model_key` and `chat_record.extra.modelConfig.key` record only `ultimate` / `experts-ultimate`.

No existing code in the codebase handles Qoder. The integration must extend the type system, ingest parser layer (a SQLite row-reader, not a JSONL parser), sync engine (with per-session fingerprint skip instead of file hash), DB schema CHECK constraints, BFF proxy, frontend registry, and overview UI without destabilizing the existing four sources.

This phase deliberately keeps cost out of scope. Qoder's `ultimate` / `experts-ultimate` are product tiers, not provider/model billing identifiers, and the local DB does not expose USD values.

## Requirements

1. **Source identity and type system**: `qoder` is a valid value across `TraceSource`, `SourceToolId`, `SyncSourceType`, validation arrays, BFF tool registry, and SQLite CHECK constraints.
   - Current: `TraceSource = 'openclaw' | 'claude-code' | 'codex' | 'opencode'`; four hardcoded source IDs across ingest, BFF, frontend
   - Target: `TraceSource = 'openclaw' | 'claude-code' | 'codex' | 'opencode' | 'qoder'`; all type unions, CHECK constraints (`sessions.source`, `subagent_links.source`, `subagent_links.subagent_source`, `ingest_file_cursors.source_type`), validation arrays, and whitelist entries accept `qoder`
   - Acceptance: TypeScript compilation passes; existing tests for the four prior sources still pass; `assertSourceToolId('qoder')` does not throw

2. **SQLite schema migration to widen source CHECK constraints**: The ingest SQLite schema accepts `qoder` everywhere `source` is constrained.
   - Current: CHECK constraints allow only `openclaw | claude-code | codex | opencode` (assuming Phase 17 has landed; otherwise the existing three) on `sessions`, `subagent_links`, `ingest_file_cursors`
   - Target: Migration creates replacement tables with widened CHECK constraints, copies existing rows, drops old tables, renames replacements, and rebuilds indexes, FTS5 external content triggers, and foreign keys per current `ingest/db/migrations` conventions; migration is additive and existing rows are unaffected
   - Acceptance: An existing local SQLite DB migrates without data loss; `INSERT INTO sessions (source, ...) VALUES ('qoder', ...)` succeeds; FTS5 external content triggers continue to fire on inserts; `pnpm test:run ingest/db/migrations` passes

3. **Qoder DB discovery and configuration**: Ingest discovers the local Qoder SQLite main DB through environment variable, config file, or built-in default.
   - Current: No Qoder configuration exists in `tool-dirs.ts`, `env.ts`, or `~/.agents-tracing/config.json` schema
   - Target: `QODER_DB_PATH` env var (single path) or `qoder_db_paths` config key (path array) or default `~/Library/Application Support/Qoder/SharedClientCache/cache/db/local.db` resolves; discovery validates the file exists, is readable, opens readonly, and contains the expected tables (`chat_session`, `chat_record`, `chat_message`); `discoverQoderSources()` recognizes file paths instead of recursing for `.jsonl`
   - Acceptance: `/api/v1/sources/qoder` returns `{ path, sessionCount, status: 'configured' }` when DB exists; returns `{ status: 'empty' | 'error' }` with non-crashing fallback when DB is absent or schema is missing tables

4. **Qoder readonly SQLite parser**: A new parser reads Qoder sessions from the SQLite DB and produces canonical `ParseResult` objects with `qoder:` session IDs.
   - Current: No Qoder parser exists; all parsers read JSONL files
   - Target: `ingest/parser/qoder.ts` opens `local.db` readonly (`new Database(path, { readonly: true, fileMustExist: true })`); queries rows in order `chat_session ORDER BY gmt_modified DESC` then per-session `chat_record ORDER BY gmt_create, request_id` and `chat_message ORDER BY gmt_create, id`; maps to `TraceSession`, `TraceMessage`, `TraceToolCall`, `TraceToolResultEvent`, `TraceThinkingBlock`, `TraceSubagentLink` per the canonical mapping in `.planning/2026-05-17-qoder-source-integration-plan.md` §3.3; canonical session IDs use `qoder:<raw-session-id>` prefix; raw ID is preserved in `source_session_id`; never reads `machine_token.json`, `supabase_token` table, or `secret://` keys
   - Acceptance: Parser produces a valid `ParseResult` for a synthetic SQLite fixture covering one root session + one subagent session + one error tool; tool messages map to `TraceToolCall` + `TraceToolResultEvent` with correct `inputJson`, `results[]`, status; assistant messages with `token_info` map to per-turn `TokenUsage`; `chat_session.parent_session_id` produces `relationshipType: 'subagent'` and a `TraceSubagentLink` row; malformed JSON in `tool_result` / `token_info` / `model_info` produces a parser warning without aborting the session

5. **Sync integration with per-session fingerprint skip**: Ingest sync engine indexes Qoder sessions through the canonical `writeSessionToDatabase` pipeline using a Qoder-specific skip strategy.
   - Current: `syncSource()` dispatches only to JSONL-file sources via `collectSessionFileCandidates()`; skip cache uses whole-file hashes
   - Target: `SyncSourceType` accepts `'qoder'`; `syncQoderSource(opts)` opens the DB readonly, iterates `chat_session` rows, builds session bundles, and writes each through `writeSessionToDatabase`; skip cache uses session fingerprint `qoder-session-v1:<session_id>:<gmt_modified>:<message_count>:<max_message_gmt>` instead of whole-DB hash; `force: true` re-parses all Qoder sessions; `SQLITE_BUSY` / locked DB is logged and the session is preserved (no destructive delete)
   - Acceptance: `POST /api/v1/sources/qoder/sync` indexes Qoder sessions into the canonical DB; re-running sync without DB changes skips every session via fingerprint; appending one new message to one Qoder session re-indexes only that session; running the Qoder app concurrently does not crash ingest

6. **Frontend registry, BFF proxy, and routing**: The frontend recognizes `qoder` as a source and serves its routes.
   - Current: `AGENT_TOOL_DEFINITIONS` includes all, openclaw, claude-code, codex (and opencode after Phase 17)
   - Target: `lib/agent-tools/qoder/definition.ts` defines capabilities (`sessions: true`, `replay: true`, `activity: true`, `subagents: true`, `cost: false`, `office: false`, `workspace: false`, `approvals: false`); `server-adapter.ts` wraps BFF calls with `source=qoder`; registry includes `qoder` in `TOOL_IDS` and `SHELL_TOOL_IDS`; `SOURCE_CAPABILITIES.qoder` is configured; BFF route adapter map adds `qoderAdapter`; SourceSwitcher / overview source color map / label formatter add Qoder
   - Acceptance: `/qoder/dashboard`, `/qoder/sessions`, `/qoder/sessions/:id`, `/qoder/activity` resolve without 404; source switcher includes `qoder` as a formal option; BFF routes accept `qoder` as a valid `[tool]` parameter; `/all/sessions` includes Qoder rows

7. **Session detail and turn replay including tools, subagents, and errors**: Session detail and turn replay work correctly for Qoder sessions.
   - Current: No Qoder sessions exist in the canonical DB; replay UI has only been exercised against JSONL-derived sessions plus opencode SQLite
   - Target: Session detail HUD header shows title, project, model key, agent type (`session_type` / `mode`), token totals, and duration; turn replay assembles turns by `chat_record.request_id`, rendering user input, assistant text, tool calls (with `parameters` / `results[]`), tool results, and error tools (`toolCallStatus = 'ERROR'`); tool categories map per `.planning/2026-05-17-qoder-source-integration-plan.md` §2.8 (`read_file` → Read, `search_file` / `grep_code` / `search_codebase` → Grep, `list_dir` → Read, `run_in_terminal` → Bash, `Agent` → Agent); subagent `Agent` tool calls expose links to child sessions via `parent_session_id` / `parent_tool_call_id` and produce `TraceSubagentLink` rows
   - Acceptance: Opening a Qoder session detail renders without error; a turn with `Agent` tool call shows a clickable subagent link that navigates to the child session; an error tool displays `status='error'` with the `errorMsg` body; tool count rendered in the UI matches `SELECT COUNT(*) FROM chat_message WHERE session_id = ? AND role = 'tool'` for the synthetic fixture

8. **Token attribution without double-counting**: Qoder token totals are derived from `chat_message.token_info` with explicit channel mapping and no double-counting.
   - Current: No Qoder token aggregation logic exists
   - Target: Per assistant message, `inputTokens = prompt_tokens`, `outputTokens = completion_tokens`, `cacheReadTokens = cached_tokens`, `cacheWriteTokens = 0`, `reasoningTokens = 0`, `totalTokens = prompt_tokens + completion_tokens`; `max_input_tokens` is stored as source metadata only and never enters totals; only assistant rows contribute to session totals; user/tool rows do not
   - Acceptance: For the synthetic fixture, `sessions.total_input_tokens` / `total_output_tokens` / `total_cache_read_tokens` match the per-message sums; `total_tokens` is `prompt+completion` only and does NOT include `cached_tokens`; an integration test asserts that summing `cached_tokens` is not added to `total_tokens`

9. **Model display and cost exclusion**: Qoder model column displays the recorded model key; Qoder rows are excluded from cost ranking and never produce a USD estimate.
   - Current: Cost rendering treats every source as estimable via the pricing registry
   - Target: Model fallback chain is `chat_message.model_info.model_key` > `chat_record.extra.modelConfig.key` > `chat_session.preferred_model_info` > workspace/global `chat.modelConfig.session.<id>` > `chat.modelConfig.assistant` / `experts` > `unknown`; rendered model is the raw key (`ultimate`, `experts-ultimate`, or a more specific value when Qoder records one); cost-related code paths treat `source = 'qoder'` as `pricingStatus = 'unknown'`, exclude Qoder from cost-based top rankings, and render the cost cell as `—` / `unknown` (never `$0.00` and never an inferred Anthropic/OpenAI/Gemini price)
   - Acceptance: Sessions table cost column shows `—` for every Qoder row; `GET /api/v1/overview/top-models?metric=cost` does not include Qoder model keys; `GET /api/v1/overview/top-models?metric=tokens` may include Qoder model keys; provider grouping never assigns `ultimate` to Anthropic/OpenAI

10. **Privacy/credential hardline + DB safety + documentation**: The integration cannot read Qoder credentials or write to Qoder's DB, and the project documentation reflects Qoder as a fifth source.
    - Current: No Qoder code paths; docs reference four sources
    - Target: Code paths verifiably never read `SharedClientCache/cache/machine_token.json`, the `supabase_token` table, `secret://` keys in `state.vscdb`, HTTP cookie storage, or any auth/token file; Qoder DB is opened with `readonly: true`; no `PRAGMA` writes are executed against the Qoder DB; `chat_session.extra.firstTurnRulesPrompt` and large `chat_session.extra` JSON are not injected into the canonical transcript or default API responses; locked DB / WAL contention is captured as a parser warning without crashing ingest; `docs/CONFIGURATION.md` documents `QODER_DB_PATH` and `qoder_db_paths`; `docs/API.md` includes `qoder` in source examples; `docs/services/ingest.md` mentions the Qoder SQLite reader; `ERRORS_LEARNED.md` records that Qoder JSONL is insufficient and that auth/token files must not be read
    - Acceptance: A static check (or unit test) asserts no source string referencing `machine_token.json`, `supabase_token`, or `secret://` exists in `ingest/parser/qoder.ts` or its callers; opening the Qoder DB uses `readonly: true`; manual code review confirms no `PRAGMA journal_mode` / `PRAGMA synchronous` / `BEGIN` / `INSERT` / `UPDATE` against the Qoder DB; docs include `QODER_DB_PATH`; `ERRORS_LEARNED.md` has a Qoder credential-hardline entry

## Boundaries

**In scope:**
- Type system extension (`TraceSource`, `SourceToolId`, `SyncSourceType`, validation arrays, BFF tool registry)
- SQLite schema migration to widen source CHECK constraints
- Qoder DB discovery (`QODER_DB_PATH`, `qoder_db_paths`, default macOS path) and validation
- Readonly SQLite row-reader parser mapping `chat_session` / `chat_record` / `chat_message` / `tool_result` / `token_info` / `model_info` to the canonical trace model
- Sync engine integration with per-session fingerprint skip cache
- Frontend tool registry, BFF adapter, route integration, source switcher entry
- Token aggregation with explicit double-count protection
- Model display from Qoder model key fallback chain (`ultimate`, `experts-ultimate`, or specific model when Qoder records one)
- Subagent linkage from `parent_session_id` / `parent_tool_call_id` with `TraceSubagentLink` records
- Session detail, turn replay (including tool calls, tool results, error tools)
- Activity rows for the seven observed Qoder tools (`read_file`, `search_file`, `grep_code`, `search_codebase`, `list_dir`, `run_in_terminal`, `Agent`)
- Documentation updates (`CONFIGURATION.md`, `API.md`, `services/ingest.md`, `ERRORS_LEARNED.md`)
- Unit tests for parser, sync, discovery, type registry, BFF route

**Out of scope:**
- Cost / USD estimation for Qoder — Qoder records only product-tier model keys (`ultimate`, `experts-ultimate`) without verifiable underlying provider/model billing
- Mapping `ultimate` / `experts-ultimate` to specific Anthropic / OpenAI / Gemini models — speculative and risks misleading users
- Watcher-based real-time sync of Qoder DB / WAL files — the first version uses periodic/manual sync; chokidar wiring for `local.db` / `.db-wal` / `.db-shm` and debounce can be added later
- Live snapshot copy-then-read for hot-locked Qoder DB — first version retries-or-skips with a parser warning; copy-snapshot reader is a follow-up enhancement
- `chat_snapshot` table reading and snapshot-based replay — not transcript data; this phase only consumes `chat_session` / `chat_record` / `chat_message`
- Reading `chat_session.extra.firstTurnRulesPrompt` or other large `extra` blobs into the transcript — privacy and payload-size hardline; only specific narrow keys are read
- `task_tree` table integration — task tracking is not transcript data
- `chat_working_space_file` / `chat_working_space_file_reference` integration — adjacent code-context tracking, not core replay
- Reading credentials, tokens, or secrets — `machine_token.json`, `supabase_token` table, `secret://` keys in `state.vscdb`, HTTP cookies, login storage are explicitly excluded
- Writing back to Qoder's DB or executing any write `PRAGMA` against it — Qoder DB is strictly readonly to this codebase
- Conversation-history JSONL as primary data source — JSONL lacks tokens, model, tools, parent/child links; it can serve only as sanity check or fallback (and that fallback is not implemented in this phase)
- Backfill of historical Qoder cost from any external API — billing reconciliation is not in this phase

## Constraints

- Qoder DB MUST be opened readonly (`new Database(path, { readonly: true, fileMustExist: true })`) — no write `PRAGMA`, no `BEGIN`, no `INSERT`/`UPDATE`/`DELETE` against `local.db`.
- Parser MUST NOT read `SharedClientCache/cache/machine_token.json`, the `supabase_token` table, `secret://` keys in `state.vscdb`, or any auth/cookie storage. This is a hardline.
- Canonical session IDs MUST be prefixed `qoder:<raw-session-id>`; the raw ID is preserved in `source_session_id`.
- `prompt_tokens` and `cached_tokens` MUST NOT both be added to total — `totalTokens = prompt_tokens + completion_tokens` only. `cached_tokens` is exposed separately as cache-read.
- `max_input_tokens` MUST be metadata only, never aggregated into totals.
- `model_info.model_key` / `chat_record.extra.modelConfig.key` MUST NOT be mapped to specific Anthropic / OpenAI / Gemini model names. The displayed key is the raw Qoder value.
- Cost code paths MUST treat `source = 'qoder'` as `pricingStatus = 'unknown'`. Qoder rows are excluded from cost-based ranking and never produce a USD value.
- Qoder DB live use (Qoder app running) MUST NOT crash ingest — locked DB / WAL contention is captured as a parser warning, the prior canonical row is preserved.
- Skip cache MUST be per-session fingerprint (`qoder-session-v1:<session_id>:<gmt_modified>:<message_count>:<max_message_gmt>`); whole-DB file hash MUST NOT be used as skip key (would re-index every session on any change).
- Source-enum CHECK constraints MUST be widened by the standard SQLite replacement-table migration pattern; FTS5 external content triggers, indexes, and foreign keys MUST be preserved.
- Existing OpenClaw / Claude Code / Codex / OpenCode parser, sync, BFF, replay tests MUST continue to pass without modification.
- `chat_session.extra.firstTurnRulesPrompt` and other large `extra` JSON MUST NOT be injected into canonical messages or default API responses; only specific narrow keys (`modelConfig`, `key_sub_agent_*`) are extracted.

## Acceptance Criteria

- [ ] `assertSourceToolId('qoder')` does not throw; TypeScript compilation passes
- [ ] Existing OpenClaw / Claude Code / Codex / OpenCode parser, sync, BFF, and replay tests pass without modification
- [ ] SQLite migration widens source CHECK constraints to include `qoder` on `sessions`, `subagent_links.source`, `subagent_links.subagent_source`, `ingest_file_cursors.source_type`; existing rows are preserved
- [ ] `/api/v1/sources/qoder` returns `configured` status, DB path, and session count when local Qoder DB exists; returns `empty` / `error` without crashing when absent
- [ ] `POST /api/v1/sources/qoder/sync` indexes Qoder sessions into the canonical DB
- [ ] Re-running sync with no DB change skips every Qoder session via fingerprint
- [ ] Appending one new message to one Qoder session re-indexes only that session
- [ ] Parser opens Qoder `local.db` with `readonly: true`; static check confirms no write `PRAGMA` / `INSERT` / `UPDATE` against the Qoder DB
- [ ] Parser produces valid `TraceToolCall` + `TraceToolResultEvent` for `read_file`, `search_file`, `grep_code`, `search_codebase`, `list_dir`, `run_in_terminal`, `Agent`
- [ ] Tool with `toolCallStatus = 'ERROR'` maps to `status='error'` and surfaces `errorMsg`
- [ ] `chat_session.parent_session_id` produces `relationshipType: 'subagent'` plus a `TraceSubagentLink` row whose `messageOrdinal` is derived from the matching `Agent` tool call's `toolCallId`
- [ ] `/qoder/dashboard`, `/qoder/sessions`, `/qoder/sessions/:id`, `/qoder/activity` render without 404
- [ ] Source switcher includes `qoder` as a formal option; `/all/sessions` includes Qoder rows
- [ ] Session detail HUD header renders title, project, model key, agent type, tokens, duration for a Qoder session
- [ ] Turn replay assembles turns by `chat_record.request_id` and renders user / assistant / tool / tool-result rows
- [ ] Token totals: `total_input_tokens = sum(prompt_tokens)`, `total_output_tokens = sum(completion_tokens)`, `total_cache_read_tokens = sum(cached_tokens)`, `total_tokens = sum(prompt_tokens + completion_tokens)` with NO double-counting of `cached_tokens` into total
- [ ] Sessions table cost column renders `—` for every Qoder row; cost-based top-models excludes Qoder; token-based top-models may include Qoder model keys
- [ ] Provider grouping never assigns `ultimate` / `experts-ultimate` to Anthropic / OpenAI / Gemini
- [ ] Static check / unit test asserts no string references to `machine_token.json`, `supabase_token`, or `secret://` keys in Qoder code paths
- [ ] Locked Qoder DB (Qoder app running) does not crash ingest; failure is logged as parser warning and previous canonical rows are preserved
- [ ] `docs/CONFIGURATION.md` documents `QODER_DB_PATH` and `qoder_db_paths`; `docs/API.md` and `docs/services/ingest.md` include Qoder; `ERRORS_LEARNED.md` records Qoder credential hardline

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                                 |
|--------------------|-------|------|--------|-----------------------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Full-stack integration aligned with Phase 17 OpenCode pattern         |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | Cost / watcher / snapshot / credentials explicitly excluded           |
| Constraint Clarity | 0.85  | 0.65 | ✓      | Readonly DB, double-count guard, model fallback chain, auth hardline  |
| Acceptance Criteria| 0.78  | 0.70 | ✓      | 22 pass/fail criteria covering schema, parser, sync, UI, privacy      |
| **Ambiguity**      | 0.147 | ≤0.20| ✓      |                                                                       |

## Interview Log

| Round | Perspective     | Question summary                                  | Decision locked                                                                 |
|-------|-----------------|---------------------------------------------------|--------------------------------------------------------------------------------|
| 0     | Researcher      | Where is Qoder data stored?                       | SQLite at `~/Library/Application Support/Qoder/SharedClientCache/cache/db/local.db`; JSONL is insufficient |
| 0     | Researcher      | What schema/tables matter?                        | `chat_session`, `chat_record`, `chat_message`; tool/token/model facts live there only |
| 1     | Boundary Keeper | Phase scope (A / A+B+D / A+B+C+D)?                | Full-stack like Phase 17: parser → sync → BFF → frontend → replay → docs (watcher/incremental deferred) |
| 1     | Boundary Keeper | Cost handling for `ultimate` / `experts-ultimate`?| Cost excluded; pricingStatus = `unknown`; token totals computed; model column shows raw key (or specific model if Qoder records one) |
| 1     | Boundary Keeper | Phase number / position?                          | Phase 18, immediately after Phase 17 OpenCode within v1.1                       |
| 2     | Failure Analyst | What must NOT happen if requirements are wrong?   | Reading `machine_token.json`, `supabase_token`, `secret://` keys; writing to Qoder DB; double-counting `cached_tokens` into total |
| 2     | Failure Analyst | What if Qoder app is running and DB is locked?    | Retry-or-skip with parser warning; never crash ingest; never destructive-delete prior rows |
| 2     | Failure Analyst | Skip cache strategy?                              | Per-session fingerprint (`session_id + gmt_modified + message_count + max_message_gmt`); whole-DB hash forbidden |

---

*Phase: 18-qoder-source-integration*
*Spec created: 2026-05-18*
*Next step: /gsd-discuss-phase 18 — implementation decisions (parser architecture, migration ordering vs Phase 17, sync fingerprint storage, fixture strategy, frontend registry wiring)*
