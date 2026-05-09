---
slug: gateway-dead-code-audit
status: complete
---

# Gateway Dead Code Audit

**结论**: gateway/ 核心代码全部活跃，被 30+ 前端文件通过 useGatewayStore 消费。不可直接删除。

## Dead Code 清单

1. `RpcError` class — gateway/rpc-client.ts 导出但从未被外部 import
2. `writeGatewayConfig()` — lib/gateway-config.ts 定义但从未被调用
3. `NEXT_PUBLIC_API_BASE` env var — .env.local 中设置但代码中零引用
4. `.ovao-config.json` — 磁盘上不存在，readGatewayConfig() 始终返回 null 并 fallback 到 env var

---

## 前端 Gateway 数据使用详情（按文件 + 行号）

### GatewayBootstrap 挂载点（WS 连接入口）

| 文件 | 行 | 用途 |
|---|---|---|
| `app/(shell)/layout.tsx` | :19 | `<GatewayBootstrap />` — **无条件挂载**，shell 下所有页面都会建立 WS 连接 |
| `app/(tool-shell)/[tool]/tool-layout-client.tsx` | :30 | `gatewayBootstrap={toolId === 'openclaw' ? <GatewayBootstrap /> : null}` — 仅 openclaw 工具挂载 |

### Runtime `useGatewayStore` 消费者（16 个文件）

#### app/ 页面

| 文件 | 行 | 消费内容 |
|---|---|---|
| `app/(shell)/dashboard/page.tsx` | :9, :23, :25 | agents, globalEventFeed |
| `app/(shell)/sessions/page.tsx` | :4, :12 | selectSessionsState — session 列表 |
| `app/(tool-shell)/[tool]/dashboard/openclaw-dashboard.tsx` | :6, :33-35 | connectionStatus, sessions, gatewayVersion |

#### components/dashboard/

| 文件 | 行 | 消费内容 |
|---|---|---|
| `dashboard-kpi-bar.tsx` | :4, :18, :20 | agents (计数), usageDetail |
| `dashboard-left-panel.tsx` | :4, :26-30 | agents, selectAlertsState, usageDetail, globalEventFeed |
| `dashboard-right-rail.tsx` | :4, :33-34 | globalEventFeed, usageDetail |
| `overview-tab.tsx` | :7, :75-82, :317 | agents, usageDetail, sessions, cronTasks, globalEventFeed, agentLogs, skills |
| `agents-tab.tsx` | :4, :14 | agents |
| `skills-tab.tsx` | :3, :7 | skills |
| `agent-card-grid.tsx` | :4, :27 | globalEventFeed |
| `agent-detail-panel.tsx` | :3, :20, :67 | selectAgentDetailState, agentLogs |
| `agent-drawer.tsx` | :4, :35-36 | agentLogs, globalEventFeed |
| `quick-actions.tsx` | :4, :58 | useGatewayStore.getState() — 命令式访问 |

#### components/dashboard/overview/

| 文件 | 行 | 消费内容 |
|---|---|---|
| `skills-list.tsx` | :3, :6 | skills |

#### components/shell/ + components/hud/

| 文件 | 行 | 消费内容 |
|---|---|---|
| `shell/shell-status-bar.tsx` | :4, :8-10 | connectionStatus, isDashboardLoading, agents.size |
| `hud/status-indicator.tsx` | :3, :15 | connectionStatus |
| `hud/shell-status-bar.tsx` | :3, :7-9 | connectionStatus, isDashboardLoading, agents.size |
| `hud/gateway-bootstrap.tsx` | :4, :7-9 | init(), disconnect(), hydrateFromCache() |

### Type-only imports from gateway store（12 个文件，编译依赖但无运行时影响）

| 文件 | 行 | 引入的类型 |
|---|---|---|
| `agent-basic-info.tsx` | :6 | AgentInfo |
| `agent-capabilities.tsx` | :6 | AgentInfo |
| `agent-card.tsx` | :4 | AgentInfo, AgentDisplayStatus |
| `agent-drawer.tsx` | :6 | AgentInfo, AgentDisplayStatus |
| `agent-card-grid.tsx` | :8 | AgentInfo |
| `agent-search-filter.tsx` | :8 | AgentDisplayStatus |
| `dashboard-kpi-bar.tsx` | :6 | AgentDisplayStatus |
| `agents-tab.tsx` | :6 | AgentInfo |
| `overview/agent-drawer.tsx` | :3 | AgentInfo |
| `overview/agent-card.tsx` | :4 | AgentInfo |
| `overview/agent-avatar.tsx` | :4 | AgentInfo |
| `radar-widget.tsx` | :4 | AgentInfo, AgentDisplayStatus |

### p0-selector/p0-types imports（4 个文件）

| 文件 | 行 | 引入内容 |
|---|---|---|
| `agent-detail-panel.tsx` | :4 | selectAgentDetailState |
| `dashboard-left-panel.tsx` | :5 | selectAlertsState |
| `overview/agent-drawer.tsx` | :5 | GlobalEventFeedItem (type) |
| `app/(shell)/sessions/page.tsx` | :5 | selectSessionsState |

### Direct `@/gateway/` imports（3 个文件）

| 文件 | 行 | 引入内容 |
|---|---|---|
| `sessions/sessions-table.tsx` | :5 | SessionInfo (type) |
| `overview/cron-drawer.tsx` | :3 | CronTask (type) |
| `hud/status-indicator.tsx` | :4 | ConnectionStatus (type) |

### Gateway config UI（1 个文件）

| 文件 | 行 | 用途 |
|---|---|---|
| `quick-actions.tsx` | :69, :101, :166, :170 | gatewayUrl/gatewayToken state, fetch /api/gateway-config, 渲染设置 |

---

## 已有的替代数据源（Ingest / API，不依赖 Gateway）

项目已有 ingest-based 数据系统，供 Claude Code / Codex 等 non-OpenClaw 工具使用：

- `stores/ingest-health-store.ts` — ingest 健康状态
- `lib/agent-tools/client-hooks.tsx` — useToolSessions, useSessionDetail, useSessionTurns, useAggregateSessions 等 hooks
- `components/hud/ingest-health-overlay.tsx` — ingest 状态 UI

这些被 `app/(tool-shell)/` 下所有页面和 `components/sessions/` 大量使用。

**特殊文件**: `openclaw-dashboard.tsx` 同时使用 gateway 和 ingest 两套数据源——从 gateway 读取 connectionStatus/sessions/gatewayVersion，从 ingest 读取 indexed session 做交叉对比。

---

## 统计

| 类别 | 文件数 |
|---|---|
| Runtime useGatewayStore 消费者 | 16 |
| Type-only imports | 12 |
| p0-selector/types imports | 4 |
| @/gateway/ direct imports | 3 |
| GatewayBootstrap 挂载 | 2 |
| Gateway config UI | 1 |
| **总计去重** | **~30 文件** |
