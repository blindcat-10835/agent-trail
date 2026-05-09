# 前端服务深度解析

Next.js 前端是一个服务端渲染的 React 应用，用于浏览本地 trace 存储并逐轮回放会话。本文档描述了各个层级——路由、BFF、agent-tool 注册表、stores、回放界面——以及它们如何协同工作。

系统上下文：[`../ARCHITECTURE.md`](../ARCHITECTURE.md)。它消费的 HTTP 接口定义：[`../API.md`](../API.md)。它通信的服务：[`./ingest.md`](./ingest.md)。

---

## 1. 模块结构

```text
app/
├── layout.tsx                          # 根布局：JetBrains Mono + Inter，主题引导，IngestHealthOverlay
├── page.tsx                            # /  →  redirect('/all/dashboard')
├── globals.css                         # Tailwind v4 + @theme 内联令牌（无 tailwind.config.js）
├── favicon.ico
├── (tool-shell)/                       # 路由分组 — 将每个工具页面包裹在 shell 中
│   └── [tool]/                         # 动态段：openclaw | claude-code | codex | all
│       ├── layout.tsx                  # 服务端组件：assertAgentToolId(tool) → ToolLayoutClient
│       ├── tool-layout-client.tsx      # 'use client'：AgentToolProvider + ShellFrame 包装
│       ├── dashboard/
│       │   ├── page.tsx                # 每个工具的仪表盘
│       │   ├── openclaw-dashboard.tsx  # OpenClaw 专用概览
│       │   └── session-stats-dashboard.tsx
│       ├── sessions/
│       │   ├── page.tsx                # AggregateSessionsView | SessionStatsDashboard
│       │   └── [sessionId]/page.tsx    # 逐轮回放界面
│       └── activity/page.tsx
└── api/                                # 所有服务端路由（HTTP 协议见 API.md）
    ├── agent-tools/[tool]/             # BFF 代理（D-07）：health、sessions、sessions/:id、.../messages、.../turns、sessions/lookup、sync、events
    ├── ingest/health/                  # 前端面向的 ingest 健康检查
    ├── sync/                           # 全源聚合同步
    ├── logs/                           # 从本地文件系统读取活动日志
    ├── sessions/messages/              # 旧版 OpenClaw 文件扫描端点（保留）
    └── action/{restart,update}/        # OpenClaw 服务控制（Linux/systemd）

lib/
├── utils.ts                            # cn() — clsx + tailwind-merge
├── env.ts                              # requireEnv / optionalEnv
├── api-error.ts                        # apiErrorResponse 辅助函数
├── logs.ts                             # 活动日志读取器
├── parseFixture.ts                     # 测试/CI fixture 解析分发器
├── agent-avatar-utils.ts               # 头像 + 首字母辅助函数
└── agent-tools/                        # 每个工具的注册表、服务端适配器、客户端 hooks
    ├── types.ts                        # AgentToolId、AgentToolDefinition、capabilities、UI 配置
    ├── registry.ts                     # AGENT_TOOL_DEFINITIONS、assertAgentToolId、assertSourceToolId
    ├── server-adapter.ts               # 基础接口 + fetchIngest + sanitizeError + source 范围限定辅助函数
    ├── client-hooks.tsx                # AgentToolProvider、useAgentTool、useSessionDetail、useSessionTurns、syncToolSessions
    ├── capability-gate.tsx             # 按 capability 条件渲染
    ├── all/definition.ts               # 合成聚合范围
    ├── openclaw/{definition,server-adapter}.ts
    ├── claude-code/{definition,server-adapter}.ts
    └── codex/{definition,server-adapter}.ts

stores/                                 # Zustand
├── tool-store.ts                       # 选中的会话、侧边栏 UI 状态
├── replay-store.ts                     # 每轮的展开/折叠、搜索、滚动位置
├── ui-store.ts                         # 右侧栏开关、模态框状态
├── ingest-health-store.ts              # 'checking' | 'connected' | 'timeout' 健康探测
├── theme-store.ts                      # 'light' | 'dark' | 'system'（引导脚本在 app/layout.tsx 中）
└── office-layout/                      # OpenClaw 2D 办公平面图持久化

components/
├── ui/                                 # shadcn/ui（button、card、badge、input、separator、scroll-area、select、skeleton、tooltip）
├── shell/                              # ShellFrame、ShellHeader、ShellStatusBar、SidebarNav、RightRail、SourceSwitcher
├── replay/                             # TurnTimeline（虚拟化）、TurnCard、ToolBlock、SkillBlock、SubagentBlock、ThinkingBlock、SystemEventBlock、ReplaySearchBar、ReplayHeader、ReplayRightRail、TurnNavigator、MarkdownContent、key-utils
├── sessions/                           # AggregateSessionsView、SessionsRightRail、SessionsStatsBar
├── activity/                           # ActivityEntryDrawer、ActivitySummaryCards、LogBrowser
├── dashboard/empty-state.tsx
└── hud/                                # HudPanel、IngestHealthOverlay、ThemeToggle

types/
├── trace.ts                            # 标准协议（TraceSession、TraceTurn、TraceMessage、TraceActivity 等）
├── activity.ts                         # LogEntry、LogSummary
└── log.ts                              # 日志数据结构
```

