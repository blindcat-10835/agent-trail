# Phase 7: Sessions Dashboard - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

替换当前 Channels 为 Sessions，展示 AI 会话的完整生命周期（token 用量、费用、消息历史、状态追踪），支持多维过滤、会话详情和实时更新。包含：

1. **Sessions 独立页面 `/sessions`** — Stats bar + 可折叠 Filter bar + 紧凑表格
2. **Session 详情** — 右侧 360px 面板，chat bubbles 消息历史
3. **Overview 替换** — Channels 区域改为 Sessions 概要
4. **导航更新** — Header + Sidebar 加 Sessions 入口
5. **SessionInfo 类型扩展** — 对齐 Gateway 完整数据

</domain>

<decisions>
## Implementation Decisions

### Sessions 页面布局
- **D-01:** 表格布局，紧凑 4 列（Label + Status + Model + Updated），可排序，展开行显示详情（tokens, cost, kind, lastMessage）
- **D-02:** Stats bar 4 指标（Total Sessions / Active Sessions / Total Tokens / Total Cost），HudCard 风格，一行水平排列
- **D-03:** Filter bar 用折叠面板（默认收起），点击展开显示：Status 筛选 + Model 筛选 + Kind 筛选 + 搜索框

### Session 详情视图
- **D-04:** 点击 Session 在右侧 360px 面板展示详情（中心表格保持可见，选中行高亮）
- **D-05:** 消息历史用 chat bubbles 样式（user 消息右对齐，AI 回复左对齐），带时间戳，role-based 颜色区分
- **D-06:** 面板内部：上方小 info 区（model + tokens + cost + kind + status badge），下方消息历史为主区域

### 数据获取与类型
- **D-07:** 扩展 SessionInfo 类型，对齐参考项目字段：key, label, model, totalTokens, contextTokens, kind (main/sub/cron/group), updatedAt, createdAt, aborted, thinkingLevel, channel, sessionId, lastMessage, cost
- **D-08:** Session 列表数据通过 Gateway `sessions.list` RPC（需验证返回字段完整性）；消息历史通过对应 session .jsonl 的 RPC 获取
- **D-09:** Session 状态指示器：Active=绿色 + LIVE 动画、Idle=灰色、Aborted=红色（ROADMAP 已定义）

### Overview 与导航
- **D-10:** Overview 左侧面板中 Channels 区域替换为 Sessions 概要（活跃会话数 + 最近 5 条 session 活动：模型 + 最后消息截断 + 时间），底部 "View All Sessions →" 链接跳转 `/sessions`
- **D-11:** Header 导航加 Sessions 项（Dashboard / Office / Sessions），Sidebar 加 SES 导航项（OVR / AGT / USD / SKL / SES）

### Claude's Discretion
- 表格具体 CSS Grid 列宽配置和排序图标实现
- Filter 面板内部控件排布（横向/纵向）
- Chat bubble 的具体颜色和圆角样式
- Session 状态 LIVE 动画的具体实现（pulse / glow / blink）
- 右侧面板 info 区的布局细节
- Overview Sessions 概要的截断策略和空状态
- SessionInfo 字段映射到 UI 的格式化（token 数量缩写、cost 货币格式）
- 消息历史的加载策略（全量 / 分页 / 虚拟滚动）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目上下文
- `.planning/PROJECT.md` — 项目愿景、技术栈约束
- `.planning/REQUIREMENTS.md` — SESS-01/02/03 需求定义
- `.planning/ROADMAP.md` §Phase 7 — Phase 7 目标和成功标准
- `.planning/STATE.md` — 当前进度和上下文

### 设计参考
- `../references/openclaw-dashboard-html/index.html` §Sessions — 完整的 Sessions 页面设计参考（表格列、Stats bar、filter chips、session modal detail、消息历史）
- `../references/openclaw-dashboard-html/server.js` §getSessionsJson/getLastMessage — Session 数据组装逻辑、字段映射、消息获取方式
- `../ovao-design/dashboard-hud.html` — HUD 视觉风格基线

### 前置 Phase 产出
- `.planning/phases/04-agent-dashboard/04-CONTEXT.md` — Phase 4 决策（Agent 卡片网格、右侧面板、KPI bar、左侧面板、导航结构）

