# Phase 7: Sessions Dashboard - Research

**Researched:** 2026-05-02
**Domain:** Sessions Dashboard (数据展示 + 表格组件 + 实时更新)
**Confidence:** HIGH

## Summary

Phase 7 将 Channels 替换为 Sessions，展示 AI 会话的完整生命周期（token 用量、费用、消息历史、状态追踪），支持多维过滤、会话详情和实时更新。参考项目 `openclaw-dashboard-html` 提供了完整的 Sessions 实现参考，包括数据结构、表格布局、过滤逻辑和消息历史展示。

**Primary recommendation:** 复用现有 Dashboard/Skills 页面布局模式（Sidebar + Center + Right Rail），Sessions 页面采用 Stats bar + 可折叠 Filter bar + 紧凑表格布局，右侧 360px 面板展示选中 Session 的详情（info 区 + chat bubbles 消息历史）。数据层扩展 `SessionInfo` 类型以对齐 Gateway 完整字段，通过 `sessions.list` RPC 获取列表，消息历史通过 Next.js API route 读取 Gateway 的 .jsonl 文件获取。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sessions 列表展示和过滤 | API / Backend (Gateway RPC) | Browser / Client | 数据由 Gateway 的 `sessions.list` RPC 提供，前端仅展示和过滤 |
| Session 详情和消息历史 | API / Backend (Next.js API route) | Browser / Client | 消息历史存储在 Gateway 的 .jsonl 文件中，Next.js API route 封装文件读取 |
| 实时状态更新 | WebSocket (Gateway WS) | Browser / Client | Gateway WS 推送 agent 事件，前端更新 Session 状态 |
| 多维过滤和搜索 | Browser / Client | — | 前端基于已获取数据进行过滤（Status/Model/Kind/搜索） |
| UI 交互（展开行、选中行） | Browser / Client | — | 纯前端交互状态管理 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Next.js** | 16.2.4 | App Router + SSR + API Routes | 项目已采用，提供路由、布局和 API route 基础设施 |
| **React** | 19.2.4 | 组件框架 | 项目已采用，与 Next.js 16 配套 |
| **Zustand** | 5.0.12 | 状态管理 | 项目已采用，Sessions selector 遵循 P0 selector 模式 |
| **Tailwind CSS** | v4 | 样式系统 | 项目已采用，CSS-first 配置，使用 `@theme inline` |
| **shadcn/ui** | 4.6.0 | UI 组件基础 | 项目已采用，radix-nova style，提供 button/card/badge/separator |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **lucide-react** | 1.14.0 | 图标库 | 项目已采用，Sessions 页面图标（筛选、搜索、展开） |
| **clsx + tailwind-merge** | 2.1.1 + 3.5.0 | className 组合 | 项目已采用，`cn()` 工具函数用于条件样式 |
| **WebSocket (ws)** | 8.20.0 | Gateway WS 连接 | 项目已采用，`GatewayWsClient` 处理实时事件 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 手写表格组件 | TanStack Table (React Table) | TanStack Table 功能强大但复杂度较高，当前需求简单（4 列 + 展开行），手写 CSS Grid 更轻量 |
| 自定义过滤面板 | shadcn Collapsible + Filter 组件 | shadcn 没有 Filter 组件，Collapsible 适合折叠面板，但当前设计简单，手写即可 |
| 虚拟滚动消息历史 | react-window 或 react-virtualized | 消息历史通常几十条，不需要虚拟滚动，全量加载即可 |

**Installation:**
```bash
# 无需安装新依赖，复用现有栈
pnpm install  # 确保现有依赖完整
```