---

## 2. 路由

应用使用 Next.js App Router，包含一个路由分组 `(tool-shell)/` 和一个动态段 `[tool]`。

### 2.1 顶层路由

| URL | 文件 | 用途 |
| --- | --- | --- |
| `/` | `app/page.tsx` | `redirect('/all/dashboard')` — 不存在纯根路径页面 |
| `/api/*` | `app/api/.../route.ts` | 所有服务端路由（参见 [`../API.md`](../API.md)） |

### 2.2 工具路由

路由分组 `(tool-shell)/` 在 URL 中不可见。`[tool]` 是动态段。

| URL 模式 | 解析到 |
| --- | --- |
| `/<tool>/dashboard` | `app/(tool-shell)/[tool]/dashboard/page.tsx` |
| `/<tool>/sessions` | `app/(tool-shell)/[tool]/sessions/page.tsx` |
| `/<tool>/sessions/<id>` | `app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx`（逐轮回放） |
| `/<tool>/activity` | `app/(tool-shell)/[tool]/activity/page.tsx` |

`<tool>` 必须为 `openclaw | claude-code | codex | all` 之一。Shell 布局通过 `assertAgentToolId` 验证该值；任何其他值触发 `notFound()`（Next.js 404）。

### 2.3 Shell 布局

`app/(tool-shell)/[tool]/layout.tsx` 是一个**服务端组件**：它等待 `params`，验证工具 ID，然后渲染 `<ToolLayoutClient toolId={...}>`。客户端组件安装 `<AgentToolProvider>` 并使用 `<ShellFrame>` 包裹其子组件。

`ShellFrame` 是一个 3 行 CSS 网格：

```text
┌────────────────────────────────────────────────────────────┐ 48px  ShellHeader（品牌、数据源切换器、主题切换）
├──┬─────────────────────────────────────┬───────────────────┤
│ S│                                     │                   │
│ I│                                     │   RightRail       │
│ D│         页面子内容                  │   （打开时        │
│ N│                                     │    360px，否则 0）│
│ A│                                     │                   │
│ V│                                     │                   │
├──┴─────────────────────────────────────┴───────────────────┤ 26px  ShellStatusBar（INGEST · ONLINE/OFFLINE/RECONNECTING）
└────────────────────────────────────────────────────────────┘
56px
```

网格模板列在 `useUIStore((s) => s.rightRailOpen)` 切换时，在 `'56px 1fr 0px'` 和 `'56px 1fr 360px'` 之间动画过渡。

---

## 3. Agent-tool 注册表

注册表是"每个工具在 UI 中是什么样子？"的单一真相来源。

