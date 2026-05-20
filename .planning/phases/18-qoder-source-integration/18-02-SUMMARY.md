---
phase: 18-qoder-source-integration
plan: 02
subsystem: type-system + validation + config
tags: [pattern-a, mechanical-widening, qdr-101, qdr-102, qdr-109]
requires:
  - 18-01 (DB schema CHECK widening + parser_version migration landed; base codebase has 3 sources, not 4)
provides:
  - "TraceSource union including 'qoder' (QDR-101)"
  - "SourceToolId union including 'qoder' (QDR-101)"
  - "Runtime whitelists in 5 files accept source=qoder (QDR-101)"
  - "TOOL_DIR_REGISTRY entry { type:'qoder', envVar:'QODER_DB_PATH', configKey:'qoder_db_paths', defaultDirs:['Library/Application Support/Qoder/SharedClientCache/cache/db/local.db'] } (QDR-102)"
  - "SOURCE_CAPABILITIES.qoder = { agents:false, automations:false, cost:false, activity:true, sessions:true, replay:true } — first line of defence for cost exclusion (QDR-109)"
affects:
  - "Plan 18-03: discoverQoderSources can call loadToolDirs().get('qoder') to obtain the configured DB file path list"
  - "Plan 18-03: SyncSourceType union and ingest/sync dispatcher must add 'qoder' (deferred — owned by 18-03)"
  - "Plan 18-04: lib/agent-tools/registry.ts AGENT_TOOLS map must add qoder entry (deferred — owned by 18-04)"
  - "Plan 18-04: ingest/api/sources.ts source-list endpoint must accept qoder (deferred — owned by 18-04)"
  - "Plan 18-05: components/sessions/aggregate-sessions-view.tsx and session-filter-dropdown.tsx must add qoder branches (deferred — owned by 18-05)"
tech-stack:
  added: []
  patterns:
    - "Pattern A: literal union widening + chronological-introduction order (NOT alphabetical)"
key-files:
  created: []
  modified:
    - types/trace.ts
    - lib/agent-tools/types.ts
    - lib/agent-tools/types.test.ts
    - ingest/api/sessions.ts
    - ingest/api/overview.ts
    - ingest/api/agents.ts
    - ingest/api/overview.test.ts
    - ingest/index.ts
    - app/api/sync/route.ts
    - ingest/config/tool-dirs.ts
    - ingest/config/capabilities.ts
    - tests/unit/ingest/tool-dirs.test.ts
    - tests/unit/bff/sync-route.test.ts
decisions:
  - "Did NOT defensively add 'opencode' literal — Phase 17 has not landed; existing unions are 3-source so widening to 4-source ('openclaw','claude-code','codex','qoder')."
  - "Did NOT modify lib/agent-tools/registry.ts (owned by 18-04 — imports qoderDef which 18-04 creates)."
  - "Did NOT modify ingest/sync/index.ts SyncSourceType (owned by 18-03 — same file hosts syncQoderSource that 18-03 implements)."
  - "Did NOT modify ingest/api/sources.ts or ingest/sync/sources.ts (owned by 18-03/18-04)."
  - "Confirmed home-prefix join loop at ingest/config/tool-dirs.ts:102 uses path.join(home, p) which does NOT append a trailing slash — Qoder's single-file defaultDirs entry is preserved as-is. No normalisation needed in 18-03's discoverQoderSources."
  - "TOOL_DIR_REGISTRY appended Qoder entry AFTER codex (chronological-introduction order per PATTERNS.md Pattern A)."
metrics:
  duration: "~50 minutes"
  completed: "2026-05-18"
---

# Phase 18 Plan 02: Types & whitelists accept 'qoder' Summary

Mechanical Pattern A widening — threaded the literal `'qoder'` through every TypeScript union, runtime whitelist, startup array, BFF validation list, and the two `ingest/config/*` registries (tool-dirs and capabilities), with the cost-exclusion capability flag (`cost: false`) locked in as the first line of defence for QDR-109.

## Tasks Completed

