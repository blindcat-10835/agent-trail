---
phase: 04-multi-source-frontend-shell-session-explorer
reviewed: 2026-05-07T02:40:00+08:00
status: issues_found
depth: standard
files_reviewed: 51
findings:
  critical: 1
  warning: 5
  info: 0
  total: 6
verification:
  typecheck: pass
  typecheck_ingest: pass
  tests: pass
  targeted_lint: fail
---

# Phase 04 Code Review

## Scope

Reviewed Phase 04 source changes for the multi-source frontend shell, BFF agent-tool routes, shared Session Explorer, synthetic ALL shell, and related tests. Also inspected `ingest/api/sources.ts`, `ingest/sync/sources.ts`, and `ingest/sync/index.ts` as cross-phase integration context for the current `/all/dashboard` missing Claude/Codex sessions issue.

## Verification

- `pnpm typecheck` — PASS
- `pnpm typecheck:ingest` — PASS
- `pnpm test:run` — PASS, 14 files / 173 tests
- Targeted `pnpm lint app/(tool-shell)/[tool] components/sessions components/shell lib/agent-tools ingest/api/sources.ts ingest/sync/sources.ts ingest/sync/index.ts` — FAIL, 9 errors / 14 warnings

## Findings

### CR-01 — BFF source isolation can be bypassed with `source` query override

**Severity:** Critical  
**Files:** `lib/agent-tools/openclaw/server-adapter.ts`, `lib/agent-tools/claude-code/server-adapter.ts`, `lib/agent-tools/codex/server-adapter.ts`

Each adapter injects its source first, then spreads caller-controlled query params afterward:

- `lib/agent-tools/openclaw/server-adapter.ts:38`
- `lib/agent-tools/claude-code/server-adapter.ts:38`
- `lib/agent-tools/codex/server-adapter.ts:38`

Because `...query` comes after `source: ...`, a request like `/api/agent-tools/openclaw/sessions?source=codex` can overwrite the adapter's source filter before the request reaches ingest. That breaks the source-first isolation contract and can return sessions for a different tool under the wrong URL namespace once non-OpenClaw sessions are indexed.

**Recommendation:** Build params from sanitized query first, explicitly remove/ignore `source`, then set the adapter-owned source last. Add regression tests for `openclaw?source=codex`, `claude-code?source=openclaw`, and `codex?source=openclaw`.

### WR-01 — Session detail/message/turn endpoints do not verify session ownership

**Severity:** Warning  
**Files:** `app/api/agent-tools/[tool]/sessions/[sessionId]/route.ts`, `app/api/agent-tools/[tool]/sessions/[sessionId]/messages/route.ts`, `app/api/agent-tools/[tool]/sessions/[sessionId]/turns/route.ts`, `lib/agent-tools/*/server-adapter.ts`

The detail routes validate only the URL `tool` and `sessionId` format, then fetch by session ID alone:

- `app/api/agent-tools/[tool]/sessions/[sessionId]/route.ts:32`
- `lib/agent-tools/openclaw/server-adapter.ts:49`

The messages and turns routes follow the same pattern at:

- `app/api/agent-tools/[tool]/sessions/[sessionId]/messages/route.ts:32`
- `app/api/agent-tools/[tool]/sessions/[sessionId]/turns/route.ts:32`

If a session ID from another source is known, a source-scoped URL can fetch it without checking that the returned session belongs to the requested source. This undermines source-specific navigation and right-rail consistency.

**Recommendation:** After fetching a session by ID, reject it with 404 if `session.source !== adapter.toolId`. For messages/turns, either verify the parent session source first or add ingest endpoints that accept both `source` and `sessionId`.

### WR-02 — Ingest discovery/sync API still exposes only OpenClaw, so ALL cannot index Claude/Codex

**Severity:** Warning  
**Files:** `ingest/api/sources.ts`, `ingest/sync/sources.ts`

The current source API still discovers and syncs only OpenClaw:

- `ingest/api/sources.ts:22` calls only `discoverOpenClawSources()`
- `ingest/api/sources.ts:57` rejects any `:type` other than `openclaw`
- `ingest/api/sources.ts:91` rejects sync for `claude-code` and `codex`

The lower-level `syncSource()` supports all three types, but the HTTP API blocks access to the Claude/Codex branches. On this machine, local JSONL files exist under `~/.claude/projects` and nested `~/.codex/sessions/YYYY/MM/DD`, but the database currently contains only `openclaw` rows.

