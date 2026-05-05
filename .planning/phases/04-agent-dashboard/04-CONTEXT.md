# Phase 4: Agent Dashboard - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

实现 Agent Dashboard 页面，包含三个核心功能：

1. **Agent 卡片网格** — 中心区域展示所有 Agent 的紧凑卡片网格，自适应多列布局
2. **Agent 详情面板** — 点击卡片在右侧 300px 面板展示详情（状态/日志流/任务进度/能力信息）
3. **KPI + 搜索筛选** — 中心顶部 KPI 摘要条 + 搜索框/状态筛选器

左侧面板（260px）在 Dashboard 模式下显示子导航标签（Overview/Agents/Skills）+ 对应数据面板。

导航只有 Dashboard / Office 两个页面（Workspace 功能已合并到 Dashboard 内）。

</domain>

<decisions>
## Implementation Decisions

### Agent 卡片网格
- **D-01:** 采用紧凑多列自适应网格布局（每个卡片 ~180-200px 宽）
- **D-02:** 每个卡片显示：头像、Agent 名称、状态色点（idle/working/tool_calling/speaking/error）、当前工具名
- **D-03:** 卡片使用 HudCard 组件（Phase 3 已创建），variant="sm" 或 "md"
- **D-04:** Agent 状态色令牌：idle=灰色、working=蓝色、tool_calling=黄色、speaking=绿色、error=红色

### Agent 详情面板
- **D-05:** 点击 Agent 卡片后，右侧 300px 面板展示该 Agent 的详情信息
- **D-06:** 中心卡片网格保持可见（不替换），选中卡片有高亮边框
- **D-07:** 右侧面板内容分区：基本信息（名称/状态/工具）+ 日志流 + 能力信息（模型/工具列表）
- **D-08:** 日志流使用终端风格 — 黑色背景 + 等宽字体（JetBrains Mono）+ 彩色编码事件
- **D-09:** 日志彩色编码：lifecycle=白色、tool=黄色、assistant=绿色、error=红色
- **D-10:** 日志流自动滚动到底部，最多显示最近 200 条（store 已有限制）

### KPI 摘要条
- **D-11:** KPI 摘要条在中心区域顶部，一行显示：活跃 Agent 数 / 工作中 / 错误数 / Token 用量
- **D-12:** 搜索框和状态筛选器在 KPI 行下方或行内

### 左侧面板
- **D-13:** 左侧面板 Dashboard 模式下显示子导航标签（Overview / Agents / Skills）
- **D-14:** Overview 标签：全局 stats（总 Agent 数、活跃会话数、连接状态）+ alert 列表
- **D-15:** Agents 标签：Agent 列表（可快速定位/高亮中心卡片）
- **D-16:** Skills 标签：Gateway 技能列表
- **D-17:** 默认选中 Overview 标签

### Claude's Discretion
- Agent 卡片的具体 CSS Grid 配置（列数/间距/断点）
- 搜索/筛选组件的具体 UI 实现
- Agent 状态色令牌的具体色值（OKLCH）
- 右侧面板的 tab/section 切换交互
- 日志行的具体格式（时间戳格式、内容截断方式）
- 左侧面板各标签的数据展示密度
- KPI 卡片的具体布局和数值格式化
- 空状态（无 Agent / 未连接 Gateway）的展示方式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目上下文
- `.planning/PROJECT.md` — 项目愿景、技术栈约束、开发约定
- `.planning/REQUIREMENTS.md` — DASH-01~05 + WORK-01~02 需求定义
- `.planning/ROADMAP.md` §Phase 4 — Phase 4 目标和成功标准
- `.planning/STATE.md` — 当前进度和上下文

### 设计参考
- `../ovao-design/dashboard-hud.html` — 设计稿的 Dashboard 布局和 Agent 卡片样式参考
- `../ovao-design/dashboard.css` — CSS 样式，HUD 效果参考

### 前置 Phase 产出
- `.planning/phases/02-design-tokens-theme/02-CONTEXT.md` — Phase 2 决策（OKLCH tokens、data-theme、字体）
- `.planning/phases/03-shell-layout-base-components/03-CONTEXT.md` — Phase 3 决策（Shell Grid、HUD effects、导航结构）

