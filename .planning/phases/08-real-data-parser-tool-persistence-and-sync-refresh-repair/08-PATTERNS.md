# Phase 8: Implementation Patterns

**Mapped:** 2026-05-09

## Existing Patterns To Reuse

| Concern | Existing Pattern | Files |
|---------|------------------|-------|
| Parser return contract | `ParseResult` returns canonical `TraceSession`, `TraceMessage[]`, `TraceActivity[]`, warnings/errors. | `ingest/parser/types.ts` |
| Parser tests | Vitest writes temporary JSONL files with `writeFixture()` and calls parser directly. | `tests/unit/ingest/claude-parser.test.ts`, `tests/unit/ingest/codex-parser.test.ts` |
| Regression fixtures | Self-contained parser regression tests use temp fixtures. | `tests/fixtures/parser-regression/*.test.ts` |
| SQLite tests | In-memory `better-sqlite3` DB loaded from `ingest/db/schema.sql`. | `tests/unit/ingest/sync.test.ts` |
| Turn read model | `assembleTurns(sessionId)` groups DB messages and reads `tool_calls` / `tool_result_events`. | `ingest/turns/assembler.ts` |
| Ingest sync API | Hono route validates source type then calls `syncSource(type)`. | `ingest/api/sources.ts` |
| BFF boundary | Next route handlers call `fetchIngest()` and sanitize errors. | `app/api/sync/route.ts`, `lib/agent-tools/server-adapter.ts` |
| Client refresh | Hooks listen for `SESSION_REFRESH_EVENT` and refetch BFF sessions. | `lib/agent-tools/client-hooks.tsx` |

## Closest Code Analogs

### Parser Real-shape Tests

Use `tests/unit/ingest/codex-parser.test.ts` and `tests/unit/ingest/claude-parser.test.ts` as the primary pattern. Add focused tests rather than broad snapshots:

- Count messages/activities.
- Assert no unknown-type warnings for known real payloads.
- Assert `tool_call.id`, `name`, `inputJson`, `resultEvents`.
- Assert thinking/compact records are preserved.

### DB Persistence

Use `tests/unit/ingest/sync.test.ts` for schema bootstrapping, but add new tests that import `writeSessionToDatabase()` directly. The test should not rely only on `syncSource()` discovery mocks because the bug is inside `writeSessionToDatabase()`.

### Refresh UI

Use `tests/hooks/client-hooks.test.tsx` for global refresh event behavior. Add assertions around fetch order:

1. Sync endpoint is called.
2. Session list endpoint is called after sync resolves.
3. Error state is visible if sync fails, but existing list is not destructively cleared.

## Required Divergences

- Existing parser activities lack message ordinal metadata. Phase 8 must add explicit metadata; matching activities to messages by text is not acceptable.
- Existing `writeSessionToDatabase()` is not transaction-safe for derived rows. Phase 8 must wrap session/message/tool writes in a transaction.
- Existing right rail source refresh calls `sourceSessions.refetch()` only. Phase 8 must call sync first.

## Files To Avoid Unless Needed

- `docs/DATA-FLOW.md` currently has unrelated local modifications. Do not touch it unless the user explicitly asks or the execution plan needs docs updates later.
- `ingest/dist/**` is generated output and should not be edited manually.