**Recommendation:** Update source discovery and sync endpoints to cover `openclaw`, `claude-code`, and `codex`. Also update discovery to match real local layouts: Claude sessions under `~/.claude/projects/**/*.jsonl` and Codex sessions recursively under `~/.codex/sessions/**/*.jsonl`, plus any intentionally supported archived/session paths.

### WR-03 — ALL aggregation silently hides failed or empty sources

**Severity:** Warning  
**File:** `lib/agent-tools/client-hooks.tsx`

`useAggregateSessions()` treats each source failure as an empty array:

- `lib/agent-tools/client-hooks.tsx:315`

This makes partial data look successful. It is the reason `/all/dashboard` can display only OpenClaw without showing that Claude/Codex are not discovered, not synced, or returning errors. The top-level `.catch()` almost never runs because per-source failures are already swallowed.

**Recommendation:** Return per-source status alongside merged sessions, e.g. `{ sessions, sources: [{ toolId, status, count, error }] }`. The ALL page should show a compact source health row or warning when any source fails or has not been indexed.

### WR-04 — Targeted ESLint fails on Phase 04 code

**Severity:** Warning  
**Files:** `lib/agent-tools/capability-gate.tsx`, `lib/agent-tools/client-hooks.tsx`, `components/sessions/sessions-filter-bar.tsx`, `components/sessions/sessions-detail-rail.tsx`

Targeted ESLint reports 9 errors and 14 warnings. The most material errors:

- `lib/agent-tools/capability-gate.tsx:69` exports `requiresCapability()` but it calls `useAgentTool()`. React hook rules require this to be named like a hook, e.g. `useRequiresCapability()`, or converted to a pure helper that receives capabilities as input.
- `lib/agent-tools/client-hooks.tsx:217` and `lib/agent-tools/client-hooks.tsx:332` use `JSON.stringify(query)` directly in dependency arrays, which React lint cannot statically validate.
- `components/sessions/sessions-filter-bar.tsx:59` defines `FilterChip` inside render, triggering `react-hooks/static-components`.
- `components/sessions/sessions-detail-rail.tsx:125` uses `any` casts for display fields, and the file has an unused `TraceSession` import.

**Recommendation:** Fix lint errors before treating Phase 04 as code-review clean. Rename hook-like APIs, memoize or normalize query dependencies outside dependency arrays, hoist `FilterChip`, and replace `any` with a local extended session type.

### WR-05 — Session stats and ALL totals are computed from the loaded page, not the full result set

**Severity:** Warning  
**Files:** `components/sessions/sessions-stats-bar.tsx`, `components/sessions/aggregate-sessions-view.tsx`, `app/(tool-shell)/[tool]/dashboard/session-stats-dashboard.tsx`

The UI displays aggregate KPIs from the currently loaded slice:

- `components/sessions/aggregate-sessions-view.tsx:17` loads each source with `limit: 50`
- `components/sessions/sessions-stats-bar.tsx:71` computes active sessions, tokens, and cost only from the passed `sessions`
- `app/(tool-shell)/[tool]/dashboard/session-stats-dashboard.tsx:49` computes active sessions only from the first 50 sessions

`TOTAL SESSIONS` may use `pagination.total`, but active counts, tokens, cost, and model breakdown are page-local. Once there are more than 50 sessions per source, dashboard summaries become misleading.

**Recommendation:** Either label these as "loaded sessions" metrics, or add aggregate endpoints that compute totals per source and across sources in ingest/BFF. For ALL, use source totals from each response and compute global pagination intentionally.

### WR-06 — Recent-session rows on Claude/Codex dashboards do not open the right rail

**Severity:** Warning  
**File:** `app/(tool-shell)/[tool]/dashboard/session-stats-dashboard.tsx`

The recent sessions table passes a no-op selection handler:

- `app/(tool-shell)/[tool]/dashboard/session-stats-dashboard.tsx:132`

Rows still look interactive because `SessionExplorerTable` applies pointer/hover styling and expansion behavior, but clicking them does not set `selectedSessionId` for the shell right rail. This differs from the Session Explorer behavior and makes the same table component behave inconsistently between pages.

**Recommendation:** Wire the dashboard recent-session table to `useToolStore().setSelectedSessionId`, or render a non-interactive compact list instead of `SessionExplorerTable`.

## Notes

The most important functional blockers are CR-01 and WR-02. CR-01 should be fixed before relying on source-specific API route boundaries. WR-02 is the main reason `/all/dashboard` currently shows only OpenClaw despite local Claude/Codex JSONL files being present.
