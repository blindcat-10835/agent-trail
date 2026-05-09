# 保留功能 - OpenClaw 概览

**最后更新：** 2026-05-06
**阶段：** 1 - Trace Contract & Brownfield Reset
**目的：** 现有 OpenClaw 概览功能的审计记录，确保在 brownfield reset 期间得到保留

**说明：** 本文档是从 OVAO（OpenClaw Visual Agents Office）到 agent-tracing-dashboard（多数据源追踪仪表盘）的 Phase 1 brownfield reset 的一部分。

---

## 概述

本文档记录了在 brownfield reset 到 agent-tracing-dashboard 之前，OVAO（OpenClaw Visual Agents Office）仪表盘中存在的所有当前 OpenClaw 概览功能。目标是确保在迁移过程中不会意外移除任何正常工作的功能。

### 保留策略

功能按数据依赖进行分类：

- **Gateway 独占**：需要 OpenClaw Gateway WebSocket 实时连接。这些功能"保留但隔离"——Phase 1 不做变更，可能在后续阶段与 Gateway 一起重新评估。
- **文件可替代**：可使用 ingest 服务解析的 session 数据。这些功能将在 Phase 2-4 迁移到 ingest API。

### 需求追溯

本文档对应 `.planning/REQUIREMENTS.md` 中的以下需求：

- **OPEN-01**：OpenClaw dashboard 保留并增强现有 overview：Agent 状态、Gateway 状态、KPI、sessions、skills、cron、activity、usage
- **OPEN-02**：OpenClaw live Gateway 数据和 ingest 历史 session 通过 session key/session id 做 best-effort link
- **OPEN-03**：OpenClaw 无 Gateway 或 ingest 未启动时仍显示明确状态

---

## Gateway 独占功能

这些功能需要来自 OpenClaw Gateway WebSocket 连接的实时数据。无法通过基于文件的 session 解析替代。

### 1. Agent 实时状态

**功能说明：** 显示所有已注册 agent 的实时状态（working、tool_calling、speaking、idle、error），带有实时状态指示器和动画脉冲效果。

**当前实现：**
- `components/dashboard/overview-tab.tsx` — Agent 网格及状态徽章
- `components/dashboard/overview/agent-card.tsx` — 每个 agent 的状态显示
- `components/dashboard/agent-card.tsx` — 标签页视图中的 agent 卡片
- `components/dashboard/dashboard-kpi-bar.tsx` — Agent 状态 KPI 条
- 数据源：`useGatewayStore((s) => s.agents)` — agent ID 到 AgentInfo 对象的映射
- 类型：来自 `stores/gateway/gateway-store.ts` 的 `AgentInfo`

**为何 Gateway 独占：**
- 需要来自 Gateway 的实时 WebSocket 事件流
- 状态变化通过 Gateway 事件推送（`AgentEventPayload`，stream: `"lifecycle"`）
- 实时状态指示器（动画脉冲）依赖持续的 Gateway 连接
- Agent 状态转换（idle → working → tool_calling）是不会持久化到 session 文件的瞬时事件

**保留策略：** 保留但隔离 —— Phase 1 不做变更，可能在后续阶段与 Gateway 一起重新评估。

---

### 2. Gateway 连接健康

**功能说明：** 显示 Gateway WebSocket 连接状态（connecting、connected、reconnecting、disconnected、error）并处理重连逻辑。

**当前实现：**
- `components/hud/gateway-bootstrap.tsx` — Gateway 连接引导组件
- `gateway/ws-client.ts` — 带重连逻辑的 WebSocket 客户端
- `gateway/rpc-client.ts` — 基于 WebSocket 的 RPC 客户端
- 类型：来自 `gateway/types.ts` 的 `ConnectionStatus`

**为何 Gateway 独占：**
- 管理 WebSocket 连接生命周期（connect、disconnect、reconnect）
- 在 UI 中显示连接状态（例如 "GATEWAY › WORKSPACE:DEFAULT › AGENTS" 面包屑）
- 需要来自 WebSocket API 的实时连接状态