**Version verification:** 当前项目依赖版本已锁定，无需更新。

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser / Client                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Sessions Page (/sessions)                                  │ │
│  │  ┌──────────────┐  ┌──────────────────┐  ┌─────────────┐  │ │
│  │  │ Stats Bar     │  │ Filter Bar       │  │ Sessions    │  │ │
│  │  │ (4 metrics)   │  │ (collapsible)    │  │ Table       │  │ │
│  │  └──────────────┘  └──────────────────┘  │ (expandable │  │ │
│  │                                            │  rows)      │  │ │
│  │  ┌──────────────────────────────────────┐ │             │  │ │
│  │  │ Right Rail (360px)                   │ │             │  │ │
│  │  │ ┌────────────────┐ ┌──────────────┐ │ │             │  │ │
│  │  │ │ Session Info   │ │ Chat Bubbles │ │ │             │  │ │
│  │  │ │ (model/tokens) │ │ (messages)   │ │ │             │  │ │
│  │  │ └────────────────┘ └──────────────┘ │ │             │  │ │
│  │  └──────────────────────────────────────┘ │             │  │ │
│  └────────────────────────────────────────────┘             │  │
└─────────────────────────────────────────────────────────────┘
        │                                          │
        │ RPC: sessions.list                       │ HTTP: /api/sessions/messages?id=xxx
        ▼                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js API Layer                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ app/api/sessions/messages/route.ts                         │ │
│  │ → Reads Gateway .jsonl files                               │ │
│  │ → Returns parsed messages                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        │                                          │
        ▼                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Gateway RPC / WebSocket                      │
│  ┌──────────────────┐          ┌──────────────────────────────┐ │
│  │ sessions.list    │          │ WS Events (agent lifecycle)  │ │
│  │ → SessionInfo[]  │          │ → update Session status      │ │
│  └──────────────────┘          └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Storage                                │
│  ┌──────────────────────┐    ┌──────────────────────────────┐  │
│  │ sessions.json        │    │ {sessionId}.jsonl            │  │
│  │ (session metadata)   │    │ (message history)            │  │
│  └──────────────────────┘    └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Data flow:**
1. Sessions 页面加载 → 调用 `sessions.list` RPC → 获取 SessionInfo[] → 存入 Zustand store
2. 用户点击 Session 行 → 选中状态存入组件 state → 右侧面板展示详情
3. 右侧面板加载 → 调用 Next.js API route `/api/sessions/messages?id=xxx` → 读取 Gateway .jsonl 文件 → 返回消息历史 → 渲染 chat bubbles
4. Gateway WS 推送 agent 事件 → 更新 Session 状态（Active/Idle/Aborted）→ 表格行实时更新

### Recommended Project Structure
```
app/(shell)/sessions/
├── page.tsx                      # Sessions 主页面（Stats + Filter + Table）
app/api/sessions/
├── messages/
│   └── route.ts                  # API route: 读取 Gateway .jsonl 文件
components/dashboard/
├── overview-tab.tsx              # 修改：Channels 区域改为 Sessions 概要
components/sessions/
├── sessions-stats-bar.tsx        # Stats bar（4 指标）
├── sessions-filter-bar.tsx       # 可折叠 Filter bar
├── sessions-table.tsx            # 紧凑表格（4 列 + 展开行）
├── sessions-detail-rail.tsx      # 右侧 360px 面板
├── chat-bubble.tsx               # Chat bubble 组件（user/assistant）
gateway/
├── adapter-types.ts              # 扩展 SessionInfo 类型
stores/gateway/
├── p0-selectors.ts               # 新增 selectSessionsState()
components/dashboard/sidebar-nav.tsx  # 修改：加 SES 导航项
components/hud/shell-header.tsx   # 修改：加 Sessions 链接
```

### Pattern 1: P0 Selector 模式（复用现有）
**What:** 统一的数据选择器层，返回 `{ state: P0UIState, data: T }`，封装连接状态和数据加载逻辑。
**When to use:** 所有需要从 Gateway store 读取数据的组件。
**Example:**
```typescript
// stores/gateway/p0-selectors.ts
export function selectSessionsState(state: GatewayState): { state: P0UIState; data: SessionInfo[] } {
  const base = connectionUIState(state.connectionStatus, state.isDashboardLoading);
  if (base) return sessionsBaseResults[base];

  const sessions = state.sessions; // 假设 store 新增 sessions 字段
  if (sessions.length === 0) return sessionsEmptyResult;
  return { state: 'success', data: sessions };
}
```

### Pattern 2: 可折叠 Filter 面板（手写）
**What:** 使用 useState 控制展开/收起状态，CSS Grid 布局内部控件。
**When to use:** 需要节省空间的高级筛选场景。
**Example:**
```typescript
const [filterExpanded, setFilterExpanded] = useState(false);
return (
  <div className="border border-border bg-card">
    <button onClick={() => setFilterExpanded(!filterExpanded)} className="flex items-center justify-between w-full px-3 py-2">
      <span>Filters</span>
      <span>{filterExpanded ? '▼' : '▶'}</span>
    </button>
    {filterExpanded && (
      <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-3 pb-3">
        {/* Status chips, Model chips, Search input */}
      </div>
    )}
  </div>
);
```

