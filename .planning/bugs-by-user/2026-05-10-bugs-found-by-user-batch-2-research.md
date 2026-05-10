# 2026-05-10 用户反馈 Bugs Batch 2 调查报告

**日期**: 2026-05-10  
**模式**: `$gsd-audit-fix --research` 只读调查，不修复代码  
**输入**: `.planning/bugs-by-user/2026-05-10-bugs-found-by-user-batch-2.md`

---

## 总览

| ID | 问题 | 严重度 | 分类 | 结论 |
|----|------|--------|------|------|
| B2-01 | Starred sessions 刷新后消失，GET starred 404 | 高 | auto-fixable | Ingest route 顺序错误，`/sessions/:id` 抢先匹配 `starred` |
| B2-02 | Session 动态加载疑似未生效 | 中 | auto-fixable | Source rail 有分页；`all` 聚合 rail 没有分页且固定 `hasMore=false` |
| B2-03 | 搜索 turns 时 Markdown 报 children object 错 | 高 | auto-fixable | 搜索高亮把 `ReactMarkdown.children` 从 string 改成 ReactNode |
| B2-04 | Edit 工具只显示 input JSON，缺少 diff 视图 | 中 | auto-fixable | 数据已基本具备，但 UI 没有 edit-specific formatter；Codex `apply_patch` 还被归为 Other |
| B2-05 | Codex subagent 调用识别不完整 | 中 | auto-fixable | 原始事件存在；parser 未锚定 call_id，limited sync 不回填关系 |

---

## B2-01 Starred sessions GET 404

### 复现与证据

当前本地服务可复现：

```text
GET http://localhost:8078/api/v1/sessions/starred
=> 404 {"error":"Session not found","sessionId":"starred"}

GET http://localhost:3000/api/agent-tools/all/sessions/starred
=> 404 {"error":"Session not found","sessionId":"starred"}
```

数据库里已经有 star 数据：

```text
session_stars count = 1
64a46f4d-f523-46a1-a201-74236a40fc60 | 2026-05-10 07:47:15
```

### 根因

`ingest/index.ts` 中 route mount 顺序是：

```ts
app.route('/', sessionsRoutes);
app.route('/', turnsRoutes);
app.route('/', agentsRoutes);
app.route('/', starsRoutes);
```

但 `ingest/api/sessions.ts` 里有：

```ts
sessionsRoutes.get('/api/v1/sessions/:id', ...)
```

Hono 按注册顺序匹配，所以 `GET /api/v1/sessions/starred` 被 sessions wildcard 当成 `id = "starred"` 处理，返回 session not found。`POST /api/v1/sessions/:id/star` 能成功，是因为 sessionsRoutes 没有对应 POST wildcard。

### 修复建议

优先把 `starsRoutes` mount 移到 `sessionsRoutes` 之前；或者把 starred GET 路由并入 `sessionsRoutes`，放在 `/:id` 之前。建议加 ingest API 测试覆盖：

```text
GET /api/v1/sessions/starred returns session_ids and is not captured by /sessions/:id
```

---

## B2-02 Session 动态加载疑似未生效

### 证据

数据库实际有更早数据，不是 ingest 没扫到：

```text
root sessions:
claude-code 157, oldest 2026-03-31
codex       309, oldest 2025-09-27
openclaw    125, oldest 2026-03-02
```

Codex 第一页 100 条的最后一条是：

```text
pagination: { total: 309, limit: 100, offset: 0, hasMore: true }
oldest in first 100: 2026-03-22T05:22:21.204Z
oldest all:          2025-09-27T09:27:46.578Z
```

这说明 API 分页数据是存在的。

### 根因

Source-specific right rail 路径基本具备动态加载：

- `useToolSessions()` 保存 `pagination.hasMore`
- `loadMore()` 请求下一页
- `SessionsRailContent` 用 sentinel + `IntersectionObserver` 触发 `loadMore`

但 `all` 聚合模式没有分页：

- `AggregateSessionsRightRail` 只调用 `useAggregateSessions({ limit: '100' })`
- 传给 `SessionsRailContent` 的 `hasMore={false}`
- `useAggregateSessions()` 只抓每个 source 第一页并 merge，没有 `loadMore`
- 即使聚合页传 `limit: '500'`，BFF `sanitizeLimit()` 仍把单页上限压到 100

所以用户在 `all` 视图或聚合 right rail 里会看到“只拿了 limit 数量”的效果。

### 修复建议

