# API 参考

agent-tracing-dashboard 暴露两个 HTTP 接口：

1. **摄取服务**，地址为 `http://localhost:8078` (Hono) — 规范的 REST + SSE API。
2. **Next.js BFF**，地址为 `http://localhost:3000/api/...` — 浏览器使用的代理和聚合器。前端绝不直接调用摄取服务 (D-07)。

前端按源读取数据应始终通过 `/api/agent-tools/[tool]/...` 路径。此处记录摄取 API 供工具开发、调试和对照参考。

> 所有示例假定使用 [`CONFIGURATION.md`](CONFIGURATION.md) 中的默认值。`[tool]` 取值为 `openclaw | claude-code | codex | opencode`（`all` 聚合作用域仅用于 shell 层，BFF 会拒绝它）。

---

## 1. 摄取服务 (`:8078`)

### 1.1 健康检查与版本

#### `GET /health`

```json
{
  "status": "ok",
  "ready": true,
  "version": "0.1.0",
  "uptime": 12.345,
  "database": "connected",
  "sync": {
    "phase": "idle",
    "startupComplete": true,
    "foregroundLimit": 50,
    "backgroundSyncEnabled": true,
    "currentSource": null,
    "lastSyncAt": "2026-05-09T19:14:33.000Z",
    "lastError": null
  }
}
```

- `status`：`openDatabase()` 成功后为 `"ok"`，否则为 `"error"`。
- `ready`：仅在有限预热同步完成后为 `true`。
- `database`：当 `getDatabase()` 返回有效句柄时为 `"connected"`。
- `sync.phase`：依次经过 `starting → discovering → warming → indexing → idle`（或 `error`）。

该路由在 `rateLimiter` 中跳过 `/version` 和 `/health` 的速率限制。

#### `GET /version`

```json
{
  "version": "0.1.0",
  "name": "agent-tracing-dashboard-ingest",
  "sources": ["openclaw", "claude-code", "codex", "opencode"]
}
```

---

### 1.2 数据源

#### `GET /api/v1/sources`

列出所有数据源类型的已发现数据源。

```json
{
  "sources": [
    {
      "type": "openclaw",
      "path": "/Users/me/.openclaw/agents/blue/sessions",
      "sessionCount": 42,
      "lastSyncAt": null,
      "error": null,
      "healthStatus": "configured",
      "watcherStatus": "watching",
      "filesWatched": 142
    }
  ],
  "total": 1
}
```

- `healthStatus` 推导规则：如果 `error != null` 则为 `error`，否则如果 `sessionCount > 0` 则为 `configured`，否则为 `empty`。
- `watcherStatus` 和 `filesWatched` 来自 chokidar 监视器（`watching` / `stopped`）。
- 发现错误（例如 ENOENT）会成为对应条目上的 `error`，而非响应级别的错误。

#### `GET /api/v1/sources/:type`

与上述结构相同，仅限某一数据源类型。

  - **400** 当 `type` 不是 `openclaw | claude-code | codex | opencode` 时返回 `Unsupported source type`。

#### `POST /api/v1/sources/:type/sync`

触发某一数据源类型的立即同步。

| 参数 | 位置 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `force` | 查询参数 (`?force=true`) 或 JSON 请求体 (`{"force":true}`) | `false` | 绕过 `file_hash` 跳过缓存；重新解析每个文件。 |

```json
{
  "type": "claude-code",
  "syncResult": {
    "sessionsInserted": 12,
    "sessionsUpdated": 3,
    "messagesInserted": 1184,
    "toolCallsInserted": 226,
    "toolResultEventsInserted": 226,
    "errors": []
  },
  "status": "completed"
}
```

- **400** 不支持的数据源类型。
- **500** 解析器/IO 错误时返回 `{ error: "Sync failed", message: "<details>" }`（如果 `INGEST_DEBUG=false` 则返回 `Internal server error`）。

#### `GET /api/v1/sources/:type/status`

轻量级监视器状态 — 不枚举数据源。

```json
{ "type": "openclaw", "watcherStatus": "watching", "filesWatched": 142, "lastSyncAt": null, "lastError": null }
```