### Pattern 3: 表格展开行（手写）
**What:** 点击行切换展开状态，渲染详情区域（tokens, cost, kind, lastMessage）。
**When to use:** 需要在表格内展示更多详细信息但不跳转页面的场景。
**Example:**
```typescript
const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
const toggleExpand = (key: string) => {
  const next = new Set(expandedKeys);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  setExpandedKeys(next);
};
return (
  <>
    {sessions.map((s) => (
      <Fragment key={s.key}>
        <div onClick={() => toggleExpand(s.key)}>{/* row cells */}</div>
        {expandedKeys.has(s.key) && (
          <div className="border-t border-border bg-muted/30 p-3">
            {/* expanded details */}
          </div>
        )}
      </Fragment>
    ))}
  </>
);
```

### Anti-Patterns to Avoid
- **硬编码颜色值:** 必须使用语义化 token（`bg-background`, `text-foreground`, `border-border`），不要直接写 `#0a0a0f` 等。
- **在 selector 里做过滤:** selector 只返回原始数据，过滤逻辑放在组件内部或 useMemo 里，避免 selector 返回值频繁变化导致不必要的重渲染。
- **每次渲染重新创建数组/对象:** 用 useMemo 缓存过滤后的 sessions 列表，依赖项是 filter state 和原始数据。
- **直接操作 DOM:** 用 React state 控制展开/收起，不要用 `document.getElementById` 等 DOM API。
- **忽略空状态:** 必须处理 `sessions.length === 0` 的情况，展示 "No sessions found" 而不是空白页。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| **表格排序** | 手写 sort 逻辑 + 图标状态 | 用 useState 存 sort field/dir，useMemo 计算 sorted array | 避免状态管理混乱，复用现有 pattern |
| **搜索防抖** | 手写 setTimeout + clearTimeout | 用 `useDebouncedCallback` from `use-debounce`（如果已引入）或简单 useEffect 延迟更新 | 避免内存泄漏和竞态条件 |
| **Chat bubble 样式** | 手写 role-based 颜色和布局 | 用 CSS 条件类 + 语义化 token（user 右对齐 + accent 色，assistant 左对齐 + neutral 色） | 保持视觉一致性，简化维护 |
| **Status 指示器** | 手写 pulse/glow 动画 | 复用 `StatusIndicator` 组件或用 Tailwind `animate-pulse` + `shadow-[color]` | 保持 HUD 风格统一 |
| **时间格式化** | 手写 Date 计算逻辑 | 用工具函数 `fmtAgo()`（已在 `overview-tab.tsx` 中） | 避免重复代码，保持格式一致 |

**Key insight:** Sessions 页面的复杂度主要在数据展示和交互，不需要引入额外的重型库。手写 CSS Grid 表格和过滤逻辑足够简单且可控。

## Runtime State Inventory

> 本阶段为新建页面，不涉及 rename/refactor，无需 Runtime State Inventory。

## Common Pitfalls

### Pitfall 1: 表格行展开状态丢失
**What goes wrong:** 切换 filter 或 sort 后，展开的行被收起，用户体验差。
**Why it happens:** filter/sort 改变后列表重新渲染，expandedKeys Set 中的 key 可能不存在于新列表中。
**How to avoid:** 在 useMemo 计算 filtered/sorted sessions 时保留 expandedKeys，或者在 render 时检查 `expandedKeys.has(s.key)` 而不是依赖索引。
**Warning signs:** 切换 filter 后所有行都收起了，或者展开状态不正确。

### Pitfall 2: 实时状态更新不及时
**What goes wrong:** Session 状态（Active/Idle/Aborted）没有实时更新，用户看到过期数据。
**Why it happens:** Gateway WS 推送的是 agent 事件，需要映射到 Session 状态，映射逻辑可能缺失或错误。
**How to avoid:** 在 `gateway-store.ts` 的 `handleAgentEvent` 里更新 Session 状态，通过 `sessionKey` 找到对应 Session，更新 `updatedAt` 和 `aborted` 字段。
**Warning signs:** Session 状态一直是 "Active" 但 agent 已经停止工作。

