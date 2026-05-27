---
quick_id: 260527-rhm
slug: complete-backlog-item-docs-backlog-globa
status: complete
completed: 2026-05-27
---

# Summary

Implemented a global session-content search path that can reverse-locate sessions from message bodies without knowing the session ID upfront.

## Changes

- Added ingest `GET /api/v1/sessions/search` with session-level dedupe, FTS5-first lookup, `LIKE` fallback, `source` filtering, optional `includeChildren`, and session snippets.
- Kept `GET /api/v1/sessions/:id/search` as the known-session message-level search path and refactored it to share sanitization/snippet helpers.
- Added Next.js BFF `GET /api/agent-tools/[tool]/sessions/search` with `all` support for cross-source search and source injection for concrete tools.
- Introduced typed session search result contracts in `types/trace.ts`.
- Documented the boundary between metadata list search, global body search, and in-session body search in API / data-flow / ingest docs.
- Marked the backlog item complete.

## Verification

- `pnpm test:run ingest/api/search.test.ts tests/unit/bff/session-search-route.test.ts`
- `pnpm typecheck`
- `pnpm typecheck:ingest`
- `git diff --check`

## Notes

- Broad `pnpm test:run` was not executed in this task.
