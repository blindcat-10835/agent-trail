# Phase 09: Batch 2 session replay and Codex subagent relationship fixes - Research

**Researched:** 2026-05-10 [VERIFIED: system date]  
**Domain:** Local ingest routing, aggregate session pagination, replay rendering, tool edit formatting, Codex subagent relationship backfill [VERIFIED: .planning/phases/09-batch-2-session-replay-and-codex-subagent-relationship-fixes/09-CONTEXT.md]  
**Confidence:** HIGH [VERIFIED: codebase inspection, Context7 docs, npm registry, local runtime probes]

<user_constraints>
## User Constraints (from CONTEXT.md)

All bullets in this section are copied from `09-CONTEXT.md` as the locked phase scope and exclusions. [VERIFIED: .planning/phases/09-batch-2-session-replay-and-codex-subagent-relationship-fixes/09-CONTEXT.md]

### Locked Decisions

#### Starred sessions persistence
- Fix the ingest route collision where `GET /api/v1/sessions/starred` is captured by `GET /api/v1/sessions/:id`.
- Preserve the existing BFF contract `/api/agent-tools/[tool]/sessions/starred` and `/api/agent-tools/[tool]/sessions/[sessionId]/star`.
- Add regression coverage proving `GET /api/v1/sessions/starred` returns `{ session_ids: [...] }` from `session_stars`.

#### All-source sessions pagination
- Add incremental pagination for the `all` aggregate right rail.
- Preserve correct indexed totals from per-source API pagination metadata; displayed totals must not equal only the number of loaded rows.
- `hasMore` for aggregate mode is true when any source has another page.
- `loadMore` should request only sources that still have `hasMore`, merge newly loaded sessions, de-duplicate by session id, and sort by freshness.

#### Markdown replay search
- Do not clone the top-level `ReactMarkdown` element with non-string children.
- Search highlighting must either happen through `ReactMarkdown` component overrides after Markdown is parsed, or through an AST-safe approach.
- Markdown rendering should remain active in both normal and search modes.

#### Edit and patch rendering
- Add an edit-specific formatter/display path for tool calls instead of showing only raw JSON.
- Claude `Edit` inputs with `{ file_path, old_string, new_string }` should render file path and a unified diff-style preview.
- Claude `MultiEdit` should render one diff section per edit.
- Claude `Write` should render file path and created/replaced content preview.
- Codex `apply_patch` custom tool calls should render patch text directly as a patch/diff block.
- Codex `apply_patch`, `patch`, and file edit-like tool names should infer `category: 'Edit'`.

#### Codex subagent relationships
- Treat Codex child JSONL files as ordinary thread files until a parent `collab_agent_spawn_end` event links them.
- Collect `new_thread_id -> sender_thread_id` relationships from Codex parent sessions.
- Backfill child sessions with `parent_session_id`, `root_session_id`, and `relationship_type = 'subagent'`.
- Relationship backfill must be idempotent and not depend on parse order; parent may sync before or after child.
- Limited startup sync must not permanently leave known Codex subagents as root sessions after full/background sync.
- Session lists should hide Codex subagents through the existing default child-filtering behavior, matching Claude Code behavior.
- A UI `hide subagents` filter may be added only if it is based on `relationshipType === 'subagent'`; `hide_single_turn` must not be treated as equivalent to hiding subagents.

#### Testing and verification
- Tests should cover ingest route ordering, client aggregate pagination state, Markdown search crash prevention, edit formatter output, Codex `apply_patch` category inference, and Codex relationship backfill.
- Manual verification should include the known Codex parent session `019df211-e301-7561-bfa5-9aeba110c584` and at least one child thread from its `collab_agent_spawn_end` events.

### Claude's Discretion

No `Claude's Discretion` section exists in `09-CONTEXT.md`; the planner should treat the locked decisions and specifics as the phase boundary. [VERIFIED: .planning/phases/09-batch-2-session-replay-and-codex-subagent-relationship-fixes/09-CONTEXT.md]

### Deferred Ideas (OUT OF SCOPE)

- Rich diff syntax highlighting beyond a readable patch/diff block.
- Extracting edits from arbitrary shell commands that write files without `apply_patch`.
- User-configurable default for showing/hiding subagents after relationship backfill is stable.
- Cross-session graph visualization for parent/child subagent relationships.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-04 | ingest supports watcher/resync/skip cache/parse error tracking. [VERIFIED: .planning/REQUIREMENTS.md] | Relationship repair must work after limited startup sync and later background/full sync; current limited Codex sync skips relationship collection. [VERIFIED: ingest/sync/index.ts:823-825] |
| DATA-05 | ingest exposes REST APIs including sessions, turns, children, search, sync/resync. [VERIFIED: .planning/REQUIREMENTS.md] | Starred route must be reachable through ingest and the existing BFF route. [VERIFIED: ingest/api/stars.ts:19-28; app/api/agent-tools/[tool]/sessions/starred/route.ts] |
| SRC-03 | Codex parser supports `session_meta`, `turn_context`, `response_item`, `event_msg`, function calls, spawn/subagent notifications, and token dedupe. [VERIFIED: .planning/REQUIREMENTS.md] | Parser already handles real `custom_tool_call` and `collab_agent_spawn_end`; phase must add edit category inference and better subagent metadata linkage. [VERIFIED: ingest/parser/codex.ts:541-597; ingest/parser/codex.ts:637-645] |
| SRC-04 | Parsers output canonical messages, tool calls, result events, subagent links, and source metadata. [VERIFIED: .planning/REQUIREMENTS.md] | Tool edit formatting should consume existing `TraceToolCall.inputJson`; Codex subagent links should remain canonical `TraceSubagentLink` activities. [VERIFIED: types/trace.ts] |
| TURN-03 | Tool calls pair results by source call ids. [VERIFIED: .planning/REQUIREMENTS.md] | Edit formatter must not disturb tool/result DB persistence or call-id pairing. [VERIFIED: tests/unit/ingest/tool-persistence.test.ts; tests/unit/ingest/turn-activity-regression.test.ts] |
| TURN-04 | Skill uses render as independent blocks. [VERIFIED: .planning/REQUIREMENTS.md] | No direct implementation work is needed for skills, but replay block changes must avoid regressing existing `ActivityBlock` dispatch. [VERIFIED: components/replay/turn-card.tsx:258-270] |
| TURN-05 | Subagent calls support child session ids and lazy expansion. [VERIFIED: .planning/REQUIREMENTS.md] | Codex relationship backfill makes existing `SubagentBlock` lazy loading useful for Codex child sessions. [VERIFIED: components/replay/subagent-block.tsx] |
| REPLAY-01 | Replay page renders turn cards with messages and activity blocks. [VERIFIED: .planning/REQUIREMENTS.md] | Markdown search and edit tool rendering both affect existing turn-card activity/message rendering. [VERIFIED: components/replay/turn-card.tsx] |
| REPLAY-02 | Replay supports long sessions via virtualization or pagination. [VERIFIED: .planning/REQUIREMENTS.md] | Aggregate rail pagination must preserve stable append/dedupe behavior so list growth does not corrupt selection or freshness ordering. [VERIFIED: lib/agent-tools/client-hooks.tsx:488-607] |
| REPLAY-03 | Tool blocks show category/name/input/result/status/error/duration/copy. [VERIFIED: .planning/REQUIREMENTS.md] | Current `ToolBlock` renders raw formatted input only; phase should add edit-specific display while preserving copy content. [VERIFIED: components/replay/tool-block.tsx:24-123] |
| REPLAY-04 | Subagent inline view lazy loads child sessions and caps nesting. [VERIFIED: .planning/REQUIREMENTS.md] | `SubagentBlock` already lazy-loads turns with `MAX_DEPTH = 2`; phase should feed it correct Codex child ids through backfill. [VERIFIED: components/replay/subagent-block.tsx] |
| REPLAY-06 | Replay supports copy message/tool/turn. [VERIFIED: .planning/REQUIREMENTS.md] | Edit formatter should update copy output if rendered preview differs materially from raw input. [VERIFIED: components/replay/tool-block.tsx:24-33] |
</phase_requirements>