```ts
// lib/agent-tools/registry.ts
export const AGENT_TOOL_DEFINITIONS: Record<AgentToolId, AgentToolDefinition> = {
  all: allDef,
  openclaw: openclawDef,
  'claude-code': claudeCodeDef,
  codex: codexDef,
}

export const TOOL_IDS: SourceToolId[] = ['openclaw', 'claude-code', 'codex']           // 仅 ingest 支持的数据源
export const SHELL_TOOL_IDS: AgentToolId[] = ['all', ...TOOL_IDS]                       // 包含聚合范围
```

每个 `AgentToolDefinition`（[`lib/agent-tools/types.ts`](../../lib/agent-tools/types.ts)）包含：

- `id`、`label`、`shortLabel`、`defaultRoute`
- `capabilities` — 功能开关（`sessions`、`replay`、`activity`、`office`、`workspace`、`subagents`、`cost`、`approvals`）
- `nav` — 侧边栏项目，每项可选 `requiredCapability`
- `ui` — `brand`、`sessionColumns`、`dashboardSlots?`、`replayBlocks?`、格式化器

当前各工具的 capabilities（来自四个 definition 文件）：

| 工具 | sessions | replay | activity | office | workspace | subagents | cost | approvals |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **openclaw** | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ |  |
| **claude-code** | ✓ | ✓ | ✓ |  |  | ✓ |  |  |
| **codex** | ✓ | ✓ | ✓ |  |  |  |  |  |
| **all** | ✓ |  |  |  |  |  |  |  |

两个信任边界验证器：

- `assertAgentToolId(raw)` 接受 `all | openclaw | claude-code | codex` — 用于 shell URL 解析。
- `assertSourceToolId(raw)` 仅接受三个 ingest 数据源 — 用于 BFF 路由处理，其中 `all` 无意义。

两者都会抛出包含有效 ID 列表的描述性错误，BFF 通过 `sanitizeError` 将其转换为 400。

---

## 4. BFF（服务端适配器）

`lib/agent-tools/server-adapter.ts` 定义了协议：

```ts
interface AgentToolServerAdapter {
  toolId: string
  health(): Promise<{ status: string; version?: string }>
  listSessions(query: Record<string, string>): Promise<SessionListResult>
  getSession(sessionId: string): Promise<TraceSession | null>
  getSessionMessages(sessionId: string): Promise<unknown[]>
  getSessionTurns(sessionId: string, query?: TurnsQueryParams): Promise<TurnsListResult>
  lookupSessionByKey(key: string): Promise<TraceSession | null>
}
```

每个工具对应一个微型适配器实现（参见 [`lib/agent-tools/openclaw/server-adapter.ts`](../../lib/agent-tools/openclaw/server-adapter.ts)），它：

- 设置 `SOURCE = '<tool>'`。
- 为列表查询调用 `buildSourceScopedSessionParams(SOURCE, query)` — 这**会删除调用者提供的任何 `source` 键**并重新注入适配器的 source。在此无法通过调用者控制 source 筛选。
- 为 `getSession` 调用 `getSourceScopedSession(sessionId, SOURCE)`，从 ingest 获取会话，如果 `session.source !== SOURCE` 则返回 `null`。跨数据源隔离在此实现。
- 在获取子资源（messages / turns）之前调用 `requireSourceScopedSession(sessionId, SOURCE)`，因此跨数据源访问会抛出异常。

`fetchIngest<T>(path, options?)` 是共享的 HTTP 客户端。它：

- 添加 `INGEST_URL` 前缀（默认 `http://localhost:8078`）。
- 通过 `AbortController` 设置 5 秒超时。
- 设置 `Content-Type: application/json` 并将 `body` 序列化为 JSON。
- 转发 Next.js 风格的缓存选项（`cache`、`next.revalidate`、`next.tags`）。
- 如果上游返回 `error` 字段则抛出该错误，否则抛出 `Ingest returned <status>`。
- 特殊处理 `AbortError` → `Error('Ingest service request timed out')`。