- **400** 不支持的数据源类型。

---

### 1.3 会话

#### `GET /api/v1/sessions`

带分页、过滤和排序的会话列表。

| 查询参数 | 类型 | 默认值 | 校验 |
| --- | --- | --- | --- |
| `source` | `openclaw \| claude-code \| codex \| opencode` | _(任意)_ | 白名单；不匹配经下游过滤器返回 **400** |
| `project` | string | _(任意)_ | 透传 `=` 过滤 |
| `status` | `active \| idle \| aborted \| error \| unknown` | _(任意)_ | 透传 |
| `sort` | `updated_at \| started_at \| ended_at` | `updated_at` | 无效排序参数返回 **400** |
| `order` | `asc \| desc` | `desc` | 无效参数返回 **400** |
| `includeChildren` | `true`（仅此值启用） | `false` | 为 false 时，仅返回 `relationship_type IS NULL OR 'root'` 的会话 |
| `limit` | 非负整数 | `50` | 上限 1000；负数返回 **400** |
| `offset` | 非负整数 | `0` | 负数返回 **400** |

`updated_at` 计算方式为 `MAX(COALESCE(ended_at, ''), COALESCE(started_at, ''), COALESCE(file_mtime, ''))` — 这便是 `sort=updated_at` 无需存储列即可工作的原因。

```json
{
  "sessions": [ { "id": "...", "source": "claude-code", "project": "/Users/...", "name": "...", "status": "idle", "metrics": {"messageCount": 88, ...}, "turns": [] }, ... ],
  "pagination": { "total": 412, "limit": 50, "offset": 0, "hasMore": true }
}
```

`turns` 在此处始终为 `[]` — 请通过 `/sessions/:id/turns` 单独获取轮次。

#### `GET /api/v1/sessions/lookup`

通过 `(source, key)` 查找会话 — 供 OpenClaw Gateway 到摄取服务的下钻使用。

| 查询参数 | 是否必需 | 说明 |
| --- | --- | --- |
| `source` | 是 | 白名单 `openclaw \| claude-code \| codex \| opencode`；否则返回 **400** |
| `key` | 是 | 正则 `^[a-zA-Z0-9:\-_.]{1,256}$`；否则返回 **400** |

查找流程先尝试 `id = ?`，再尝试 `source_session_id = ?`，两者均按 `source` 过滤。

- **400** 参数缺失或无效。
- **404** `Session not found for key`。

#### `GET /api/v1/sessions/:id`

单个会话详情。

- **400** 当 `id` 不匹配 `^[a-zA-Z0-9:\-_.]{1,256}$` 时返回 `Invalid session ID format`。
- **404** 无匹配行时返回 `Session not found`。
- **200** 返回规范 `TraceSession`（其中 `turns: []`）。

#### `GET /api/v1/sessions/:id/messages`

扁平有序的消息列表。

| 查询参数 | 默认值 | 说明 |
| --- | --- | --- |
| `role` | _(全部)_ | 白名单 `user \| assistant \| system \| tool_result`；否则返回 **400** |
| `limit` | `100` | 上限 1000；负数返回 **400** |
| `offset` | `0` | 负数返回 **400** |

```json
{
  "sessionId": "...",
  "messages": [ { "id": "...", "ordinal": 0, "role": "user", "content": "...", "timestamp": "...", "model": null, "tokenUsage": null, "sourceMetadata": {"sourceType": "openclaw", "sourceFile": "...", "sourceLine": 1} }, ... ],
  "pagination": { "total": 88, "limit": 100, "offset": 0, "hasMore": false }
}
```

> 注意：`sourceMetadata.sourceType` 目前在消息行映射器中硬编码为 `"openclaw"` — 参见 `ingest/api/turns.ts` 中的 `// TODO` 注释。请勿依赖该字段进行数据源识别；请使用父会话的 `source`。

- **400** 无效的会话 ID 格式 / role / limit / offset。
- **404** 会话未找到。

#### `GET /api/v1/sessions/:id/turns`

为某个会话运行轮次组装器。

