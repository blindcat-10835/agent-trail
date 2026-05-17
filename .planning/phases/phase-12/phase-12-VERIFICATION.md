---
phase: 12-overview-v2
verified: 2026-05-16T11:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "OpenClaw agents and automation modules appear only when capability metadata supports them (OVR-104)"
    - "Token-vs-cost ranking mode works where exposed by the UI (OVR-103)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to /openclaw/dashboard with ingest running and sessions present"
    expected: "KPI hero shows real numbers, ranking tables show model/project data with RANK BY toggle, timeline shows colored event dots, starred section shows sessions, agents and automations sections appear for OpenClaw source"
    why_human: "Cannot verify visual layout, typography, color rendering, or HUD styling programmatically"
  - test: "Switch between all, openclaw, claude-code, and codex using the source switcher"
    expected: "All overview sections re-fetch and update. Agents and automations sections show N/A for non-OpenClaw sources"
    why_human: "Requires running dev server and visual observation of state transitions"
  - test: "Click RANK BY toggle (TOKENS/COST) in top models section"
    expected: "Token mode shows SESSIONS, TOKENS, SHARE columns. Cost mode shows SESSIONS, COST columns with em-dash values. No layout shift on toggle"
    why_human: "Toggle behavior and layout stability require visual inspection"
  - test: "Toggle between light and dark themes"
    expected: "All overview sections render correctly in both themes including new automations module and toggle"
    why_human: "Visual theme compatibility requires visual inspection"
---

# Phase 12: Overview v2 Real Data — Re-Verification Report

**Phase Goal:** Replace the current dashboard overview with the prototype-aligned HUD overview powered by live ingest aggregates.
**Verified:** 2026-05-16T11:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plans 12-04 and 12-05)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Overview v2 renders real BFF-backed data with KPI hero, top models, top projects, starred sessions, activity timeline, agents, and automations (OVR-101) | ✓ VERIFIED | `overview-page.tsx` (105 lines) orchestrates 7 child components. All wired to BFF hooks via `fetchToolApi`. Automations module added in right column. TypeScript compiles clean. |
| 2 | Source switching updates every overview panel consistently (OVR-102, SC2) | ✓ VERIFIED | All hooks have `toolId` in useEffect deps: aggregates `[toolId, window]`, models `[toolId, window, sortBy]`, projects `[toolId, window]`, starred `[toolId]`, timeline `[toolId]`, capabilities `[toolId]`, automations `[toolId]`. No regressions. |
| 3 | Token-vs-cost ranking mode works where exposed by the UI (OVR-103, SC3) | ✓ VERIFIED (gap closed) | `top-models-table.tsx` (161 lines) has RANK BY toggle with TOKENS/COST buttons. Token mode: SESSIONS, TOKENS, SHARE columns. Cost mode: SESSIONS, COST column with em-dash for null. `useTopModels` hook accepts sortBy param, ingest validates sortBy (400 on invalid). `overview-page.tsx` manages `modelSortBy` state. Full data flow wired. |
| 4 | OpenClaw agents and automation modules appear only when capability metadata supports them (OVR-104, SC4) | ✓ VERIFIED (gap closed) | Agents module previously verified. `overview-automations.tsx` (190 lines) follows exact capability-gated pattern: checks `sourceCaps?.automations === true && toolId !== 'all'`. BFF proxy route (38 lines) with `assertSourceToolId`, returns empty for 'all'. Ingest endpoint (lines 534-596) queries sessions with `agent_name IS NOT NULL AND user_message_count = 0`. 4 test cases pass. |
| 5 | Loading, empty, error, and partial-data states preserve layout density and HUD copy tone (OVR-105, SC5) | ✓ VERIFIED | All 7 sections handle loading (Skeleton), empty (EmptyState), error (EmptyState/error border), partial data (em-dash values). New automations module handles capsLoading, automationsLoading, error, empty, data — all return wrapped container for grid stability. TopModelsTable renders toggle in all states. All copy ALL CAPS, no emoji. No `return null` or empty implementations. |

**Score:** 5/5 truths verified