`sanitizeError(err)` 将：

- `SessionValidationError` → `{ error: err.message, code: err.code }`
- `Invalid (source|agent) tool ID …` → `{ error, code: 400 }`
- 其他一切 → `{ error: 'Ingest service unreachable', code: 502 }`

这就是前端错误看起来比较泛化的原因——这是故意为之。真实原因仅出现在 `[INGEST]` 日志中。

BFF 路由处理本身很薄：验证 → 分发 → sanitize。标准模式参见 [`app/api/agent-tools/[tool]/sessions/route.ts`](../../app/api/agent-tools/%5Btool%5D/sessions/route.ts)。

---

## 5. 客户端 Hooks（`lib/agent-tools/client-hooks.tsx`）

所有消费者组件通过 `useAgentTool()` 访问当前工具：

```tsx
const { toolId, capabilities, href, definition } = useAgentTool()
// href('/sessions') → '/openclaw/sessions'（当 toolId === 'openclaw' 时）
```

在 `<AgentToolProvider>` 之外调用会抛出描述性消息——有助于在开发时捕获配置错误。

数据 hooks 全部访问 BFF。它们从不直接调用 ingest。

| Hook | 功能 |
| --- | --- |
| `useToolSessions(toolId, query)` | 列出某个工具的会话。调用 `/api/agent-tools/<tool>/sessions?...`。 |
| `useSessionDetail(toolId, sessionId)` | 通过 `/api/agent-tools/<tool>/sessions/<id>` 获取单个会话。 |
| `useSessionTurns(toolId, sessionId, { offset, limit })` | 通过 `/api/agent-tools/<tool>/sessions/<id>/turns?offset=&limit=` 获取 turns。 |
| `syncToolSessions(toolId, { force? })` | POST 到 `/api/agent-tools/<tool>/sync`。非 OK 状态时抛出异常。 |
| `syncAggregate({ force? })` | POST 到 `/api/sync` 进行全源同步。 |
| `notifySessionsRefresh()` | 发送 `agent-tracing-dashboard:sessions-refresh` 窗口事件以触发跨组件刷新。 |

Hooks 通过 `EventSource('/api/agent-tools/<tool>/events?sessionId=...')`（每个会话）或 `'/api/agent-tools/<tool>/events'`（全局）订阅 SSE。收到 `session_updated` 事件时，它们会重新获取数据——事件仅携带 ID，从不内联数据（D-12）。

---

## 6. 状态管理（`stores/`）

状态按关注点拆分；没有任何东西存在于单一的全局 store 中。

| Store | 管理的内容 |
| --- | --- |
| `tool-store` | 当前选中的 sessionId（`selectedSessionId`），侧边栏折叠/展开等。 |
| `replay-store` | 每轮的 `expandedTurns: Set<string>`、`searchQuery`、`searchMatches`、`currentMatchIndex`、`currentTurnIndex`、`focusedTurnId`、按 session ID 保存的滚动位置。 |
| `ui-store` | `rightRailOpen`、模态框状态 — 仅视觉外壳。 |
| `ingest-health-store` | `status: 'checking' \| 'connected' \| 'timeout'`、`hasConnectedOnce: boolean`，以及 `retry / setConnected / setTimeout` 操作。由 `IngestHealthOverlay` 轮询。 |
| `theme-store` | `'light' \| 'dark' \| 'system'`。**通过 `app/layout.tsx` 中的内联脚本同步引导**，以避免 FOUC。store 在挂载后水合。 |
| `office-layout/office-layout-store` + `office-map` | OpenClaw Office 2D 平面图布局持久化（拖拽位置、缩放）。 |

Stores 从不直接调用 API。Hooks 负责网络请求；stores 负责跨组件状态。

---

## 7. Shell 组件（`components/shell/`）