### 代码参考（核心）
- `stores/gateway/gateway-store.ts` — Agent 数据核心（AgentInfo 类型、useGatewayStore、agents Map、agentLogs、channels、skills、providers）
- `stores/gateway/p0-selectors.ts` — P0 选择器（selectUsageState、selectAlertsState、selectAgentDetailState、selectGlobalFeedState）
- `stores/gateway/p0-ui-state.ts` — P0UIState 类型（loading/success/empty/error/disconnected/stale）
- `stores/gateway/p0-types.ts` — AlertItem、GlobalEventFeedItem、UsageDetailSnapshot 类型
- `types/log.ts` — LogEntry 类型（time/type/content/runId）
- `gateway/types.ts` — AgentStream、ConnectionStatus 类型
- `gateway/adapter-types.ts` — ChannelInfo、UsageProviderInfo、SessionInfo 类型

### 代码参考（组件）
- `app/globals.css` — HUD 效果令牌（hud-clip-sm/md/lg、hud-glow）和 scanline/grid 叠加层
- `app/(shell)/layout.tsx` — Shell Grid 布局（grid-cols-[260px_1fr_300px]）
- `app/(shell)/dashboard/page.tsx` — 当前占位 Dashboard 页面
- `components/hud/hud-card.tsx` — HudCard 组件（variant/glow props）
- `components/hud/hud-panel.tsx` — HudPanel 组件
- `components/hud/glow-effect.tsx` — GlowEffect 组件
- `components/hud/status-indicator.tsx` — StatusIndicator 组件

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `stores/gateway/gateway-store.ts`: 完整的 Zustand store — `useGatewayStore()` 提供 agents Map、agentLogs、channels、skills、providers、activeSessions、alertItems、globalEventFeed
- `stores/gateway/p0-selectors.ts`: 4 个 selector 函数（selectUsageState、selectAlertsState、selectAgentDetailState、selectGlobalFeedState），返回 `{ state: P0UIState, data: T }` 结构
- `stores/gateway/p0-ui-state.ts`: P0UIState 类型（loading/success/empty/unsupported/error/disconnected/stale），所有 Dashboard 组件使用此状态机
- `components/hud/hud-card.tsx`: HudCard 组件 — variant (sm/md/lg) + glow props，用 cn() 组合 className
- `components/hud/hud-panel.tsx`: HudPanel 组件 — 简单背景面板
- `components/hud/glow-effect.tsx`: GlowEffect 组件 — 可配置发光效果
- `app/globals.css`: HUD @utility（hud-clip-sm/md/lg、hud-glow）可在组件 className 中直接使用

### Established Patterns
- Tailwind v4 CSS-first: `@theme inline {}` 定义 token，`:root` / `[data-theme="dark"]` 定义色值
- OKLCH 格式: Phase 2 已确立
- data-theme attribute switching: `[data-theme="dark"]` 选择器
- Zustand stores: `stores/` 目录下按 domain 组织
- P0UIState 状态机: 所有 Dashboard 组件使用统一的 UI 状态（loading/success/empty/error/disconnected/stale）
- cn() 工具函数: `@/lib/utils` — clsx + tailwind-merge

### Integration Points
- Dashboard 页面在 `app/(shell)/dashboard/page.tsx` 中实现，自动继承 Shell Grid 布局
- 左侧面板（260px）内容需要在 Shell 或 Dashboard 页面中实现
- 右侧面板（300px）内容需要在 Dashboard 页面中实现
- Agent 数据通过 `useGatewayStore()` hook 消费
- Agent 详情面板消费 `selectAgentDetailState(agentId)` selector
- 日志流消费 `state.agentLogs[agentId]` 数据（已按 agentId 组织，最多 200 条）

</code_context>

<specifics>
## Specific Ideas

- Agent 状态色：idle=灰色、working=蓝色、tool_calling=黄色、speaking=绿色、error=红色（设计稿风格）
- 日志彩色编码：lifecycle=白色、tool=黄色、assistant=绿色、error=红色（设计稿 terminal 风格）
- KPI 数据源：agents Map 统计各状态数量 + providers 累计 token 用量 + activeSessions
- 左侧面板子导航：Overview（stats+alerts）/ Agents（agent 列表）/ Skills（技能列表）
- 右侧面板 Agent 详情：基本信息区 + 终端风格日志区 + 能力信息区

</specifics>

<deferred>
## Deferred Ideas

- Radar 雷达可视化 — v2 VIS-01
- Command Palette — v2 UTIL-01
- 多强调色主题切换 — v2 PREF-02
- Agent 交互控制（启动/停止/配置）— 后续 Phase
- 实时 MEM/FPS 更新（Status Bar 当前是静态占位数据）— 后续 Phase

</deferred>

---
*Phase: 04-agent-dashboard*
*Context gathered: 2026-04-30*
