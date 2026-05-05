# 前端架构研究：多 Agent Tool 仪表盘

**项目：** agent-tracing-dashboard  
**维度：** 前端页面与组件架构  
**调研日期：** 2026-05-06  
**整体信心：** MEDIUM-HIGH

## 结论

OpenClaw、Claude Code、Codex 不应该各自拥有一套完整页面。推荐采用“单一 Shell + 工具路由维度 + 共享页面模板 + Adapter/UI Profile 插槽”的结构：Shell、导航、列表、过滤、详情、Session Replay、内容解析、工具调用渲染全部共享；工具差异只落在数据 Adapter、能力声明、少量页面槽位和工具块元数据上。

当前代码已经有共享 Shell 的雏形：`app/(shell)/layout.tsx` 统一了 header/sidebar/status/right rail，`dashboard/page.tsx` 和 `sessions/page.tsx` 是功能页入口。但页面内部仍直接耦合 OpenClaw/Gateway 形态，例如 `SessionsDetailRail` 直接 fetch `/api/sessions/messages`，`ShellHeader` 写死 `OVAO`，`SidebarNav` 写死导航项，`ChatBubble` 只显示截断文本。下一步应把这些耦合点下沉到 `agent-tools` Adapter 层和 `session-replay` 共享渲染层。

agentsview 的 Svelte 实现给出的核心经验是：复杂 transcript 不应由普通聊天气泡渲染，而应先归一化成 display items，再按 segment 类型渲染 text/thinking/code/tool/subagent/system boundary。React/Next 版本应移植这个“纯函数解析 + 虚拟列表 + 可扩展 block registry”的思想，而不是移植 Svelte 组件本身。

## 推荐总架构

```text
RootLayout: app/layout.tsx
  |
  +-- Legacy redirects
  |     /dashboard  -> /openclaw/dashboard
  |     /sessions   -> /openclaw/sessions
  |
  +-- Tool Shell Route: app/(tool-shell)/[tool]/layout.tsx
        |
        +-- validate tool param: openclaw | claude-code | codex
        +-- AgentToolProvider(toolId)
        +-- ShellFrame
              |
              +-- ShellHeader           shared, reads ToolUIProfile
              +-- SidebarNav            shared, built from capabilities/nav config
              +-- ShellStatusBar        shared, reads connection/session state
              +-- optional RightRail    shared frame, tool slots inside
              |
              +-- Route content
                    |
                    +-- DashboardTemplate
                    |     +-- shared KPI/grid/layout primitives
                    |     +-- tool-specific slots
                    |
                    +-- SessionsTemplate
                    |     +-- SessionExplorer
                    |     +-- SessionReplay
                    |
                    +-- ActivityTemplate
                    |     +-- shared log/event browser
                    |
                    +-- Capability-gated pages
                          +-- office only when tool.capabilities.office = true
```

关键点：

1. `tool` 必须是 URL 段，而不是 query。`/openclaw/sessions`、`/claude-code/sessions`、`/codex/sessions` 可收藏、可深链、可并行测试。
2. Shell Frame 放到 `[tool]/layout.tsx` 下面，而不是继续放在不带参数的 `app/(shell)/layout.tsx` 中。父 layout 不能可靠持有子动态段的工具上下文，Shell header/sidebar 又必须读取当前工具 profile。
3. 保留 legacy redirects 兼容现有 `/dashboard`、`/sessions` 路径，默认指向 `openclaw`。
4. 不使用多 root layout。Next.js 官方文档说明跨不同 root layout 导航会触发整页加载；本项目需要一个连续的 dashboard 体验。

## 路由结构

推荐目标结构：

```text
app/
  layout.tsx
  page.tsx                         # redirect('/openclaw/dashboard')

  (legacy)/
    dashboard/page.tsx             # redirect('/openclaw/dashboard')
    sessions/page.tsx              # redirect('/openclaw/sessions')
    activity/page.tsx              # redirect('/openclaw/activity')
    office/page.tsx                # redirect('/openclaw/office')
    workspace/page.tsx             # redirect('/openclaw/workspace')

  (tool-shell)/
    [tool]/
      layout.tsx                   # validate params.tool, mount AgentToolProvider + ShellFrame
      dashboard/page.tsx           # shared DashboardRoute
      sessions/page.tsx            # shared SessionListRoute
      sessions/[sessionId]/page.tsx# shared SessionReplayRoute
      activity/page.tsx            # shared ActivityRoute
      traces/[traceId]/page.tsx    # optional future deep link for trace/replay
      office/page.tsx              # capability-gated; OpenClaw only initially
      workspace/page.tsx           # capability-gated; if a tool exposes active workspace

  api/
    agent-tools/
      [tool]/
        health/route.ts
        dashboard/route.ts
        sessions/route.ts
        sessions/[sessionId]/messages/route.ts
        activity/route.ts
```

