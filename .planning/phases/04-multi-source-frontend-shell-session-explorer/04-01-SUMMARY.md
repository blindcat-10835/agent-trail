---
phase: 04-multi-source-frontend-shell-session-explorer
plan: 01
subsystem: ui
tags: [react, typescript, context, types, registry, agent-tools]

# Dependency graph
requires:
  - phase: 01-trace-contract-brownfield-reset
    provides: TraceSource type (AgentToolId union compatibility)
  - phase: 03-claude-codex-parsers-turn-assembly
    provides: Normalized session/turn/message contract reference
provides:
  - AgentToolId, AgentToolDefinition, AgentToolCapabilities, AgentToolUIProfile types
  - Tool registry with getDefinition, assertAgentToolId, getAllDefinitions
  - 3 per-tool definitions (openclaw, claude-code, codex) with UI-SPEC copywriting contract
  - AgentToolProvider React context with useAgentTool hook and href builder
  - CapabilityGate component and requiresCapability hook
affects: [04-02-api-proxy-redirects, 04-03-shell-migration, 04-04-session-explorer, 04-05-dashboard-pages]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AgentToolProvider + useAgentTool context pattern for tool-scoped components"
    - "CapabilityGate conditional rendering pattern for tool-specific features"
    - "Per-tool definition files under lib/agent-tools/[tool]/definition.ts"
    - "Barrel export via lib/agent-tools/index.ts"

key-files:
  created:
    - lib/agent-tools/types.ts
    - lib/agent-tools/registry.ts
    - lib/agent-tools/openclaw/definition.ts
    - lib/agent-tools/claude-code/definition.ts
    - lib/agent-tools/codex/definition.ts
    - lib/agent-tools/index.ts
    - lib/agent-tools/client-hooks.tsx
    - lib/agent-tools/capability-gate.tsx
    - lib/agent-tools/types.test.ts
  modified:
    - vitest.config.ts

key-decisions:
  - "Renamed client-hooks.ts and capability-gate.ts to .tsx for JSX syntax support (React context/components)"
  - "Added lib/**/*.test.ts to vitest include pattern to cover new test location"
  - "Forward-declared NormalizedSession, NormalizedToolCall, and ReplayBlockRegistry as intentional stubs for Phase 5 (needed by AgentToolUIProfile type contract)"
  - "No REFACTOR phase needed in TDD cycle — implementation was clean from RED to GREEN"
  - "Used 'use client' directive on client-hooks.tsx and capability-gate.tsx per React context/hooks requirements"

patterns-established:
  - "AgentToolProvider: React context provider pattern reading from tool registry"
  - "CapabilityGate: declarative conditional rendering based on tool capability flags"
  - "assertAgentToolId: validation + narrowing at trust boundaries (URL params)"
  - "nav nav items: href builder functions producing /:toolId/:route URLs"

requirements-completed: [UI-02]

# Metrics
duration: 9min
completed: 2026-05-06
---

# Phase 4 Plan 1: Agent Tool Types, Registry, and Provider Foundation

**AgentTool type system, registry with 3 tool definitions (OpenClaw/Claude Code/Codex matching UI-SPEC copywriting contract), React AgentToolProvider context, useAgentTool hook, and CapabilityGate for multi-source dashboard architecture**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-06T15:39:55Z
- **Completed:** 2026-05-06T15:49:20Z
- **Tasks:** 2
- **Files modified:** 10 (9 created, 1 modified)

## Accomplishments

- Pure TypeScript type system: AgentToolId union, AgentToolDefinition, AgentToolCapabilities (9 boolean flags), ToolNavItem, SessionColumnDef, AgentToolUIProfile, AgentToolContextValue
- Tool registry with getDefinition(), assertAgentToolId() (with validation error messages), getAllDefinitions(), AGENT_TOOL_DEFINITIONS, and TOOL_IDS
- 3 per-tool definitions with UI-SPEC copywriting contract: OpenClaw (6 nav items, liveGateway, office, workspace, cost), Claude Code (3 nav items, subagents), Codex (3 nav items)
- AgentToolProvider React context exposing toolId, definition, capabilities, and href builder
- useAgentTool() hook with descriptive error when called outside provider
- CapabilityGate component and requiresCapability() hook for conditional rendering
- 16 vitest tests covering type contracts, registry behavior, and per-tool definition correctness

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Add failing test for agent tool types and registry** - `3673c80` (test)
2. **Task 1 (TDD GREEN): Implement agent tool types, registry, and per-tool definitions** - `f0021c7` (feat)
3. **Task 2: Create AgentToolProvider React context, client hooks, and CapabilityGate** - `0c04bc7` (feat)

**No REFACTOR commit needed** — implementation was clean from RED to GREEN.

## Files Created/Modified

### Created
- `lib/agent-tools/types.ts` — All agent tool types: AgentToolId, AgentToolDefinition, AgentToolCapabilities, ToolNavItem, SessionColumnDef, AgentToolUIProfile, AgentToolContextValue, plus forward-declared stubs (NormalizedSession, NormalizedToolCall, ReplayBlockRegistry)
- `lib/agent-tools/registry.ts` — Tool registry: getDefinition(), assertAgentToolId(), getAllDefinitions(), AGENT_TOOL_DEFINITIONS, TOOL_IDS
- `lib/agent-tools/openclaw/definition.ts` — OpenClaw definition: 6 nav items, liveGateway/office/workspace/cost capabilities, 4 session columns
- `lib/agent-tools/claude-code/definition.ts` — Claude Code definition: 3 nav items, subagents capability, 5 session columns (includes project)
- `lib/agent-tools/codex/definition.ts` — Codex definition: 3 nav items, same capability set as Claude Code minus subagents, 5 session columns
- `lib/agent-tools/index.ts` — Barrel export of types, registry, per-tool definitions, client hooks, and capability gate
- `lib/agent-tools/client-hooks.tsx` — AgentToolProvider, useAgentTool, AgentToolContext, getClientToolDefinition, isAgentToolCapabilities
- `lib/agent-tools/capability-gate.tsx` — CapabilityGate component and requiresCapability hook
- `lib/agent-tools/types.test.ts` — 16 vitest tests: AgentToolId union, AgentToolDefinition fields, AgentToolCapabilities, assertAgentToolId, getDefinition for each tool, TOOL_IDS, AGENT_TOOL_DEFINITIONS