### 核心代码参考
- `gateway/adapter-types.ts` — 现有 SessionInfo / ChannelInfo / ChannelType 类型（需扩展 SessionInfo）
- `gateway/types.ts` — Gateway WebSocket 协议类型
- `stores/gateway/gateway-store.ts` — Zustand store（sessions.list 调用、activeSessions 计数、sessionKeyMap）
- `stores/gateway/agent-event-routing.ts` — Session key 到 agent 的路由映射
- `stores/gateway/p0-selectors.ts` — P0 选择器模式（state + data 结构）
- `stores/gateway/p0-ui-state.ts` — P0UIState 状态机
- `app/(shell)/layout.tsx` — Shell Grid 布局
- `app/(shell)/dashboard/page.tsx` — Dashboard 页面（Sessions 页面结构参考）
- `components/dashboard/dashboard-left-panel.tsx` — 左侧面板
- `components/dashboard/dashboard-right-rail.tsx` — 右侧 360px rail（FEED/ALERTS/PROVIDERS tabs）
- `components/dashboard/overview-tab.tsx` — Overview 标签（现有 Channels 展示，需替换）
- `components/dashboard/sidebar-nav.tsx` — 56px 侧边导航
- `components/hud/shell-header.tsx` — Header 导航
- `components/hud/hud-card.tsx` — HudCard 组件（Stats bar 可复用）
- `components/hud/status-indicator.tsx` — StatusIndicator 组件

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `stores/gateway/gateway-store.ts`: Zustand store 已有 sessions.list 调用、activeSessions 计数、sessionKeyMap 构建
- `stores/gateway/p0-selectors.ts`: 4 个 selector 函数模式 — 新增 Sessions selector 可参考
- `components/hud/hud-card.tsx`: HudCard 组件 — Stats bar 的 stat 卡片可复用
- `components/hud/status-indicator.tsx`: StatusIndicator 组件 — Session 状态指示器可复用
- `components/dashboard/dashboard-right-rail.tsx`: 右侧 360px rail 框架 — Session 详情面板可参考
- `app/globals.css`: HUD 效果令牌（hud-clip, hud-glow）

### Established Patterns
- P0UIState 状态机: 所有数据面板使用统一的 UI 状态（loading/success/empty/error/disconnected/stale）
- P0 selector 模式: `selectXxxState()` 返回 `{ state: P0UIState, data: T }`
- Gateway RPC: `useGatewayStore` 统一管理 RPC 调用和响应
- Tailwind v4 CSS-first: `@theme inline {}` 定义 token，不使用 tailwind.config.js
- cn() 工具函数: clsx + tailwind-merge 组合 className

### Integration Points
- Sessions 页面在 `app/(shell)/sessions/page.tsx` 中实现，自动继承 Shell Grid 布局
- Overview tab 需修改 `components/dashboard/overview-tab.tsx` 替换 Channels 为 Sessions 概要
- Sidebar nav 需修改 `components/dashboard/sidebar-nav.tsx` 加 SES 项
- Header 需修改 `components/hud/shell-header.tsx` 加 Sessions 链接
- SessionInfo 类型需扩展 `gateway/adapter-types.ts`
- Sessions selector 需新增在 `stores/gateway/p0-selectors.ts`

</code_context>

<specifics>
## Specific Ideas

- 参考项目 Sessions 表格列：checkbox + status dot + Name + Type + Model + Tokens + Cost + Last Message + Updated（我们简化为 4 列 + 展开行）
- 参考项目 Stats bar：Sessions 计数 + Total Tokens + Total Cost（3 指标，我们加 Active 为 4 指标）
- 参考项目 Session detail modal：stats 网格（2x2）+ Recent Messages 列表（我们改为右侧面板 info + chat bubbles）
- 参考项目 filter：chip 标签分三组（Status/Model/Date）+ 搜索框（我们改为折叠面板）
- Session 状态：Active=绿色+LIVE 动画、Idle=灰色、Aborted=红色（与 Agent 状态色体系一致）

</specifics>

<deferred>
## Deferred Ideas

- Session 对比功能（checkbox 多选 + 并排比较）— v2
- Session Timeline 可视化（时间线图表）— 参考项目有但优先级低
- Session 导出（CSV/JSON）— v2
- Session 终止/重启操作 — 后续 Phase
- 消息搜索（在 Session 详情中搜索消息内容）— v2

</deferred>

---

*Phase: 07-sessions-dashboard*
*Context gathered: 2026-05-02*