**保留策略：** 保留但隔离 —— Phase 1 不做变更，可能在后续阶段与 Gateway 一起重新评估。

---

### 3. 实时活动流

**功能说明：** 实时事件流，显示 Gateway 范围内的活动事件（agent 生命周期事件、工具调用、assistant 响应、错误），带有流式更新。

**当前实现：**
- `components/dashboard/overview-tab.tsx` — "ACTIVITY · RECENT" 区域，带有实时事件流
- 数据源：`useGatewayStore((s) => s.globalEventFeed)` — 最近事件数组
- 事件显示：按级别（error、warn、info）和来源（cron、config）进行颜色编码
- 类型：来自 `types/activity.ts` 的 `LogEntry`

**为何 Gateway 独占：**
- 事件通过 Gateway WebSocket 事件实时推送
- 活动流显示带有时间戳和时效计算的"实时"事件
- 事件缓冲区（最多 100 条事件）维护在 Gateway store 中，不在 session 文件中
- 实时事件流无法从历史 session 文件重建

**保留策略：** 保留但隔离 —— Phase 1 不做变更，可能在后续阶段与 Gateway 一起重新评估。

---

### 4. 活跃 Session 监控

**功能说明：** 显示当前活跃的 session 并带有实时更新，包括 session 状态（active、idle、aborted）、最后一条消息预览和模型信息。

**当前实现：**
- `components/dashboard/overview-tab.tsx` — "SESSIONS" 区域，带有活跃 session 列表
- `components/sessions/sessions-detail-rail.tsx` — Session 详情抽屉
- 数据源：`useGatewayStore((s) => s.sessions)` — SessionInfo 对象数组
- 活跃检测：`updatedAt && (Date.now() - s.updatedAt) < 300000 && !s.aborted`
- 类型：来自 `gateway/adapter-types.ts` 的 `SessionInfo`

**为何 Gateway 独占：**
- 需要来自 Gateway WebSocket 事件的实时 session 更新
- 活跃 session 检测依赖实时的 `updatedAt` 时间戳
- session 列表显示实时更新的"当前活跃"数量
- Session 生命周期事件（created、updated、aborted）是 Gateway 事件

**保留策略：** 保留但隔离 —— Phase 1 不做变更，可能在后续阶段与 Gateway 一起重新评估。注意：历史 session 将在 Phase 2-4 由 ingest API 提供（参见 OPEN-02）。

---

### 5. 每个 Agent 的事件流

**功能说明：** 在 agent 详情抽屉中显示特定 agent 的事件日志和活动流，包括生命周期事件、工具调用和错误。

**当前实现：**
- `components/dashboard/overview/agent-drawer.tsx` — Agent 详情抽屉，带有日志和事件
- 数据源：`useGatewayStore((s) => s.agentLogs[agent.id])` — 每个 agent 的日志数组
- 类型：来自 agent 特定事件流的日志条目数组

**为何 Gateway 独占：**
- Agent 特定事件通过 Gateway WebSocket 推送，带有 agentId 过滤
- 事件流是实时的，显示最近活动（最近 10 条事件）
- 无法从历史 session 文件重建（瞬时运行时事件）

**保留策略：** 保留但隔离 —— Phase 1 不做变更，可能在后续阶段与 Gateway 一起重新评估。

---

### 6. Agent 工具执行显示

**功能说明：** 在 agent 卡片和概览中显示每个 agent 当前正在执行的工具（例如 "▸ tool_name"）。

**当前实现：**
- `components/dashboard/overview-tab.tsx` — Agent 卡片中的工具显示
- `components/dashboard/agent-card.tsx` — 工具行，带有 "▸ awaiting dispatch" 回退
- 数据源：来自 AgentInfo 的 `agent.currentTool` 字段
- 类型：`AgentInfo.currentTool?: string`

