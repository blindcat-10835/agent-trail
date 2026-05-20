---
phase: 18-qoder-source-integration
plan: 04
subsystem: bff-adapter
tags: [pattern-e, pattern-d, qdr-101, qdr-104, qdr-110]

# Dependency graph
requires:
  - phase: 18-02
    provides: "TraceSource/SourceToolId unions include 'qoder'; TOOL_IDS in registry accepts 'qoder'"
  - phase: 18-03
    provides: "Qoder parser + sync engine registered in ingest; /api/v1/sources/qoder endpoints work"
provides:
  - "qoderDef registered in AGENT_TOOL_DEFINITIONS, TOOL_IDS, SHELL_TOOL_IDS (QDR-101)"
  - "qoderAdapter exported from lib/agent-tools/qoder/server-adapter.ts (QDR-101)"
  - "All 5 adapter-dispatch BFF routes accept 'qoder' as valid [tool] parameter (QDR-104)"
  - "Remaining 18 BFF routes accept 'qoder' via assertSourceToolId + dynamic URL (QDR-104)"
  - "getAllDefinitions() includes qoderDef; SourceSwitcher will auto-pick it up"
affects:
  - "Plan 18-05: frontend label/color SOURCE_LABELS and SOURCE_COLORS need qoder entries (session-filter-dropdown, starred-sessions, kpi-hero, aggregate-sessions-view)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern E: AgentToolDefinition + ServerAdapter triplet (definition.ts + server-adapter.ts)"
    - "Pattern D: BFF route adapter-dispatch map (5 routes use explicit adapter maps; 18 use dynamic URL construction)"

key-files:
  created:
    - lib/agent-tools/qoder/definition.ts
    - lib/agent-tools/qoder/server-adapter.ts
  modified:
    - lib/agent-tools/registry.ts
    - app/api/agent-tools/[tool]/health/route.ts
    - app/api/agent-tools/[tool]/sessions/route.ts
    - app/api/agent-tools/[tool]/sessions/[sessionId]/route.ts
    - app/api/agent-tools/[tool]/sessions/[sessionId]/messages/route.ts
    - app/api/agent-tools/[tool]/sessions/[sessionId]/turns/route.ts

key-decisions:
  - "Branch B taken for client-adapter pre-check: neither codex nor claude-code ships client-adapter.ts; no qoder/client-adapter.ts created"
  - "Only 5 of 23 BFF routes use adapter dispatch maps; remaining 18 use assertSourceToolId + dynamic fetchIngest URL and already accept 'qoder'"
  - "sessions/lookup is openclaw-only by design (Gateway key lookup) — no qoder patch applied"
  - "sync/route uses assertSourceToolId + dynamic URL — already works with qoder, no patch needed"

patterns-established:
  - "Pattern E triplet: definition.ts (default export), server-adapter.ts (factory + singleton), registry.ts (import + map entry)"

requirements-completed: [QDR-101, QDR-104, QDR-110]

# Metrics
duration: 20min
completed: 2026-05-19
---

# Phase 18 Plan 04: Qoder BFF Adapter + Route Registration Summary

**Qoder adapter definition + server-adapter registered in agent-tools registry, threaded through all 5 adapter-dispatch BFF routes, with remaining 18 routes accepting qoder via assertSourceToolId**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-19T13:03:49Z
- **Completed:** 2026-05-19T13:23:53Z
- **Tasks:** 2
- **Files modified:** 7 (2 new, 5 modified)

## Accomplishments

- Qoder adapter triplet created: definition.ts (subagents:true, cost:false) + server-adapter.ts (SOURCE='qoder')
- qoderDef registered in AGENT_TOOL_DEFINITIONS, TOOL_IDS, SHELL_TOOL_IDS, getAllDefinitions()
- All BFF routes now accept 'qoder' as a valid [tool] parameter
- SourceSwitcher will auto-pick up qoderDef via getAllDefinitions() — no UI code changes needed in this plan

## Task Commits

Each task was committed atomically:

1. **Task 1: Create qoder/{definition,server-adapter}.ts + register in registry.ts** - `7612e59` (feat)
2. **Task 2: Patch BFF route handler dispatch maps** - `8514f2f` (feat)

## Files Created/Modified

- `lib/agent-tools/qoder/definition.ts` — Qoder AgentToolDefinition with subagents:true, cost:false, nav (OVR/SES/ACT), ui brand profile
- `lib/agent-tools/qoder/server-adapter.ts` — Qoder server adapter wrapping ingest calls with source=qoder (mirrors codex)
- `lib/agent-tools/registry.ts` — Added qoderDef import + AGENT_TOOL_DEFINITIONS + TOOL_IDS + getAllDefinitions entries
- `app/api/agent-tools/[tool]/health/route.ts` — Added qoderAdapter to dispatch map
- `app/api/agent-tools/[tool]/sessions/route.ts` — Added qoderAdapter to dispatch map
- `app/api/agent-tools/[tool]/sessions/[sessionId]/route.ts` — Added qoderAdapter to dispatch map
- `app/api/agent-tools/[tool]/sessions/[sessionId]/messages/route.ts` — Added qoderAdapter to dispatch map
- `app/api/agent-tools/[tool]/sessions/[sessionId]/turns/route.ts` — Added qoderAdapter to dispatch map

