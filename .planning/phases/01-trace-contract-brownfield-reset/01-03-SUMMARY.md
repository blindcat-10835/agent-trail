---
phase: 01-trace-contract-brownfield-reset
plan: 03
title: Document Preserved Capabilities
subsystem: documentation
tags: [brownfield-reset, capabilities-audit, preservation]
completed_date: 2026-05-06
duration_seconds: 1800
---

# Phase 01 Plan 03: Document Preserved Capabilities - Summary

**One-liner:** Comprehensive audit of 12 existing OpenClaw overview capabilities categorized by data source (Gateway-exclusive vs file-replaceable) with Phase 4 migration guidance.

---

## Completion Status

**Tasks:** 2/2 completed
**Deviations:** None - plan executed exactly as written
**Authentication gates:** None

---

## Deliverables

### Artifacts Created

1. **docs/preserved-capabilities.md** (422 lines)
   - Gateway-Exclusive Capabilities section (6 capabilities)
   - File-Replaceable Capabilities section (6 capabilities)
   - Dependency Mapping Table (12 capabilities mapped to data sources and preservation strategies)
   - Phase 4 Migration Notes (components at risk, refactoring guidance)
   - References section linking to component implementations and requirements

### Verification Results

All acceptance criteria met:
- ✓ Document exists at `docs/preserved-capabilities.md`
- ✓ Contains "## Gateway-Exclusive Capabilities" section
- ✓ Contains "## File-Replaceable Capabilities" section
- ✓ Contains capability mapping table with 12 rows
- ✓ Contains "## Phase 4 Migration Notes" section
- ✓ 32 "Gateway-exclusive" mentions (requirement: >= 3)
- ✓ 4 "File-replaceable" mentions (requirement: >= 3)
- ✓ 422 total lines (requirement: >= 80 lines)
- ✓ 18 heading sections

---

## Capability Inventory

### Gateway-Exclusive Capabilities (6)

1. **Agent Live Status** — Real-time agent state (working, tool_calling, speaking, idle, error) with live status indicators
2. **Gateway Connection Health** — WebSocket connection state (connecting, connected, reconnecting, disconnected, error)
3. **Real-time Activity Stream** — Live event feed showing Gateway-wide activity events with streaming updates
4. **Active Session Monitor** — Currently active sessions with live updates and status tracking
5. **Per-Agent Event Feed** — Agent-specific event logs and activity stream in agent detail drawer
6. **Agent Tool Execution Display** — Shows current tool being executed by each agent in real-time

**Preservation strategy:** All preserved but isolated — no changes in Phase 1, may be re-evaluated with Gateway in future phases.

### File-Replaceable Capabilities (6)

1. **Sessions List** — Historical and active session browsing with filtering, search, and metadata display
2. **KPI/Metrics Dashboard** — Aggregated metrics (fleet status, active sessions, token usage, cost tracking, error counts)
3. **Skills Inventory** — List of available skills with metadata (name, description, icon, version, author, enabled status)
4. **Cron Jobs** — Scheduled tasks with schedule information, enabled status, and last/next run times
5. **Activity History** — Past activity events, error logs, and cron job runs with timestamps and severity levels
6. **Usage Provider Info** — Per-provider usage information including token counts, cost estimates, plan details, and usage windows

**Migration target:** All will be served by ingest API in Phase 2-4.

---

## Components Identified as At-Risk for Phase 4 Migration

### High Priority

1. **OverviewTab** (`components/dashboard/overview-tab.tsx`)
   - **Risk:** Mixes Gateway and file data sources extensively
   - **Refactoring needed:** Split session data source (active from Gateway, historical from ingest), migrate usageDetail/cronTasks/activity logs to ingest API, maintain Gateway-exclusive data from Gateway store
   - **Complexity:** High

2. **DashboardKpiBar** (`components/dashboard/dashboard-kpi-bar.tsx`)
   - **Risk:** Mixes Gateway agent data with file-replaceable usage metrics
   - **Refactoring needed:** Keep agent KPIs from Gateway, migrate TOKENS/cost KPIs to ingest API
   - **Complexity:** Medium

### Medium Priority

3. **AgentCard / OverviewAgentCard**
   - **Risk:** Assumes agent data always comes from Gateway store
   - **Refactoring needed:** Add dual-status support (ingestStatus + gatewayStatus per D-14), show disconnected state, fallback to ingest agent metadata
   - **Complexity:** Medium

### Migration Complexity Assessment

**Overall complexity:** Medium

**Rationale:** Most capabilities are cleanly separated by data source. The main complexity is in the OverviewTab component which mixes multiple data sources (agents from Gateway, sessions from mixed sources, usage/cron/activity from files). This will require careful refactoring in Phase 4 to maintain functionality while migrating to ingest API.

---

## Key Findings

### Ambiguities Discovered