**为何 Gateway 独占：**
- 当前工具是来自 Gateway agent 事件的瞬时运行时状态
- 工具执行状态（currentTool）不会持久化到 session 文件
- 实时工具执行状态需要实时的 Gateway 连接

**保留策略：** 保留但隔离 —— Phase 1 不做变更，可能在后续阶段与 Gateway 一起重新评估。注意：历史工具调用将在 Phase 2-4 通过 ingest API 的 session 回放中可用。

---

## 文件可替代功能

这些功能可使用解析后的 session 文件中的静态数据。它们将在 Phase 2-4 迁移到 ingest API。

### 1. Sessions 列表

**功能说明：** 可浏览的历史和活跃 session 列表，支持过滤、搜索和元数据显示（label、model、status、时间、最后一条消息）。

**当前实现：**
- `components/dashboard/overview-tab.tsx` — "SESSIONS" 区域
- `components/sessions/sessions-detail-rail.tsx` — Session 详情抽屉
- 数据源：`useGatewayStore((s) => s.sessions)` — 当前来自 Gateway
- 类型：来自 `gateway/adapter-types.ts` 的 `SessionInfo`
- 字段：key、label、displayName、updatedAt、model、totalTokens、cost、lastMessage、aborted

**为何可被文件替代：**
- Session 元数据可从 OpenClaw JSONL session 文件中解析
- 历史 session 存储在本地文件中，而非仅在 Gateway 内存中
- Session 列表可从解析的 session 头部重建
- 可通过 ingest API 配合 SQLite 索引提供（Phase 2）

**迁移目标：** 将在 Phase 2-4 由 ingest API 提供。Ingest 服务将扫描本地 OpenClaw session 目录，解析 session 文件，并提供 sessions 列表的 REST API。

---

### 2. KPI/指标仪表盘

**功能说明：** 显示聚合指标，包括 fleet 状态、活跃 session 数量、token 使用（输入/输出）、成本追踪（24 小时花费）和错误计数。

**当前实现：**
- `components/dashboard/overview-tab.tsx` — 核心统计块（FLEET STATUS、SESSIONS ACT、SPEND · 24H、ACTIVITY · ERRORS）
- `components/dashboard/dashboard-kpi-bar.tsx` — KPI 条（ACTIVE、WORKING、TOOL EXEC、ERRORS、TOKENS、EVT BUF）
- 数据源：`useGatewayStore((s) => s.usageDetail)` — 使用量提供方信息
- 类型：来自 `gateway/adapter-types.ts` 的 `UsageProviderInfo`、`UsageProviderWindow`

**为何可被文件替代：**
- Token 使用和成本存储在 session 文件中（usage 元数据）
- 聚合指标可从解析的 session 数据中计算
- 历史 KPI 可从 ingest 服务的 SQLite 数据库计算
- 历史指标不需要实时流

**迁移目标：** 将在 Phase 2-4 由 ingest API 提供。Ingest 服务将从解析的 session 聚合指标并提供 KPI 端点。

---

### 3. Skills 清单

**功能说明：** 列出可用 skills 及其元数据（name、description、icon、version、author、enabled 状态）。

**当前实现：**
- `components/dashboard/overview-tab.tsx` — 概览中的 "SKILLS" 区域
- `components/dashboard/skills-tab.tsx` — 独立的 skills 标签页
- 数据源：`useGatewayStore((s) => s.skills)` — SkillInfo 对象数组
- 类型：来自 `gateway/adapter-types.ts` 的 `SkillInfo`
- 字段：id、slug、name、description、enabled、icon、version、author

**为何可被文件替代：**
- Skill 定义是静态配置，不是实时数据
- Skills 列表可从 OpenClaw 配置文件中读取
- Skill 清单不需要 WebSocket 流
- 可从本地配置解析或由 ingest API 提供

**迁移目标：** 将在 Phase 2-4 由 ingest API 提供。Ingest 服务将从 OpenClaw 配置中解析 skill 定义并提供 skills 端点。