## Decisions Made

### client-adapter pre-check (Step 0)
- **Branch B taken.** Neither `lib/agent-tools/codex/client-adapter.ts` nor `lib/agent-tools/claude-code/client-adapter.ts` exists at execution time. Per Pattern E parity rule: qoder ships the same files as codex/claude-code, no more, no less. No `client-adapter.ts` created.

### BFF route patching scope
- **Only 5 of 23 BFF routes** have adapter dispatch maps (health, sessions, sessions/:id, sessions/:id/messages, sessions/:id/turns). The remaining 18 routes use `assertSourceToolId()` / `assertAgentToolId()` with dynamic `fetchIngest` URL construction — they accept 'qoder' automatically since Task 1 added it to `TOOL_IDS` in the registry.
- **sessions/lookup/route.ts** — OpenClaw-only by design (Gateway key lookup). Returns 400 for non-openclaw tools including qoder. No patch needed — correct behavior.
- **sync/route.ts** — Uses `assertSourceToolId(tool)` + `fetchIngest(/api/v1/sources/${toolId}/sync)`. Already works with 'qoder'. No adapter map.

### Brand color
- Codex uses `var(--accent)` for its brand. No per-source accent token exists in the radix-nova theme. Qoder uses the same `var(--accent)` default. Frontend label/color customization is deferred to Plan 18-05 which owns SOURCE_COLORS and SOURCE_LABELS updates.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] Reduced BFF route patch scope from 23 to 5 files**
- **Found during:** Task 2 (reading route files to understand patterns)
- **Issue:** Plan listed all 23 BFF route files as needing "two mechanical edits" (import + map entry). However, only 5 files actually have adapter dispatch maps. The other 18 use `assertSourceToolId`/`assertAgentToolId` with dynamic URL construction — they don't import adapter instances at all.
- **Fix:** Patched only the 5 files with adapter maps. The remaining 18 files already accept 'qoder' through the `assertSourceToolId('qoder')` call succeeding (TOOL_IDS includes 'qoder' from Task 1's registry update).
- **Files modified:** 5 instead of 23 (same functional result — all routes accept qoder)
- **Verification:** `rg -l "qoder: qoderAdapter" app/api/agent-tools/ | wc -l` = 5; all other routes use assertSourceToolId/dynamic URL

---

**Total deviations:** 1 auto-fixed (1 scope correction based on actual code structure)
**Impact on plan:** Positive — fewer files changed, same functional result. No scope creep.

## Cross-plan tsc boundary (2 expected errors — owned by 18-05)

| Error | File:Line | Owner | Resolution |
| ----- | --------- | ----- | ---------- |
| TS2366: Function lacks ending return statement | `components/sessions/aggregate-sessions-view.tsx:8` | 18-05 | Add `case 'qoder':` switch branch |
| TS2741: Property 'qoder' missing in Record<TraceSource, string> | `components/sessions/session-filter-dropdown.tsx:27` | 18-05 | Add `qoder: 'Qoder'` to SOURCE_LABELS |

## Notes for downstream plans

### For Plan 18-05 (UI integration + docs)

- **`components/sessions/session-filter-dropdown.tsx:27`** and **`components/sessions/aggregate-sessions-view.tsx:8`** — add qoder label entries.
- **`components/overview/kpi-hero.tsx:45-50`** SOURCE_LABELS — add `qoder: 'QODER'` entry.
- **`components/overview/starred-sessions.tsx:13-17`** SOURCE_COLORS — add qoder entry with a distinct accent token.
- **`lib/agent-tools/types.test.ts:192, 199`** — these assert TOOL_IDS/SHELL_TOOL_IDS shapes and need 'qoder' appended.
- SourceSwitcher auto-picks up qoderDef via `getAllDefinitions()` — no SourceSwitcher code changes needed.

## Self-Check: PASSED

**1. Created files exist:**
- `lib/agent-tools/qoder/definition.ts` ✓
- `lib/agent-tools/qoder/server-adapter.ts` ✓

**2. Commits exist:**
- `7612e59` — Task 1 ✓
- `8514f2f` — Task 2 ✓

**3. Acceptance criteria verified:**
- `grep -c "qoderDef" lib/agent-tools/registry.ts` = 3 ✓
- `grep -E "subagents:\s*true" lib/agent-tools/qoder/definition.ts` = 1 ✓
- `grep -E "cost:\s*false" lib/agent-tools/qoder/definition.ts` = 1 ✓
- `grep -E "SOURCE\s*=\s*'qoder'" lib/agent-tools/qoder/server-adapter.ts` = 1 ✓
- `rg -l "qoder: qoderAdapter" app/api/agent-tools/ | wc -l` = 5 ✓
- `pnpm exec tsc --noEmit` → 2 cross-plan errors only (18-05 owned) ✓
- `! test -f lib/agent-tools/qoder/client-adapter.ts` → Branch B confirmed ✓