### Pitfall 3: 消息历史加载性能问题
**What goes wrong:** 点击 Session 后消息历史加载慢，或者频繁切换导致大量 RPC 请求。
**Why it happens:** 每次点击都调用 API route，没有缓存，且 .jsonl 文件可能很大。
**How to avoid:** 用 `useEffect` + 依赖项（selectedSessionKey）避免重复请求，或者在前端做简单缓存（Map<sessionId, messages[]>）。
**Warning signs:** Network 面板看到大量 `/api/sessions/messages?id=xxx` 请求，或者加载 spinner 长时间不消失。

### Pitfall 4: Filter 逻辑不完整
**What goes wrong:** 过滤后某些 Session 不应该被显示但仍然出现，或者过滤条件没有正确组合（AND/OR 逻辑错误）。
**Why it happens:** filter 函数里多个条件组合时逻辑混乱，或者 Status/Model/Kind 的值与实际数据不匹配。
**How to avoid:** 清晰定义 filter 对象 `{ status: 'all' | 'active' | 'idle', model: 'all' | string, kind: 'all' | string, search: string }`，用 useMemo 计算 filteredSessions，每个条件独立判断后用 && 组合。
**Warning signs:** 选择 "Active" filter 但仍然显示 Idle 状态的 Session。

### Pitfall 5: 空状态和错误状态处理缺失
**What goes wrong:** 当 sessions.list 返回空数组或 RPC 调用失败时，页面没有任何提示，用户不知道发生了什么。
**Why it happens:** 只考虑了成功场景，没有处理 `state === 'empty'` 或 `state === 'error'` 的情况。
**How to avoid:** 遵循 P0UIState 状态机，在 Sessions 页面中根据 state 渲染不同 UI：`loading` → spinner，`empty` → "No sessions found"，`error` → error message with retry button。
**Warning signs:** 页面一直显示 spinner 或者空白区域。

## Code Examples

Verified patterns from official sources:

### 扩展 SessionInfo 类型（D-07）
```typescript
// Source: gateway/adapter-types.ts (扩展)
export interface SessionInfo {
  key: string;
  kind?: string;                    // 'main' | 'sub' | 'cron' | 'group'
  label?: string;
  displayName?: string;
  model?: string;                   // 新增：模型名称（如 'anthropic/claude-opus-4-6'）
  totalTokens?: number;             // 新增：总 token 用量
  contextTokens?: number;           // 新增：上下文 token 数
  updatedAt?: number;
  createdAt?: number;               // 新增：会话创建时间
  sessionId?: string;
  aborted?: boolean;                // 新增：是否被终止
  thinkingLevel?: string | null;    // 新增：思考级别
  channel?: string;                 // 新增：渠道名称
  cost?: number;                    // 新增：费用（USD）
  lastMessage?: string;             // 新增：最后一条消息（截断）
}
```

### Sessions selector 遵循 P0 模式
```typescript
// Source: stores/gateway/p0-selectors.ts (新增)
const sessionsBaseResults = createBaseResultMap<SessionInfo[]>([]);
const sessionsEmptyResult = { state: 'empty' as const, data: [] };
let lastSessions: SessionInfo[] | null = null;
let lastSessionsResult: { state: P0UIState; data: SessionInfo[] } | null = null;

export function selectSessionsState(state: GatewayState): { state: P0UIState; data: SessionInfo[] } {
  const base = connectionUIState(state.connectionStatus, state.isDashboardLoading);
  if (base) return sessionsBaseResults[base];

  const sessions = state.sessions; // 假设 GatewayState 新增 sessions: SessionInfo[]
  if (sessions.length === 0) return sessionsEmptyResult;
  if (sessions === lastSessions && lastSessionsResult) return lastSessionsResult;

  lastSessions = sessions;
  lastSessionsResult = { state: 'success', data: sessions };
  return lastSessionsResult;
}
```

