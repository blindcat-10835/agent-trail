# Skills + ToolCalls 页签开发踩坑记录

## 1. Hono 路由顺序：通配路由会吃掉静态路径

**问题**：`sessionsRoutes.get('/api/v1/sessions/:id', ...)` 会匹配 `toolcall-stats` 和 `skills-stats`，把路径参数当成 session ID，返回 "Session not found"。

**原因**：Hono 按注册顺序匹配路由。`/:id` 通配路由在前，`/toolcall-stats` 等静态路径在后，Hono 优先匹配先注册的。

**解决**：
- 新建独立的 `Hono()` 实例（`statsRoutes`），在 `ingest/index.ts` 里先于 `sessionsRoutes` 挂载
- 注释已说明这个模式：`// Mount search before sessions so /sessions/:id/search matches before /sessions/:id`

**教训**：Hono 中**所有非通配的静态路由都必须注册在 `/:id` 通配路由之前**。同文件内的路由顺序不够——Hono 实例作为整体挂载到 `app.route()`，不同实例的注册顺序决定匹配优先级。

---

## 2. tsx 编译缓存问题

**问题**：编辑了 `ingest/api/sessions.ts` 后重启 ingest 服务，新端点返回 404。SQL 直查有数据，但 API 端点不生效。

**原因**：`tsx watch` 模式有编译缓存（`node_modules/.cache/tsx` 和 `/tmp/tsx-*`），重启进程时加载了缓存的旧编译产物。

**解决**：
```bash
rm -rf node_modules/.cache/tsx /tmp/tsx-* ~/.cache/tsx
pkill -f "tsx.*ingest"
# 重新启动
```

**教训**：修改 tsx 运行时加载的代码后，必须**清理全部三级 tsx 缓存**：
1. `node_modules/.cache/tsx`
2. `/tmp/tsx-*`
3. `~/.cache/tsx`

仅重启进程是不够的。

---

## 3. Sqlite3 JSON 提取函数行为

**问题**：`json_extract(tc.input_json, '$.name')` 在某些行返回 NULL，导致 SQL 的 GROUP BY 把技能名 NULL 的行聚合成一个 "null" 组。

**验证**：OpenClaw 的 tool call `input_json` 和 OpenCode 的结构不同，`json_extract` 在路径不匹配时静默返回 NULL。

**教训**：用 `COALESCE(json_extract(..., '$.name'), tc.name)` 做兜底，确保 GROUP BY 不会吞掉数据。

---

## 4. BFF 代理的 source 参数传递

**问题**：BFF 路由 `/api/agent-tools/opencode/sessions/toolcalls` 传 `source=opencode` 给 ingest。但 `all` 是聚合视图，ingest 没有 `all` 这个 source。

**解决**：BFF 层判断 `tool === 'all'` 时不传 source 参数，ingest 层判断 `source === 'all'` 时忽略 source 条件。

---

## 5. 数据模型边界

- `tool_calls` 表没有 token 字段，token 在 `messages.token_usage_json` 或 `turns.token_usage_json` 中
- 一个 assistant message 可能包含多个 tool call，token 无法精确分配到单个 tool call
- `skill` 工具调用通过 `input_json.name` 标识技能名，`input_json.user_message` 存用户输入
- 技能调用数据只存在于 OpenCode parser 产出中（通过 tool call name='skill' 识别），OpenClaw/Claude Code 不产 skill 类型
