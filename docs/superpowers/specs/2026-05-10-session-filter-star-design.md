# Session List Filter & Star 功能设计

**日期**: 2026-05-10
**状态**: Draft

## 概述

为 right rail session 列表添加 filter 和 star（收藏）功能。参考 agentsview 的实现模式。

### 功能范围

- **Filter dropdown panel**: Group by agent / Group by project、Agent 过滤、Starred only、文本搜索
- **Star/Unstar**: 每条 session row 右侧的 star icon，数据持久化到 server-side SQLite
- **所有过滤逻辑 client-side**，对已加载的 ~500 条 sessions 做过滤，不新增 ingest API filter 参数

## 1. Star 后端（Ingest）

### 1.1 SQLite 新表

```sql
CREATE TABLE IF NOT EXISTS session_stars (
  session_id TEXT NOT NULL,
  starred_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (session_id)
);
```

Migration 文件: `ingest/db/migrations/XXXX_add_session_stars.sql`

### 1.2 Ingest API 端点

新增文件 `ingest/api/stars.ts`，注册到 `ingest/api/index.ts`。

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/sessions/starred` | 返回 `{ session_ids: string[] }` |
| POST | `/sessions/:id/star` | Star 一个 session（INSERT OR IGNORE） |
| DELETE | `/sessions/:id/star` | Unstar 一个 session |

### 1.3 BFF 代理路由

| 文件 | 代理到 |
|------|--------|
| `app/api/agent-tools/[tool]/sessions/starred/route.ts` | `GET /sessions/starred` |
| `app/api/agent-tools/[tool]/sessions/[sessionId]/star/route.ts` | `POST/DELETE /sessions/:id/star` |

BFF 路由沿用现有的 `fetchToolApi` 模式，不需要验证 tool ownership（star 是全局的，不按 source 隔离）。

## 2. Frontend 状态管理

### 2.1 Star Store（Zustand）

新建 `stores/starred-store.ts`。

**为什么用 Zustand**: star 数据需要在 session row 的 star icon 和 filter dropdown 的 "Starred only" 之间共享，且切换 session 后需保留。与现有 `useToolStore` 同等 scope。

```typescript
interface StarredStore {
  ids: Set<string>;
  loaded: boolean;

  load(): Promise<void>;
  toggle(sessionId: string): void;
  isStarred(sessionId: string): boolean;
}
```

**行为**:
- `load()`: 调用 `GET /sessions/starred`，填充 `ids`
- `toggle()`: 乐观更新 `ids`，然后 `POST/DELETE` server，失败时 revert
- Store 在 app 启动时初始化一次

### 2.2 Filter 状态（组件内 useState）

**为什么不用 Zustand**: filter dropdown 和 session list 都在 `sessions-right-rail.tsx` 内部，不需要跨组件树共享。与 agentsview 保持一致。

```typescript
type TraceSource = 'openclaw' | 'claude-code' | 'codex';

interface FilterState {
  groupMode: 'none' | 'agent' | 'project';
  sourceFilter: Set<TraceSource>;   // 选中的 source 集合，空 = 全部
  starredOnly: boolean;
  searchQuery: string;
}
```

`sourceFilter` 为空集时等价于 "All sources"。过滤逻辑匹配 `TraceSession.source` 字段。

`groupMode` 持久化到 localStorage（key: `agents-tracing-group-mode`），其余状态仅在组件生命周期内有效。

## 3. Filter Dropdown 组件

新建 `components/sessions/session-filter-dropdown.tsx`。

**UI 结构** (dropdown panel，点击 filter 按钮弹出):

```
┌─────────────────────────┐
│ 🔍 Search...            │
├─────────────────────────┤
│ DISPLAY                 │
│ ☑ Group by agent        │
│ ☐ Group by project      │
├─────────────────────────┤
│ STARRED                 │
│ ☐ Starred only    (3)   │
├─────────────────────────┤
│ SOURCE                  │
│ ☑ All                   │
│ ☑ Claude Code           │
│ ☑ OpenClaw              │
│ ☑ Codex                 │
├─────────────────────────┤
│ Clear filters           │
└─────────────────────────┘
```

**行为**:
- Filter 按钮带绿色 dot 指示器（有 active filter 时显示）
- Group mode 互斥（agent / project / none）
- Agent filter 支持多选
- "Starred only" 从 `starredStore.ids` 过滤
- "Clear filters" 重置所有 filter 到默认

**样式**: 遵循 HUD 风格，使用项目已有的语义化 token（`bg-background`, `text-foreground`, `border-border` 等）。参考 agentsview 的 `SessionFilterControl.svelte` 布局，但用项目自己的 CSS 变量体系。

## 4. Right Rail 集成

### 4.1 Session Row Star Icon

修改 `components/sessions/sessions-right-rail.tsx` 中的 session row。

- **位置**: row 最右侧
- **默认**: 空心 ☆，颜色淡（`text-muted-foreground`）
- **Hover**: 颜色加深
- **Starred**: 实心 ★，amber 色
- **点击**: 调用 `starredStore.toggle(sessionId)`

### 4.2 Filter Button 位置

在 right rail header 区域（"Sessions" 标题旁），与现有 search icon 并排。

### 4.3 Group By 渲染

当 `groupMode !== 'none'` 时：

1. 从已过滤的 sessions 提取分组 key（agent name 或 project）
2. 按 session 数量降序排列分组
3. 渲染分组 header：`{label} ({count})`，9px uppercase HUD 风格
4. 分组内 sessions 缩进显示
5. 分组默认展开，可折叠（state 在组件内 `useState<Set<string>>`）

### 4.4 Filter 数据流

```
所有 sessions (from API, ~500 条)
  → searchQuery: client-side 文本匹配 (session.name, session.project)
  → sourceFilter: client-side 按 TraceSession.source 过滤（Set<TraceSource>）
  → starredOnly: client-side 查 starredStore.ids 交集
  → groupMode: 按分组 key 排列 + 渲染 group headers
  → 渲染到 right rail
```

全部过滤在 client-side 对已加载数据做，不需要新增 ingest API 参数。

## 5. 文件清单

### 新建

| 文件 | 用途 |
|------|------|
| `stores/starred-store.ts` | Star 状态管理 + server 同步 |
| `components/sessions/session-filter-dropdown.tsx` | Filter dropdown panel |
| `ingest/db/migrations/XXXX_add_session_stars.sql` | session_stars 建表 |
| `ingest/api/stars.ts` | Star REST 端点 |
| `app/api/agent-tools/[tool]/sessions/starred/route.ts` | BFF: starred list |
| `app/api/agent-tools/[tool]/sessions/[sessionId]/star/route.ts` | BFF: star/unstar |

### 修改

| 文件 | 改动 |
|------|------|
| `ingest/db/index.ts` | 注册新 migration |
| `ingest/api/index.ts` | 注册 star 路由 |
| `components/sessions/sessions-right-rail.tsx` | 加 filter button、star icon、group headers、filter 逻辑 |

### 不变

- `types/trace.ts` — star 不存在 session 类型上
- Ingest sessions API — 不加新 filter 参数
- BFF sessions route — 不变