迁移时可以先保留现有 `app/(shell)`，但最终建议把可交互 Shell 提取成 `components/shell/shell-frame.tsx`，由 `app/(tool-shell)/[tool]/layout.tsx` 调用。这样工具上下文、导航项、品牌名和 capability gate 都有明确来源。

`[tool]/layout.tsx` 建议保持为 Server Component，只负责参数校验和挂载 client provider/frame：

```typescript
export default async function ToolLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tool: string }>
}) {
  const { tool } = await params
  const toolId = assertAgentToolId(tool)

  return (
    <AgentToolProvider toolId={toolId}>
      <ShellFrame>{children}</ShellFrame>
    </AgentToolProvider>
  )
}
```

## 目录与边界

```text
components/
  shell/
    shell-frame.tsx
    shell-header.tsx
    sidebar-nav.tsx
    shell-status-bar.tsx

  dashboard/
    dashboard-template.tsx         # shared layout only
    dashboard-kpi-bar.tsx
    dashboard-grid.tsx

  sessions/
    session-explorer.tsx           # filters/table/master-detail frame
    sessions-table.tsx             # shared table, columns from profile
    session-detail-rail.tsx        # frame only, delegates replay

  replay/
    session-replay.tsx
    replay-toolbar.tsx
    replay-message-list.tsx
    replay-message-card.tsx
    message-content.tsx
    thinking-block.tsx
    code-block.tsx
    tool-call-block.tsx
    parallel-tool-group.tsx
    subagent-inline.tsx
    system-boundary-card.tsx

features/
  dashboard/
    dashboard-route.tsx            # query state + template composition
  sessions/
    sessions-route.tsx             # query state + adapter hooks
  activity/
    activity-route.tsx

lib/
  agent-tools/
    types.ts
    registry.ts
    capability-gate.ts
    client-hooks.ts
    server-adapters.ts
    openclaw/
      definition.ts
      server-adapter.ts
      ui-profile.tsx
    claude-code/
      definition.ts
      server-adapter.ts
      ui-profile.tsx
    codex/
      definition.ts
      server-adapter.ts
      ui-profile.tsx

  session-replay/
    types.ts
    normalize.ts
    content-parser.ts
    display-items.ts
    tool-registry.ts
    format.ts
```

边界原则：

| 层 | 职责 | 禁止事项 |
|---|---|---|
| `app/` routes | URL、layout、redirect、capability gate | 不写业务解析、不直接读 transcript 文件 |
| `components/shell` | 全局框架与导航呈现 | 不关心 OpenClaw/Claude/Codex 数据格式 |
| `features/*` | 页面状态、查询参数、组合共享模板 | 不解析原始 JSONL，不写工具专属分支森林 |
| `components/replay` | Session Replay 可视化 | 不直接 fetch `/api/...`，不读文件系统 |
| `lib/session-replay` | 纯函数解析、归一化、display items | 不 import React 组件 |
| `lib/agent-tools/*/server-adapter` | 工具专属数据读取与归一化 | 不 import client component，不依赖浏览器 API |
| `ui-profile.tsx` | 工具专属小插槽、列定义、badge、空状态 | 不做 IO，不解析原始数据 |

## Adapter 与 Provider 接口

推荐把“数据 Adapter”和“UI Profile”分开。原因是 Next/React 的 Client Provider 不能安全接收 server-only 函数，文件系统读取也不能进入 client bundle。