| # | Name | Commit | Files |
| - | ---- | ------ | ----- |
| 1 | Widen TraceSource and SourceToolId unions + types tests | `b8dceec` | types/trace.ts, lib/agent-tools/types.ts, lib/agent-tools/types.test.ts |
| 2 | Add 'qoder' to runtime validation arrays across ingest/api + ingest/index + BFF sync route | `7397716` | ingest/api/sessions.ts, ingest/api/overview.ts, ingest/api/agents.ts, ingest/api/overview.test.ts, ingest/index.ts, app/api/sync/route.ts |
| 3 | Register Qoder in TOOL_DIR_REGISTRY and SOURCE_CAPABILITIES | `01b33f1` | ingest/config/tool-dirs.ts, ingest/config/capabilities.ts |
| Δ | (Rule 1 deviation) Widen tool-dirs and sync-route test fixtures to 4 sources | `6bbc27c` | tests/unit/ingest/tool-dirs.test.ts, tests/unit/bff/sync-route.test.ts |

## Files Modified — Line Numbers of Literal Additions

| File | Line(s) | Site |
| ---- | ------- | ---- |
| `types/trace.ts` | 22 | `TraceSource = 'openclaw' \| 'claude-code' \| 'codex' \| 'qoder'` |
| `lib/agent-tools/types.ts` | 18 | `SourceToolId = 'openclaw' \| 'claude-code' \| 'codex' \| 'qoder'` |
| `lib/agent-tools/types.ts` | 214 | doc-comment "openclaw, claude-code, codex, qoder" |
| `lib/agent-tools/types.test.ts` | 18, 20, 26, 30, 34, 36 | type-level literal arrays + `toContain('qoder')` assertions (lines 192/199 NOT modified — they assert TOOL_IDS/SHELL_TOOL_IDS sourced from registry.ts which is owned by 18-04) |
| `ingest/api/sessions.ts` | 17 | `VALID_SOURCES = ['openclaw','claude-code','codex','qoder'] as const` |
| `ingest/api/sessions.ts` | 69 | inline lookup whitelist `['openclaw','claude-code','codex','qoder'].includes(source)` |
| `ingest/api/overview.ts` | 27 | `VALID_SOURCES = ['openclaw','claude-code','codex','qoder'] as const` |
| `ingest/api/agents.ts` | 44 | inline whitelist `['openclaw','claude-code','codex','qoder'].includes(source)` |
| `ingest/index.ts` | 76 | `sources: ['openclaw','claude-code','codex','qoder'] as TraceSource[]` |
| `ingest/index.ts` | 267 | `sourceTypes = ['openclaw','claude-code','codex','qoder'] as SyncSourceType[]` |
| `app/api/sync/route.ts` | 4 | `SOURCE_TYPES = ['openclaw','claude-code','codex','qoder'] as const` |
| `ingest/config/tool-dirs.ts` | 45–57 | new TOOL_DIR_REGISTRY entry (after codex): type/displayName/envVar/configKey/defaultDirs |
| `ingest/config/capabilities.ts` | 44–55 | new `SOURCE_CAPABILITIES.qoder` entry |
| `ingest/api/overview.test.ts` | ~817–852 | (Rule 1 deviation, Task 2) capabilities test now expects 4 sources + qoder capability flags |
| `tests/unit/ingest/tool-dirs.test.ts` | 23–29 | (Rule 1 deviation, post-Task 3) length 4, `toContain('qoder')` |
| `tests/unit/bff/sync-route.test.ts` | 163–220 | (Rule 1 deviation, post-Task 2) `/api/sync` now fans out to 4 ingest calls |

## Acceptance Criteria — Per-task

### Task 1
- ✅ `grep -c "'qoder'" types/trace.ts` = 1 (line 22).
- ✅ `grep -E "TraceSource\s*=.*'qoder'" types/trace.ts` matches 1.
- ✅ `grep -E "SourceToolId\s*=.*'qoder'" lib/agent-tools/types.ts` matches 1.
- ✅ `grep -c "'qoder'" lib/agent-tools/types.test.ts` = 5 (≥ 4 required).
- ⚠️ `pnpm exec tsc --noEmit`: did NOT exit 0 — see "Cross-plan tsc boundary" below. Plan-internal types/files compile cleanly; the 5 errors all live in files owned by other plans and exist BECAUSE the union widening exposed downstream non-exhaustive consumers — the expected hand-off behaviour for parallel waves.
- ✅ `pnpm test:run lib/agent-tools/types.test.ts` exits 0 (20/20 pass).

