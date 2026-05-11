---
wave: 3
depends_on: [phase-12-02]
files_modified:
  - components/overview/kpi-hero.tsx
  - components/overview/top-models-table.tsx
  - components/overview/top-projects-table.tsx
  - components/overview/starred-sessions.tsx
  - components/overview/activity-timeline.tsx
  - components/overview/overview-page.tsx
  - app/(tool-shell)/[tool]/dashboard/page.tsx
autonomous: true
---

# Phase 12 Plan 03: States Polish + Source Switch + Integration Verify

## Context

Wave 3 polishes all loading/empty/error states to meet OVR-105 requirements, verifies source switching updates all panels simultaneously (OVR-102), and ensures light/dark theme compatibility. This is a refinement pass over the Wave 1+2 output.

## Tasks

### Task 1: Verify and polish loading/empty/error states

<read_first>
  - components/overview/overview-page.tsx
  - components/overview/kpi-hero.tsx
  - components/overview/top-models-table.tsx
  - components/overview/top-projects-table.tsx
  - components/overview/starred-sessions.tsx
  - components/overview/activity-timeline.tsx
  - components/overview/overview-agents.tsx
</read_first>

Audit and fix all state handling to ensure:

1. **Loading states** use `Skeleton` components matching layout density — no spinners except for initial full-page load
2. **Empty states** use em-dash `—` for individual values, `EmptyState` component for empty sections
3. **Partial data** — show what's available, `—` for missing. No section should disappear when data is partially available
4. **Error states** — "INGEST OFFLINE" for connection errors, "NO SESSIONS" for empty data. Terse HUD copy, no emoji
5. **Layout stability** — loading/empty/error states must NOT cause layout shift. All sections maintain their grid position

```xml
<action file="components/overview/overview-page.tsx" verb="edit">
Verify the overview-page orchestrator:
- Each section independently handles loading/empty/error
- Full-page spinner only on very first load (aggregatesLoading && !aggregates)
- After first load, individual sections show their own Skeleton/empty/error
- No layout shift between states
</action>
```

Specific checks per component:
- **kpi-hero**: Skeleton tiles when loading, em-dash values when null
- **top-models-table**: Skeleton rows when loading, EmptyState when empty, error message when error
- **top-projects-table**: Same as top-models-table
- **starred-sessions**: Skeleton rows when loading, EmptyState when empty (not an error)
- **activity-timeline**: Skeleton rows when loading, EmptyState when empty
- **overview-agents**: null render when not applicable, Skeleton when loading applicable

<acceptance_criteria>
- All sections have correct loading/empty/error states
- No layout shift between state transitions
- No spinners except initial full-page load
- Em-dash for empty values in KPI tiles
- Terse HUD copy in all error messages (ALL CAPS, no emoji)
</acceptance_criteria>

### Task 2: Verify source switching updates all panels

<read_first>
  - components/overview/overview-page.tsx
  - lib/agent-tools/client-hooks.tsx (all overview hooks)
  - app/(tool-shell)/[tool]/dashboard/page.tsx
</read_first>

Verify that when the user switches source (e.g. from "all" to "openclaw"), ALL overview panels update simultaneously:

1. All hooks depend on `toolId` from `useAgentTool()` — verify this is in the dependency arrays
2. When `toolId` changes, all hooks should re-fetch with the new tool ID
3. Loading states should appear on all panels during the switch
4. Agents module should appear/disappear based on capabilities for the new source
5. Starred sessions and timeline should update with source-scoped data

```xml
<action file="components/overview/overview-page.tsx" verb="edit">
If needed, ensure that all hooks properly reset on toolId change.
Verify useOverviewCapabilities is called so that runtime capabilities
refresh when toolId changes (even though the endpoint is global, the
hook should still re-fetch to ensure fresh data).
</action>
```

Specific checks:
- `useOverviewAggregates(toolId, window)` — `toolId` in deps → re-fetches
- `useTopModels(toolId, window)` — `toolId` in deps → re-fetches
- `useTopProjects(toolId, window)` — `toolId` in deps → re-fetches
- `useStarredSessions(toolId)` — `toolId` in deps → re-fetches
- `useTimeline(toolId)` — `toolId` in deps → re-fetches
- `useOverviewCapabilities(toolId)` — re-fetches on toolId change

<acceptance_criteria>
- Source switch triggers re-fetch on ALL overview hooks
- All panels show loading state during switch
- Agents module appears/disappears correctly
- Starred/timeline data updates for new source scope
</acceptance_criteria>

### Task 3: Verify light/dark theme compatibility

<read_first>
  - app/globals.css (theme tokens)
  - components/overview/overview-page.tsx
  - All components/overview/*.tsx files
</read_first>

Audit all overview components for theme compatibility:

1. All colors use semantic tokens (`text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`, `text-accent`, `text-destructive`) — no hardcoded hex/rgb/oklch values
2. Accent color (`bg-accent`, `text-accent`) renders correctly in both themes
3. Skeleton components use default Skeleton styling (theme-aware)
4. Badge component uses theme-aware variants
5. HUD clip paths render correctly (they're shape-based, not color-based)

Check each component for hardcoded colors:
```xml
<action pattern="verify-all" verb="audit">
Search all components/overview/*.tsx for:
- Any hex colors (#xxx, #xxxxxx)
- Any rgb()/rgba() values
- Any oklch() values outside of inline style objects (which are OK for status dots)
- Any non-token color references

Replace any found with semantic Tailwind tokens.
</action>
```

<acceptance_criteria>
- No hardcoded color values in overview components (except inline status dot colors which use CSS variables)
- All colors reference Tailwind semantic tokens
- Visual spot-check: light and dark themes both render cleanly (no invisible text/borders)
- Build passes, lint clean
</acceptance_criteria>

### Task 4: Build and lint verification

<read_first>
  - All files modified in Phase 12
</read_first>

Run full build and lint:

```xml
<action verb="run" command="pnpm build">
Verify Next.js build succeeds with no errors.
</action>

<action verb="run" command="pnpm lint">
Verify ESLint passes with no errors in overview files.
</action>
```

Fix any issues found.

<acceptance_criteria>
- `pnpm build` succeeds
- `pnpm lint` passes
- No TypeScript errors
- No console warnings from new components
</acceptance_criteria>