```typescript
export type AgentToolId = 'openclaw' | 'claude-code' | 'codex'

export interface AgentToolDefinition {
  id: AgentToolId
  label: string
  shortLabel: string
  defaultRoute: string
  capabilities: AgentToolCapabilities
  nav: ToolNavItem[]
  ui: AgentToolUIProfile
}

export interface AgentToolCapabilities {
  liveGateway: boolean
  sessions: boolean
  replay: boolean
  activity: boolean
  office: boolean
  workspace: boolean
  subagents: boolean
  cost: boolean
  approvals: boolean
}

export interface ToolNavItem {
  id: string
  href: (toolId: AgentToolId) => string
  label: string
  title: string
  requiredCapability?: keyof AgentToolCapabilities
}

export interface AgentToolUIProfile {
  brand: {
    name: string
    versionLabel?: string
    accentToken?: string
  }
  sessionColumns: SessionColumnDef[]
  dashboardSlots?: {
    overviewHero?: React.ComponentType
    rightRail?: React.ComponentType
    emptyState?: React.ComponentType
  }
  replayBlocks?: ReplayBlockRegistry
  formatSessionLabel?: (session: NormalizedSession) => string
  formatToolName?: (tool: NormalizedToolCall) => string
}

export interface AgentToolServerAdapter {
  health(): Promise<ToolHealth>
  getDashboardSnapshot(): Promise<DashboardSnapshot>
  listSessions(query: SessionQuery): Promise<SessionListResult>
  getSession(sessionId: string): Promise<NormalizedSession | null>
  getReplayPage(sessionId: string, query: ReplayQuery): Promise<ReplayPage>
  listActivity?(query: ActivityQuery): Promise<ActivityPage>
}
```

Provider 只暴露 client-safe 内容：

```typescript
export interface AgentToolContextValue {
  toolId: AgentToolId
  definition: AgentToolDefinition
  capabilities: AgentToolCapabilities
  href: (route: string) => string
}

export function AgentToolProvider({
  toolId,
  children,
}: {
  toolId: AgentToolId
  children: React.ReactNode
}) {
  const definition = getClientToolDefinition(toolId)

  return (
    <AgentToolContext.Provider
      value={{
        toolId,
        definition,
        capabilities: definition.capabilities,
        href: (route) => `/${toolId}${route}`,
      }}
    >
      {children}
    </AgentToolContext.Provider>
  )
}
```

数据 hooks 统一走工具 URL：

```typescript
export function useToolSessions(query: SessionQuery) {
  const { toolId } = useAgentTool()
  return useSWR(['/api/agent-tools', toolId, 'sessions', query], () =>
    fetchToolJson<SessionListResult>(`/api/agent-tools/${toolId}/sessions`, query)
  )
}
```

OpenClaw 的实时 Gateway 可以继续使用现有 store/bootstrap，但要藏在 `openclaw` client hook 之后：

```text
useToolDashboard()
  openclaw     -> useGatewayStore selectors + snapshot fallback
  claude-code  -> fetch /api/agent-tools/claude-code/dashboard
  codex        -> fetch /api/agent-tools/codex/dashboard
```

这样共享页面只依赖 `useToolDashboard/useToolSessions/useReplayPage`，不依赖 OpenClaw store 名称。

## 共享 Session Replay 架构

当前 `SessionsDetailRail` 的聊天气泡适合预览，不适合作为 trace/replay 主视图。推荐拆成下面的管线：

```text
Raw source
  OpenClaw session jsonl
  Claude Code transcript
  Codex session/events
      |
      v
AgentToolServerAdapter
      |
      v
NormalizedReplay
  NormalizedSession
  NormalizedMessage[]
  NormalizedToolCall[]
  Timing/usage/subagent links
      |
      v
session-replay pure functions
  parseContent()
  enrichSegments()
  buildDisplayItems()
  filterDisplayItems()
      |
      v
React replay components
  SessionReplay
  ReplayToolbar
  ReplayMessageList
  MessageContent
  ToolCallBlock
  SubagentInline
```

推荐标准类型：

```typescript
export interface NormalizedSession {
  id: string
  toolId: AgentToolId
  title: string
  status: 'active' | 'idle' | 'aborted' | 'error' | 'complete'
  createdAt?: string
  updatedAt?: string
  model?: string
  totalTokens?: number
  costUsd?: number
  kind?: string
  parentSessionId?: string
  tags?: string[]
}

export interface NormalizedMessage {
  id: string
  ordinal: number
  sessionId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp?: string
  model?: string
  hasToolUse?: boolean
  toolCalls?: NormalizedToolCall[]
  usage?: TokenUsage
  sourceSubtype?: 'compact_boundary' | 'system_boundary' | 'approval' | string
}

export interface NormalizedToolCall {
  id: string
  name: string
  category:
    | 'Read'
    | 'Write'
    | 'Edit'
    | 'Bash'
    | 'Search'
    | 'Task'
    | 'Approval'
    | 'Network'
    | 'Other'
  inputJson?: string
  resultContent?: string
  resultEvents?: NormalizedToolResultEvent[]
  subagentSessionId?: string
  startedAt?: string
  durationMs?: number
  status?: 'pending' | 'running' | 'success' | 'error' | 'canceled'
}
```