None. All capabilities could be clearly categorized as either Gateway-exclusive or file-replaceable based on their data dependencies. The distinction was straightforward:
- Gateway-exclusive: Requires real-time WebSocket event stream
- File-replaceable: Can be reconstructed from static session/config files

### Requirement Traceability

The document directly addresses the following requirements from `.planning/REQUIREMENTS.md`:

- **OPEN-01**: OpenClaw dashboard 保留并增强现有 overview：Agent 状态、Gateway 状态、KPI、sessions、skills、cron、activity、usage
  - ✓ Documented all 8 overview capability categories
  - ✓ Preserved existing implementations in current codebase

- **OPEN-02**: OpenClaw live Gateway 数据和 ingest 历史 session 通过 session key/session id 做 best-effort link
  - ✓ Identified sessions as hybrid capability (active from Gateway, historical from ingest)
  - ✓ Documented linking strategy in Phase 4 migration notes

- **OPEN-03**: OpenClaw 无 Gateway 或 ingest 未启动时仍显示明确状态，不把 loading 当成永久空白
  - ✓ Documented Gateway-disconnected state handling requirements
  - ✓ Added explicit error state guidance in Phase 4 migration notes

- **FOUND-04**: 保留现有 OpenClaw Gateway live overview 能力，避免改造期间丢失已完成的 Agent/KPI/Sessions/Cron/Skills/Activity 信息
  - ✓ Comprehensive inventory of all existing overview capabilities
  - ✓ Clear preservation strategy for each capability

---

## Technical Insights

### Data Source Architecture

The audit revealed a clean separation between two data planes:

1. **Real-time data plane** (Gateway WebSocket):
   - Ephemeral runtime state (agent status, current tool, connection state)
   - Live event streams (activity feed, agent events)
   - No persistence to session files
   - Cannot be replaced by file parsing

2. **Historical data plane** (local files):
   - Session metadata and content (JSONL files)
   - Configuration data (skills, cron jobs)
   - Activity logs (log files)
   - Usage metrics (session usage fields)
   - Can be parsed and indexed by ingest service

### Dual-Status Model (D-14)

The document captures decision D-14 from Phase 1 context:
- Each source has `ingestStatus` (installed/configured/empty/indexing/error/parser-warning)
- Each source may have `gatewayStatus` (connected/disconnected/connecting/error) if it supports Gateway
- OpenClaw has both statuses; Claude Code / Codex only have ingestStatus
- UI must display both status indicators for OpenClaw

### Hybrid Capabilities

Some capabilities span both data planes:
- **Sessions**: Active sessions from Gateway, historical sessions from ingest (best-effort link by session key)
- **Tool execution**: Current tool from Gateway (ephemeral), historical tool calls from ingest (session replay)
- **Activity**: Real-time stream from Gateway, historical logs from ingest

This hybrid model aligns with OPEN-02's "best-effort link" requirement.

---

## Next Steps for Plan 04

Plan 04 (Documentation Brownfield Reset) should:

1. **Rename project semantics** per D-09:
   - Update PROJECT.md, AGENTS.md to use "agent-tracing-dashboard" terminology
   - Update page visible copy (header titles, navigation labels)
   - Keep component names, routes, directory structure unchanged (deferred to Phase 4)

2. **Clean up old planning artifacts** per D-10:
   - Delete all legacy `.planning/phases/` files from OVAO
   - Delete `.planning/debug/`, `.planning/quick/`, `.planning/ui-reviews/`
   - Retain only new Phase 1 structure

3. **Preserve HUD design language** per D-11:
   - Document cyberpunk HUD design tokens (glow, scanline, monospace, dark-first)
   - Ensure no accidental removal of `app/globals.css` @theme inline block
   - Verify shadcn/ui `radix-nova` preset is maintained

4. **Verify no capability loss**:
   - Use `docs/preserved-capabilities.md` as checklist
   - Confirm all 12 capabilities are still documented or preserved in code
   - Ensure no components are deleted that implement documented capabilities

---

## Deviations from Plan

**None** - plan executed exactly as written with all tasks completed and acceptance criteria met.

---

## Commits

| Commit | Hash | Message |
|--------|------|---------|
| 1 | 3a67def | docs(01-03): document preserved OpenClaw overview capabilities |

---

## Self-Check

- [x] docs/preserved-capabilities.md exists and is readable
- [x] File contains >= 80 lines (actual: 422 lines)
- [x] File contains Gateway-Exclusive Capabilities section
- [x] File contains File-Replaceable Capabilities section
- [x] File contains dependency mapping table with 12 rows
- [x] File contains Phase 4 Migration Notes section
- [x] Commit 3a67def exists in git history
- [x] All acceptance criteria from plan met
- [x] No authentication gates encountered
- [x] No deviations from plan

---

**Plan Status:** COMPLETE
**Next Plan:** 01-04 - Documentation Brownfield Reset
**Phase Progress:** 3/4 plans complete

---

*Summary created: 2026-05-06*
*Execution time: 30 minutes*
*Commits: 1*
