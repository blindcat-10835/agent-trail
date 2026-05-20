---
phase: 18-qoder-source-integration
plan: 03
subsystem: ingest/parser + ingest/sync + ingest/api + tests
tags: [sqlite-reader, qoder-parser, discovery, sync-engine, fingerprint-skip, privacy-hardline, tool-categories, subagent-links, token-attribution]
requires:
  - 18-01 (DB schema CHECK widening — sessions.source accepts 'qoder')
  - 18-02 (TraceSource/SourceToolId unions include 'qoder'; TOOL_DIR_REGISTRY has qoder entry)
provides:
  - "discoverQoderSources() — readonly DB open, validate 3 tables, return configured/empty/error (QDR-102, QDR-110)"
  - "parseQoderSession(dbPath, rawSessionId) → ParseResult with qoder:<id> prefix (QDR-103)"
  - "inferQoderToolCategory() — 7 Qoder tools mapped to canonical categories (QDR-106)"
  - "computeQoderSessionFingerprint() — sha256(qoder-session-v1:<id>:<gmt_modified>:<msg_count>:<max_msg_gmt>) (QDR-110)"
  - "syncQoderSource() — session-keyed iteration with per-session fingerprint skip cache (QDR-110)"
  - "18 parser unit tests proving canonical mapping, token rule, subagent links, privacy invariant"
  - "Synthetic SQLite fixture builder with MANIFEST.json (D-08/D-09)"
affects:
  - "ingest/sync/index.ts: SyncSourceType widened to include 'qoder'; syncSource/parseFullCandidate dispatch branches added"
  - "ingest/sync/sources.ts: discoverQoderSources() + getSourceConfig() 'qoder' branch"
  - "ingest/api/sources.ts: SOURCE_TYPES includes 'qoder'; discoverByType dispatch"
  - "tests/fixtures/qoder/: synthetic DB + builder + MANIFEST"
tech-stack:
  added:
    - "better-sqlite3 (already in project; new usage for Qoder readonly reader)"
  patterns:
    - "Readonly SQLite reader pattern (single DB handle, readonly:true, fileMustExist:true)"
    - "Per-session fingerprint skip cache (sha256 composite of session metadata)"
    - "Tool category mapping from Qoder tool names to canonical categories"
    - "Token attribution: totalTokens = prompt_tokens + completion_tokens ONLY (SPEC §8)"
key-files:
  created:
    - "ingest/parser/qoder.ts"
    - "tests/fixtures/qoder/build-fixture.ts"
    - "tests/fixtures/qoder/MANIFEST.json"
    - "tests/fixtures/qoder/sample.db"
    - "tests/unit/ingest/parser/qoder.test.ts"
  modified:
    - "ingest/sync/sources.ts"
    - "ingest/sync/index.ts"
    - "ingest/api/sources.ts"
decisions:
  - "Single-file parser (ingest/parser/qoder.ts) — did not split into reader/mapper/normalizer"
  - "Per-session fingerprint stored via sessions.file_hash column (reused per D-03) — no new column"
  - "writeSessionToDatabase() called with sourceFile=source.path+'#'+row.id; separate UPDATE sets file_hash to cacheKey after write"
  - "Subagent parentMessageOrdinal computed by querying parent session messages in the same DB handle — no second Database() connection"
  - "SQLITE_BUSY handled with 3 retries × 100ms busy-wait; parser returns partial result on exhaustion (never crashes)"
  - "Pricing status set to 'unknown' implicitly — parser does not call model-pricing.ts; cost=null at session level"
  - "Did NOT bump PARSER_CACHE_VERSION (v9 unchanged) — Qoder token attribution matches v9 contract"
  - "Malformed tool_result JSON produces ParseWarning but still creates TraceToolCall with empty results — keeps call-result pairing intact"
metrics:
  duration_minutes: 46
  tasks_completed: 3
  files_changed: 8
  tests_added: 18
  commits: 3
  parser_lines: 748
  sync_lines_added: 130
completed: 2026-05-19
---

# Phase 18 Plan 03: Qoder Data Path — Parser + Discovery + Sync + Tests Summary

One-liner: **Readonly SQLite reader (parseQoderSession) maps 7 Qoder tools to canonical categories, emits subagent links via parent_tool_call_id reverse-lookup, attributes tokens as prompt+completion only (never cached), with per-session fingerprint skip cache and 18 passing unit tests against a synthetic fixture.**

---

## What Changed

### 1. Discovery — `ingest/sync/sources.ts`

- Added `discoverQoderSources(dbPaths?: string[]): Promise<DiscoveredSource[]>`
  - Opens each candidate path with `{ readonly: true, fileMustExist: true }`
  - Validates `chat_session`, `chat_record`, `chat_message` tables exist (3/3 required)
  - Returns `{ type: 'qoder', path, sessionCount }` on success
  - Graceful error handling: SQLITE_BUSY / locked DB → push error status, never re-throw (D-10)