### Gap Closure Detail

#### Gap 1: OVR-104 Automation Module (previously PARTIAL → VERIFIED)

| Check | Item | Status |
|-------|------|--------|
| Exists | `components/overview/overview-automations.tsx` (190 lines) | ✓ |
| Exists | `app/api/agent-tools/[tool]/overview/automations/route.ts` (38 lines) | ✓ |
| Exists | `types/overview.ts` AutomationSummary + AutomationsResponse (lines 131-141) | ✓ |
| Exists | `ingest/api/overview.ts` automations endpoint (lines 534-596) | ✓ |
| Exists | `lib/agent-tools/client-hooks.tsx` useOverviewAutomations hook (lines 1077-1097) | ✓ |
| Substantive | Component: capability gating, 5 states, AutomationCard grid | ✓ |
| Substantive | Endpoint: SQL with agent_name + user_message_count=0 heuristic | ✓ |
| Substantive | BFF: assertSourceToolId, 'all' returns empty array | ✓ |
| Wired | overview-page → overview-automations: import + JSX render (line 100) | ✓ |
| Wired | overview-automations → useOverviewAutomations: unconditional hook call | ✓ |
| Wired | useOverviewAutomations → fetchToolApi('/overview/automations') → BFF → ingest | ✓ |
| Data flow | `automations` state ← setAutomations(data.automations) ← fetchToolApi ← BFF ← ingest SQL | ✓ FLOWING |
| Tests | 4 new test cases, all 42 overview tests pass | ✓ |

#### Gap 2: OVR-103 Token/Cost Toggle (previously PARTIAL → VERIFIED)