- `ShellFrame` — 上述 3 行网格。通过 `useUIStore` 读取右侧栏状态。
- `ShellHeader` — 品牌块（使用 `definition.ui.brand`）、`<SourceSwitcher>`、主题切换。
- `ShellStatusBar` — 底部栏，通过 `useIngestHealthStore` 显示 ingest 连接状态。
- `SidebarNav` — 固定 56px 列。渲染通过 `requiredCapability` 筛选的 `definition.nav`；通过 `usePathname` 高亮当前路由。
- `RightRail` — 上下文敏感面板。在 sessions 页显示会话详情；在回放页显示 turn 导航器 + 元数据。
- `SourceSwitcher` — 来自 `getAllDefinitions()` 的每个工具的按钮。点击时，通过 `buildSourceSwitchHref(pathname, targetToolId, tools)` 计算目标路由，使深度链接在切换后保持（例如 `/openclaw/sessions` → `/codex/sessions`）。
- `source-switcher-routing.ts` — 路由映射的纯函数；测试覆盖在 `tests/unit/bff/source-switcher-routing.test.ts`。

---

## 8. 回放界面（`components/replay/`）

最复杂的功能。会话回放路由位于 `/<tool>/sessions/<sessionId>`（[`app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx`](../../app/(tool-shell)/%5Btool%5D/sessions/%5BsessionId%5D/page.tsx)）驱动了整体布局：

1. 调用 `useSessionDetail(toolId, sessionId)` 获取头部/元数据。
2. 调用 `useSessionTurns(toolId, sessionId, { offset: 0, limit: 50 })` 获取第一页 turns。
3. 维护跨分页的累计 turns —— 在 `handleLoadMore` 时将新页追加到 `allTurns` 状态。
4. 渲染 `<ReplayHeader>`、可选的 `<SessionStatusBar>`、`<ReplaySearchBar>`、`<TurnNavigator>`，然后渲染骨架屏、"NO TURNS" 空状态或 `<TurnTimeline>`。

### `TurnTimeline`

- 当 `turns.length > 15` 或 `hasMore` 时使用 `@tanstack/react-virtual`。短会话使用普通渲染（无虚拟化）。
- 首次加载时若长度 ≤ 10，自动展开所有 turns。
- 通过 `useReplayStore` 按 session ID 持久化滚动位置，使后退导航能够恢复。
- 接近底部时调用 `onLoadMore` —— 父组件追加下一页。

### `TurnCard`

- 渲染一个 turn：用户消息、助手消息、活动（tool / skill / subagent / thinking / system）。
- 在可能的情况下，活动会锚定到特定消息序号 — `groupActivityEntriesByOrdinal` 将活动与助手消息交错排列，使工具调用出现在触发它的消息旁边。
- 折叠视图显示徽章（`toolCount`、`skillCount`、`subagentCount`）。
- 复制 turn 按钮将 markdown 格式的 `## Turn N\n**User:** ... \n**Assistant:** ...` 写入剪贴板。

### Block 组件

每种活动类型都有各自的 block 组件，全部位于 `components/replay/` 下：

- `tool-block.tsx` — 输入 JSON 查看器 + 结果事件（支持部分流式输出）
- `skill-block.tsx` — skill 元数据 + 调用信息
- `subagent-block.tsx` — 指向子 agent 会话的链接，递归回放链接
- `thinking-block.tsx` — 可折叠的 thinking 追踪
- `system-event-block.tsx` — 紧凑的系统消息，支持按 subtype 渲染
- `markdown-content.tsx` — `react-markdown` + `remark-gfm`，用于助手消息正文

`key-utils.ts` 导出 `getTurnKey`、`getActivityKey`、`getMessageKey` — 用于 React reconciliation 跨重新渲染的稳定键。测试在 `tests/unit/bff/replay-key-utils.test.ts`。

### 搜索

`ReplaySearchBar` 将查询写入 `useReplayStore.searchQuery`。`TurnCard` 使用查询计算并高亮匹配项；store 还追踪 `searchMatches` 和 `currentMatchIndex` 以支持上/下导航，`TurnNavigator` 将这些暴露为键盘可访问的 UI。

---