### 表格展开行交互（手写）
```typescript
// Source: components/sessions/sessions-table.tsx
const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
const toggleExpand = (key: string) => {
  setExpandedKeys(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
};

return (
  <div className="border border-border bg-card">
    {sessions.map(s => (
      <Fragment key={s.key}>
        <div onClick={() => toggleExpand(s.key)} className="grid grid-cols-[1fr_70px_140px_90px] gap-3 px-3 py-2 border-b border-border hover:bg-accent/5 cursor-pointer">
          <div className="font-medium truncate">{s.label}</div>
          <div><StatusBadge status={s.aborted ? 'aborted' : isActive ? 'active' : 'idle'} /></div>
          <div className="text-muted-foreground text-sm truncate">{s.model?.split('/').pop()}</div>
          <div className="text-muted-foreground text-sm text-right">{fmtAgo(Date.now() - (s.updatedAt || 0))}</div>
        </div>
        {expandedKeys.has(s.key) && (
          <div className="border-t border-border bg-muted/30 p-3 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            <div><span className="text-[10px] text-muted-foreground uppercase">Tokens</span><div className="font-mono text-sm">{(s.totalTokens || 0).toLocaleString()}</div></div>
            <div><span className="text-[10px] text-muted-foreground uppercase">Cost</span><div className="font-mono text-sm">${(s.cost || 0).toFixed(2)}</div></div>
            <div><span className="text-[10px] text-muted-foreground uppercase">Kind</span><div className="text-sm">{s.kind || '-'}</div></div>
            <div><span className="text-[10px] text-muted-foreground uppercase">Last Message</span><div className="text-sm truncate">{s.lastMessage || '-'}</div></div>
          </div>
        )}
      </Fragment>
    ))}
  </div>
);
```

### Chat bubbles 样式（手写）
```typescript
// Source: components/sessions/chat-bubble.tsx
export function ChatBubble({ message }: { message: { role: string; content: string; timestamp?: number } }) {
  const isUser = message.role === 'user';
  const time = message.timestamp ? new Date(message.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div className={cn('flex w-full mb-3', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[80%] rounded-lg px-3 py-2', isUser ? 'bg-accent text-background' : 'bg-muted text-foreground')}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{message.role}</span>
          {time && <span className="text-[10px] opacity-50">{time}</span>}
        </div>
        <div className="text-[11px] leading-relaxed whitespace-pre-wrap break-words font-mono">{message.content}</div>
      </div>
    </div>
  );
}
```