### Modified
- `vitest.config.ts` — Added `lib/**/*.test.ts` to include pattern

## Decisions Made

- **Renamed .ts to .tsx for JSX files**: client-hooks.tsx and capability-gate.tsx use JSX (React context provider, fragment rendering); TypeScript requires .tsx extension for JSX syntax
- **Extended vitest include pattern**: Added `lib/**/*.test.ts` to support test files colocated with source under `lib/agent-tools/`
- **Forward-declared stubs for Phase 5**: NormalizedSession, NormalizedToolCall, and ReplayBlockRegistry are placed in types.ts as documented stubs — needed by AgentToolUIProfile type contract for formatSessionLabel and formatToolName callbacks; will be replaced by canonical types from session-replay module in Phase 5
- **Skipped REFACTOR phase**: Code was clean from GREEN — no unnecessary abstraction, consistent patterns across all 3 definition files, registry functions are minimal

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest config exclude pattern prevented test discovery**
- **Found during:** Task 1 (RED phase)
- **Issue:** `lib/agent-tools/types.test.ts` was not found by vitest because the include pattern was `tests/**/*.test.ts` only. Explicit file path also failed due to include filter.
- **Fix:** Updated `vitest.config.ts` to add `lib/**/*.test.ts` to the include array
- **Files modified:** `vitest.config.ts`
- **Verification:** `npx vitest run lib/agent-tools/types.test.ts` found and ran all 16 tests
- **Committed in:** `3673c80`

**2. [Rule 3 - Blocking] JSX syntax in .ts files caused TypeScript compilation errors**
- **Found during:** Task 2
- **Issue:** `client-hooks.ts` and `capability-gate.ts` contained JSX (`<AgentToolContext.Provider>`, `<>children</>`) but used `.ts` extension. TypeScript requires `.tsx` for JSX syntax.
- **Fix:** Renamed files to `client-hooks.tsx` and `capability-gate.tsx`
- **Files modified:** `lib/agent-tools/client-hooks.tsx`, `lib/agent-tools/capability-gate.tsx`, `lib/agent-tools/index.ts` (updated imports)
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** `0c04bc7`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were necessary for build correctness. No scope creep. Plan executed otherwise exactly as specified.

## Issues Encountered

None — plan executed smoothly through RED/GREEN cycle and Task 2 implementation.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `NormalizedSession` interface | `lib/agent-tools/types.ts` | 136 | Forward-declared placeholder for Phase 5 session-replay module. Needed by `AgentToolUIProfile.formatSessionLabel` |
| `NormalizedToolCall` interface | `lib/agent-tools/types.ts` | 155 | Forward-declared placeholder for Phase 5 session-replay module. Needed by `AgentToolUIProfile.formatToolName` |
| `ReplayBlockRegistry` interface | `lib/agent-tools/types.ts` | 171 | Forward-declared placeholder for Phase 5 replay component registry. Needed by `AgentToolUIProfile.replayBlocks` |

All stubs are intentionally forward-declared per the plan's scope boundary: "extensions go in later phases." Phase 5 (Turn Replay UI) will replace these with canonical types from `lib/session-replay/types.ts`.

## Verification Results

### Plan-level verification
- `npx tsc --noEmit` — PASS (no errors from `lib/agent-tools/`)
- `npx vitest run lib/agent-tools/types.test.ts` — PASS (16/16 tests)
- `grep "export type AgentToolId" lib/agent-tools/types.ts` — PASS (line 18)
- `grep "export.*getDefinition" lib/agent-tools/registry.ts` — PASS (line 35)
- `grep "export function useAgentTool" lib/agent-tools/client-hooks.tsx` — PASS (line 111)
- AgentToolId union equals `'openclaw' | 'claude-code' | 'codex'` — PASS (line 18 of types.ts)

### Success criteria
1. All AgentTool types compile without errors and are importable by downstream plans — PASS
2. Tool registry returns correct definitions for all 3 tools with per-tool capabilities matching UI-SPEC copywriting contract — PASS
3. AgentToolProvider correctly exposes toolId, definition, capabilities, and href builder via React context — PASS
4. CapabilityGate and requiresCapability hook work for conditional rendering — PASS
5. No existing pages break — plan adds types without modifying any existing route or component — PASS

## Next Phase Readiness

- Foundation types, registry, and provider are ready for Wave 2 (API proxy + redirects, Plan 04-02)
- AgentToolProvider can be mounted in `[tool]/layout.tsx` immediately — all exports are importable
- Downstream plans can use `useAgentTool()`, `CapabilityGate`, `getDefinition()`, and `assertAgentToolId()` without waiting for further changes

---

*Phase: 04-multi-source-frontend-shell-session-explorer*
*Completed: 2026-05-06*

---

## Self-Check: PASSED

- 11 key files verified on disk (9 created, 1 modified, 1 summary)
- 3 commits verified in git history (3673c80, f0021c7, 0c04bc7)
- All 16 tests pass
- TypeScript compiles with no errors