---

### 4. Cron 任务

**功能说明：** 显示预定的 cron 任务及其调度信息（at、every、cron expression）、enabled 状态和最近/下次运行时间。

**当前实现：**
- `components/dashboard/overview-tab.tsx` — "CRON · SCHEDULED" 区域
- `components/dashboard/overview/cron-drawer.tsx` — Cron 详情抽屉，带有运行历史
- 数据源：`useGatewayStore((s) => s.cronTasks)` — CronTask 对象数组
- 类型：来自 `gateway/adapter-types.ts` 的 `CronTask`、`CronSchedule`、`CronJobState`
- 字段：id、name、description、schedule（kind、at、everyMs、expr、tz）、enabled、state（nextRunAtMs、lastRunAtMs、lastRunStatus）

**为何可被文件替代：**
- Cron 任务定义是静态配置
- Cron 调度和状态可从 OpenClaw 配置文件中读取
- Cron 清单不需要实时流
- 运行历史可从活动日志中解析

**迁移目标：** 将在 Phase 2-4 由 ingest API 提供。Ingest 服务将从本地文件中解析 cron 定义和运行历史。

---

### 5. 活动历史

**功能说明：** 显示过去的活动事件、错误日志和 cron 任务运行，带有时间戳、严重级别和来源归属。

**当前实现：**
- `components/dashboard/overview-tab.tsx` — "ACTIVITY · RECENT" 区域
- API 端点：`/api/logs` — 获取活动日志条目
- 类型：来自 `types/activity.ts` 的 `LogEntry`
- 字段：id、ts（时间戳）、level（error、warn、info）、summary、source（cron、config）、jobId

**为何可被文件替代：**
- 活动日志存储在本地日志文件中
- 历史活动可从日志文件中解析
- 历史活动不需要实时流
- 可由 ingest 服务索引以支持搜索和过滤

**迁移目标：** 将在 Phase 2-4 由 ingest API 提供。Ingest 服务将解析活动日志并提供搜索/过滤端点。

---

### 6. 使用量提供方信息

**功能说明：** 显示每个提供方的使用量信息，包括 token 计数、成本估算、套餐详情和带有重置时间的使用量窗口。

**当前实现：**
- 数据源：`useGatewayStore((s) => s.usageDetail)` — 使用量详情对象
- 类型：来自 `gateway/adapter-types.ts` 的 `UsageProviderInfo`、`UsageProviderWindow`
- 字段：provider、displayName、plan、windows（label、usedPercent、resetAt）、totalTokens、estimatedCostUsd、tokensIn、tokensOut

**为何可被文件替代：**
- 使用量数据存储在 session 文件中（usage 元数据）
- 提供方使用量可从解析的 session 中聚合
- 历史使用量数据不需要实时流
- 可由 ingest 服务从 session 数据库计算

**迁移目标：** 将在 Phase 2-4 由 ingest API 提供。Ingest 服务将从解析的 session 中聚合使用量数据。

---

## 依赖映射表