| 查询参数 | 默认值 | 说明 |
| --- | --- | --- |
| `limit` | `50` | 上限 1000 |
| `offset` | `0` | 在组装之后应用（组装器读取所有消息，切片在内存中进行） |

```json
{
  "sessionId": "...",
  "turns": [
    {
      "id": "session-turn-0", "sessionId": "...", "index": 0,
      "userMessage": { "id": "...", "ordinal": 0, "role": "user", "content": "...", "sourceMetadata": {...} },
      "assistantMessages": [ { "id": "...", "ordinal": 1, "role": "assistant", "content": "...", ... } ],
      "activities": [ { "type": "tool_call", "name": "Bash", "category": "Bash", "inputJson": "...", "status": "success", "resultEvents": [{"content": "...", "isPartial": false}], ... } ],
      "startedAt": "...", "endedAt": "...", "durationMs": 12345,
      "tokenUsage": { ... },
      "isTruncated": false
    }
  ],
  "pagination": { "total": 12, "limit": 50, "offset": 0, "hasMore": false }
}
```

- **400** 无效的会话 ID / limit / offset。
- **404** 会话未找到。

#### `GET /api/v1/sessions/:id/turns/:index`

获取单个轮次。校验规则同上。

- **400** `:index` 非数字或为负数。
- **404** 轮次或会话未找到。

---

### 1.4 SSE 事件流

两个端点均设置：