- Extended `getSourceConfig()` with `'qoder'` dispatch branch

### 2. API Dispatch — `ingest/api/sources.ts`

- Added `'qoder'` to `SOURCE_TYPES` validation array
- Added `'qoder'` branch to `discoverByType()` calling `discoverQoderSources()`
- Route `/api/v1/sources/qoder` now returns `{ type, sources: [{ path, sessionCount, healthStatus }] }` per SPEC §3

### 3. Parser — `ingest/parser/qoder.ts` (748 lines, new)

**Exports:**
- `parseQoderSession(dbPath, rawSessionId, options?)` → `Promise<ParseResult>`
- `inferQoderToolCategory(toolName)` → `ToolCategory`
- `computeQoderSessionFingerprint(row)` → `string` (SHA-256 hex)

**Key behavior:**
- Single `new Database(dbPath, { readonly: true, fileMustExist: true })` per invocation — reused for all queries including parent ordinal lookup
- Session ID: `qoder:<rawSessionId>` prefix, raw ID in `sourceSessionId`
- Tool category mapping (SPEC §7):
  - `read_file`, `list_dir` → `Read`
  - `search_file`, `grep_code`, `search_codebase` → `Grep`
  - `run_in_terminal` → `Bash`
  - `Agent` → `Agent`
  - default → `Other`
- Token attribution (SPEC §8): `totalTokens = prompt_tokens + completion_tokens` ONLY; `cached_tokens` exposed as `cacheReadTokens` but NEVER added to total; `max_input_tokens` stored as metadata only
- Subagent links: `parent_session_id` + `parent_tool_call_id` → `TraceSubagentLink` with `subagentSource: 'qoder'`, `relationship: 'spawned'`, `messageOrdinal` from parent message reverse-lookup
- Model fallback chain: `chat_message.model_info.model_key` → `chat_record.extra.modelConfig.key` → `chat_session.preferred_model_info` → `'unknown'`
- SQLITE_BUSY retry (3×, 100ms) then warning + partial result — never crashes
- Privacy hardline: no credential paths, no fs.readFile, no write statements against Qoder DB

### 4. Sync Engine — `ingest/sync/index.ts`

- `SyncSourceType` widened: `'openclaw' | 'claude-code' | 'codex' | 'qoder'`
- `syncSource()` dispatch: added `else if (sourceType === 'qoder') { result = await syncQoderSource(opts); }`
- `parseFullCandidate()` dispatch: added `'qoder'` branch
- New `syncQoderSource(opts)` function:
  - Discovers Qoder DBs via `discoverQoderSources()`
  - Opens each DB readonly, enumerates sessions ordered by `gmt_modified DESC`
  - Per-session: computes fingerprint → checks skip cache → parses if changed → writes via `writeSessionToDatabase()` → updates `file_hash` with cache key
  - Fingerprint formula: `sha256("qoder-session-v1:<id>:<gmt_modified>:<msg_count>:<max_msg_gmt>")`
  - `PARSER_CACHE_VERSION` NOT bumped (v9 unchanged — Qoder token rule matches v9 contract)
- New `withSyncRetry()` helper for SQLITE_BUSY (3 retries, 100ms)

### 5. Synthetic Fixture — `tests/fixtures/qoder/`

- `build-fixture.ts`: Builds a minimal SQLite DB with 2 sessions (root + subagent), 8 tool messages (7 tool types + 1 ERROR), 1 assistant with full token_info, 1 user message, 1 malformed JSON
- `MANIFEST.json`: Stable IDs and coverage documentation for test authors
- `sample.db`: Built binary (committed)

### 6. Parser Unit Tests — `tests/unit/ingest/parser/qoder.test.ts` (18 tests, all passing)

| Test | Description |
|------|-------------|
| canonical session id prefix | `session.id === 'qoder:' + rawId`; `sourceSessionId === rawId` |
| root relationshipType | `relationshipType === 'root'`; no `parentSessionId` |
| subagent relationshipType | `relationshipType === 'subagent'`; `parentSessionId === 'qoder:' + rootId` |
| 7 tool categories | All 7 Qoder tools map to correct canonical categories |
| unknown tools → Other | Empty string and unknown tool name → `'Other'` |
| ERROR tool | `status === 'error'`; error message contains 'Permission denied' |
| token attribution | `totalTokens === 200` (NOT 240 — no cached_tokens double-count) |
| session token totals | `inputTokens=120, outputTokens=80, cacheReadTokens=40` match fixture |
| subagent link | `subagentSource === 'qoder'`, `relationship === 'spawned'`, ordinal defined |
| root no self-link | Root session has 0 subagent links |
| malformed JSON warning | Warning matches `/json|parse|malformed/i`; errors empty |
| fingerprint determinism | Identical inputs → identical SHA-256 hex |
| fingerprint differs | Changing any of 4 input fields produces different fingerprint |
| session not found | Non-existent session → error result with `errors[].error` containing 'not found' |
| inferQoderToolCategory (5 tests) | Individual category assertions for each tool |