Replay 组件拆分：

| 组件 | 共享程度 | 说明 |
|---|---:|---|
| `SessionReplay` | 100% | 加载状态、错误状态、toolbar、list 编排 |
| `ReplayToolbar` | 90% | 搜索、排序、block filters、compact/stream layout；按钮由 capability 控制 |
| `ReplayMessageList` | 100% | 虚拟列表、滚动到 ordinal、无限加载 older messages |
| `MessageContent` | 95% | role header、tokens、timestamp、markdown、segments |
| `ToolCallBlock` | 85% | 折叠、预览、duration、input/output/history；工具名和 meta tags 来自 `ReplayBlockRegistry` |
| `ParallelToolGroup` | 100% | 连续 tool-only assistant message 分组 |
| `SubagentInline` | 80% | 子 session 展开；OpenClaw/Claude/Codex 的子任务命名可由 profile 调整 |
| `SystemBoundaryCard` | 90% | compact/system/approval 等边界事件 |
| `SessionTable` | 85% | 列定义、badge、行 secondary text 由 `AgentToolUIProfile` 注入 |

从 agentsview 移植的优先级：

1. `display-items.ts` 的连续 tool-only message 分组思想。
2. `content-parser.ts` 的 thinking/tool/code/skill segment 解析与 structured tool calls enrichment。
3. `ToolBlock.svelte` 的 input/output/history/subagent 展开模型。
4. `MessageList.svelte` 的虚拟滚动、search highlight、block visibility、scroll-to-ordinal。
5. `SubagentInline.svelte` 的懒加载子 session 和“作为完整 session 打开”入口。

不要移植的部分：

1. Svelte store 结构。
2. Svelte CSS 变量命名。
3. 直接写死 Claude/Pi/OpenCode 工具名的全局正则。React 版应允许每个 Adapter 扩展 tool aliases 和 block metadata。

## Agent-specific 差异应放在哪里

| 差异 | 放置位置 | 示例 |
|---|---|---|
| 品牌名、版本、导航项 | `AgentToolUIProfile` | OpenClaw 显示 Gateway；Codex 显示 sandbox/approval；Claude Code 显示 transcript/subagents |
| 数据读取 | `AgentToolServerAdapter` | OpenClaw 读 gateway/agents sessions；Claude Code 读 transcript；Codex 读 `.omc` 或 trace events |
| Session 表格列 | `sessionColumns` | OpenClaw: agent/channel/kind；Claude Code: cwd/model/subagent；Codex: sandbox/approval/command |
| Dashboard 独有卡片 | `dashboardSlots` | OpenClaw office/cron；Claude todos/hooks；Codex approvals/patches |
| ToolCall 元数据 | `ReplayBlockRegistry` | Bash command、Edit path、Task subagent、approval decision |
| 不支持的页面 | capability gate | `office` 对 Claude/Codex 返回 unsupported empty state 或 redirect |

页面模板只处理共同布局：

```typescript
export function DashboardRoute() {
  const { definition } = useAgentTool()
  const dashboard = useToolDashboard()

  return (
    <DashboardTemplate
      snapshot={dashboard.data}
      slots={definition.ui.dashboardSlots}
    />
  )
}
```

避免在页面里写：

```typescript
if (toolId === 'openclaw') return <OpenClawDashboard />
if (toolId === 'codex') return <CodexDashboard />
```

只有当某个页面的信息架构完全不同，才允许工具级 route component 覆盖。默认策略是“共享页面模板 + slots”。

## 当前代码的具体迁移点