### Task 2
- ✅ `grep -E "'qoder'" ingest/api/sessions.ts ingest/api/overview.ts ingest/api/agents.ts ingest/index.ts app/api/sync/route.ts | wc -l` = 7 (sessions: 2, overview: 1, agents: 1, index: 2, sync route: 1) ≥ 6.
- ⚠️ `pnpm exec tsc --noEmit`: same 5 cross-plan errors only — Plan 18-02 changes themselves type-clean.
- ✅ All single-literal additions; no new functions, no new imports.
- ✅ `pnpm test:run ingest/api` passes (138/138 — including Rule 1 fix to `ingest/api/overview.test.ts:817–852`).

### Task 3
- ✅ `grep -A3 "type: 'qoder'" ingest/config/tool-dirs.ts` shows envVar='QODER_DB_PATH', configKey='qoder_db_paths', defaultDirs containing the SQLite file path.
- ✅ `grep -E "qoder:\s*\{" ingest/config/capabilities.ts` matches once at line 44; entry has cost:false, sessions:true, replay:true, activity:true.
- ⚠️ `pnpm exec tsc --noEmit`: 5 cross-plan errors only.
- ✅ `pnpm test:run tests/unit/ingest/tool-dirs.test.ts` passes (8/8 after the deviation fix in `6bbc27c`).

## Plan-level Verification

| Check | Result |
| ----- | ------ |
| `pnpm exec tsc --noEmit` exits 0 | ⚠️ 5 cross-plan errors (see boundary table below) — all caused by Task 1's union widening exposing downstream consumers in files owned by 18-03/18-04/18-05. Plan-18-02 files themselves compile cleanly. |
| `pnpm test:run lib/agent-tools/types.test.ts` exits 0 | ✅ 20/20 |
| `pnpm test:run ingest/api` exits 0 | ✅ 138/138 (8 test files) |
| `grep -RE "'qoder'" types/ lib/agent-tools/ ingest/api/ ingest/index.ts ingest/config/ app/api/sync/route.ts \| wc -l` ≥ 12 | ✅ 16 |

## Cross-plan tsc boundary (5 expected errors — DO NOT FIX HERE)

These errors all exist BECAUSE Task 1 widened `TraceSource` and `SourceToolId` to include `'qoder'`. The cited files are owned by other plans and will be fixed there per the file-ownership rule for parallel waves.

| Error | File:Line | Owner | Resolution |
| ----- | --------- | ----- | ---------- |
| TS2741: Property 'qoder' missing in `Record<AgentToolId, AgentToolDefinition>` | `lib/agent-tools/registry.ts:20` | 18-04 | 18-04 imports `qoderDef` from `lib/agent-tools/qoder/definition.ts` (created in 18-04) and adds it to the `AGENT_TOOLS` map. |
| TS2345: 'TraceSource' / `"qoder"` not assignable to 'SyncSourceType' | `ingest/api/sources.ts:130` | 18-04 | Cascades from 18-03's widening of `SyncSourceType`. |
| TS2345: 'TraceSource' / `"qoder"` not assignable to 'SyncSourceType' | `ingest/api/sources.ts:131` | 18-04 | Same as above. |
| TS2741: Property 'qoder' missing in `Record<TraceSource, string>` | `components/sessions/session-filter-dropdown.tsx:27` | 18-05 | 18-05 adds the `qoder:` entry to the source-label map. |
| TS2366: exhaustive-switch lacks ending return / 'qoder' branch | `components/sessions/aggregate-sessions-view.tsx:8` | 18-05 | 18-05 adds the `case 'qoder':` branch with display label. |

These are the **intended** signal: parallel-wave file-ownership means 18-02 widens the union, downstream owners then fill in their non-exhaustive consumers. The verification scope explicitly excludes them (`pnpm test:run -- ingest/api`, not the whole repo `tsc --noEmit`).

## Exact `SOURCE_CAPABILITIES.qoder` shape committed

```typescript
qoder: {
  // Qoder is excluded from cost rollups (QDR-109 / SPEC §9). cost=false is
  // the first line of defence — downstream cost code must short-circuit on
  // this flag. Subagents are exposed via lib/agent-tools/qoder/definition.ts
  // (Plan 18-04); SOURCE_CAPABILITIES does not currently expose subagents.
  agents: false,
  automations: false,
  cost: false,
  activity: true,
  sessions: true,
  replay: true,
},
```

`cost: false` is the **first line of defence** for QDR-109 — downstream cost rollup code (in 18-04) must short-circuit on this flag before issuing any aggregation query that touches Qoder sessions.

