# Preserved Capabilities - OpenClaw Overview

**Last updated:** 2026-05-06
**Phase:** 1 - Trace Contract & Brownfield Reset
**Purpose:** Audit trail of existing OpenClaw overview capabilities to ensure preservation during brownfield reset

**Note:** This document is part of Phase 1 brownfield reset from OVAO (OpenClaw Visual Agents Office) to agent-tracing-dashboard (multi-source tracing dashboard).

---

## Overview

This document tracks all current OpenClaw overview capabilities that existed in the OVAO (OpenClaw Visual Agents Office) dashboard prior to the brownfield reset to agent-tracing-dashboard. The goal is to ensure no working features are accidentally removed during the migration.

### Preservation Strategy

Capabilities are categorized by their data dependency:

- **Gateway-Exclusive**: Requires real-time OpenClaw Gateway WebSocket connection. These capabilities are "preserved but isolated" — no changes in Phase 1, may be re-evaluated with Gateway in future phases.
- **File-Replaceable**: Can work with parsed session data from the ingest service. These capabilities will be migrated to use the ingest API in Phase 2-4.

### Requirement Traceability

This document addresses the following requirements from `.planning/REQUIREMENTS.md`:

- **OPEN-01**: OpenClaw dashboard 保留并增强现有 overview：Agent 状态、Gateway 状态、KPI、sessions、skills、cron、activity、usage
- **OPEN-02**: OpenClaw live Gateway 数据和 ingest 历史 session 通过 session key/session id 做 best-effort link
- **OPEN-03**: OpenClaw 无 Gateway 或 ingest 未启动时仍显示明确状态

---

## Gateway-Exclusive Capabilities

These capabilities require real-time data from the OpenClaw Gateway WebSocket connection. They cannot be replaced by file-based session parsing.

### 1. Agent Live Status

**What it does:** Displays real-time status of all registered agents (working, tool_calling, speaking, idle, error) with live status indicators and animated pulse effects.

**Current Implementation:**
- `components/dashboard/overview-tab.tsx` — Agent grid with status badges
- `components/dashboard/overview/agent-card.tsx` — Per-agent status display
- `components/dashboard/agent-card.tsx` — Tab view agent cards
- `components/dashboard/dashboard-kpi-bar.tsx` — Agent status KPI strip
- Data source: `useGatewayStore((s) => s.agents)` — Map of agent IDs to AgentInfo objects
- Type: `AgentInfo` from `stores/gateway/gateway-store.ts`

**Why it's Gateway-exclusive:**
- Requires real-time WebSocket event stream from Gateway
- Status changes are pushed via Gateway events (AgentEventPayload with stream: "lifecycle")
- Live status indicator (animated pulse) depends on continuous Gateway connection
- Agent state transitions (idle → working → tool_calling) are ephemeral events not persisted to session files

**Preservation strategy:** Preserved but isolated — no changes in Phase 1, may be re-evaluated with Gateway in future phases.

---

### 2. Gateway Connection Health

**What it does:** Shows Gateway WebSocket connection state (connecting, connected, reconnecting, disconnected, error) and handles reconnection logic.

**Current Implementation:**
- `components/hud/gateway-bootstrap.tsx` — Gateway connection bootstrap component
- `gateway/ws-client.ts` — WebSocket client with reconnection logic
- `gateway/rpc-client.ts` — RPC client over WebSocket
- Type: `ConnectionStatus` from `gateway/types.ts`

**Why it's Gateway-exclusive:**
- Manages WebSocket connection lifecycle (connect, disconnect, reconnect)
- Displays connection state in UI (e.g., "GATEWAY › WORKSPACE:DEFAULT › AGENTS" breadcrumb)
- Requires real-time connection state from WebSocket API

**Preservation strategy:** Preserved but isolated — no changes in Phase 1, may be re-evaluated with Gateway in future phases.

---

### 3. Real-time Activity Stream

**What it does:** Live event feed showing Gateway-wide activity events (agent lifecycle events, tool calls, assistant responses, errors) with streaming updates.

**Current Implementation:**
- `components/dashboard/overview-tab.tsx` — "ACTIVITY · RECENT" section with live event feed
- Data source: `useGatewayStore((s) => s.globalEventFeed)` — Array of recent events
- Event display: Color-coded by level (error, warn, info) and source (cron, config)
- Type: `LogEntry` from `types/activity.ts`