| 功能 | 数据源 | 当前组件 | 保留策略 |
|------------|-------------|-------------------|----------------------|
| **Agent 实时状态** | Gateway WebSocket | OverviewAgentCard、AgentCard、DashboardKpiBar | Gateway 独占，保留 |
| **Gateway 连接健康** | Gateway WebSocket | GatewayBootstrap、WsClient | Gateway 独占，保留 |
| **实时活动流** | Gateway WebSocket | OverviewTab（ACTIVITY · RECENT） | Gateway 独占，保留 |
| **活跃 Session 监控** | Gateway WebSocket | OverviewTab（SESSIONS）、SessionsDetailRail | Gateway 独占（活跃部分），文件可替代（历史部分） |
| **每个 Agent 的事件流** | Gateway WebSocket | OverviewAgentDrawer | Gateway 独占，保留 |
| **Agent 工具执行显示** | Gateway WebSocket | OverviewAgentCard、AgentCard | Gateway 独占（当前），文件可替代（历史） |
| **Sessions 列表** | 文件（历史）/ Gateway（活跃） | OverviewTab（SESSIONS）、SessionsDetailRail | 可替代，Phase 2-4 |
| **KPI/指标仪表盘** | 文件 | OverviewTab（统计块）、DashboardKpiBar | 可替代，Phase 2-4 |
| **Skills 清单** | 文件 | OverviewTab（SKILLS）、SkillsTab | 可替代，Phase 2-4 |
| **Cron 任务** | 文件 | OverviewTab（CRON）、CronDrawer | 可替代，Phase 2-4 |
| **活动历史** | 文件 | OverviewTab（ACTIVITY · RECENT） | 可替代，Phase 2-4 |
| **使用量提供方信息** | 文件 | OverviewTab（SPEND · 24H）、DashboardKpiBar | 可替代，Phase 2-4 |

**图例：**
- **Gateway WebSocket**：来自 OpenClaw Gateway 协议 v3 的实时数据流
- **文件**：来自本地配置或 session 文件的静态数据
- **保留**：Phase 1 不做变更
- **可替代**：将在 Phase 2-4 迁移到 ingest API

---

## Phase 4 迁移说明

### 存在风险的组件

这些组件混合使用 Gateway 和文件数据，或假设 Gateway 始终存在。它们可能需要在 Phase 4 进行重构：

#### 1. OverviewTab（`components/dashboard/overview-tab.tsx`）

**混合数据依赖：**
- 使用 `useGatewayStore` 获取 agents（Gateway 独占） ✓
- 使用 `useGatewayStore` 获取 sessions（混合：活跃部分来自 Gateway，历史部分应来自 ingest）
- 使用 `useGatewayStore` 获取 usageDetail（文件可替代）
- 使用 `useGatewayStore` 获取 cronTasks（文件可替代）
- 使用 `useGatewayStore` 获取 globalEventFeed（Gateway 独占）
- 从 `/api/logs` 获取活动日志（文件可替代）

**需要的重构：**
- 拆分 session 数据源：活跃 session 来自 Gateway，历史 session 来自 ingest API
- 将 usageDetail、cronTasks、活动日志迁移到 ingest API
- 保留来自 Gateway store 的 Gateway 独占数据（agents、globalEventFeed）

#### 2. DashboardKpiBar（`components/dashboard/dashboard-kpi-bar.tsx`）

**混合数据依赖：**
- 使用 `useGatewayStore` 获取 agents（Gateway 独占） ✓
- 使用 `useGatewayStore` 获取 usageDetail（文件可替代）

**需要的重构：**
- 保留来自 Gateway 的 agent KPI（ACTIVE、WORKING、TOOL EXEC、ERRORS）
- 将 TOKENS 和 cost KPI 迁移到 ingest API

#### 3. AgentCard / OverviewAgentCard

**当前假设：** Agent 数据始终来自 Gateway store
**未来需求：** 需要处理 Gateway 断开但历史 agent 数据可从 ingest 获取的情况

**需要的重构：**
- 按 D-14 添加双状态支持：`ingestStatus` + `gatewayStatus`
- Gateway 不可用时显示"已断开"状态
- 回退到 ingest 的 agent 元数据以显示历史 session

### Gateway 断开状态处理

按 OPEN-03 需求："OpenClaw 无 Gateway 或 ingest 未启动时仍显示明确状态，不把 loading 当成永久空白。"

**当前行为：** Gateway 断开时组件可能显示持续加载
**要求的行为：** 显示明确的错误/断开状态并提供可操作的指导

**迁移方案：**
- 添加 `<GatewayDisconnectedState />` 组件
- 显示明确消息："Gateway 已断开。部分功能不可用。"
- 在可能的情况下提供回退到 ingest 来源数据的选项
- 显示重连状态和重试按钮