---

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria met.

---

## Verification Evidence

```
=== Task 1 ===
discoverQoderSources grep count:                          2 (≥ 2 required)
readonly: true, fileMustExist: true:                      1 match
privacy (machine_token/supabase_token/secret://):         0 matches
'qoder' in ingest/api/sources.ts:                         2 (≥ 2 required)
build-fixture exits 0:                                    yes
sample.db session count:                                  2 (root + subagent)
sample.db tool messages:                                  8 (≥ 7)
sample.db ERROR tools:                                    1 (≥ 1)
MANIFEST.json parses:                                     yes

=== Task 2 ===
new Database(readonly, fileMustExist):                    1 match
new Database( count:                                      1 actual (2 in comments)
privacy grep (machine_token etc.):                        0 matches
write-pragma grep (INSERT/UPDATE/DELETE against Qoder):   0 matches
qoder-session-v1: fingerprint formula:                    2 matches
subagentSource: 'qoder':                                  1 match
totalTokens = prompt + completion only:                   verified (line + comment)
pnpm exec tsc --noEmit:                                   5 cross-plan errors only (pre-existing)

=== Task 3 ===
SyncSourceType includes 'qoder':                          1 match
syncQoderSource count:                                    3 (definition + 2 dispatch branches)
buildParserCacheHash('qoder', ...):                       1 match
qoder parser tests:                                       18 passed (18)
sync tests:                                               15 passed (15)
migration tests:                                          7 passed (7)
privacy guard (diff scope):                               PASS
write-pragma guard (diff scope):                          PASS
```

---

## Commits

| Task | Commit    | Subject                                                                                     |
| ---- | --------- | ------------------------------------------------------------------------------------------- |
| 1    | `aa22599` | feat(18-03): add Qoder discovery, API dispatch, and synthetic SQLite fixture                |
| 2    | `7c5e94f` | feat(18-03): implement readonly Qoder parser with tool categories, tokens, subagent links   |
| 3    | `37ff75e` | feat(18-03): sync engine integration + parser unit tests for Qoder                          |

---

## Hand-off Notes for Downstream Plans

- **18-04 (Agent-tools registry + BFF routes):** `SyncSourceType` now includes `'qoder'` — the `ingest/api/sources.ts` TS2345 errors at lines 133-134 are resolved. The `lib/agent-tools/registry.ts` TS2741 remains open — owned by 18-04.
- **18-05 (UI integration):** `TraceSource` already includes `'qoder'` (Plan 18-02). Session filter dropdown and aggregate sessions view still need their `qoder:` branches (pre-existing TS2741/TS2366).
- **Skip cache:** Qoder sync writes `sha256('qoder-session-v1:...')` into `sessions.file_hash` via `UPDATE sessions SET file_hash = ? WHERE id = ?`. The fingerprint is per-session — not per-file.
- **Cost:** Qoder sessions have `pricingStatus = 'unknown'` (implicit — parser never calls model-pricing.ts). Cost code in 18-04 must short-circuit on `SOURCE_CAPABILITIES.qoder.cost === false` before aggregation.

## Self-Check: PASSED

- ✅ `ingest/parser/qoder.ts` exists (748 lines)
- ✅ `ingest/sync/sources.ts` has `discoverQoderSources` function
- ✅ `ingest/sync/index.ts` has `syncQoderSource` function + `SyncSourceType` includes `'qoder'`
- ✅ `ingest/api/sources.ts` has `'qoder'` in `SOURCE_TYPES` + `discoverByType` branch
- ✅ `tests/fixtures/qoder/build-fixture.ts` exists, `pnpm tsx` exits 0
- ✅ `tests/fixtures/qoder/MANIFEST.json` exists and parses
- ✅ `tests/fixtures/qoder/sample.db` exists with 2 sessions
- ✅ `tests/unit/ingest/parser/qoder.test.ts` — 18/18 passed
- ✅ Commits `aa22599`, `7c5e94f`, `37ff75e` exist on `phase/18-qoder-source-integration`
- ✅ `pnpm exec tsc --noEmit` — only 5 pre-existing cross-plan errors
- ✅ Privacy guard — 0 matches in diff for machine_token/supabase_token/secret://
- ✅ Write-pragma guard — 0 matches in diff for INSERT/UPDATE/DELETE against Qoder DB