**Why it's Gateway-exclusive:**
- Events are pushed in real-time via Gateway WebSocket events
- Activity feed shows "live" events with timestamps and age calculation
- Event buffer (100 events max) is maintained in Gateway store, not in session files
- Real-time event feed cannot be reconstructed from historical session files

**Preservation strategy:** Preserved but isolated — no changes in Phase 1, may be re-evaluated with Gateway in future phases.

---

### 4. Active Session Monitor

**What it does:** Displays currently active sessions with live updates, including session status (active, idle, aborted), last message preview, and model information.

**Current Implementation:**
- `components/dashboard/overview-tab.tsx` — "SESSIONS" section with active session list
- `components/sessions/sessions-detail-rail.tsx` — Session detail drawer
- Data source: `useGatewayStore((s) => s.sessions)` — Array of SessionInfo objects
- Active detection: `updatedAt && (Date.now() - s.updatedAt) < 300000 && !s.aborted`
- Type: `SessionInfo` from `gateway/adapter-types.ts`

**Why it's Gateway-exclusive:**
- Requires real-time session updates from Gateway WebSocket events
- Active session detection depends on live `updatedAt` timestamps
- Session list shows "active now" count that updates in real-time
- Session lifecycle events (created, updated, aborted) are Gateway events

**Preservation strategy:** Preserved but isolated — no changes in Phase 1, may be re-evaluated with Gateway in future phases. Note: Historical sessions will be served by ingest API in Phase 2-4 (per OPEN-02).

---

### 5. Per-Agent Event Feed

**What it does:** Shows agent-specific event logs and activity stream in agent detail drawer, including lifecycle events, tool calls, and errors.

**Current Implementation:**
- `components/dashboard/overview/agent-drawer.tsx` — Agent detail drawer with logs and events
- Data source: `useGatewayStore((s) => s.agentLogs[agent.id])` — Per-agent log array
- Type: Array of log entries from agent-specific event stream

**Why it's Gateway-exclusive:**
- Agent-specific events are pushed via Gateway WebSocket with agentId filtering
- Event feed is real-time and shows recent activity (last 10 events)
- Cannot be reconstructed from historical session files (ephemeral runtime events)

**Preservation strategy:** Preserved but isolated — no changes in Phase 1, may be re-evaluated with Gateway in future phases.

---

### 6. Agent Tool Execution Display

**What it does:** Shows current tool being executed by each agent (e.g., "▸ tool_name") in agent cards and overview.

**Current Implementation:**
- `components/dashboard/overview-tab.tsx` — Tool display in agent cards
- `components/dashboard/agent-card.tsx` — Tool row with "▸ awaiting dispatch" fallback
- Data source: `agent.currentTool` field from AgentInfo
- Type: `AgentInfo.currentTool?: string`

**Why it's Gateway-exclusive:**
- Current tool is ephemeral runtime state from Gateway agent events
- Tool execution state (currentTool) is not persisted to session files
- Real-time tool execution status requires live Gateway connection

**Preservation strategy:** Preserved but isolated — no changes in Phase 1, may be re-evaluated with Gateway in future phases. Note: Historical tool calls will be available in session replay via ingest API (Phase 2-4).

---

## File-Replaceable Capabilities

These capabilities can work with static data from parsed session files. They will be migrated to use the ingest API in Phase 2-4.

### 1. Sessions List

**What it does:** Browsable list of historical and active sessions with filtering, search, and metadata display (label, model, status, time ago, last message).

**Current Implementation:**
- `components/dashboard/overview-tab.tsx` — "SESSIONS" section
- `components/sessions/sessions-detail-rail.tsx` — Session detail drawer
- Data source: `useGatewayStore((s) => s.sessions)` — Currently from Gateway
- Type: `SessionInfo` from `gateway/adapter-types.ts`
- Fields: key, label, displayName, updatedAt, model, totalTokens, cost, lastMessage, aborted

**Why it's file-replaceable:**
- Session metadata can be parsed from OpenClaw JSONL session files
- Historical sessions are stored in local files, not just in Gateway memory
- Session list can be reconstructed from parsed session headers
- Can be served by ingest API with SQLite indexing (Phase 2)

**Migration target:** Will be served by ingest API in Phase 2-4. Ingest service will scan local OpenClaw session directories, parse session files, and provide REST API for sessions list.