### API Route for message fetching (NEW - RESOLVED)
```typescript
// Source: app/api/sessions/messages/route.ts (NEW)
import { NextRequest, NextResponse } from 'next/server';

// Gateway .jsonl file directory (relative to project root)
const GATEWAY_SESSIONS_DIR = process.env.GATEWAY_SESSIONS_DIR || '../openclaw-gateway/sessions';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('id');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session id' }, { status: 400 });
  }

  try {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Sanitize sessionId to prevent directory traversal
    const sanitizedId = sessionId.replace(/[^a-zA-Z0-9\-_:.]/g, '');
    const sessionDir = path.resolve(process.cwd(), GATEWAY_SESSIONS_DIR);
    const files = await fs.readdir(sessionDir);

    // Find matching .jsonl file
    const targetFile = files.find(f => f.includes(sanitizedId) && f.endsWith('.jsonl'));

    if (!targetFile) {
      return NextResponse.json([], { status: 200 }); // Return empty array if file not found
    }

    const filePath = path.join(sessionDir, targetFile);
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());

    const messages = [];
    // Read last 30 messages (from reference project)
    const startIndex = Math.max(0, lines.length - 30);

    for (let i = startIndex; i < lines.length; i++) {
      try {
        const d = JSON.parse(lines[i]);
        if (d.type !== 'message') continue;

        const msg = d.message;
        if (!msg) continue;

        let text = '';
        if (typeof msg.content === 'string') {
          text = msg.content;
        } else if (Array.isArray(msg.content)) {
          for (const b of msg.content) {
            if (b.type === 'text' && b.text) {
              text = b.text;
              break;
            }
            if (b.type === 'tool_use' || b.type === 'toolCall') {
              text = '🔧 ' + (b.name || b.toolName || 'tool');
              break;
            }
          }
        }

        if (text) {
          messages.push({
            role: msg.role || 'unknown',
            content: text.substring(0, 300), // Truncate long messages
            timestamp: d.timestamp || ''
          });
        }
      } catch {
        // Skip malformed lines
      }
    }

    return NextResponse.json(messages, { status: 200 });
  } catch (error) {
    console.error('Error reading session messages:', error);
    return NextResponse.json({ error: 'Failed to read session messages' }, { status: 500 });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Channels 作为通信标识符 | Sessions 作为完整会话生命周期 | Phase 7 | 从简单标识符升级为可追踪 token/cost/status 的完整实体 |
| 硬编码表格布局 | CSS Grid 响应式表格 | Phase 7 | 更灵活的列宽控制，支持展开行动画 |
| 手写 filter 逻辑 | useMemo + 依赖项缓存 | Phase 7 | 避免不必要的重渲染，提升性能 |
| 模态框展示详情 | 右侧 360px rail 面板 | Phase 7 | 与 Dashboard 右侧面板模式一致，保持布局统一 |
| Server-side .jsonl file reading (reference project) | Next.js API route encapsulates file access | Phase 7 | Maintains security boundary (no direct file system access from browser), follows Next.js patterns |

**Deprecated/outdated:**
- Channels 区域（Overview 左侧面板）：将被 Sessions 概要替换，展示活跃会话数 + 最近 5 条活动。
- 模态框（`session-modal-overlay`）：参考项目用全屏模态框展示 Session 详情，OVAO 改用右侧 360px rail，保持与 Dashboard 一致。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Gateway RPC `sessions.list` 返回 `{ sessions: SessionInfo[] }` 或直接 `SessionInfo[]` | Standard Stack | 如果返回结构不同，需要调整 `fetchDashboardData` 中的响应解析逻辑 |
| A2 | Gateway .jsonl 文件存储在 `../openclaw-gateway/sessions/` 目录 | API Route | 如果路径不同，需要设置 `GATEWAY_SESSIONS_DIR` 环境变量 |
| A3 | Session 状态映射逻辑：Active = updatedAt < 5min && !aborted，Idle = updatedAt ≥ 5min，Aborted = aborted === true | Code Examples | 如果 Gateway 有不同的状态定义，需要调整映射逻辑 |
| A4 | .jsonl 文件格式为每行一个 JSON 对象，包含 `{ type: 'message', message: { role, content, timestamp } }` | Code Examples | 如果格式不同，消息解析逻辑需要修改 |
| A5 | SessionInfo 的 `key` 字段可以用作 React key 和唯一标识 | Code Examples | 如果 key 不唯一或不稳定，需要使用 `sessionId` 或组合字段 |

**If this table is empty:** 所有假设已在上面列出，需要用户确认 A1-A5 的准确性。

## Open Questions (RESOLVED)

### 1. ✅ Gateway RPC 返回结构验证
- **What we know:** `sessions.list` RPC 存在（参考项目调用），返回格式可能是 `{ sessions: SessionInfo[] }` 或直接 `SessionInfo[]`。
- **Resolution:** 在 Plan 07-01 Task 2 中实现灵活的响应处理，同时支持两种格式。如果格式不符合预期，记录错误日志并返回空数组。
- **Implementation:** 在 `gateway-store.ts` 的 `fetchDashboardData` 中：
  ```typescript
  const response = await rpcClient.request('sessions.list');
  const sessions = response.sessions || response; // Handle both formats
  ```

### 2. ✅ 消息历史获取接口
- **What we know:** 参考项目使用 HTTP API `/api/session-messages?id=xxx` 读取 .jsonl 文件。
- **Resolution:** 创建 Next.js API route `app/api/sessions/messages/route.ts`，封装对 Gateway .jsonl 文件的读取。前端通过 `fetch('/api/sessions/messages?id=xxx')` 调用。
- **Implementation:**
  - **Plan 07-01 Task 4:** 创建 API route `app/api/sessions/messages/route.ts`
  - **Plan 07-02 Task 5 (SessionsDetailRail):** 在组件中调用 API route 获取消息
  - 环境变量 `GATEWAY_SESSIONS_DIR` 配置 Gateway .jsonl 文件路径（默认 `../openclaw-gateway/sessions`）
  - 读取最后 30 条消息（与参考项目一致）
  - 返回格式：`{ role: string, content: string, timestamp: string }[]`

### 3. ✅ Session 状态实时更新机制
- **What we know:** Gateway WS 推送 agent 事件（lifecycle/tool/error），包含 sessionKey。
- **Resolution:** agent 事件可能不直接包含 `updatedAt` 和 `aborted` 字段，需要在 `handleAgentEvent` 中手动维护。
- **Implementation:**
  - **Plan 07-01 Task 2:** 在 `gateway-store.ts` 的 `fetchDashboardData` 中，根据 `updatedAt` 和 `aborted` 计算状态：
    - Active: `updatedAt < 5min ago && !aborted`
    - Idle: `updatedAt >= 5min ago`
    - Aborted: `aborted === true`
  - 在 `handleAgentEvent` 中，当收到 agent lifecycle 事件时，更新对应 Session 的 `updatedAt` 为当前时间，`aborted` 根据事件类型设置（如 `agent:stopped` → `aborted = true`）

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| **Gateway (WebSocket + RPC)** | Sessions 数据获取 + 实时更新 | ✓ (本地运行) | v3.2.1 (根据 shell-header.tsx) | — |
| **Next.js 16 App Router** | 路由和布局 | ✓ | 16.2.4 | — |
| **Zustand** | 状态管理 | ✓ | 5.0.12 | — |
| **Tailwind CSS v4** | 样式系统 | ✓ | v4 | — |
| **shadcn/ui** | UI 组件基础 | ✓ | 4.6.0 | — |
| **Gateway .jsonl 文件** | 消息历史读取 | ✓ (本地文件) | — | 需配置 `GATEWAY_SESSIONS_DIR` |

**Missing dependencies with no fallback:** 无

**Missing dependencies with fallback:** 无

**Notes:**
- Gateway 必须在运行中（默认 `ws://localhost:18789`）才能测试 Sessions 页面，否则 UI 会卡在 loading 状态。
- 所有依赖已安装，无需新增包。
- 需要设置环境变量 `GATEWAY_SESSIONS_DIR` 指向 Gateway .jsonl 文件目录（默认 `../openclaw-gateway/sessions`）

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | ❌ None (手动测试) |
| Config file | — |
| Quick run command | — |
| Full suite command | — |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESS-01 | Sessions 独立页面 + Stats bar + Filter bar + 紧凑表格 | manual | — | ❌ Wave 0 |
| SESS-02 | Session 详情（右侧 360px 面板，chat bubbles） | manual | — | ❌ Wave 0 |
| SESS-03 | Overview Sessions 概要 + 导航更新 | manual | — | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** 手动验证：Sessions 页面加载正常，表格展示数据，点击行展开详情，右侧面板显示消息历史
- **Per wave merge:** 手动验证：Sessions 页面与 Dashboard/Office 风格一致，实时更新正常，过滤逻辑正确
- **Phase gate:** 手动验证：所有 SESS-01/02/03 需求满足，无 ESLint 错误，light/dark 主题正常