| Check | Item | Status |
|-------|------|--------|
| Exists | `top-models-table.tsx` sortBy/onSortChange props (161 lines) | ✓ |
| Substantive | RANK BY toggle row with TOKENS/COST buttons, conditional columns | ✓ |
| Substantive | Cost mode renders em-dash for null cost values | ✓ |
| Substantive | Ingest validates sortBy (tokens\|cost), 400 on invalid | ✓ |
| Wired | overview-page modelSortBy state → useTopModels(toolId, window, modelSortBy) | ✓ |
| Wired | overview-page modelSortBy + setModelSortBy → TopModelsTable sortBy + onSortChange | ✓ |
| Wired | useTopModels fetch params include sortBy → BFF qs passes through → ingest reads sortBy | ✓ |
| Data flow | sortBy state → hook fetch param → BFF query string → ingest validation + sort | ✓ FLOWING |
| Regression | Token mode preserves SESSIONS, TOKENS, SHARE columns | ✓ |
| TypeScript | Compiles clean | ✓ |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `types/overview.ts` | Overview response types + AutomationSummary + AutomationsResponse | ✓ VERIFIED | 147 lines. All interfaces present including new automation types. |
| `lib/agent-tools/client-hooks.tsx` | 7 overview data hooks (6 + useOverviewAutomations) | ✓ VERIFIED | 1278 lines. useOverviewAutomations added at line 1077. useTopModels updated with sortBy param at line 924. |
| `components/overview/kpi-hero.tsx` | 4-column KPI grid | ✓ VERIFIED | Unchanged — regression check passed. |
| `components/overview/time-window-selector.tsx` | Three-tab selector | ✓ VERIFIED | Unchanged — regression check passed. |
| `components/overview/top-models-table.tsx` | Model ranking with RANK BY toggle | ✓ VERIFIED | 161 lines. Toggle, conditional columns, em-dash for null cost. |
| `components/overview/top-projects-table.tsx` | Project ranking with weight bars | ✓ VERIFIED | Unchanged — regression check passed. |
| `components/overview/starred-sessions.tsx` | Starred session list | ✓ VERIFIED | Unchanged — regression check passed. |
| `components/overview/activity-timeline.tsx` | Activity timeline with event dots | ✓ VERIFIED | Unchanged — regression check passed. |
| `components/overview/overview-agents.tsx` | Capability-gated agents | ✓ VERIFIED | Unchanged — regression check passed. |
| `components/overview/overview-automations.tsx` | Capability-gated automations | ✓ VERIFIED | 190 lines. NEW — capability gating matching agents pattern, all states handled. |
| `components/overview/overview-page.tsx` | Unified page orchestrator | ✓ VERIFIED | 105 lines. Updated: modelSortBy state, automations import + render in stacked right column. |
| `app/api/agent-tools/[tool]/overview/automations/route.ts` | BFF proxy for automations | ✓ VERIFIED | 38 lines. NEW — assertSourceToolId, 'all' returns empty. |
| `app/(tool-shell)/[tool]/dashboard/page.tsx` | Unified dashboard page | ✓ VERIFIED | 13 lines. Unchanged — regression check passed. |
| `ingest/api/overview.ts` | Ingest endpoints including automations | ✓ VERIFIED | Automations endpoint at section 8b (lines 534-596). sortBy validation and cost-aware sort (lines 122-203). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `page.tsx` | `OverviewPage` | import + JSX render | ✓ WIRED | Unchanged |
| `OverviewPage` | `KpiHero` | import + JSX + props | ✓ WIRED | Unchanged |
| `OverviewPage` | `TimeWindowSelector` | import + JSX + props | ✓ WIRED | Unchanged |
| `OverviewPage` | `TopModelsTable` | import + JSX + props | ✓ WIRED | Updated: sortBy + onSortChange props added |
| `OverviewPage` | `TopProjectsTable` | import + JSX + props | ✓ WIRED | Unchanged |
| `OverviewPage` | `StarredSessions` | import + JSX + props | ✓ WIRED | Unchanged |
| `OverviewPage` | `ActivityTimeline` | import + JSX + props | ✓ WIRED | Unchanged |
| `OverviewPage` | `OverviewAgents` | import + JSX + props | ✓ WIRED | Unchanged |
| `OverviewPage` | `OverviewAutomations` | import + JSX + props | ✓ WIRED | NEW: line 20 import, line 100 render |
| `OverviewAutomations` | `useOverviewAutomations` | hook call | ✓ WIRED | NEW: unconditional call at line 114 |
| `useOverviewAutomations` | `fetchToolApi` | internal call | ✓ WIRED | NEW: fetchToolApi(toolId, '/overview/automations') |
| `fetchToolApi` | BFF automations route | HTTP fetch | ✓ WIRED | NEW: /api/agent-tools/${toolId}/overview/automations |
| BFF automations route | Ingest automations endpoint | fetchIngest proxy | ✓ WIRED | NEW: /api/v1/overview/automations?source=${toolId} |
| `useTopModels` | BFF top-models route | fetchToolApi with sortBy | ✓ WIRED | Updated: sortBy in fetch params and dep array |
| BFF top-models route | Ingest top-models endpoint | fetchIngest with qs | ✓ WIRED | qs includes sortBy from frontend |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `KpiHero` | `aggregates` | useOverviewAggregates → BFF → ingest | ✓ DB query | ✓ FLOWING |
| `TopModelsTable` | `models` | useTopModels → BFF → ingest (with sortBy) | ✓ DB query with validation | ✓ FLOWING |
| `TopProjectsTable` | `projects` | useTopProjects → BFF → ingest | ✓ DB query | ✓ FLOWING |
| `StarredSessions` | `starred` | useStarredSessions → BFF → ingest | ✓ DB query | ✓ FLOWING |
| `ActivityTimeline` | `timeline` | useTimeline → BFF → ingest | ✓ DB query | ✓ FLOWING |
| `OverviewAgents` | `agents` | useToolAgents → BFF → ingest | ✓ DB query | ✓ FLOWING |
| `OverviewAutomations` | `automations` | useOverviewAutomations → BFF → ingest | ✓ DB query (agent_name + user_message_count=0) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles | `npx tsc --noEmit` | No output (clean) | ✓ PASS |
| All overview tests pass | `npx vitest run ingest/api/overview.test.ts` | 42/42 passed (1.13s) | ✓ PASS |

