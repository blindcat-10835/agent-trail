# Phase 9: Batch 2 session replay and Codex subagent relationship fixes - Context

**Gathered:** 2026-05-10  
**Status:** Ready for planning  
**Source:** User-reported batch-2 bugs + `.planning/bugs-by-user/2026-05-10-bugs-found-by-user-batch-2-research.md`

<domain>
## Phase Boundary

This phase fixes the batch-2 user-reported defects that make session lists and replay blocks incorrect or unstable after Phase 8:

- Persisted starred sessions disappear after refresh because the starred route returns 404.
- All-source session browsing appears capped because aggregate right rail lacks pagination.
- Replay search crashes when Markdown content is highlighted.
- Edit-like tool calls show raw JSON instead of readable file/diff or patch content.
- Codex subagent child threads appear as ordinary sessions because parent/child relationship backfill is incomplete.

Out of scope:

- New analytics features.
- New sources beyond OpenClaw, Claude Code, and Codex.
- Re-running tools or changing original agent session data.
- Full redesign of replay UI; only targeted display and filtering changes are in scope.

</domain>

<decisions>
## Implementation Decisions

### Starred sessions persistence
- Fix the ingest route collision where `GET /api/v1/sessions/starred` is captured by `GET /api/v1/sessions/:id`.
- Preserve the existing BFF contract `/api/agent-tools/[tool]/sessions/starred` and `/api/agent-tools/[tool]/sessions/[sessionId]/star`.
- Add regression coverage proving `GET /api/v1/sessions/starred` returns `{ session_ids: [...] }` from `session_stars`.

### All-source sessions pagination
- Add incremental pagination for the `all` aggregate right rail.
- Preserve correct indexed totals from per-source API pagination metadata; displayed totals must not equal only the number of loaded rows.
- `hasMore` for aggregate mode is true when any source has another page.
- `loadMore` should request only sources that still have `hasMore`, merge newly loaded sessions, de-duplicate by session id, and sort by freshness.

### Markdown replay search
- Do not clone the top-level `ReactMarkdown` element with non-string children.
- Search highlighting must either happen through `ReactMarkdown` component overrides after Markdown is parsed, or through an AST-safe approach.
- Markdown rendering should remain active in both normal and search modes.

### Edit and patch rendering
- Add an edit-specific formatter/display path for tool calls instead of showing only raw JSON.
- Claude `Edit` inputs with `{ file_path, old_string, new_string }` should render file path and a unified diff-style preview.
- Claude `MultiEdit` should render one diff section per edit.
- Claude `Write` should render file path and created/replaced content preview.
- Codex `apply_patch` custom tool calls should render patch text directly as a patch/diff block.
- Codex `apply_patch`, `patch`, and file edit-like tool names should infer `category: 'Edit'`.

### Codex subagent relationships
- Treat Codex child JSONL files as ordinary thread files until a parent `collab_agent_spawn_end` event links them.
- Collect `new_thread_id -> sender_thread_id` relationships from Codex parent sessions.
- Backfill child sessions with `parent_session_id`, `root_session_id`, and `relationship_type = 'subagent'`.
- Relationship backfill must be idempotent and not depend on parse order; parent may sync before or after child.
- Limited startup sync must not permanently leave known Codex subagents as root sessions after full/background sync.
- Session lists should hide Codex subagents through the existing default child-filtering behavior, matching Claude Code behavior.
- A UI `hide subagents` filter may be added only if it is based on `relationshipType === 'subagent'`; `hide_single_turn` must not be treated as equivalent to hiding subagents.

### Testing and verification
- Tests should cover ingest route ordering, client aggregate pagination state, Markdown search crash prevention, edit formatter output, Codex `apply_patch` category inference, and Codex relationship backfill.
- Manual verification should include the known Codex parent session `019df211-e301-7561-bfa5-9aeba110c584` and at least one child thread from its `collab_agent_spawn_end` events.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug Research
- `.planning/bugs-by-user/2026-05-10-bugs-found-by-user-batch-2.md` — original user-reported batch-2 defects.
- `.planning/bugs-by-user/2026-05-10-bugs-found-by-user-batch-2-research.md` — investigation, root cause analysis, and recommended repair order.

### Ingest and Sync
- `ingest/index.ts` — route mount order for sessions/stars/turns/agents/events.
- `ingest/api/sessions.ts` — session list/detail route order, default child filtering, pagination metadata.
- `ingest/api/stars.ts` — starred session persistence API.
- `ingest/parser/codex.ts` — Codex tool call parsing, `collab_agent_spawn_end`, subagent links, category inference.
- `ingest/sync/index.ts` — source sync, limited startup sync, full sync, relationship collection, session database writes.
- `ingest/db/index.ts` and `ingest/db/schema.sql` — `sessions` relationship columns and `session_stars` table.

### Frontend and Replay
- `stores/starred-store.ts` — client star load/toggle behavior.
- `lib/agent-tools/client-hooks.tsx` — `useToolSessions`, `useAggregateSessions`, BFF fetch helpers.
- `components/sessions/sessions-right-rail.tsx` — source and aggregate right rail wiring, sentinel loading.
- `components/sessions/aggregate-sessions-view.tsx` — all-source aggregate view.
- `components/replay/markdown-content.tsx` — Markdown rendering and search highlighting.
- `components/replay/tool-block.tsx` — tool call rendering.
- `components/replay/turn-card.tsx` and `components/replay/subagent-block.tsx` — activity block placement and subagent replay display.

### Prior Phase
- `.planning/phases/08-real-data-parser-tool-persistence-and-sync-refresh-repair/08-RESEARCH.md` — real-data parser and sync background.
- `.planning/phases/08-real-data-parser-tool-persistence-and-sync-refresh-repair/08-05-PLAN.md` — target-session verification patterns from previous phase.

</canonical_refs>

<specifics>
## Specific Ideas

- Fix B2-01 first because it is a small route-ordering bug with direct user-visible state loss.
- Fix B2-03 early because it is a runtime crash during replay search.
- Aggregate pagination should be implemented with per-source offsets, not by raising the BFF `MAX_LIMIT`.
- Edit formatter should be a pure helper that can be unit-tested without rendering the full replay page.
- Codex relationship backfill should update existing rows and future parsed rows, so users do not need to delete the DB to get corrected subagent filtering.
- Do not use `hide_single_turn` as the primary subagent solution because normal one-turn sessions would be hidden and multi-turn subagents would remain visible.

</specifics>

<deferred>
## Deferred Ideas

- Rich diff syntax highlighting beyond a readable patch/diff block.
- Extracting edits from arbitrary shell commands that write files without `apply_patch`.
- User-configurable default for showing/hiding subagents after relationship backfill is stable.
- Cross-session graph visualization for parent/child subagent relationships.

</deferred>

---

*Phase: 09-batch-2-session-replay-and-codex-subagent-relationship-fixes*  
*Context gathered: 2026-05-10 via batch-2 bug research*