### Wave 0 Gaps
- [ ] `tests/` 目录 — 整个测试框架未建立（Phase 1-4 均为手动测试）
- [ ] 测试框架安装：未选择测试框架（Jest/Vitest/Playwright）
- [ ] Sessions 页面手动测试 checklist：需创建（参考 Phase 4 Agent Dashboard 的手动验证步骤）

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

**Note:** 本项目未配置自动化测试框架，所有验证依赖手动测试。Phase 7 遵循现有模式，不引入测试框架。

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (单用户本地工具，无认证) |
| V3 Session Management | no | — (Sessions 指的是 AI 会话，不是用户会话) |
| V4 Access Control | no | — (无权限控制) |
| V5 Input Validation | yes | 前端过滤和搜索输入需要防御 XSS（虽然数据来自可信 Gateway，但搜索框输入应避免 HTML 注入）；API route 需要验证和清理 sessionId 参数（防止路径遍历） |
| V6 Cryptography | no | — (无加密需求) |

### Known Threat Patterns for {Next.js + WebSocket + API Routes}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS (搜索框输入) | Tampering | React 自动转义 JSX 中的内容，但 `dangerouslySetInnerHTML` 禁止使用 |
| WebSocket 劫持 | Spoofing | Gateway WS 使用 `ws://localhost:18789`，仅本地访问，风险较低 |
| 数据泄露 | Information Disclosure | Sessions 数据可能包含敏感消息内容，仅在本地展示，不外传 |
| 路径遍历攻击 (API route) | Tampering | 在 `/api/sessions/messages` 中，使用正则表达式 `/[^a-zA-Z0-9\-_:.]/g` 清理 sessionId，使用 `path.resolve()` 确保路径在预期目录内 |