---

### 2. KPI/Metrics Dashboard

**What it does:** Displays aggregated metrics including fleet status, active session count, token usage (in/out), cost tracking (24h spend), and error counts.

**Current Implementation:**
- `components/dashboard/overview-tab.tsx` — Hero stat tiles (FLEET STATUS, SESSIONS ACT, SPEND · 24H, ACTIVITY · ERRORS)
- `components/dashboard/dashboard-kpi-bar.tsx` — KPI strip (ACTIVE, WORKING, TOOL EXEC, ERRORS, TOKENS, EVT BUF)
- Data source: `useGatewayStore((s) => s.usageDetail)` — Usage provider info
- Type: `UsageProviderInfo`, `UsageProviderWindow` from `gateway/adapter-types.ts`

**Why it's file-replaceable:**
- Token usage and cost are stored in session files (usage metadata)
- Aggregated metrics can be computed from parsed session data
- Historical KPIs can be calculated from ingest service SQLite database
- No real-time streaming required for historical metrics

**Migration target:** Will be served by ingest API in Phase 2-4. Ingest service will aggregate metrics from parsed sessions and provide KPI endpoints.

---

### 3. Skills Inventory

**What it does:** Lists available skills with metadata (name, description, icon, version, author, enabled status).

**Current Implementation:**
- `components/dashboard/overview-tab.tsx` — "SKILLS" section in overview
- `components/dashboard/skills-tab.tsx` — Dedicated skills tab page
- Data source: `useGatewayStore((s) => s.skills)` — Array of SkillInfo objects
- Type: `SkillInfo` from `gateway/adapter-types.ts`
- Fields: id, slug, name, description, enabled, icon, version, author

**Why it's file-replaceable:**
- Skill definitions are static configuration, not real-time data
- Skills list can be read from OpenClaw configuration files
- No WebSocket streaming required for skill inventory
- Can be parsed from local config or served by ingest API

**Migration target:** Will be served by ingest API in Phase 2-4. Ingest service will parse skill definitions from OpenClaw config and provide skills endpoint.

---

### 4. Cron Jobs

**What it does:** Displays scheduled cron tasks with schedule information (at, every, cron expression), enabled status, and last/next run times.

**Current Implementation:**
- `components/dashboard/overview-tab.tsx` — "CRON · SCHEDULED" section
- `components/dashboard/overview/cron-drawer.tsx` — Cron detail drawer with run history
- Data source: `useGatewayStore((s) => s.cronTasks)` — Array of CronTask objects
- Type: `CronTask`, `CronSchedule`, `CronJobState` from `gateway/adapter-types.ts`
- Fields: id, name, description, schedule (kind, at, everyMs, expr, tz), enabled, state (nextRunAtMs, lastRunAtMs, lastRunStatus)

**Why it's file-replaceable:**
- Cron job definitions are static configuration
- Cron schedule and state can be read from OpenClaw config files
- No real-time streaming required for cron inventory
- Run history can be parsed from activity logs

**Migration target:** Will be served by ingest API in Phase 2-4. Ingest service will parse cron definitions and run history from local files.

---

### 5. Activity History

**What it does:** Shows past activity events, error logs, and cron job runs with timestamps, severity levels, and source attribution.

**Current Implementation:**
- `components/dashboard/overview-tab.tsx` — "ACTIVITY · RECENT" section
- API endpoint: `/api/logs` — Fetches activity log entries
- Type: `LogEntry` from `types/activity.ts`
- Fields: id, ts (timestamp), level (error, warn, info), summary, source (cron, config), jobId

**Why it's file-replaceable:**
- Activity logs are stored in local log files
- Historical activity can be parsed from log files
- No real-time streaming required for historical activity
- Can be indexed by ingest service for search and filtering

**Migration target:** Will be served by ingest API in Phase 2-4. Ingest service will parse activity logs and provide search/filter endpoints.

---

### 6. Usage Provider Info

**What it does:** Displays per-provider usage information including token counts, cost estimates, plan details, and usage windows with reset times.

**Current Implementation:**
- Data source: `useGatewayStore((s) => s.usageDetail)` — Usage detail object
- Type: `UsageProviderInfo`, `UsageProviderWindow` from `gateway/adapter-types.ts`
- Fields: provider, displayName, plan, windows (label, usedPercent, resetAt), totalTokens, estimatedCostUsd, tokensIn, tokensOut