## Exact `TOOL_DIR_REGISTRY.qoder` shape committed

```typescript
{
  type: 'qoder',
  displayName: 'Qoder',
  envVar: 'QODER_DB_PATH',
  configKey: 'qoder_db_paths',
  // Qoder's "dir" is actually a single SQLite file path (the local cache DB).
  // The TOOL_DIR_REGISTRY semantics tolerate this because consumers treat
  // each entry as an opaque string list — discoverQoderSources (Plan 18-03)
  // interprets the path as a DB file. The home-prefix loop in resolveToolDirs
  // uses path.join(home, p) which does NOT append a trailing slash, so the
  // file path is preserved as-is.
  defaultDirs: ['Library/Application Support/Qoder/SharedClientCache/cache/db/local.db'],
},
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test fixture] `ingest/api/overview.test.ts` capabilities test (Task 2 inline)**
- Found during: Task 2 verify step.
- Issue: `expect(body.sources).toHaveLength(3)` and a 3-source-shaped capabilities assertion failed once `VALID_SOURCES` widened to 4 — the `/overview/capabilities` endpoint now returns 4 sources.
- Fix: Updated test to assert `toHaveLength(4)`, `toContain('qoder')`, and 6 capability flag assertions (`agents/automations/cost/activity/sessions/replay`). The capabilities-flag assertions all stayed red until Task 3 landed `SOURCE_CAPABILITIES.qoder`, then turned green.
- Files modified: `ingest/api/overview.test.ts:~817–852`.
- Commit: `7397716` (rolled into Task 2).

**2. [Rule 1 — Test fixture] `tests/unit/ingest/tool-dirs.test.ts` length-3 assertion (post-Task 3)**
- Found during: plan-level verify step.
- Issue: `expect(types).toHaveLength(3)` failed once Task 3 appended the qoder TOOL_DIR_REGISTRY entry.
- Fix: Updated to `toHaveLength(4)` + `toContain('qoder')`.
- Files modified: `tests/unit/ingest/tool-dirs.test.ts:23–29`.
- Commit: `6bbc27c`.

**3. [Rule 1 — Test fixture] `tests/unit/bff/sync-route.test.ts` 4 tests asserting 3 source types (post-Task 2)**
- Found during: plan-level verify step.
- Issue: `expect(fetchIngestMock).toHaveBeenCalledTimes(3)`, `(body.results).length === 3`, and "all 3 source types" failed once `app/api/sync/route.ts:4 SOURCE_TYPES` widened from 3 to 4.
- Fix: Bumped fan-out expectations to 4, added `'/api/v1/sources/qoder/sync'` to path-set assertion, extended the failure-case mock chain with a fourth `mockResolvedValueOnce` for qoder.
- Files modified: `tests/unit/bff/sync-route.test.ts:163–220`.
- Commit: `6bbc27c`.

**4. [Cleanup] `ingest/config/tool-dirs.ts` orphan code (Task 3 inline)**
- Found during: Task 3 verify step.
- Issue: tsc reported `Declaration or statement expected` at lines 112/116/119 — silent partial-write artifacts from the search_replace tool left an orphan duplicate fragment after the closing `}` of `resolveToolDirs`.
- Fix: Removed the 13 stray lines (107–119 in the corrupted state). Final file is 107 clean lines.
- Files modified: `ingest/config/tool-dirs.ts`.
- Commit: `01b33f1` (rolled into Task 3).

### Process notes (no commit, no production impact)

**`git stash` violations during baseline checks**
- Twice during this plan I ran `git stash` (once during Task 1 baseline tsc, once probing pre-existing failures during plan verify). Both runs were no-ops at execution time (`No local changes to save`) because all my changes were already committed, so no sibling-worktree state was popped or applied. Recording for protocol hygiene: in a worktree, NEVER use `git stash`; use a throwaway branch instead. The second probe additionally accidentally rolled the working tree back to baseline via `git checkout d6964dc -- ...` — recovered immediately with `git checkout HEAD -- .` and verified HEAD = `01b33f1` with all committed changes intact.

## Notes for downstream plans

### For Plan 18-03 (parser + sync source registration)

- **Home-prefix loop confirmed safe for Qoder file path.** `ingest/config/tool-dirs.ts:102` uses `path.join(home, p)`. `path.join` collapses path segments and does **not** append a trailing slash. So `path.join('/Users/x', 'Library/Application Support/Qoder/SharedClientCache/cache/db/local.db')` resolves to the exact file path with no corruption. **`discoverQoderSources` does NOT need to add normalisation — just consume the configured list as-is and treat each entry as a file path.**
- **`SyncSourceType` widening is YOURS.** I did NOT modify `ingest/sync/index.ts:63` (`SyncSourceType`) — that's owned by 18-03 because the same file is where `syncQoderSource` lands. Until 18-03 widens it, `ingest/api/sources.ts:130–131` will continue to show TS2345 errors (cited above). Expected.

### For Plan 18-04 (Agent-tools registry + 13 BFF routes)

- **`lib/agent-tools/registry.ts:20`** has the open TS2741 — your work creates `lib/agent-tools/qoder/definition.ts` (`qoderDef`), imports it, and adds the `qoder: qoderDef` entry to the `AGENT_TOOLS` `Record<AgentToolId, AgentToolDefinition>`. After that, the type narrows again.
- **`lib/agent-tools/types.test.ts:192, 199`** were intentionally NOT updated by this plan: they assert `TOOL_IDS` and `SHELL_TOOL_IDS` shapes which are runtime-imported from `registry.ts`. After 18-04 lands, those two assertions need `'qoder'` appended. (They are NOT failing today because `TOOL_IDS` is still 3-source on the registry side; they will flip to failing after 18-04's first commit if you don't update them in the same commit that adds the registry entry.)
- **`ingest/api/sources.ts`** source-list endpoint also requires the qoder branch — owned by you per file-ownership.

### For Plan 18-05 (UI integration + docs)

- **`components/sessions/session-filter-dropdown.tsx:27`** and **`components/sessions/aggregate-sessions-view.tsx:8`** both have open TS2741/TS2366 errors caused by Task 1's union widening. Add the `qoder:` label entry and the `case 'qoder':` switch branch.

## Deferred Issues (out of scope — not caused by this plan)

| Test | Failure | Cause | Owner |
| ---- | ------- | ----- | ----- |
| `tests/unit/ingest/sync-performance.test.ts` (2 tests: pre-parse skip, full sync repair) | `parseCodexSession` called when expected to skip | Pre-existing parser-version mismatch: tests insert `file_hash = 'parser-v8-model-token-accounting:codex:anyhash'` but `ingest/sync/index.ts:20` already advanced to `'parser-v9-token-channel-accounting'` (introduced before Phase 18). The hash-version mismatch makes the pre-parse skip optimisation correctly bypass — tests are stale. | Whoever bumped `PARSER_CACHE_VERSION` to v9 (NOT 18-02 — verified by reading code with no qoder references). Logged here for the verification phase to triage. |
| `tests/unit/components/activity-timeline.test.tsx` (1 test: duplicate-key warnings) | DOM rendering — "STARTED"/"COMPLETED" not found | Pre-existing UI rendering issue, no qoder/source references in the failing test. | UI/components team. |

These are out of the plan-18-02 scope per the executor's SCOPE BOUNDARY rule. None of my changes touch the parser-version constant, the `computeFileHash` function, or `ActivityTimeline`.

## Self-Check: PASSED

**1. Created files exist:**
- `.planning/phases/18-qoder-source-integration/18-02-SUMMARY.md` — this file ✓

**2. Commits exist:**
- `b8dceec` — Task 1 ✓ (`git log --oneline | grep b8dceec`)
- `7397716` — Task 2 ✓
- `01b33f1` — Task 3 ✓
- `6bbc27c` — Rule 1 deviation (test fixtures) ✓

**3. Plan-level verification:**
- `pnpm test:run lib/agent-tools/types.test.ts` → 20/20 ✓
- `pnpm test:run ingest/api` → 138/138 ✓
- grep count = 16 ≥ 12 ✓
- `pnpm exec tsc --noEmit` → 5 cross-plan errors (expected hand-off boundary; no in-scope errors). Plan-18-02 files themselves type-clean. ✓ (within plan scope)

**4. Per-file literal-addition line numbers recorded above. ✓**

**5. Exact `SOURCE_CAPABILITIES.qoder` shape recorded above with QDR-109 cost-exclusion intent documented. ✓**

**6. Cross-plan boundary documented (5 errors → 18-03/18-04/18-05 owners) with exact file:line + resolution path. ✓**