Step 7b: Additional spot-checks SKIPPED (no runnable entry points without running dev server)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| OVR-101 | 12-01, 12-02, 12-04 | Overview v2 from real BFF data with all sections | ✓ SATISFIED | All 7 sections implemented (KPI, models, projects, starred, timeline, agents, automations), wired to BFF hooks |
| OVR-102 | 12-01, 12-03 | Source scoping for rankings, starred, timeline | ✓ SATISFIED | All hooks have toolId in deps, BFF routes map toolId to source param |
| OVR-103 | 12-01, 12-05 | Token-vs-cost ranking switch | ✓ SATISFIED | RANK BY toggle in top-models-table, sortBy validated end-to-end through ingest → BFF → hook → component |
| OVR-104 | 12-02, 12-04 | Capability-gated agents and automation modules | ✓ SATISFIED | Both agents and automations modules fully implemented with identical capability-gating pattern |
| OVR-105 | 12-03 | Loading/empty/error states preserve layout | ✓ SATISFIED | All 7 sections handle all states with grid stability; new modules follow established patterns |

### Anti-Patterns Found

No anti-patterns detected in gap closure files:
- No `return null`, `return <></>`, `return []` in any overview component
- No TODO/FIXME/PLACEHOLDER/HACK/console.log in modified files
- No hardcoded empty data flowing to rendering
- No stub implementations

### Human Verification Required

### 1. Visual rendering of overview dashboard

**Test:** Navigate to `/openclaw/dashboard` with ingest running and sessions present. Verify KPI hero shows real numbers, ranking tables show model/project data with RANK BY toggle, timeline shows colored event dots, starred section shows sessions, agents and automations sections appear.
**Expected:** All sections populate with real data; layout is dense and HUD-styled. Automations module appears below agents in right column.
**Why human:** Cannot verify visual layout, typography, color rendering, or HUD styling programmatically.

### 2. Source switching behavior

**Test:** Switch between `all`, `openclaw`, `claude-code`, and `codex` using the source switcher. Observe all panels updating.
**Expected:** All 7 overview sections re-fetch and update. Agents and automations sections show "N/A" for non-OpenClaw sources and "all" scope.
**Why human:** Requires running dev server and visual observation of state transitions.

### 3. Token/cost toggle behavior

**Test:** Click RANK BY toggle in top models section. Switch between TOKENS and COST modes.
**Expected:** Token mode shows SESSIONS, TOKENS, SHARE columns. Cost mode shows SESSIONS, COST columns with em-dash (—) values. Toggle persists across source switches and time window changes. No layout shift on toggle.
**Why human:** Toggle behavior and layout stability require visual inspection.

### 4. Light/dark theme rendering

**Test:** Toggle between light and dark themes. Verify all overview sections render correctly in both themes including automations module and toggle.
**Expected:** No invisible text, borders, or backgrounds. Accent color renders correctly. Toggle buttons visible in both themes.
**Why human:** Visual theme compatibility requires visual inspection.

### Gaps Summary

**All gaps closed.** Both previously identified gaps have been fully addressed:

1. **OVR-104 Automation Module (CLOSED):** Full-stack implementation — ingest endpoint with agent_name + user_message_count=0 heuristic, BFF proxy with source-specific routing, useOverviewAutomations hook, and OverviewAutomations component with capability gating matching the agents module pattern exactly. Integrated into overview page right column stacked below agents.

2. **OVR-103 Token/Cost Toggle (CLOSED):** End-to-end wiring — ingest validates sortBy (tokens|cost) with 400 on invalid and applies cost-aware sort with nulls-last, useTopModels hook accepts sortBy parameter in fetch and dependency array, TopModelsTable has RANK BY toggle with TOKENS/COST buttons using hud-clip-sm active style, overview-page manages modelSortBy state. Cost column renders em-dash for null values.

**Regression check:** All 3 previously-passed truths (OVR-101, OVR-102, OVR-105) remain intact. No anti-patterns introduced. TypeScript compiles clean. All 42 overview tests pass.

---

_Verified: 2026-05-16T11:00:00Z_
_Verifier: the agent (gsd-verifier)_