为 `useAggregateSessions` 增加 per-source pagination state 和 `loadMore`，把 `hasMore` 定义为任一 source 还有下一页。加载更多时对仍有 `hasMore` 的 source 请求各自 offset，merge 后按 freshness 排序。`totalCount` 应继续来自 API pagination totals，不受已加载页数影响。

---

## B2-03 搜索 turns 时 MarkdownContent 报错

### 报错

```text
Unexpected value `[object Object]` for `children` prop, expected `string`
at MarkdownContent (components/replay/markdown-content.tsx:61)
```

### 根因

`components/replay/markdown-content.tsx` 的搜索高亮逻辑先创建：

```tsx
<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
```

然后 `highlightNodes()` 递归 clone React element，把 `children` 从原始 string 替换成含 `<mark>` 的 ReactNode。问题是 `ReactMarkdown` 组件的 `children` prop 必须是 string；被 clone 后收到 object/fragment，就触发 assertion。

### 修复建议

不要 clone 顶层 `ReactMarkdown`。可选方案：

1. 用 `ReactMarkdown components={...}` 在 markdown 已经转成具体元素后，对普通元素的 children 做高亮。
2. 使用 remark/rehype 插件在 AST 层插入 mark 节点。
3. 简化处理：搜索时用纯文本 fallback 高亮，非搜索时保持 Markdown。

推荐方案 1，改动集中且保留 Markdown 渲染。

---

## B2-04 Edit 工具缺少 diff 视图

### 当前数据形态

Claude Code:

```json
{
  "name": "Edit",
  "input": {
    "file_path": ".../ingest/index.ts",
    "old_string": "import { turnsRoutes } ...",
    "new_string": "import { turnsRoutes } ...\nimport { agentsRoutes } ..."
  }
}
```

当前 parser 会保存为 `TraceToolCall.inputJson = JSON.stringify(block.input || {})`，所以 UI 只能显示 JSON。

Codex:

```json
{
  "type": "custom_tool_call",
  "name": "apply_patch",
  "input": "*** Begin Patch\n*** Add File: ...\n..."
}
```

当前 parser 能保留 patch input，但 `inferToolCategory()` 没有把 `apply_patch` 归为 `Edit`，所以 UI 分类还是 `Other`。另外 `ToolBlock` 没有针对 patch/diff 的展示模式。

### 根因

这是 UI presentation gap，不是数据完全丢失：

- Claude `Edit` / `MultiEdit` / `Write` 需要把 input JSON 转成人类可读 file + unified diff。
- Codex `apply_patch` 需要直接渲染 patch block，并归类为 `Edit`。
- Codex 的 shell/exec_command 改文件场景可能需要从 command/heredoc 中提取 patch，属于后续增强。

### 修复建议

新增 edit-specific formatter，优先在 `ToolBlock` 中按 tool name/category 分流：

- `Edit`: parse `{ file_path, old_string, new_string }`，生成 unified diff。
- `MultiEdit`: 对每个 edit 生成 diff section。
- `Write`: 展示 file path + created/replaced content preview。
- `apply_patch`: 直接以 `diff`/patch code block 展示。

同时更新 Codex category inference：`apply_patch`、`patch`、`file_edit` 归为 `Edit`。

---

## B2-05 Codex subagent 调用识别不完整

### 示例 session 证据

示例 session 文件：

```text
~/.codex/sessions/2026/05/04/rollout-2026-05-04T16-19-11-019df211-e301-7561-bfa5-9aeba110c584.jsonl
```

该 session 里存在 14 条 `collab_agent_spawn_end` 事件，其中成功事件形态如下：

```json
{
  "type": "collab_agent_spawn_end",
  "call_id": "call_JL4U2LnbN2aVEVOpf28YN4U9",
  "sender_thread_id": "019df211-e301-7561-bfa5-9aeba110c584",
  "new_thread_id": "019df216-a998-7f61-9f44-bae42ebc2dc6",
  "new_agent_nickname": "Aquinas",
  "status": "pending_init"
}
```

对应 child JSONL 文件存在：

```text
019df216-a998-7f61-9f44-bae42ebc2dc6
=> ~/.codex/sessions/2026/05/04/rollout-2026-05-04T16-24-24-019df216-a998-7f61-9f44-bae42ebc2dc6.jsonl
```

### 当前实现问题

`ingest/parser/codex.ts` 已识别 `collab_agent_spawn_end`，但只生成裸 link：

```ts
{
  type: 'subagent_link',
  subagentSessionId: ev.new_thread_id,
  subagentSource: 'codex',
  relationship: 'spawned',
}
```