**Why it's file-replaceable:**
- Usage data is stored in session files (usage metadata)
- Provider usage can be aggregated from parsed sessions
- No real-time streaming required for historical usage data
- Can be computed by ingest service from session database

**Migration target:** Will be served by ingest API in Phase 2-4. Ingest service will aggregate usage data from parsed sessions.

---

## Dependency Mapping Table

| Capability | Data Source | Current Component | Preservation Strategy |
|------------|-------------|-------------------|----------------------|
| **Agent live status** | Gateway WebSocket | OverviewAgentCard, AgentCard, DashboardKpiBar | Gateway-exclusive, preserved |
| **Gateway connection health** | Gateway WebSocket | GatewayBootstrap, WsClient | Gateway-exclusive, preserved |
| **Real-time activity stream** | Gateway WebSocket | OverviewTab (ACTIVITY · RECENT) | Gateway-exclusive, preserved |
| **Active session monitor** | Gateway WebSocket | OverviewTab (SESSIONS), SessionsDetailRail | Gateway-exclusive (active), file-replaceable (historical) |
| **Per-agent event feed** | Gateway WebSocket | OverviewAgentDrawer | Gateway-exclusive, preserved |
| **Agent tool execution display** | Gateway WebSocket | OverviewAgentCard, AgentCard | Gateway-exclusive (current), file-replaceable (historical) |
| **Sessions list** | File (historical) / Gateway (active) | OverviewTab (SESSIONS), SessionsDetailRail | Replaceable, Phase 2-4 |
| **KPI/metrics dashboard** | File | OverviewTab (stat tiles), DashboardKpiBar | Replaceable, Phase 2-4 |
| **Skills inventory** | File | OverviewTab (SKILLS), SkillsTab | Replaceable, Phase 2-4 |
| **Cron jobs** | File | OverviewTab (CRON), CronDrawer | Replaceable, Phase 2-4 |
| **Activity history** | File | OverviewTab (ACTIVITY · RECENT) | Replaceable, Phase 2-4 |
| **Usage provider info** | File | OverviewTab (SPEND · 24H), DashboardKpiBar | Replaceable, Phase 2-4 |

**Legend:**
- **Gateway WebSocket**: Real-time data stream from OpenClaw Gateway protocol v3
- **File**: Static data from local configuration or session files
- **Preserved**: No changes in Phase 1
- **Replaceable**: Will migrate to ingest API in Phase 2-4

---

## Phase 4 Migration Notes

### Components at Risk

These components mix Gateway and file data or assume Gateway always exists. They may need refactoring in Phase 4:

#### 1. OverviewTab (`components/dashboard/overview-tab.tsx`)

**Mixed data dependencies:**
- Uses `useGatewayStore` for agents (Gateway-exclusive) ✓
- Uses `useGatewayStore` for sessions (mixed: active from Gateway, historical should be from ingest)
- Uses `useGatewayStore` for usageDetail (file-replaceable)
- Uses `useGatewayStore` for cronTasks (file-replaceable)
- Uses `useGatewayStore` for globalEventFeed (Gateway-exclusive)
- Fetches activity logs from `/api/logs` (file-replaceable)

**Refactoring needed:**
- Split session data source: active sessions from Gateway, historical sessions from ingest API
- Migrate usageDetail, cronTasks, activity logs to ingest API
- Maintain Gateway-exclusive data (agents, globalEventFeed) from Gateway store

#### 2. DashboardKpiBar (`components/dashboard/dashboard-kpi-bar.tsx`)

**Mixed data dependencies:**
- Uses `useGatewayStore` for agents (Gateway-exclusive) ✓
- Uses `useGatewayStore` for usageDetail (file-replaceable)

**Refactoring needed:**
- Keep agent KPIs (ACTIVE, WORKING, TOOL EXEC, ERRORS) from Gateway
- Migrate TOKENS and cost KPIs to ingest API

#### 3. AgentCard / OverviewAgentCard

**Current assumption:** Agent data always comes from Gateway store
**Future requirement:** Need to handle case where Gateway is disconnected but historical agent data is available from ingest

**Refactoring needed:**
- Add dual-status support per D-14: `ingestStatus` + `gatewayStatus`
- Show "disconnected" state when Gateway is unavailable
- Fallback to ingest agent metadata for historical sessions