**Note:** OVAO 是单用户本地工具，安全威胁模型较简单。主要关注前端 XSS 防御、API route 输入验证和本地数据隐私。

## Sources

### Primary (HIGH confidence)
- `gateway/adapter-types.ts` - [VERIFIED: codebase] 现有 SessionInfo 类型定义
- `stores/gateway/gateway-store.ts` - [VERIFIED: codebase] Gateway RPC 调用和 Zustand store 模式
- `stores/gateway/p0-selectors.ts` - [VERIFIED: codebase] P0 selector 模式实现
- `app/(shell)/dashboard/page.tsx` - [VERIFIED: codebase] Dashboard 页面布局模式
- `components/dashboard/dashboard-right-rail.tsx` - [VERIFIED: codebase] 右侧 360px rail 框架
- `components/dashboard/overview-tab.tsx` - [VERIFIED: codebase] Overview 标签和 Channels 展示
- `components/hud/hud-card.tsx` - [VERIFIED: codebase] HudCard 组件
- `components/hud/status-indicator.tsx` - [VERIFIED: codebase] StatusIndicator 组件
- `components/dashboard/sidebar-nav.tsx` - [VERIFIED: codebase] 侧边导航结构
- `components/hud/shell-header.tsx` - [VERIFIED: codebase] Header 导航结构
- `../references/openclaw-dashboard-html/server.js` - [VERIFIED: reference project] `getSessionsJson()`、`getLastMessage()` 和 `/api/session-messages` 实现（lines 459-486, 521-542, 1906-1948）
- `../references/openclaw-dashboard-html/index.html` - [VERIFIED: reference project] Sessions 页面表格、Stats bar、Filter bar、Modal 详情、Chat bubbles 样式

### Secondary (MEDIUM confidence)
- `../references/openclaw-dashboard-html/index.html` - [VERIFIED: reference project] Sessions 表格展开行、消息历史展示、Session 状态指示器（Active/Idle/Aborted）
- `../ovao-design/dashboard-hud.html` - [CITED: design spec] HUD 视觉风格基线（clip-path, glow effects）

### Tertiary (LOW confidence)
- 无（所有研究基于代码库和参考项目，无纯 WebSearch 结果）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - 所有依赖已安装并验证版本
- Architecture: HIGH - 基于现有代码库模式和参考项目完整实现
- Pitfalls: HIGH - 基于常见 React/表格/实时更新问题识别
- Data structures: HIGH - SessionInfo 扩展字段基于参考项目，Gateway RPC 和消息获取机制已明确（所有开放问题已解决）

**Research date:** 2026-05-02
**Valid until:** 14 days (Gateway 版本稳定，Sessions RPC 和 .jsonl 文件格式已验证)

---

## Revision Summary

**Date:** 2026-05-02
**Changes:**
1. ✅ Resolved all 3 open questions in "Open Questions (RESOLVED)" section
2. ✅ Added API route implementation example for message fetching
3. ✅ Updated Architectural Responsibility Map to clarify Next.js API route tier for message history
4. ✅ Updated System Architecture Diagram to show Next.js API layer
5. ✅ Updated Recommended Project Structure to include `app/api/sessions/messages/route.ts`
6. ✅ Updated State of the Art table to reflect Next.js API route approach
7. ✅ Updated Security Domain to include API route input validation (path traversal prevention)
8. ✅ Updated Environment Availability to include Gateway .jsonl files
9. ✅ Updated Assumptions Log to add A2 about Gateway .jsonl file path
10. ✅ Updated Confidence breakdown from MEDIUM to HIGH for Data structures

**Rationale:** Reference project analysis confirmed that:
- Message history is stored in .jsonl files (one per session) in Gateway's sessions directory
- Reference project uses HTTP API (`/api/session-messages?id=xxx`) to read these files server-side
- For Next.js, we create an API route that encapsulates file access (maintains security boundary)
- All three open questions have concrete implementation paths