## 9. 会话列表（`components/sessions/`）

- `AggregateSessionsView` — 当 `toolId === 'all'` 时使用。显示来自所有数据源的会话，使用 `all/definition.ts` 中更宽的 `sessionColumns`（包含 `project` 列）。
- `SessionStatsDashboard` — 用于单数据源视图。渲染每个工具的仪表盘以及带有工具特定列集的会话表格。
- `SessionsRightRail` — 选中某行时显示会话详情抽屉。
- `SessionsStatsBar` — 摘要数字行。

---

## 10. HUD 组件（`components/hud/`）

- `IngestHealthOverlay` — 由 `app/layout.tsx` 显示的全屏覆盖层。轮询 `/api/ingest/health` 并更新 `ingest-health-store`。当 ingest 服务不可达或预热未完成时，它显示可见的"INGEST UNAVAILABLE"状态，而不是让用户盯着空数据。
- `HudPanel` — 跨仪表盘小组件共享的通用样式面板容器。
- `ThemeToggle` — 亮色/暗色/系统选择器，更新 `theme-store` 并将选择写入 `localStorage`（`theme-storage` 键，由同步引导脚本读取）。

---

## 11. 样式

- **Tailwind v4。** 没有 `tailwind.config.js` — 主题令牌位于 `app/globals.css` 的 `@theme inline { ... }` 中。PostCSS 管道仅为 `@tailwindcss/postcss`（`postcss.config.mjs`）。
- **仅语义化令牌。** 使用 `bg-background`、`text-foreground`、`border-border`、`text-muted-foreground`、`text-accent`、`text-destructive`、`bg-card`。不要在组件文件中硬编码 hex/oklch 值。
- **OKLCH 色彩空间**，使用 `radix-nova` shadcn 风格。`components/replay/[sessionId]/page.tsx` 中 `SessionStatusBar` 的状态颜色使用原始的 `oklch(...)` 用于窄范围强调目的 — 当需要一次性非令牌颜色时，复制该模式。
- **两种主题都必须通过 WCAG AA。** 使用切换器进行验证。
- **字体。** `JetBrains Mono`（等宽 `--font-jetbrains-mono`）和 `Inter`（无衬线 `--font-inter`）通过 `next/font/google` 在 `app/layout.tsx` 中加载，设置 `display: 'swap'`。
- **HUD 实用类。** `hud-clip-sm` 是自定义实用类（在 `globals.css` 中定义），用于按钮和卡片上的赛博朋克风格斜角边框。

---

## 12. 添加前端功能

完整的操作手册请参见 [`../DEVELOPMENT.md`](../DEVELOPMENT.md#43-adding-a-frontend-page)。快速检查清单：

1. 确定它是每个工具独有的还是全局的。每个工具 → `app/(tool-shell)/[tool]/...`。全局 → 路由分组外的 `app/...`。
2. 如果需要为某些工具隐藏，在 `lib/agent-tools/<tool>/definition.ts` 中为相关工具定义添加一个带有 `requiredCapability` 的 `nav` 项。
3. 对于数据获取，在 `client-hooks.tsx` 中编写一个访问 BFF 的 hook。不要直接调用 ingest。
4. 对于状态，选择最小的合适 store。不要把 UI 状态倾倒进 `tool-store`。
5. 对于 UI 基础组件，使用 `pnpm dlx shadcn@latest add <name>` — 不要手写 `components/ui/`。
6. 对于令牌，添加到 `app/globals.css` 的 `@theme inline { ... }` 中。不要使用 hex。

如果要添加新的 ingest 数据源，前端方面需要：(a) `lib/agent-tools/<source>/definition.ts` 中的工具定义，(b) `lib/agent-tools/<source>/server-adapter.ts` 中的服务端适配器（从 openclaw 复制），(c) `registry.ts` 中的注册，(d) 通过 `TOOL_IDS` 扩展 `assertSourceToolId` 的允许列表。BFF 路由处理会自动分发；无需更改。