### Gateway-Disconnected State Handling

Per OPEN-03 requirement: "OpenClaw 无 Gateway 或 ingest 未启动时仍显示明确状态，不把 loading 当成永久空白。"

**Current behavior:** Components may show perpetual loading if Gateway is disconnected
**Required behavior:** Display explicit error/disconnected state with actionable guidance

**Migration approach:**
- Add `<GatewayDisconnectedState />` component
- Show clear message: "Gateway disconnected. Some features unavailable."
- Provide fallback to ingest-sourced data where possible
- Display reconnect status and retry button

### Dual-Status Support (D-14)

Per decision D-14: "Source status 采用双维度独立模型：每个 source 有 `ingestStatus`（installed/configured/empty/indexing/error/parser-warning）和 `gatewayStatus`（connected/disconnected/connecting/error）。OpenClaw 两者都有，Claude Code / Codex 只有 ingestStatus。"

**Implementation impact:**
- Add status badge component showing both ingest and Gateway status
- Overview page needs to display both status indicators for OpenClaw
- Error handling must distinguish between ingest failures and Gateway failures
- Claude Code / Codex sources only show ingestStatus

---

## References

### Component Implementations
- `app/(shell)/dashboard/page.tsx` — Dashboard page with tab navigation
- `app/(shell)/layout.tsx` — Shell layout with header, sidebar, status bar
- `components/dashboard/overview-tab.tsx` — Overview tab with stat tiles, agents, sessions, cron, skills, activity
- `components/dashboard/agent-card.tsx` — Agent card component
- `components/dashboard/overview/agent-card.tsx` — Overview agent card component
- `components/dashboard/agent-drawer.tsx` — Agent detail drawer
- `components/dashboard/overview/agent-drawer.tsx` — Overview agent drawer with logs and events
- `components/dashboard/dashboard-kpi-bar.tsx` — KPI bar strip
- `components/dashboard/skills-tab.tsx` — Skills inventory page
- `components/dashboard/overview/skills-list.tsx` — Skills list component
- `components/dashboard/overview/cron-drawer.tsx` — Cron job detail drawer
- `components/sessions/sessions-detail-rail.tsx` — Session detail drawer

### Type Definitions
- `gateway/types.ts` — Gateway WebSocket protocol types (GatewayRequest, GatewayResponse, GatewayEvent, ConnectionStatus)
- `gateway/adapter-types.ts` — Dashboard display types (ChannelInfo, SkillInfo, CronTask, UsageProviderInfo, SessionInfo)
- `types/activity.ts` — Activity log types (LogEntry with level, source, summary)

### State Management (pre-reset)
- `stores/gateway/gateway-store.ts` — Zustand store for Gateway state (agents, sessions, skills, cronTasks, usageDetail, globalEventFeed, agentLogs)

### Requirements
- `.planning/REQUIREMENTS.md` — OPEN-01, OPEN-02, OPEN-03 requirements

### Planning Context
- `.planning/phases/01-trace-contract-brownfield-reset/01-CONTEXT.md` — Phase 1 context and decisions (D-12, D-13, D-14)
- `.planning/phases/01-trace-contract-brownfield-reset/01-PATTERNS.md` — Documentation structure pattern

---

## Summary

**Total capabilities documented:** 12
- **Gateway-exclusive:** 6 (Agent live status, Gateway connection health, Real-time activity stream, Active session monitor, Per-agent event feed, Agent tool execution display)
- **File-replaceable:** 6 (Sessions list, KPI/metrics dashboard, Skills inventory, Cron jobs, Activity history, Usage provider info)

**Key preservation principles:**
1. Gateway-exclusive capabilities are preserved but isolated — no changes in Phase 1
2. File-replaceable capabilities will migrate to ingest API in Phase 2-4
3. Components mixing Gateway and file data need refactoring in Phase 4
4. Dual-status support (ingest + Gateway) required per D-14
5. Gateway-disconnected state must show explicit error per OPEN-03

**Migration complexity:** Medium. Most capabilities are cleanly separated by data source. Main work is in OverviewTab component which mixes multiple data sources.

---

*Document created: 2026-05-06*
*Phase: 1 - Trace Contract & Brownfield Reset*
*Plan: 03 - Document Preserved Capabilities*