### 双状态支持（D-14）

按决策 D-14："Source status 采用双维度独立模型：每个 source 有 `ingestStatus`（installed/configured/empty/indexing/error/parser-warning）和 `gatewayStatus`（connected/disconnected/connecting/error）。OpenClaw 两者都有，Claude Code / Codex 只有 ingestStatus。"

**实现影响：**
- 添加同时显示 ingest 和 Gateway 状态的状态徽章组件
- 概览页面需要为 OpenClaw 显示两种状态指示器
- 错误处理必须区分 ingest 故障和 Gateway 故障
- Claude Code / Codex 数据源仅显示 ingestStatus

---

## 参考

### 组件实现
- `app/(shell)/dashboard/page.tsx` — 仪表盘页面，带标签页导航
- `app/(shell)/layout.tsx` — Shell 布局，包含 header、sidebar、status bar
- `components/dashboard/overview-tab.tsx` — 概览标签页，包含统计块、agents、sessions、cron、skills、activity
- `components/dashboard/agent-card.tsx` — Agent 卡片组件
- `components/dashboard/overview/agent-card.tsx` — 概览 agent 卡片组件
- `components/dashboard/agent-drawer.tsx` — Agent 详情抽屉
- `components/dashboard/overview/agent-drawer.tsx` — 概览 agent 抽屉，包含日志和事件
- `components/dashboard/dashboard-kpi-bar.tsx` — KPI 条形条
- `components/dashboard/skills-tab.tsx` — Skills 清单页面
- `components/dashboard/overview/skills-list.tsx` — Skills 列表组件
- `components/dashboard/overview/cron-drawer.tsx` — Cron 任务详情抽屉
- `components/sessions/sessions-detail-rail.tsx` — Session 详情抽屉

### 类型定义
- `gateway/types.ts` — Gateway WebSocket 协议类型（GatewayRequest、GatewayResponse、GatewayEvent、ConnectionStatus）
- `gateway/adapter-types.ts` — 仪表盘显示类型（ChannelInfo、SkillInfo、CronTask、UsageProviderInfo、SessionInfo）
- `types/activity.ts` — 活动日志类型（LogEntry，包含 level、source、summary）

### 状态管理（重置前）
- `stores/gateway/gateway-store.ts` — Gateway 状态的 Zustand store（agents、sessions、skills、cronTasks、usageDetail、globalEventFeed、agentLogs）

### 需求
- `.planning/REQUIREMENTS.md` — OPEN-01、OPEN-02、OPEN-03 需求

### 规划上下文
- `.planning/phases/01-trace-contract-brownfield-reset/01-CONTEXT.md` — Phase 1 上下文和决策（D-12、D-13、D-14）
- `.planning/phases/01-trace-contract-brownfield-reset/01-PATTERNS.md` — 文档结构模式

---

## 总结

**已记录的总功能数：** 12
- **Gateway 独占：** 6（Agent 实时状态、Gateway 连接健康、实时活动流、活跃 Session 监控、每个 Agent 的事件流、Agent 工具执行显示）
- **文件可替代：** 6（Sessions 列表、KPI/指标仪表盘、Skills 清单、Cron 任务、活动历史、使用量提供方信息）

**关键保留原则：**
1. Gateway 独占功能保留但隔离 —— Phase 1 不做任何变更
2. 文件可替代功能将在 Phase 2-4 迁移到 ingest API
3. 混合 Gateway 和文件数据的组件需要在 Phase 4 进行重构
4. 按 D-14 需要双状态支持（ingest + Gateway）
5. 按 OPEN-03，Gateway 断开状态必须显示明确的错误提示

**迁移复杂度：** 中等。大多数功能已按数据源清晰分离。主要工作集中在混合多个数据源的 OverviewTab 组件。

---

*文档创建时间：2026-05-06*
*阶段：1 - Trace Contract & Brownfield Reset*
*计划：03 - Document Preserved Capabilities*