| 当前文件 | 问题 | 目标形态 |
|---|---|---|
| `app/(shell)/layout.tsx` | Shell 与 OpenClaw bootstrap/right rail 绑在一起 | 提取 `ShellFrame`，由 `[tool]/layout.tsx` 提供 tool context |
| `components/hud/shell-header.tsx` | `OVAO`、`GATEWAY`、nav items 写死 | 从 `AgentToolUIProfile.brand` 与 shared nav 读取 |
| `components/dashboard/sidebar-nav.tsx` | `NAV_ITEMS` 写死，active tab 混合 query/path | 从 `definition.nav` 和 pathname 计算，按 capability 过滤 |
| `app/(shell)/dashboard/page.tsx` | dashboard tab 属于 OpenClaw 旧模型 | 改为 `features/dashboard/dashboard-route.tsx`，tabs/slots 来自 profile |
| `app/(shell)/sessions/page.tsx` | 直接使用 gateway selector、cron filter | 改为 `features/sessions/sessions-route.tsx`，filter schema 由 adapter/profile 给默认值 |
| `components/sessions/sessions-table.tsx` | 列和状态计算写死 | 保留表格框架，列定义和 status mapper 注入 |
| `components/sessions/sessions-detail-rail.tsx` | 组件内 fetch OpenClaw API，最多显示 100 个简单气泡 | 变成 detail frame，内部挂 `SessionReplay` |
| `components/sessions/chat-bubble.tsx` | 截断内容，无法表示工具调用/思考/子代理 | 降级为 preview 组件或删除，主视图使用 replay renderer |
| `app/api/sessions/messages/route.ts` | OpenClaw 文件路径和 JSONL 解析写死 | 移到 `api/agent-tools/openclaw/...` Adapter route |

注意：本次工作区快照中没有看到 `stores/`、`types/`、`package.json`，但当前组件仍 import `@/stores/...` 和 `@/types/...`。这说明 pivot 工作区可能处于不完整迁移状态。Roadmap 阶段需要先确认这些目录是会恢复、重建，还是替换为新的 `lib/agent-tools/client-hooks`。

## Build Order

1. **定义共享领域模型**
   - 新增 `lib/agent-tools/types.ts`、`lib/session-replay/types.ts`。
   - 先覆盖 `NormalizedSession`、`NormalizedMessage`、`NormalizedToolCall`、`AgentToolDefinition`。
   - 不改 UI 行为，只建立编译期边界。

2. **建立工具 registry 和 OpenClaw 默认 profile**
   - 新增 `lib/agent-tools/registry.ts`。
   - 把当前 OVAO/OpenClaw 品牌、导航、session columns、capabilities 写成 `openclaw` definition。
   - 先让现有页面仍表现为 OpenClaw。

3. **提取 ShellFrame 并引入 `[tool]` 路由**
   - 从 `app/(shell)/layout.tsx` 提取 `components/shell/shell-frame.tsx`。
   - 新增 `app/(tool-shell)/[tool]/layout.tsx`。
   - 新增 legacy redirects，默认 `/dashboard` 到 `/openclaw/dashboard`。

4. **把 Header/Sidebar 改成 profile-driven**
   - `ShellHeader` 读取 `definition.ui.brand`。
   - `SidebarNav` 读取 `definition.nav`，按 capability 过滤。
   - 保持 HUD 视觉 token，不为工具复制 Shell 组件。

5. **抽取 SessionsTemplate**
   - 将 `sessions/page.tsx` 中的过滤、hide cron、表格、detail rail 拆到 `features/sessions`。
   - `SessionsTable` 支持 `columns`、`statusMapper`、`rowBadges` 注入。
   - `SessionsDetailRail` 不再自己 fetch messages。

6. **移植 session-replay 纯函数**
   - 从 agentsview 思路移植 `content-parser.ts`、`display-items.ts`。
   - 加测试夹具覆盖 OpenClaw JSONL、Claude Code transcript、Codex events。
   - 工具名 alias 从 `ReplayBlockRegistry` 注入。

7. **实现 React Replay 组件**
   - `SessionReplay`、`ReplayMessageList`、`MessageContent`、`ToolCallBlock`、`SubagentInline`。
   - 长 transcript 使用 `@tanstack/react-virtual`；React 19 下建议设置 `useFlushSync: false`，降低滚动场景的同步刷新风险。

8. **Adapter 化 API routes**
   - `/api/sessions/messages` 迁到 `/api/agent-tools/openclaw/sessions/[sessionId]/messages`。
   - 再实现 `claude-code` 和 `codex` 的只读 Adapter。
   - 共享页面只调用 `useToolSessions/useReplayPage`。

9. **添加工具专属 slots**
   - OpenClaw: office/cron/channel/skills。
   - Claude Code: subagents/todos/hooks/transcript boundaries。
   - Codex: sandbox approvals/patch summaries/command execution。
   - slots 控制局部差异，不 fork 整页。

10. **验证与收敛**
    - 每个工具至少准备 3 个 replay fixture：普通对话、工具调用密集、子代理/approval 边界。
    - 验证 desktop/mobile、dark/light、1000+ messages、scroll-to-ordinal、filter/search。