## Project Constraints (from CLAUDE.md and AGENTS.md)

- `CLAUDE.md` delegates to `AGENTS.md`. [VERIFIED: CLAUDE.md]  
- Use `pnpm`, not npm or yarn, for project commands. [VERIFIED: AGENTS.md]  
- Project stack is Next.js 16.2.4 App Router, React 19.2.4, TypeScript, Tailwind v4 CSS-first config, shadcn/ui `radix-nova`, Zustand, and ESLint 9 flat config. [VERIFIED: AGENTS.md; package.json]  
- Frontend must access ingest through BFF routes under `app/api/agent-tools/[tool]/...`; client components must not call ingest directly. [VERIFIED: AGENTS.md; lib/agent-tools/client-hooks.tsx]  
- The URL route group is `(tool-shell)` and `[tool]` is the dynamic URL segment; URLs are `/claude-code/dashboard`, not `/(tool-shell)/claude-code/dashboard`. [VERIFIED: AGENTS.md]  
- Visual changes must use semantic tokens such as `bg-background`, `text-foreground`, and `border-border`, and both light/dark themes must remain valid. [VERIFIED: AGENTS.md]  
- Planning docs may be Chinese; code comments, identifiers, and commit messages should be English. [VERIFIED: AGENTS.md]  
- `ERRORS_LEARNED.md` should be checked before writing new components. [VERIFIED: AGENTS.md]

## Summary

Phase 09 is a targeted repair phase over existing Phase 8 data and replay surfaces, not a new architecture phase. [VERIFIED: 09-CONTEXT.md; .planning/ROADMAP.md] The planner should split work by bug surface but preserve the existing two-service boundary: Hono ingest owns data/indexing/backfill, Next.js BFF owns proxy contracts, and React/Zustand UI owns aggregate pagination and rendering state. [VERIFIED: AGENTS.md; ingest/index.ts; lib/agent-tools/client-hooks.tsx]

The highest-risk item is Codex subagent backfill because the child JSONL file does not identify itself as a child, and the current implementation only applies relationships while parsing a child if a pre-collected parent relationship map exists. [VERIFIED: .planning/bugs-by-user/2026-05-10-bugs-found-by-user-batch-2-research.md; ingest/sync/index.ts:823-849] The current limited startup sync deliberately uses an empty relationship map, so startup can index child sessions as roots; the plan must include an idempotent DB backfill step that updates already-inserted child rows after relationship collection. [VERIFIED: ingest/sync/index.ts:823-849; local sqlite probe on data/ingest.db]

The other four fixes are lower risk and mostly localized: route mount ordering for starred sessions, per-source offset state in `useAggregateSessions`, react-markdown-safe highlighting through component overrides, and a pure edit formatter consumed by `ToolBlock`. [VERIFIED: ingest/index.ts:80-84; lib/agent-tools/client-hooks.tsx:488-607; components/replay/markdown-content.tsx:53-61; components/replay/tool-block.tsx:67-123]