缺失信息：

- 没有 `messageOrdinal`，无法锚定到对应 `spawn_agent` tool call。
- 没有 nickname/prompt/status/sourceLine。
- 没有过滤 `new_thread_id = null` 的 not_found 事件。

`ingest/sync/index.ts` 的 `collectCodexRelationships()` 能从这些事件建立 child -> parent 关系，但在 `opts.limit` 存在时直接跳过：

```ts
const relationshipsByChild = typeof opts.limit === 'number'
  ? new Map()
  : await collectCodexRelationships(sources);
```

所以 startup warmup / limited sync 阶段不会把 child sessions 标为 subagent。

### 为什么 Codex subagent 会出现在 sessions 列表里

Claude Code 和 Codex 的源数据结构不同：

- Claude Code 的 subagent JSONL 通常位于父 session 目录下的 `subagents/agent-xxx.jsonl`，例如 `~/.claude/projects/<project>/<parent-session>/subagents/agent-xxx.jsonl`。当前 `extractClaudeSessionContext()` 可以直接从路径判断 `parentDir === 'subagents'`，并把 session 标成 `relationshipType = 'subagent'`。
- Codex 的 subagent JSONL 是普通 thread 文件，位于全局 `~/.codex/sessions/YYYY/MM/DD/rollout-...-<thread-id>.jsonl` 下。child 文件本身看不出自己是 subagent，必须从父 session 的 `collab_agent_spawn_end.sender_thread_id/new_thread_id` 事件反推父子关系。

Session list API 默认过滤 children：

```sql
relationship_type IS NULL OR relationship_type = 'root'
```

因此 Claude Code subagent 被稳定标记为 `subagent` 后不会出现在普通列表里；Codex subagent 如果关系回填漏掉，就会保持 `root` 或 `NULL`，自然混入 sessions 列表。

### 修复建议

1. 在 Codex parser 中维护 `callId -> toolCall.messageOrdinal` 映射。
2. 处理 `collab_agent_spawn_end` 时，只有 `new_thread_id` 为 string 才建 link，并把 `messageOrdinal/sourceLine/nickname/prompt/status` 写入 canonical metadata。
3. limited sync 也应做轻量关系采集，至少扫描本次候选文件内的 `collab_agent_spawn_end`，或在 full sync 完成后批量 backfill relationship。
4. 增加真实 fixture，覆盖示例 session 的 `spawn_agent` -> `collab_agent_spawn_end` -> child JSONL 文件链路。

### 复杂度与替代方案权衡

推荐优先做结构性修复，而不是只加 `hide_single_turn` filter。

结构性修复复杂度：中等，但不算高。实现点主要是 ingest/sync 层：

1. 收集 `collab_agent_spawn_end` 关系：扫描父 Codex JSONL，记录 `new_thread_id -> sender_thread_id`。
2. 在写入 child session 时设置 `parent_session_id/root_session_id/relationship_type = subagent`。
3. 对已经入库但关系漏掉的 child session 做 backfill update。
4. 加 fixture/test 覆盖 limited startup sync 和 full sync。

风险点是同步顺序：父 session 可能已经解析，child session 还没解析；或者 child 先入库，父关系后出现。因此实现应支持 idempotent backfill，不依赖解析顺序。

`hide_single_turn` 的优点是实现很快，可能只需要前端 filter 或 API query filter。但它不建议作为主修法：

- false positive 高：很多正常短会话也是 single-turn，会被误隐藏。
- false negative 高：subagent 不一定只有 one turn，尤其会继续对话、wait/close 或失败重试。
- 它只隐藏列表噪音，不修复 replay 中父子链接、subagent block、统计口径和关系查询。

可接受的折中：

1. 主线实现 Codex relationship backfill。
2. 同时在 UI filter 里加入 `hide subagents`，基于 `relationshipType === 'subagent'` 隐藏，默认开启或跟随列表默认行为。
3. `hide_single_turn` 只作为临时/debug filter，命名应避免暗示它等同于 subagent 隐藏。

---

## 建议修复顺序

1. B2-01 Starred 404：最小改动，直接解除用户可见数据丢失。
2. B2-03 Markdown 搜索崩溃：高频交互，明确 runtime crash。
3. B2-02 All sessions pagination：解决“看起来没扫全”的核心体验问题。
4. B2-05 Codex subagent link：先锚定事件和关系，再优化 UI 展示。
5. B2-04 Edit diff：数据展示增强，可与 ToolBlock formatter 一起做。