## 反模式

1. **整页 fork**
   - 问题：`OpenClawSessionsPage`、`ClaudeSessionsPage`、`CodexSessionsPage` 会快速复制过滤、空状态、列表、详情、滚动逻辑。
   - 替代：共享 `SessionsTemplate`，差异通过 profile columns 和 replay registry 注入。

2. **在组件内直接 fetch 工具 API**
   - 问题：`SessionsDetailRail` 现在直接调用 `/api/sessions/messages`，导致无法切换工具。
   - 替代：route/hooks 通过 `toolId` 访问 `/api/agent-tools/[tool]/...`。

3. **把工具解析写进 React 组件**
   - 问题：组件会变成 regex 和 UI 混合体，难测且难支持新 agent。
   - 替代：`lib/session-replay` 保持纯函数，组件只消费 normalized segments。

4. **多 root layout 分工具**
   - 问题：跨工具导航会整页加载，Shell 状态难保持。
   - 替代：单 root layout，动态 `[tool]` layout 复用同一个 ShellFrame。

5. **用 query 表示工具**
   - 问题：`/sessions?tool=codex` 会让导航、深链、active state、server adapter 解析更脆弱。
   - 替代：`/[tool]/sessions`。

6. **把 Adapter 和 UI slot 绑定成一个巨型对象**
   - 问题：server-only IO 可能进入 client bundle。
   - 替代：client-safe `definition/ui-profile` 与 server-only `server-adapter` 分文件。

## Roadmap 含义

建议路线不是先做 Claude/Codex 页面，而是先把 OpenClaw 旧页面收敛成可配置模板。只有 OpenClaw 通过新 registry/adapter/profile 跑通后，再加 Claude Code 和 Codex。这样每新增一个工具时，主要工作是数据归一化和少量 slots，而不是重建仪表盘。

最需要提前研究的阶段是 session replay。它决定三类 agent transcript 能否共享同一套用户体验，也是后续搜索、过滤、时间线、子代理展开、approval 审计的共同基础。

## 来源与信心

| 来源 | 用途 | 信心 |
|---|---|---|
| `CLAUDE.md` | 当前 Next/Tailwind/shadcn/Zustand 约束、中文文档约定、App Router 注意事项 | HIGH |
| `app/(shell)/layout.tsx`、`shell-header.tsx`、`sidebar-nav.tsx` | 当前 Shell 和导航耦合点 | HIGH |
| `sessions/page.tsx`、`sessions-table.tsx`、`sessions-detail-rail.tsx`、`chat-bubble.tsx` | 当前 Session 页面和 replay 缺口 | HIGH |
| agentsview `MessageList.svelte`、`MessageContent.svelte`、`ToolBlock.svelte`、`SubagentInline.svelte` | display items、虚拟列表、工具块、子代理展开模式 | HIGH |
| agentsview `display-items.ts`、`content-parser.ts` | 可移植的纯函数解析与分组思想 | HIGH |
| Next.js Route Groups 文档，2026-03-31 | route group 不进入 URL、route group 用途和 caveats | HIGH |
| Next.js Layout 文档，2026-03-31 | root layout、layout 缓存、params Promise、避免多 root layout 切换成本 | HIGH |
| Next.js Server/Client Components 文档 | Client Provider 应放在合适深度、Server/Client 组合方式 | HIGH |
| TanStack React Virtual 文档 | 长列表虚拟滚动 API，React 19 下 `useFlushSync: false` 的建议 | MEDIUM-HIGH |

官方来源：

- https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
- https://nextjs.org/docs/app/api-reference/file-conventions/layout
- https://nextjs.org/docs/app/getting-started/server-and-client-components
- https://tanstack.com/virtual/latest/docs/framework/react/react-virtual

## 未决问题

1. Claude Code 和 Codex 的本地 transcript/event 文件格式需要单独确认，当前研究只定义了前端归一化边界。
2. 当前工作区缺少 `package.json`、`stores/`、`types/` 目录，需要确认是 pivot 暂态还是预期删除。
3. OpenClaw Gateway 的实时订阅是否继续通过 Zustand store 暴露，还是统一改为 SWR/API polling，需要数据层研究决定。
4. Session replay 是否需要跨工具统一“成本/usage”计算，取决于 Claude/Codex 原始数据是否有可靠 token/cost 字段。