**Primary recommendation:** Plan five focused tracks in this order: route collision, Markdown crash, aggregate pagination, edit formatter/category inference, then Codex relationship backfill with idempotent DB update and real-session verification. [VERIFIED: 09-CONTEXT.md; .planning/bugs-by-user/2026-05-10-bugs-found-by-user-batch-2-research.md]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Starred session persistence route | API / Backend | Frontend Server (BFF) | Hono route order determines whether `/api/v1/sessions/starred` reaches `starsRoutes`; BFF contract is already present and should remain unchanged. [CITED: https://hono.dev/docs/api/routing; VERIFIED: ingest/index.ts:80-84; ingest/api/stars.ts:19-28] |
| All-source aggregate pagination | Browser / Client | Frontend Server (BFF) | Aggregate mode merges three source-scoped BFF calls in `useAggregateSessions`; ingest already returns per-source pagination metadata. [VERIFIED: lib/agent-tools/client-hooks.tsx:488-607; ingest/api/sessions.ts:207-218] |
| Markdown search highlighting | Browser / Client | - | The crash is in a client component that passes non-string children into `ReactMarkdown`; react-markdown supports custom render components for post-parse rendering behavior. [VERIFIED: components/replay/markdown-content.tsx:53-61; CITED: https://github.com/remarkjs/react-markdown/blob/main/readme.md] |
| Edit and patch display | Browser / Client | Parser | UI should format already-persisted `TraceToolCall.inputJson`; parser only needs Codex edit-like category inference. [VERIFIED: components/replay/tool-block.tsx:67-123; ingest/parser/codex.ts:933-941] |
| Codex subagent session list filtering | API / Backend | Database / Storage | Session list filtering already excludes rows whose `relationship_type` is not null/root; Codex fix must backfill DB relationship columns. [VERIFIED: ingest/api/sessions.ts:146-149; ingest/db/schema.sql] |
| Codex subagent inline replay | Browser / Client | API / Backend | `SubagentBlock` already lazy-loads child turns by `subagentSessionId`; backend must provide correct child ids and session relationship rows. [VERIFIED: components/replay/subagent-block.tsx; types/trace.ts] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.4 installed; 16.2.6 registry latest modified 2026-05-09. [VERIFIED: package.json; npm registry] | BFF route handlers and App Router pages. [VERIFIED: app/api/agent-tools/[tool]/sessions/route.ts] | Existing project boundary requires BFF proxy instead of direct ingest calls. [VERIFIED: AGENTS.md] |
| React | 19.2.4 installed; 19.2.6 registry latest modified 2026-05-08. [VERIFIED: package.json; npm registry] | Client replay and session rail rendering. [VERIFIED: components/replay/turn-card.tsx; components/sessions/sessions-right-rail.tsx] | Current UI stack already uses React client components and hooks. [VERIFIED: package.json; lib/agent-tools/client-hooks.tsx] |
| Hono | 4.6.16 installed; 4.12.18 registry latest modified 2026-05-06. [VERIFIED: package.json; npm registry] | Ingest REST routing. [VERIFIED: ingest/index.ts] | Hono route registration order is the relevant behavior for the starred route collision. [CITED: https://hono.dev/docs/api/routing] |
| better-sqlite3 | 11.8.1 installed; 12.9.0 registry latest modified 2026-04-12. [VERIFIED: package.json; npm registry] | Local synchronous SQLite writes and backfill updates. [VERIFIED: ingest/db/index.ts; ingest/sync/index.ts] | Existing sync tests use transaction-like in-memory DB patterns and should be extended. [VERIFIED: tests/unit/ingest/tool-persistence.test.ts] |
| Zustand | 5.0.12 installed; 5.0.13 registry latest modified 2026-05-05. [VERIFIED: package.json; npm registry] | Frontend store state for stars and replay. [VERIFIED: stores/starred-store.ts; stores/replay-store.ts] | Existing project state management uses Zustand stores. [VERIFIED: AGENTS.md] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-markdown | 10.1.0 installed; 10.1.0 registry latest modified 2025-03-07. [VERIFIED: package.json; npm registry] | Markdown rendering in replay message blocks. [VERIFIED: components/replay/markdown-content.tsx] | Use `components` overrides for search highlighting after Markdown parsing instead of cloning the top-level `ReactMarkdown`. [CITED: https://github.com/remarkjs/react-markdown/blob/main/readme.md] |
| remark-gfm | 4.0.1 installed; 4.0.1 registry latest modified 2025-02-10. [VERIFIED: package.json; npm registry] | GitHub-flavored Markdown support. [VERIFIED: components/replay/markdown-content.tsx] | Keep existing `remarkPlugins={[remarkGfm]}` in normal and search modes. [VERIFIED: 09-CONTEXT.md] |
| Vitest | 4.1.5 installed; 4.1.5 registry latest modified 2026-05-05. [VERIFIED: package.json; npm registry] | Unit and integration regression tests. [VERIFIED: vitest.config.ts; tests] | Use node environment by default and file-level `@vitest-environment jsdom` for hook/component tests. [VERIFIED: vitest.config.ts; tests/hooks/client-hooks.test.tsx; CITED: https://github.com/vitest-dev/vitest/blob/v4.0.7/docs/guide/environment.md] |
| @testing-library/react | 16.3.2 installed; 16.3.2 registry latest modified 2026-01-19. [VERIFIED: package.json; npm registry] | React hook/component tests. [VERIFIED: tests/hooks/client-hooks.test.tsx] | Use for `useAggregateSessions`, `MarkdownContent`, and `ToolBlock` regression tests. [VERIFIED: tests/hooks/client-hooks.test.tsx] |
| jsdom | 29.1.1 installed; 29.1.1 registry latest modified 2026-04-30. [VERIFIED: package.json; npm registry] | DOM APIs in focused UI tests. [VERIFIED: package.json; tests/hooks/client-hooks.test.tsx] | Use file-level jsdom comments, matching existing test style. [VERIFIED: tests/hooks/client-hooks.test.tsx] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ReactMarkdown components` override | remark/rehype AST plugin | AST plugin is valid but larger than needed for a targeted crash fix; `components` is already documented by react-markdown. [CITED: https://github.com/remarkjs/react-markdown/blob/main/readme.md] |
| Per-source aggregate offsets | Raising BFF `MAX_LIMIT` above 100 | Raising the cap violates the existing server-adapter limit and still does not provide true pagination. [VERIFIED: lib/agent-tools/server-adapter.ts] |
| DB relationship backfill | UI-only `hide_single_turn` filter | UI-only filtering does not repair session relationship columns and would not match the locked decision. [VERIFIED: 09-CONTEXT.md] |

**Installation:**

No new runtime dependency is required for the phase. [VERIFIED: package.json; codebase inspection] If a diff helper is introduced, implement it as a small pure project helper instead of adding a library. [VERIFIED: 09-CONTEXT.md]

```bash
pnpm test:run
pnpm typecheck
pnpm lint
```

**Version verification:** Package versions above were checked with `npm view <package> version time.modified` on 2026-05-10. [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```text
User action / background sync
  -> Next.js BFF routes
       -> source-scoped session list/star/sync requests
       -> preserves /api/agent-tools/[tool]/... contract
  -> Hono ingest API
       -> static routes registered before dynamic /sessions/:id
       -> list sessions filters relationship_type IS NULL OR root by default
  -> SQLite
       -> session_stars stores persisted star ids
       -> sessions stores parent/root/relationship_type
  -> React hooks
       -> useToolSessions handles single-source offset pagination
       -> useAggregateSessions maintains per-source pagination state
  -> Replay components
       -> MarkdownContent renders markdown and highlights text after parse
       -> ToolBlock renders raw JSON or edit/diff preview
       -> SubagentBlock lazy-loads child turns by subagentSessionId
```

The flow above maps existing source code boundaries and should be preserved during planning. [VERIFIED: ingest/index.ts; ingest/api/sessions.ts; lib/agent-tools/client-hooks.tsx; components/replay]

### Recommended Project Structure

```text
ingest/
  api/
    stars.ts              # keep starred API here or mount before sessions wildcard [VERIFIED: ingest/api/stars.ts]
    sessions.ts           # default child filtering and pagination metadata [VERIFIED: ingest/api/sessions.ts]
  parser/
    codex.ts              # Codex category inference and subagent link metadata [VERIFIED: ingest/parser/codex.ts]
  sync/
    index.ts              # relationship collection plus idempotent DB backfill [VERIFIED: ingest/sync/index.ts]
components/
  replay/
    markdown-content.tsx  # react-markdown component override highlighting [VERIFIED: components/replay/markdown-content.tsx]
    tool-block.tsx        # edit formatter rendering path [VERIFIED: components/replay/tool-block.tsx]
    tool-formatters.ts    # recommended pure helper for unit-tested display formatting [VERIFIED: codebase inspection; 09-CONTEXT.md]
lib/
  agent-tools/
    client-hooks.tsx      # aggregate per-source pagination state [VERIFIED: lib/agent-tools/client-hooks.tsx]
tests/
  unit/ingest/            # route, sync, parser, DB regression tests [VERIFIED: tests/unit/ingest]
  hooks/                  # jsdom hook tests [VERIFIED: tests/hooks/client-hooks.test.tsx]
  unit/bff/ or components # focused UI helper/rendering tests [VERIFIED: existing test layout]
```

### Pattern 1: Static Hono Routes Before Dynamic Routes

**What:** Register `starsRoutes` before `sessionsRoutes`, or put `/api/v1/sessions/starred` in `sessionsRoutes` before `/api/v1/sessions/:id`. [CITED: https://hono.dev/docs/api/routing; VERIFIED: ingest/index.ts:80-84; ingest/api/sessions.ts:228-230]  
**When to use:** Use for `starred`, `lookup`, and any future static routes under `/api/v1/sessions/*`. [VERIFIED: ingest/api/sessions.ts:1-230]  
**Example:**

```ts
// Source: Hono routing priority docs and current route mount bug.
app.route('/', sourcesRoutes)
app.route('/', starsRoutes)
app.route('/', sessionsRoutes)
```

### Pattern 2: Aggregate Pagination as Per-Source Cursors

**What:** Store per-source pagination state in `useAggregateSessions`, not one global offset. [VERIFIED: current aggregate hook lacks offsets in lib/agent-tools/client-hooks.tsx:488-607]  
**When to use:** Use whenever `toolId === 'all'` and sessions are fetched from OpenClaw, Claude Code, and Codex independently. [VERIFIED: components/sessions/sessions-right-rail.tsx:31-69]  
**Example:**

```ts
type AggregatePageState = Record<SourceToolId, {
  offset: number
  limit: number
  total: number
  hasMore: boolean
  status: 'loaded' | 'error'
}>

// loadMore fetches only sources whose state.hasMore is true,
// then merges by session.id and sorts by updatedAt/endedAt/startedAt.
```

This pattern keeps displayed totals derived from per-source API `pagination.total`, not from loaded row count. [VERIFIED: ingest/api/sessions.ts:207-218; 09-CONTEXT.md]

### Pattern 3: ReactMarkdown Highlighting Through Render Overrides

**What:** Keep top-level `ReactMarkdown` children as the original `content` string and highlight text inside component overrides. [CITED: https://github.com/remarkjs/react-markdown/blob/main/readme.md; VERIFIED: components/replay/markdown-content.tsx:53-61]  
**When to use:** Use when `searchQuery` is present and Markdown rendering must remain active. [VERIFIED: 09-CONTEXT.md]  
**Example:**

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    p({ children, ...props }) {
      return <p {...props}>{highlightChildren(children, searchQuery)}</p>
    },
  }}
>
  {content}
</ReactMarkdown>
```

### Pattern 4: Pure Edit Formatter Before Rendering

**What:** Add a pure helper that turns `TraceToolCall` into a display model such as `{ kind: 'edit-diff', filePath, sections }`. [VERIFIED: components/replay/tool-block.tsx currently formats only raw JSON at lines 70-85]  
**When to use:** Use for Claude `Edit`, `MultiEdit`, `Write`, and Codex `apply_patch`/`patch`/edit-like tools. [VERIFIED: 09-CONTEXT.md]  
**Example:**

```ts
type ToolDisplay =
  | { kind: 'raw'; title: 'INPUT'; body: string }
  | { kind: 'diff'; filePath: string; body: string }
  | { kind: 'patch'; body: string }

export function formatToolDisplay(tool: TraceToolCall): ToolDisplay {
  // parse JSON only for known Claude edit tools;
  // return patch text directly for Codex apply_patch.
}
```

### Pattern 5: Idempotent Relationship Backfill

**What:** Collect Codex `new_thread_id -> sender_thread_id` relationships independently of child parse order, then update existing DB rows by child id. [VERIFIED: ingest/sync/index.ts:879-918; 09-CONTEXT.md]  
**When to use:** Run after Codex relationship collection during full sync and after any limited sync that collects parent relationships. [VERIFIED: ingest/sync/index.ts:823-849]  
**Example:**

```sql
UPDATE sessions
SET parent_session_id = ?,
    root_session_id = ?,
    relationship_type = 'subagent'
WHERE source = 'codex'
  AND id = ?;
```

The unconditional update is idempotent because setting the same relationship columns to the same values again does not create duplicate rows or change source files. [VERIFIED: ingest/db/schema.sql; 09-CONTEXT.md]

### Anti-Patterns to Avoid

- **Mounting static session routes after `/sessions/:id`:** Hono executes handlers in registration order, so static routes must precede general dynamic routes. [CITED: https://hono.dev/docs/api/routing]  
- **Aggregate mode with `hasMore=false`:** Current aggregate right rail hard-codes no pagination, which is the reported user-facing cap. [VERIFIED: components/sessions/sessions-right-rail.tsx:82-83]  
- **Cloning top-level `ReactMarkdown`:** Current implementation can pass React nodes instead of a string as children and trigger the reported assertion. [VERIFIED: components/replay/markdown-content.tsx:53-61; .planning/bugs-by-user/2026-05-10-bugs-found-by-user-batch-2.md]  
- **Using `hide_single_turn` as subagent filtering:** Locked scope says subagent hiding must use `relationshipType === 'subagent'`. [VERIFIED: 09-CONTEXT.md]  
- **Parser-only relationship fix:** Updating `parseResult.session` during child parse is insufficient for already-indexed child sessions. [VERIFIED: ingest/sync/index.ts:842-849; local sqlite probe on target child]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP route matching | Custom dispatcher or route string parser | Hono registration order and explicit route mount order | Hono already defines routing priority by registration order. [CITED: https://hono.dev/docs/api/routing] |
| Markdown parsing | Regex Markdown parsing or string-to-HTML | `react-markdown` with `remark-gfm` and `components` overrides | Existing renderer already handles Markdown; only highlighting should change. [VERIFIED: components/replay/markdown-content.tsx; CITED: https://github.com/remarkjs/react-markdown/blob/main/readme.md] |
| Aggregate pagination transport | New aggregate ingest endpoint | Existing per-source BFF `/sessions` calls with per-source state | Locked scope asks for aggregate right rail pagination while preserving per-source API metadata. [VERIFIED: 09-CONTEXT.md; lib/agent-tools/client-hooks.tsx] |
| Edit diff display | Full diff library or syntax highlighter | Small pure formatter for known tool payloads | Deferred scope excludes rich diff syntax highlighting. [VERIFIED: 09-CONTEXT.md] |
| Relationship graph storage | New graph table | Existing `sessions.parent_session_id`, `root_session_id`, `relationship_type` columns | Schema already has relationship columns and list API already filters children. [VERIFIED: ingest/db/schema.sql; ingest/api/sessions.ts:146-149] |

**Key insight:** The phase should repair existing contracts instead of adding parallel mechanisms: starred state already has a DB table, sessions already have relationship columns, and replay already dispatches activity blocks by canonical type. [VERIFIED: ingest/api/stars.ts; ingest/db/schema.sql; components/replay/turn-card.tsx]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `data/ingest.db` currently has Codex sessions with `relationship_type` null/root and only 3 Codex rows marked `subagent`; the target parent and one verified child both currently have empty relationship columns. [VERIFIED: sqlite3 data/ingest.db probe on 2026-05-10] | Add an idempotent SQLite backfill that updates existing Codex child rows after collecting `collab_agent_spawn_end` relationships. [VERIFIED: 09-CONTEXT.md] |
| Live service config | No external service config is required; ingest config is local env/default config and source directory config. [VERIFIED: ingest/config/index.ts; ingest/config/tool-dirs.ts] | None for external services; plan should only account for local ingest restart/full sync behavior. [VERIFIED: AGENTS.md; ingest/index.ts] |
| OS-registered state | No launchd/systemd/pm2/task registration was found in the requested code scope. [VERIFIED: codebase inspection with rg/find] | None. [VERIFIED: codebase inspection] |
| Secrets/env vars | `INGEST_DB_PATH`, `INGEST_STARTUP_SYNC_LIMIT`, source directory env vars, and `AGENTS_TRACING_CONFIG` can affect local verification but no secret key rename is needed. [VERIFIED: ingest/config/index.ts; AGENTS.md] | Document verification commands with explicit DB/source assumptions; do not rename env vars. [VERIFIED: AGENTS.md] |
| Build artifacts | No build artifact rename is involved; node_modules exists and tests run against source TS. [VERIFIED: package.json; repository listing] | None beyond normal `pnpm test:run`, `pnpm typecheck`, and `pnpm lint`. [VERIFIED: package.json] |

**Canonical runtime question:** After all files are changed, Codex children already stored as root/null rows in `data/ingest.db` still need a relationship backfill. [VERIFIED: sqlite3 data/ingest.db probe; 09-CONTEXT.md]

## Common Pitfalls

### Pitfall 1: Fixing Star POST But Not Star GET

**What goes wrong:** Star toggles appear to work but refresh loses state because `GET /api/v1/sessions/starred` is still captured by `/api/v1/sessions/:id`. [VERIFIED: .planning/bugs-by-user/2026-05-10-bugs-found-by-user-batch-2-research.md]  
**Why it happens:** `starsRoutes` is mounted after `sessionsRoutes` while `sessionsRoutes` owns a dynamic `/:id` route. [VERIFIED: ingest/index.ts:80-84; ingest/api/sessions.ts:228-230]  
**How to avoid:** Test the composed Hono app or mount order, not just `starsRoutes.request()` in isolation. [CITED: https://hono.dev/docs/api/routing]  
**Warning signs:** Response body includes `"Session not found"` with `"sessionId":"starred"`. [VERIFIED: .planning/bugs-by-user/2026-05-10-bugs-found-by-user-batch-2-research.md]

### Pitfall 2: Treating Aggregate Pagination As One Offset

**What goes wrong:** A global offset skips or duplicates sessions because each source has its own sorted list and total. [VERIFIED: lib/agent-tools/client-hooks.tsx:488-607]  
**Why it happens:** `useAggregateSessions` currently only fetches one page per source and merges the results. [VERIFIED: lib/agent-tools/client-hooks.tsx:500-544]  
**How to avoid:** Track `offset`, `limit`, `total`, and `hasMore` per source; request only sources with `hasMore`. [VERIFIED: 09-CONTEXT.md]  
**Warning signs:** Aggregate `totalCount` is correct but scrolling never fetches older sessions. [VERIFIED: 09-CONTEXT.md]

### Pitfall 3: Breaking Markdown While Highlighting Search Terms

**What goes wrong:** `ReactMarkdown` receives a React node/fragment as `children` and throws an assertion. [VERIFIED: .planning/bugs-by-user/2026-05-10-bugs-found-by-user-batch-2.md]  
**Why it happens:** Current `highlightNodes()` clones the top-level `ReactMarkdown` element. [VERIFIED: components/replay/markdown-content.tsx:53-61]  
**How to avoid:** Use `components` overrides or AST-safe plugins while keeping the top-level Markdown input as a string. [CITED: https://github.com/remarkjs/react-markdown/blob/main/readme.md]  
**Warning signs:** Search mode renders differently from normal Markdown mode or tables/lists lose Markdown formatting. [VERIFIED: 09-CONTEXT.md]

### Pitfall 4: Pretty JSON Instead Of Edit Semantics

**What goes wrong:** Claude edit tools still show only raw JSON even though the payload has `file_path`, `old_string`, and `new_string`. [VERIFIED: .planning/bugs-by-user/2026-05-10-bugs-found-by-user-batch-2-research.md]  
**Why it happens:** `ToolBlock` only calls `formatJson(tool.inputJson)`. [VERIFIED: components/replay/tool-block.tsx:70-85]  
**How to avoid:** Put tool-specific parsing in a pure formatter and render a diff/patch branch. [VERIFIED: 09-CONTEXT.md]  
**Warning signs:** `Edit`, `MultiEdit`, `Write`, or `apply_patch` blocks show escaped JSON strings instead of file/path and patch content. [VERIFIED: 09-CONTEXT.md]

### Pitfall 5: Relationship Backfill Depends On Parse Order

**What goes wrong:** A child session parsed before its parent relationship remains visible as a root session. [VERIFIED: 09-CONTEXT.md; ingest/sync/index.ts:823-849]  
**Why it happens:** Current Codex sync only sets child relationship fields on the in-memory parse result when `relationshipsByChild` already contains the child id. [VERIFIED: ingest/sync/index.ts:842-849]  
**How to avoid:** After collecting relationships, update DB rows for child ids regardless of whether the child was parsed in this sync pass. [VERIFIED: 09-CONTEXT.md]  
**Warning signs:** `SELECT id,parent_session_id,relationship_type FROM sessions WHERE id = child_id` shows null values after full sync. [VERIFIED: local sqlite probe]

## Code Examples

### Hono Mount Order Regression

```ts
// Source: Hono route priority docs and current ingest/index.ts route mounting.
app.route('/', sourcesRoutes)
app.route('/', starsRoutes)
app.route('/', sessionsRoutes)

const res = await app.request('/api/v1/sessions/starred')
expect(res.status).toBe(200)
expect(await res.json()).toEqual({ session_ids: ['session-a'] })
```

Claim: Hono executes handlers in registration order, so this regression must test the composed app or equivalent mount order. [CITED: https://hono.dev/docs/api/routing]

### Aggregate Hook Pagination Shape

```ts
type AggregateSessionsResult = {
  sessions: TraceSession[]
  totalCount: number
  groupCounts: GroupCounts | null
  sources: AggregateSourceStatus[]
  paginationBySource: Record<SourceToolId, {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }>
  hasMore: boolean
  isLoadingMore: boolean
  loadMore: () => Promise<void>
}
```

Claim: The current aggregate hook returns no `hasMore`, `isLoadingMore`, or `loadMore`, so `AggregateSessionsRightRail` cannot use the existing sentinel path. [VERIFIED: lib/agent-tools/client-hooks.tsx:604; components/sessions/sessions-right-rail.tsx:82-83]

### Markdown Component Override Highlighting

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    p({ children, ...props }) {
      return <p {...props}>{highlightChildren(children, searchQuery)}</p>
    },
    li({ children, ...props }) {
      return <li {...props}>{highlightChildren(children, searchQuery)}</li>
    },
    code({ children, ...props }) {
      return <code {...props}>{children}</code>
    },
  }}
>
  {content}
</ReactMarkdown>
```

Claim: `components` overrides are the documented customization mechanism for react-markdown rendered elements. [CITED: https://github.com/remarkjs/react-markdown/blob/main/readme.md]

### Codex Relationship Backfill

```ts
function backfillCodexRelationships(
  db: Database.Database,
  relationships: Map<string, { parentSessionId: string; rootSessionId?: string }>,
) {
  const update = db.prepare(`
    UPDATE sessions
    SET parent_session_id = ?,
        root_session_id = ?,
        relationship_type = 'subagent'
    WHERE source = 'codex'
      AND id = ?
  `)

  const tx = db.transaction(() => {
    for (const [childId, relationship] of relationships) {
      const rootId = relationship.rootSessionId || relationship.parentSessionId
      update.run(relationship.parentSessionId, rootId, childId)
    }
  })

  tx()
}
```

Claim: The project already uses `better-sqlite3` synchronous database operations and transaction-oriented tests for derived row replacement. [VERIFIED: ingest/sync/index.ts; tests/unit/ingest/tool-persistence.test.ts]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hono route files mounted without considering static-vs-dynamic collision. [VERIFIED: ingest/index.ts:80-84] | Register specific routes before dynamic routes. [CITED: https://hono.dev/docs/api/routing] | Current docs checked 2026-05-10. [VERIFIED: Context7] | Fix route order before adding more `/sessions/*` static routes. [VERIFIED: bug research] |
| Search highlighting clones a rendered React element tree. [VERIFIED: components/replay/markdown-content.tsx:53-61] | Keep Markdown input string and customize rendered elements via `components`. [CITED: https://github.com/remarkjs/react-markdown/blob/main/readme.md] | Current docs checked 2026-05-10. [VERIFIED: Context7] | Prevents non-string children assertions while preserving Markdown. [VERIFIED: bug report] |
| Codex startup limited sync skips relationship collection. [VERIFIED: ingest/sync/index.ts:823-825] | Relationship backfill should be independent of child parse timing. [VERIFIED: 09-CONTEXT.md] | Phase 09 planning. [VERIFIED: .planning/ROADMAP.md] | Prevents known child sessions from remaining roots after background sync. [VERIFIED: 09-CONTEXT.md] |

**Deprecated/outdated:**
- `hide_single_turn` as a subagent solution is out of scope and contradicts the locked decision. [VERIFIED: 09-CONTEXT.md]
- Raising aggregate fetch limit is not a pagination fix because BFF caps source session list limits at 100. [VERIFIED: lib/agent-tools/server-adapter.ts]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Research validity through 2026-06-09 is an estimate. [ASSUMED] | Metadata | Low; planner can re-run version/documentation checks before dependency upgrades. |

## Open Questions (RESOLVED)

1. **[RESOLVED] Should Codex relationship backfill run after limited sync, full sync, or both?** [VERIFIED: ingest/sync/index.ts:823-849]  
   - What we know: Limited sync currently skips `collectCodexRelationships`, while full sync currently collects relationships before parsing candidates. [VERIFIED: ingest/sync/index.ts:823-849]  
   - What's unclear: Whether bounded startup should scan all Codex parent files for relationships or defer DB repair until the background full sync finishes. [VERIFIED: ingest/index.ts startup/background sync flow]  
   - Resolution: Phase 09 plans require full/background sync to run an idempotent DB backfill after relationship collection so already-indexed children are repaired; limited startup sync may collect relationships from its bounded candidate set for faster correctness, but it must not be treated as the only repair path. [VERIFIED: 09-CONTEXT.md; 09-05-PLAN.md]

2. **[RESOLVED] Should subagent link metadata include nickname/status in canonical types now?** [VERIFIED: bug research]  
   - What we know: Real `collab_agent_spawn_end` events include `call_id`, `sender_thread_id`, `new_thread_id`, nickname, and status fields. [VERIFIED: local Codex session probe on 019df211-e301-7561-bfa5-9aeba110c584]  
   - What's unclear: The locked success criteria only requires session relationship backfill and default list hiding. [VERIFIED: 09-CONTEXT.md]  
   - Resolution: Do not expand the database schema or canonical relationship model for nickname/status in this phase. Parser work may use existing `TraceSubagentLink` fields such as `subagentSessionId` and `messageOrdinal` to anchor replay blocks, while nickname/status stays out of Phase 09 unless already supported by existing types. [VERIFIED: types/trace.ts; 09-CONTEXT.md; 09-04-PLAN.md]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | `pnpm` scripts and Vitest. [VERIFIED: package.json] | yes [VERIFIED: command probe] | v24.14.0 [VERIFIED: `node --version`] | None needed. |
| pnpm | Project commands. [VERIFIED: AGENTS.md] | yes [VERIFIED: command probe] | 10.33.0 [VERIFIED: `pnpm --version`] | No fallback; project forbids npm/yarn. [VERIFIED: AGENTS.md] |
| sqlite3 CLI | Manual DB verification. [VERIFIED: research probe] | yes [VERIFIED: command probe] | Available at `/opt/miniconda3/bin/sqlite3`. [VERIFIED: command probe] | Use `better-sqlite3` node script if CLI unavailable. [VERIFIED: package.json] |
| Context7 | Library documentation lookup. [VERIFIED: tool availability] | yes [VERIFIED: Context7 calls] | Hono/react-markdown/Vitest docs fetched 2026-05-10. [VERIFIED: Context7] | Official docs via web if Context7 unavailable. [VERIFIED: GSD instructions] |
| Local Codex target session | Manual subagent verification. [VERIFIED: 09-CONTEXT.md] | yes [VERIFIED: file probe] | Parent file found at `~/.codex/sessions/2026/05/04/rollout-2026-05-04T16-19-11-019df211-e301-7561-bfa5-9aeba110c584.jsonl`. [VERIFIED: command probe] | Use redacted fixture if local file missing in another environment. [VERIFIED: tests/fixtures/real-shape] |
| Ingest SQLite DB | Runtime backfill verification. [VERIFIED: ingest/config/index.ts] | yes [VERIFIED: sqlite probe] | `data/ingest.db` exists and is queryable. [VERIFIED: sqlite probe] | Create temp DB in tests. [VERIFIED: tests/unit/ingest/tool-persistence.test.ts] |

**Missing dependencies with no fallback:** None found for planning. [VERIFIED: environment probes]  
**Missing dependencies with fallback:** None found for planning. [VERIFIED: environment probes]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5. [VERIFIED: package.json; npm registry] |
| Config file | `vitest.config.ts`, default `environment: 'node'`. [VERIFIED: vitest.config.ts] |
| Quick run command | `pnpm test:run tests/unit/ingest/sessions-api.test.ts tests/hooks/client-hooks.test.tsx` [VERIFIED: package.json; existing test paths] |
| Full suite command | `pnpm test:run` [VERIFIED: package.json] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DATA-05 | `GET /api/v1/sessions/starred` reaches `session_stars` instead of `/sessions/:id`. [VERIFIED: 09-CONTEXT.md] | ingest unit | `pnpm test:run tests/unit/ingest/stars-route-order.test.ts` | No, Wave 0 gap. |
| REPLAY-02 | Aggregate hook appends per-source pages, dedupes ids, preserves total from source totals. [VERIFIED: 09-CONTEXT.md] | jsdom hook unit | `pnpm test:run tests/hooks/client-hooks.test.tsx` | Partial; extend existing file. [VERIFIED: tests/hooks/client-hooks.test.tsx] |
| REPLAY-01 | Markdown search does not crash and keeps Markdown active. [VERIFIED: 09-CONTEXT.md] | jsdom component unit | `pnpm test:run tests/unit/bff/markdown-content.test.tsx` | No, Wave 0 gap. |
| REPLAY-03 | Claude edit/write/multiedit and Codex patch tools render formatted file/diff/patch content. [VERIFIED: 09-CONTEXT.md] | pure helper + component unit | `pnpm test:run tests/unit/bff/tool-formatters.test.ts` | No, Wave 0 gap. |
| SRC-03 | Codex `apply_patch` and patch-like tools infer `Edit`. [VERIFIED: 09-CONTEXT.md] | parser unit | `pnpm test:run tests/unit/ingest/codex-parser.test.ts` | Exists; extend. [VERIFIED: tests/unit/ingest/codex-parser.test.ts] |
| TURN-05 | Codex child rows are backfilled as subagents regardless of parse order. [VERIFIED: 09-CONTEXT.md] | sync/DB unit | `pnpm test:run tests/unit/ingest/codex-relationships.test.ts` | No, Wave 0 gap. |
| DATA-04 | Limited startup sync does not permanently leave known Codex children as roots after background/full sync. [VERIFIED: 09-CONTEXT.md] | sync unit/integration | `pnpm test:run tests/unit/ingest/codex-relationships.test.ts` | No, Wave 0 gap. |

### Sampling Rate

- **Per task commit:** Run the focused test for the touched subsystem plus `pnpm typecheck` when TypeScript signatures change. [VERIFIED: package.json]  
- **Per wave merge:** Run `pnpm test:run` and `pnpm typecheck`. [VERIFIED: package.json]  
- **Phase gate:** Run `pnpm test:run`, `pnpm typecheck`, `pnpm lint`, and manual target-session verification for parent `019df211-e301-7561-bfa5-9aeba110c584`. [VERIFIED: package.json; 09-CONTEXT.md]

### Wave 0 Gaps

- [ ] `tests/unit/ingest/stars-route-order.test.ts` - composed Hono route-order regression for B2-01. [VERIFIED: missing file via tests listing]  
- [ ] `tests/unit/bff/markdown-content.test.tsx` - jsdom render test for Markdown search highlighting. [VERIFIED: missing file via tests listing]  
- [ ] `components/replay/tool-formatters.ts` and `tests/unit/bff/tool-formatters.test.ts` - pure formatter for edit/diff display. [VERIFIED: missing file via code listing]  
- [ ] `tests/unit/ingest/codex-relationships.test.ts` - idempotent backfill and parse-order tests. [VERIFIED: missing file via tests listing]  
- [ ] Extend `tests/hooks/client-hooks.test.tsx` for aggregate pagination `hasMore` and `loadMore`. [VERIFIED: existing file lacks aggregate pagination tests]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Local single-user dashboard has no auth in v1 scope. [VERIFIED: .planning/REQUIREMENTS.md Out of Scope] |
| V3 Session Management | no | No browser auth session management is in scope. [VERIFIED: .planning/REQUIREMENTS.md Out of Scope] |
| V4 Access Control | yes | Keep BFF source scoping and session id validation before proxying. [VERIFIED: lib/agent-tools/server-adapter.ts] |
| V5 Input Validation | yes | Continue validating session ids, source ids, sort/order/groupBy, limit/offset. [VERIFIED: lib/agent-tools/server-adapter.ts; ingest/api/sessions.ts:89-123] |
| V6 Cryptography | no | No cryptographic operation is introduced by this phase. [VERIFIED: 09-CONTEXT.md] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Route confusion between static and dynamic session paths | Tampering | Register static routes before dynamic routes and add regression tests. [CITED: https://hono.dev/docs/api/routing] |
| Arbitrary source/session access through BFF params | Elevation of Privilege | Keep `assertSourceToolId`, `assertAgentToolId`, and `validateSessionId` boundaries. [VERIFIED: app/api/agent-tools/[tool]/sessions/route.ts; lib/agent-tools/server-adapter.ts] |
| Local path exposure in edit display | Information Disclosure | Render paths already present in local trace data, but do not add new file reads or arbitrary path fetches. [VERIFIED: 09-CONTEXT.md; .planning/REQUIREMENTS.md HARD-03] |
| Markdown/HTML injection in replay | Tampering | Keep `react-markdown` renderer instead of manual HTML injection; do not use `dangerouslySetInnerHTML` for highlighting. [VERIFIED: components/replay/markdown-content.tsx; CITED: https://github.com/remarkjs/react-markdown/blob/main/readme.md] |
| Unbounded aggregate fetch | Denial of Service | Keep per-source page sizes and use incremental loading; do not raise BFF `MAX_LIMIT` as the fix. [VERIFIED: lib/agent-tools/server-adapter.ts; 09-CONTEXT.md] |

## Sources

### Primary (HIGH confidence)

- `09-CONTEXT.md` - locked decisions, scope, deferred ideas, manual target session. [VERIFIED: .planning/phases/09-batch-2-session-replay-and-codex-subagent-relationship-fixes/09-CONTEXT.md]  
- Batch 2 bug report and bug research - reproduced symptoms and root causes. [VERIFIED: .planning/bugs-by-user/2026-05-10-bugs-found-by-user-batch-2.md; .planning/bugs-by-user/2026-05-10-bugs-found-by-user-batch-2-research.md]  
- Codebase files listed by user: ingest routes/parser/sync/db, hooks, stores, sessions rail, replay blocks. [VERIFIED: codebase inspection]  
- Context7 Hono docs - route priority and `app.route()` behavior. [CITED: https://hono.dev/docs/api/routing]  
- Context7 react-markdown docs - `components` override pattern. [CITED: https://github.com/remarkjs/react-markdown/blob/main/readme.md]  
- Context7 Vitest docs - jsdom file-level environment pattern. [CITED: https://github.com/vitest-dev/vitest/blob/v4.0.7/docs/guide/environment.md]  
- npm registry version checks on 2026-05-10. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)

- Local runtime probes: Node/pnpm/sqlite3 availability, target Codex parent/child files, and current `data/ingest.db` relationship rows. [VERIFIED: command probes on 2026-05-10]  
- Prior Phase 08 research for parser/sync architecture and force reparse context. [VERIFIED: .planning/phases/08-real-data-parser-tool-persistence-and-sync-refresh-repair/08-RESEARCH.md]

### Tertiary (LOW confidence)

- No web-search-only sources were used. [VERIFIED: research process]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - package versions verified from `package.json` and npm registry, and no new dependency is required. [VERIFIED: package.json; npm registry]  
- Architecture: HIGH - existing code paths directly show the route order, hook state, parser category inference, and sync relationship gap. [VERIFIED: codebase inspection]  
- Pitfalls: HIGH - each pitfall maps to a reported bug plus code evidence. [VERIFIED: bug report; bug research; codebase inspection]  
- Codex target-session runtime state: HIGH for this machine - parent file, child file, 14 spawn-end events, and current DB relationship gaps were probed locally. [VERIFIED: command probes]  

**Research date:** 2026-05-10 [VERIFIED: system date]  
**Valid until:** 2026-06-09 for architecture and codebase findings; re-check npm/doc versions before dependency upgrades. [ASSUMED]