```text
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

连接在客户端保持打开期间一直存活。路由处理器会附加 `abort` 监听器，以便客户端断开连接时清理订阅者。

#### `GET /api/v1/events`

全局流。发送的事件：

| 事件 | 数据 |
| --- | --- |
| `connected` | `{}`（订阅时立即发送） |
| `session_created` | `{ sessionId, source }` |
| `session_updated` | `{ sessionId, source }` |
| `session_removed` | `{ sessionId }`（当前未使用 — 摄取服务不删除行；保留为向前兼容） |
| `sync_complete` | `{ source, sessionsInserted, sessionsUpdated, errors }` |

#### `GET /api/v1/sessions/:id/events`

每个会话的事件流。在订阅前会校验 `:id` 格式并确认会话存在（依据威胁模型 T-06-02-01）。

| 事件 | 数据 |
| --- | --- |
| `connected` | `{}` |
| `session_created` | `{ sessionId, ... }`（仅当恰好是该会话时） |
| `session_updated` | `{ sessionId, ... }` |
| `turn_added` | 保留 — 由 SSE 管理器接口定义，但当前写入器不触发 |

- **400** 无效的会话 ID 格式。
- **404** 会话未找到。

---

### 1.5 错误与速率限制

- 全局错误处理器 (`app.onError`) 默认返回状态码为 500 的 `{ "error": "Internal server error" }`。当 `INGEST_DEBUG=true` 时，改为返回 `{ error, stack }` — **切勿在共享环境中启用**。
- `rateLimiter` 中间件（当 `INGEST_RATE_LIMIT_ENABLED=true` 时，默认为 true）将每个 IP 每分钟的请求限制为 `INGEST_RATE_LIMIT_RPM`。超限返回 `429 { error: "Too many requests", retryAfter: <seconds> }`。`/health` 和 `/version` 不受限制。
- IP 取自第一个 `x-forwarded-for` 条目；回退为 `127.0.0.1`。

---

## 2. Next.js BFF (`:3000/api`)

所有 BFF 路由对请求（如适用）和响应均使用 `Content-Type: application/json`。错误经过清理 — 参见 `lib/agent-tools/server-adapter.ts` 中的 `sanitizeError`。

### 2.1 按工具划分的代理

每个按工具划分的端点均遵循相同的模式：

1. `assertSourceToolId(tool)` — 拒绝未知工具并返回 **400**。
2. 查找正确的适配器 (`openclaw | claude-code | codex | opencode`)。
3. 调用适配器；为列表查询注入 `source=<tool>`。
4. 校验 `sessionId`（如果存在）（`validateSessionId` 正则）。格式错误返回 **400**。
5. 捕获并 `sanitizeError` — 无法识别的错误返回 **502**，消息为通用 `Ingest service unreachable`。

#### `GET /api/agent-tools/[tool]/health`

透传到摄取服务的 `/health`。返回摄取服务的原始响应（不改变结构）。

#### `GET /api/agent-tools/[tool]/sessions`

与摄取服务 `GET /api/v1/sessions` 相同的查询参数，**区别**在于 `source` 被忽略（BFF 根据 `[tool]` 注入），并且 `limit` 在转发前上限为 **100**。

#### `GET /api/agent-tools/[tool]/sessions/lookup`

包装摄取服务 `GET /api/v1/sessions/lookup`。

- 仅允许 `openclaw` — 其他工具返回 **400** `Gateway lookup is only available for OpenClaw`。
- `key` 缺失时返回 **400**。
- 摄取服务返回 404 时返回 **404** `No matching indexed session found`。

#### `GET /api/agent-tools/[tool]/sessions/[sessionId]`

校验 `sessionId`，然后调用 `getSourceScopedSession(sessionId, source)`。如果会话在摄取服务中存在但其 `source` 与 `[tool]` 不匹配，BFF 返回 **404**（跨源隔离）。

#### `GET /api/agent-tools/[tool]/sessions/[sessionId]/messages`

首先调用 `requireSourceScopedSession`，然后代理到摄取服务 `/api/v1/sessions/:id/messages`。BFF 层不做额外的查询处理 — 直接透传。

#### `GET /api/agent-tools/[tool]/sessions/[sessionId]/turns`

| 查询参数 | 默认值 | 说明 |
| --- | --- | --- |
| `offset` | `undefined`（透传到适配器，默认为 0） | 负数返回 **400** |
| `limit` | `undefined`（适配器默认 50） | 负数返回 **400**；转发前上限为 100 |

调用 `requireSourceScopedSession`，然后调用 `adapter.getSessionTurns()`。

#### `POST /api/agent-tools/[tool]/sync`

按数据源的同步触发器。接受来自查询参数 (`?force=true`) 或 JSON 请求体 (`{"force":true}`) 的 `force`。

- **400** 当 `tool` 无效时返回 `Invalid source tool ID`（包括 `all`）。
- **502** 摄取服务不可达时返回 `Ingest service unreachable`。

#### `GET /api/agent-tools/[tool]/events`

SSE 透传。`runtime = 'nodejs'`，`dynamic = 'force-dynamic'`。

| 查询参数 | 行为 |
| --- | --- |
| _(无)_ | 订阅全局 `/api/v1/events` 流。 |
| `sessionId=<id>` | 订阅 `/api/v1/sessions/:id/events`。 |

浏览器端的 `EventSource` 在重连时应自动设置 `Last-Event-ID` 头。该流逐字转发摄取服务的响应体；如果上游 fetch 失败则返回 **502** `{ "error": "Ingest SSE unavailable" }`。

---

### 2.2 聚合 / 工具路由

#### `GET /api/ingest/health`

前端使用的健康检查。包装摄取服务 `/health`，不可达时返回 502。

```json
{ "status": "ok", "ready": true, "version": "0.1.0", "sync": { ... } }
// 失败时
{ "status": "error", "error": "<sanitized message>" }
```

#### `POST /api/sync`

全源聚合同步。按 `openclaw → claude-code → codex → opencode` 顺序依次调用每个 `/api/v1/sources/:type/sync`。

| 参数 | 位置 | 默认值 |
| --- | --- | --- |
| `force` | 查询参数或 JSON 请求体 | `false` |

```json
{
  "results": [
    { "type": "openclaw",    "syncResult": {...}, "status": "completed" },
    { "type": "claude-code", "syncResult": {...}, "status": "completed" },
    { "type": "codex",       "syncResult": {...}, "status": "completed" },
    { "type": "opencode",    "syncResult": {...}, "status": "completed" }
  ],
  "force": false
}
```

#### `GET /api/logs`

通过 `lib/logs.ts` 从本地文件系统读取活动日志（定时任务运行和配置审计）。最多返回 200 条记录。

```json
{
  "entries": [ { "id": "...", "ts": "...", "level": "info", "summary": "...", "source": "cron", "jobId": "..." } ],
  "summary": { ... }
}
```

- **500** 文件系统错误时返回 `Failed to load logs`（经 `apiErrorResponse` 清理）。

#### `GET /api/sessions/messages`

**遗留的文件扫描路由**，从 OVAO 时代保留至今。直接从 OpenClaw 会话 JSONL 文件读取最后 30 行消息。

| 查询参数 | 是否必需 |
| --- | --- |
| `id` | 是 |

- 会话 ID 经过清理（去除 `[^a-zA-Z0-9\-_:.]` 以外的字符）。
- `WORKSPACE_PATH` 必须设置；否则返回 **500** `WORKSPACE_PATH not configured`。
- `id` 查询参数缺失时返回 **400** `Missing session id`。
- 会话文件未找到时返回 `[]`（200）— 不返回 404。

> 请勿在新代码中使用此路由。推荐使用 `/api/agent-tools/openclaw/sessions/[sessionId]/messages`，该路由通过摄取服务的读取模型，可享受索引、源范围限定和 SSE 失效机制的优势。

#### `POST /api/action/restart`

调用 `systemctl restart openclaw`，失败时回退到 `systemctl --user restart openclaw`。供 OpenClaw 运维工具使用。

- 成功时返回 **200** `{ "success": true }`。
- 失败时返回 **500** `{ "success": false, "error": "All restart attempts failed" }`。

> 主机级别操作。在非 Linux/systemd 机器或 OpenClaw 未安装为服务的情况下会失败（或产生意外效果）。

#### `POST /api/action/update`

运行 `npm update -g openclaw`，超时 120 秒。

- 成功时返回 **200** `{ "success": true, "output": "..." }`。
- 非零退出码时返回 **500** `{ "success": false, "error": "<details>" }`。

> 与 `/api/action/restart` 注意事项相同 — 主机级别命令。

---

## 3. 状态码汇总

| 状态码 | 含义 |
| --- | --- |
| **200** | 成功。 |
| **400** | 输入错误 — 无效的 tool、session ID、source、role、sort、limit/offset，或缺少必需参数。 |
| **404** | 会话 / 轮次 / 会话不在该源范围内，未找到。 |
| **429** | 摄取服务速率限制已达（响应体包含 `retryAfter`）。 |
| **500** | 内部服务器错误（生产环境中已清理；仅在 `INGEST_DEBUG=true` 时返回完整堆栈）。 |
| **502** | BFF 无法连接摄取服务，或摄取服务返回了 BFF 无法分类的非 2xx 响应。 |

---

## 4. 端到端调试步骤

```bash
# 1. 确认摄取服务已启动并就绪
curl http://localhost:8078/health | jq

# 2. 确认你关心的数据源已配置
curl 'http://localhost:8078/api/v1/sources/claude-code' | jq

# 3. 强制同步某个数据源（跳过缓存，重新解析）
curl -X POST 'http://localhost:8078/api/v1/sources/claude-code/sync' \
  -H 'content-type: application/json' \
  -d '{"force":true}' | jq

# 4. 列出最新的会话
curl 'http://localhost:8078/api/v1/sessions?source=claude-code&limit=5' | jq

# 5. 获取某个会话的轮次（将 SID 替换为上面返回的真实 id）
curl 'http://localhost:8078/api/v1/sessions/SID/turns' | jq '.turns | length'

# 6. 与步骤 (4) 相同，但通过 BFF — 除 limit 上限外应与上面一致
curl 'http://localhost:3000/api/agent-tools/claude-code/sessions?limit=5' | jq

# 7. 订阅实时失效事件（Ctrl+C 停止）
curl -N 'http://localhost:3000/api/agent-tools/claude-code/events'
```

关于每个端点内部实际行为的更深入指南，请参阅 [`services/ingest.md`](services/ingest.md)（解析器/同步/SSE）和 [`services/frontend.md`](services/frontend.md)（BFF 适配器和 React 钩子）。
