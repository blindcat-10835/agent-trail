# Phase 8 Verification Notes

**Date:** 2026-05-09
**Phase:** 08-real-data-parser-tool-persistence-and-sync-refresh-repair
**Status:** Complete

---

## Scope

These notes record the deterministic (non-local) verification commands run for Phase 8.
Local corpus runs (requiring `RUN_REAL_SESSION_TESTS=1`) were skipped because
no local session manifest was available in the CI/worktree context.

---

## Commands Run

### 1. Phase 8 Regression Tests (New)

```bash
/path/to/node_modules/.bin/vitest run tests/unit/ingest/phase8-regression.test.ts
```

**Result:** 12 tests passed (0 failed)

Test coverage:
- `messages.id IS NOT NULL` — Claude JSONL parsed and synced: `count(*) = count(id)` for messages table
- `messages.id IS NOT NULL` — Codex JSONL parsed and synced: `count(*) = count(id)` for messages table
- Claude `tool_result` pairing: `tool_calls.count = 1`, `tool_result_events.count = 1`
- Force sync re-populates `tool_calls` exactly once (no duplicates)
- Codex `function_call` + `event_msg function_call_output`: `tool_calls.count > 0`, `tool_result_events.count > 0`
- Codex `function_call_output` as `response_item`: pairing confirmed
- Codex `custom_tool_call` + `event_msg custom_tool_call_output`: `tool_calls.count > 0`, `tool_result_events.count > 0`
- Session discoverable by id after initial sync
- Session discoverable by id after force sync (effac644 regression class)
- Session appears in list-style SELECT query after force sync
- Claude `assembleTurns()` returns tool activities from DB
- Codex `assembleTurns()` returns tool activities from DB

### 2. All Unit Tests (Ingest)

```bash
/path/to/node_modules/.bin/vitest run tests/unit/ingest/
```

**Result:** 152 tests passed (11 test files)

Test file breakdown:
- `claude-parser.test.ts` — Claude JSONL parser structural assertions
- `codex-parser.test.ts` — Codex JSONL parser structural assertions
- `parser-types.test.ts` — Parser type invariants
- `parser.test.ts` — Parser integration
- `sessions-api.test.ts` — Sessions REST API
- `sources.test.ts` — Source sync API
- `sync.test.ts` — Sync layer
- `tool-persistence.test.ts` — DB persistence (20 tests added Phase 8 Plan 03)
- `turn-activity-regression.test.ts` — assembleTurns regression (7 tests added Phase 8 Plan 03)
- `turns.test.ts` — Turn assembly
- `phase8-regression.test.ts` — Phase 8 target-session regression (12 tests, added this plan)

### 3. Ingest TypeScript Typecheck

```bash
/path/to/node_modules/.bin/tsc --noEmit -p ingest/tsconfig.json
```

**Result:** Clean (no errors)

---

## DB Assertion Summaries

### 606dac00 Target Session Class (claude-key-null-risk)

**Assertion:** After parse + force sync of any Claude session:
```sql
SELECT COUNT(*) as total, COUNT(id) as with_id FROM messages WHERE session_id = ?;
-- Expected: with_id = total (no NULL ids)
```

**Result:** Verified via `phase8-regression.test.ts` — test "all messages have non-null id after parsing Claude JSONL and sync" passes.

**Root cause addressed:** Plan 03 added stable message ID logic to `writeSessionToDatabase`: uses `message.id` when non-empty, falls back to deterministic `${sessionId}:${ordinal}`.

### effac644 Target Session Class (claude-discoverability)

**Assertion:** After initial sync followed by force sync:
```sql
SELECT id, source FROM sessions WHERE id = ?;
-- Expected: row found
```

**Result:** Verified via `phase8-regression.test.ts` — tests "session exists in sessions table with correct id after initial sync" and "session remains discoverable after force sync" both pass.

**Root cause addressed:** Plan 03 implemented dependency-order delete in transactional writes — the session row is always upserted, not deleted-and-lost on force re-sync.

### Tool Sessions (codex-function-output, codex-custom-tool)

**Assertion:** After parse + force sync:
```sql
SELECT COUNT(*) as c FROM tool_calls WHERE session_id = ?;
-- Expected: c > 0

SELECT COUNT(*) as c FROM tool_result_events
WHERE tool_call_id IN (SELECT id FROM tool_calls WHERE session_id = ?);
-- Expected: c > 0
```

**Result:** Verified via `phase8-regression.test.ts` — all Codex tool output tests pass.

**Root cause addressed:**
- Plan 01: Added `function_call_output` using `ev.output || ev.content` fallback; added `custom_tool_call`/`custom_tool_call_output` handlers
- Plan 02: Added `function_call_output` as `response_item` handler; added `inputJson` normalization
- Plan 03: Persisted `tool_calls` and `tool_result_events` transactionally

---

## Local Corpus Status

**Local corpus manifest:** `.local/real-session-corpus.json` — NOT PRESENT in this context

**Corpus tests:** Skipped (no manifest). The harness was extended in Plan 05 to recognize:
- `claude-key-null-risk` — DB-backed `count(*) = count(id)` assertion after force sync
- `claude-discoverability` — DB-backed session discoverability assertion after force sync
- `codex-function-output` — DB-backed `tool_calls > 0` assertion
- `codex-custom-tool` — DB-backed `tool_calls > 0` assertion
- `claude-subagent` — `subagent_link` activity assertion

When local sessions matching the `606dac00-...` or `effac644-...` IDs are added to
`.local/real-session-corpus.json` with the appropriate tags, these assertions will run
automatically via `RUN_REAL_SESSION_TESTS=1 pnpm test:real-sessions`.

---

## Manual Smoke Test

**Dev server status:** Not running in this worktree/CI context.

**Intended manual verification steps** (to be performed when dev server is available):

1. Start dev servers: `pnpm dev` (Next.js on :3000, ingest on :8078)
2. Navigate to target Claude session `606dac00-...` in browser
3. Confirm replay tool blocks show structured inputs/results (not empty)
4. Open browser console — confirm no `key=null` warnings in session list rendering
5. Navigate to `effac644-...` Claude session
6. Trigger force sync via refresh button in right rail (Syncing... spinner should appear)
7. Confirm session reappears in the session list after sync completes
8. Navigate to a Codex session with function calls
9. Confirm turn replay shows tool call blocks with expanded inputs and result content

---

## Phase 8 Completion Summary

All user-reported failures are addressed by committed code:

| Issue | Plan | Fix |
|-------|------|-----|
| Null message IDs (`key=null` in UI) | 03 | Stable ID with `${sessionId}:${ordinal}` fallback |
| Tool calls not in DB after sync | 03 | Transactional `tool_calls` + `tool_result_events` insert |
| Force sync loses sessions (effac644) | 03 | Dependency-order delete preserves session row |
| Claude tool_result not paired | 02 | `toolCallMap` pairing by `tool_use_id` |
| Codex `function_call_output.output` empty | 01 | `ev.output || ev.content` fallback |
| Codex `custom_tool_call` not handled | 01 | Added handler before unknown-type fallback |
| Refresh button triggers ingest reindex | 04 | Sync-first refresh pattern wired through BFF |
