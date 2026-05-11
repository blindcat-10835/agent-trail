# Phase 12: Overview v2 Real Data - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current dashboard overview with the prototype-aligned HUD overview powered by live ingest aggregates from Phase 10's BFF endpoints. The deliverable is a redesigned Overview page that renders KPI hero, usage/cost rows, top models, starred sessions, activity timeline, top projects, and source-specific modules (agents, automations) from real BFF-backed data.

Covers: OVR-101, OVR-102, OVR-103, OVR-104, OVR-105.

</domain>

<decisions>
## Implementation Decisions

### Data Flow
- Overview components fetch data via BFF routes `/api/agent-tools/[tool]/overview/...` created in Phase 10
- Use existing `lib/agent-tools/client-adapter.ts` pattern for data fetching
- Source scoping: use current `[tool]` route param to scope all overview panels
- Loading states: skeleton components matching shadcn/ui patterns
- Error states: terse HUD copy ("INGEST OFFLINE", "NO DATA")

### Overview Layout
- KPI hero bar at top (session count, turn count, token totals, project count)
- Usage/cost section with time window selector (today / 7d / 30d)
- Top models ranking table with token/cost toggle (OVR-103)
- Top projects ranking table
- Starred sessions section (from Phase 10 starred endpoint)
- Activity timeline (mixed events from Phase 10 timeline endpoint)
- Source-specific modules: agents section (OpenClaw only), automations (OpenClaw only)

### Source Capability Awareness (OVR-104)
- Fetch capabilities from `/api/agent-tools/[tool]/overview/capabilities`
- Conditionally render agents/automations modules based on capability metadata
- All sources show: KPI, usage/cost, top models, top projects, starred, timeline
- OpenClaw additionally shows: agents, automations

### States (OVR-105)
- Loading: skeleton placeholders matching layout density
- Empty: em-dash `—` placeholders, terse HUD copy
- Partial data: show what's available, `—` for missing
- Error: "INGEST OFFLINE" or "NO SESSIONS" with retry prompt

### the agent's Discretion
- Exact component file organization
- Chart vs. table for rankings
- Time window selector UI (tabs vs. dropdown)
- Timeline entry rendering format

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/(tool-shell)/[tool]/dashboard/page.tsx` — current dashboard page
- `app/(tool-shell)/[tool]/dashboard/openclaw-dashboard.tsx` — current OpenClaw dashboard
- `app/(tool-shell)/[tool]/dashboard/session-stats-dashboard.tsx` — session stats
- `components/dashboard/` — agent-avatar, agent-card, empty-state
- `components/sessions/sessions-stats-bar.tsx` — existing stats bar
- BFF endpoints from Phase 10: overview/aggregates, top-models, top-projects, timeline, starred, agents, capabilities, status
- `lib/agent-tools/client-adapter.ts` — data fetching pattern
- `stores/` — Zustand stores

### Established Patterns
- Server components with BFF fetch for data
- Client components for interactive elements
- shadcn/ui Card, Badge, Skeleton components
- Tailwind v4 tokens for all colors
- HUD clip utilities for branded elements

</code_context>

<specifics>
## Specific Ideas

- Design reference: `.planning/designs/design-notes.md` Overview section
- KPI hero uses mono nums with tabular-nums
- All section headings: ALL CAPS + tracking
- Em-dash `—` for empty values
- No emoji in UI strings
- Loading skeletons should preserve layout density
- Source switching must update ALL panels simultaneously

</specifics>

<deferred>
## Deferred Ideas

- Sessions table redesign (Phase 13)
- Session detail redesign (Phase 13)
- Playwright tests (Phase 14)
- Dark/light visual verification (Phase 14)

</deferred>
