---
phase: 04-multi-source-frontend-shell-session-explorer
fixed: 2026-05-07T03:01:29+08:00
status: fixed
source_review: 04-REVIEW.md
worktree: /Users/ebbi/Work/ai-dashboard-projects/agents-tracing-dashboard-review-fix
branch: fix/phase04-code-review
findings_fixed:
  critical: 1
  warning: 5
  info: 0
  total: 6
commits:
  - 92156be fix(04): enforce source-scoped BFF sessions
  - f076927 fix(04): enable Claude and Codex source discovery
  - 373dc29 fix(04): surface aggregate source status and lint fixes
verification:
  lint: pass
  typecheck: pass
  typecheck_ingest: pass
  tests_targeted: pass
  tests_full: pass
---

# Phase 04 Code Review Fix Report

## Scope

Fixed all findings from `04-REVIEW.md` in an isolated worktree because the primary branch is moving into Phase 05:

- Worktree: `/Users/ebbi/Work/ai-dashboard-projects/agents-tracing-dashboard-review-fix`
- Branch: `fix/phase04-code-review`
- Base commit: `edff836 docs(04): add code review report`

## Fix Summary

| Finding | Status | Commit | Summary |
| --- | --- | --- | --- |
| CR-01 BFF source isolation can be bypassed with `source` query override | Fixed | `92156be` | Added source-scoped session param construction so caller query params cannot override adapter-owned `source`. |
| WR-01 Detail/messages/turn endpoints do not verify session ownership | Fixed | `92156be` | Added source-scoped session lookup/require helpers and required parent session ownership before detail, messages, and turns reads. |
| WR-02 Ingest discovery/sync API still exposes only OpenClaw | Fixed | `f076927` | Extended source discovery and sync HTTP routes to all supported sources; updated Claude/Codex discovery to recursive JSONL layouts under `~/.claude/projects` and `~/.codex/sessions`. |
| WR-03 ALL aggregation silently hides failed or empty sources | Fixed | `373dc29` | `useAggregateSessions()` now returns per-source status and total counts; the ALL view displays source indexed/error state instead of making partial data look complete. |
| WR-04 Targeted ESLint fails on Phase 04 code | Fixed | `373dc29` | Renamed hook-like capability helper, stabilized query dependencies, hoisted static components, removed unused imports, and replaced `any` display casts. |
| WR-05 Session stats and ALL totals are computed from the loaded page | Fixed | `373dc29` | ALL total now sums source pagination totals; page-local metrics are explicitly labeled as loaded metrics until dedicated aggregate metric endpoints exist. |
| WR-06 Recent-session rows on Claude/Codex dashboards do not open the right rail | Fixed | `373dc29` | Dashboard recent-session tables now use the shared tool store selection handler, matching Session Explorer behavior. |

## Verification

- `pnpm lint app/(tool-shell)/[tool] components/sessions components/shell lib/agent-tools ingest/api/sources.ts ingest/sync/sources.ts ingest/sync/index.ts` - PASS
- `pnpm typecheck` - PASS
- `pnpm typecheck:ingest` - PASS
- `pnpm vitest run lib/agent-tools/server-adapter.test.ts lib/agent-tools/types.test.ts tests/unit/ingest/sources.test.ts tests/unit/ingest/sync.test.ts` - PASS, 4 files / 59 tests
- `pnpm test:run` - PASS, 15 files / 179 tests

## Notes

- The original "ALL only shows OpenClaw" issue is now addressed in two layers:
  - Discovery/sync can reach Claude and Codex local JSONL layouts instead of being OpenClaw-only.
  - `/all/dashboard` exposes per-source indexed/error status, so a missing source is visible instead of silently collapsing to OpenClaw rows.
- In this isolated worktree, `better-sqlite3` needed a one-time native binding rebuild because pnpm ignored package build scripts during install. After rebuilding the binding, ingest tests passed.
- This branch has not been merged back into `main`.
