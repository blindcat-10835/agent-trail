# Ingest 服务深度解析

ingest 服务是一个长时间运行的 Node.js 进程，它监听本地 AI 工具会话文件，将其解析为标准的 trace 协议，并通过 Hono REST + SSE API 提供结果。本文档是该服务的运维者和贡献者指南。

系统上下文参见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md)。它写入的数据库参见 [`../db-schema.md`](../db-schema.md)。它暴露的公开 HTTP 协议参见 [`../API.md`](../API.md)。

---

## 1. 模块结构

```text
ingest/
├── index.ts                 # 引导：config → DB → HTTP → 发现 → 监听 → 预热 → 后台同步
├── types.ts                 # 内部类型：ServiceContext、HealthStatus、StartupSyncState、VersionInfo
├── tsconfig.json            # 项目引用；编译输出到 ingest/dist/
├── config/
│   ├── index.ts             # loadConfig() / getConfig() — INGEST_* 环境变量解析 + 验证
│   └── tool-dirs.ts         # TOOL_DIR_REGISTRY + resolveToolDirs() — 工具目录注册表
├── db/
│   ├── schema.sql           # 标准 SQLite DDL（见 db-schema.md）
│   └── index.ts             # openDatabase / initSchema / runMigrations / getDatabase / closeDatabase
├── parser/
│   ├── types.ts             # ParseResult、ParseError、解析器接口
│   ├── claude.ts            # Claude Code JSONL 解析器（UUID 去重、DAG、compact 检测）
│   ├── openclaw.ts          # OpenClaw 解析器（content blocks、网关前缀剥离）
│   └── codex.ts             # Codex 解析器（turn_context、function_call、custom-tool）
├── sync/
│   ├── sources.ts           # discover{OpenClaw,Claude,Codex}Sources + isWithinRoot
│   └── index.ts             # writeSessionToDatabase + syncSource（编排器）+ 跳过缓存
├── turns/
│   └── assembler.ts         # 读取时 TraceTurn[] 组装（D-08、D-10、D-11）
├── api/
│   ├── sources.ts           # /api/v1/sources、/sources/:type、/sources/:type/sync、/sources/:type/status
│   ├── sessions.ts          # /api/v1/sessions、/sessions/lookup、/sessions/:id
│   ├── turns.ts             # /sessions/:id/turns、/sessions/:id/turns/:index、/sessions/:id/messages
│   ├── routes/
│   │   └── events.ts        # /api/v1/events、/api/v1/sessions/:id/events（SSE）
│   └── middleware/
│       └── rate-limit.ts    # 每个 IP 的滑动窗口限流器
└── src/
    ├── watcher.ts           # chokidar 封装：防抖、定期重新同步、临时文件过滤
    └── sse.ts               # SSEManager 单例，用于失效广播
```

`ingest/dist/` 是 `tsc` 的输出 — 已 gitignore。`ingest/.tsbuildinfo` 是增量构建缓存。

---

## 2. 启动流程（`index.ts`）

```text
start()
  loadConfig()                                         // 环境变量无效时抛出异常
  if config.rateLimitEnabled: app.use('*', rateLimiter)
  openDatabase({ path: config.dbPath })                // WAL 开启，父目录 mkdir
  initSchema()                                         // 执行 schema.sql + runMigrations()
  syncState = { phase: 'starting', startupComplete: limit===0, ... }
  serve({ fetch: app.fetch, port: config.port })       // TCP 立即开始监听（这样 /health 就能响应了）
  context = { config, db, server, sseManager, watcher: null, syncState }
  void initializeSourcesAndSync()                      // 立即返回；在后台运行

initializeSourcesAndSync()                             // 后台执行
  syncState.phase = 'discovering'
  discoverOpenClawSources / discoverClaudeSources / discoverCodexSources
  syncState.phase = 'starting watcher'
  createWatcher({ sourceDirs, debounceMs, resyncIntervalMs, fileExtensions: ['.jsonl', '.json', '.md'], onSyncTrigger })
  watcher.start()
  if startupSyncLimit > 0:
    syncState.phase = 'warming'
    for sourceType in ['openclaw', 'claude-code', 'codex']:
      syncSource(sourceType, { limit, sortByMtimeDesc: true })   // 仅同步最新的 N 个文件
  syncState.startupComplete = true                     // /health 切换 ready=true
  if backgroundSyncEnabled:
    syncState.phase = 'indexing'
    for sourceType in [...]: syncSource(sourceType)    // 完整历史扫描，无限制
  syncState.phase = 'idle'
```

需要注意的两个设计选择：

1. **HTTP 先于预热启动。** 快速任务 `260509-nwg` 将"ingest 可达"与"ingest 已索引所有内容"解耦。在预热期间 health 报告 `ready: false`；前端的健康覆盖层将其视为"仍在加载中"而非故障。
2. **有限预热 → 后台完整同步。** 前端在同步每个数据源约 50 个最新文件后（`INGEST_STARTUP_SYNC_LIMIT`）即可获得可用数据；其余数据通过后台同步 + SSE 逐步流入。

`stop()` 反向执行启动流程：停止 watcher、关闭 HTTP 服务器、关闭数据库。

---

## 3. 配置

所有可调参数来自 `config/index.ts` 中解析的环境变量。每个变量、默认值和验证规则在 [`../CONFIGURATION.md`](../CONFIGURATION.md) 中。要点：

| 变量 | 默认值 | 为什么在此处重要 |
| --- | --- | --- |
| `INGEST_PORT` | `8078` | Hono `serve()` 端口 |
| `INGEST_DB_PATH` | `./data/ingest.db` | 使用 `path.resolve()` 解析；拒绝 `..` |
| `INGEST_STARTUP_SYNC_LIMIT` | `50` | 每个数据源预热时同步的最新文件数；`0` 跳过预热 |
| `INGEST_BACKGROUND_SYNC_ENABLED` | `true` | 预热后是否执行完整同步 |
| `INGEST_DEBOUNCE_MS` | `500` | chokidar 事件合并窗口 |
| `INGEST_RESYNC_INTERVAL_MS` | `300000` | 定期完整重新同步的兜底间隔 |
| `INGEST_PARSE_CONCURRENCY` | `1` | Phase 16 有界解析并发开关；当前保持串行 |
| `INGEST_SQLITE_BATCH_SIZE` | `500` | SQLite 批量写入上限；append writer 使用有界事务写入 |
| `INGEST_SYNC_HISTORY_LIMIT` | `20` | sync debug recent-run 历史条数 |
| `INGEST_RATE_LIMIT_RPM` | `100` | 每个 IP 每分钟上限 |
| `INGEST_DEBUG` | `false` | 为 true 时，错误响应包含堆栈追踪 |

验证在启动时进行——如果 Hono 从未到达 `serve()`，查看打印的 `Error: Invalid INGEST_*` 行。

---

## 4. 数据源发现

### 4.1 工具目录注册表（`config/tool-dirs.ts`）

扫描目录由 `ingest/config/tool-dirs.ts` 中的工具目录注册表集中管理。注册表为每个数据源定义了：

| 数据源 | 环境变量 | 配置文件键 | 默认目录 |
| --- | --- | --- | --- |
| OpenClaw | `OPENCLAW_DIR` | `openclaw_dirs` | `~/.openclaw/agents` |
| Claude Code | `CLAUDE_PROJECTS_DIR` | `claude_project_dirs` | `~/.claude/projects` |
| Codex | `CODEX_SESSIONS_DIR` | `codex_sessions_dirs` | `~/.codex/sessions` |

`resolveToolDirs()` 按优先级解析目录：环境变量 > 配置文件（`AGENTS_TRACING_CONFIG` 或默认 `~/.agents-tracing/config.json`）> 内置默认值。配置文件中可指定多个目录（数组），环境变量仅支持单个目录。解析结果存储在 `IngestConfig.toolDirs`（`Map<SourceToolId, string[]>`）中。

### 4.2 发现器（`sync/sources.ts`）

`sync/sources.ts` 导出三个发现器：

- `discoverOpenClawSources(dirs?: string[])`
  - 默认从 `IngestConfig.toolDirs` 中读取 OpenClaw 的目录列表。
  - 对每个目录，遍历 `*/sessions/` 子目录，为每个 agent 的 sessions 目录返回一个 `DiscoveredSource`，包含来自 `*.jsonl` 文件的 `sessionCount`。
  - 如果未找到任何 agent，返回一个 `sessionCount: 0` 且带有描述缺失原因的 `error` 的条目。
  - 通过 `isWithinRoot` 过滤掉已解析的 `agentsDir` 之外的任何内容。
- `discoverClaudeSources(dirs?: string[])`
  - 默认从 `IngestConfig.toolDirs` 中读取 Claude Code 的目录列表。
  - 递归：目录下任何包含 `.jsonl` 的子目录都成为 `DiscoveredSource`。
- `discoverCodexSources(dirs?: string[])`
  - 默认从 `IngestConfig.toolDirs` 中读取 Codex 的目录列表。
  - 与 Claude 相同的递归模式。

`isWithinRoot(candidate, allowed)` 解析两个路径并检查 `candidate.startsWith(root + sep) || candidate === root`。这阻止了可能让 watcher 逃逸出配置根路径的符号链接。

---

## 5. 解析器

每个解析器实现相同的协议：

```ts
async function parseSession(filePath: string, project: string): Promise<ParseResult>

interface ParseResult {
  session: TraceSession      // 元数据：id、source、project、name、timestamps、status、metrics
  messages: TraceMessage[]   // 扁平排序的消息
  activities: TraceActivity[] // tool_call | skill_use | subagent_link | thinking | system
  errors: ParseError[]       // 格式错误的行记录
  warnings: string[]
}
```

只有数据源特定的结构能离开解析器边界。下游所有内容（sync、assembler、API）仅看到 `ParseResult`。

### 5.1 Claude 解析器（`parser/claude.ts`）

- 逐行读取 `~/.claude/projects/<encoded-cwd>/<uuid>.jsonl`。
- 每行包含 `uuid`、`parentUuid`、`type`、`message`、`timestamp`、可选的 `usage`。
- 执行 **UUID 去重** — 同一文件中重复的 `uuid` 行被跳过（长时间会话中的真实故障模式）。
- 构建 **DAG**：`parentUuid` 定义了父子/兄弟/分支关系。解析器保留文件中的线性顺序，但使用 DAG 来识别子 agent/分叉结构。
- 检测 **compact 边界** — 系统事件中的 `[compact]` 标记变为 `TraceSystemEvent { subtype: 'compact' }` 活动；assembler 随后将周围的 turn 标记为 `isTruncated`。
- 从文件名的编码 cwd 中提取项目路径：`-Users-ebbi-work` → `/Users/ebbi/work`。如果解析出的值为空/`default`，sync 层随后会修补 `session.project`。

### 5.2 OpenClaw 解析器（`parser/openclaw.ts`）

- 读取 `<workspace>/agents/<name>/sessions/<key>.jsonl`。
- 每行是一条 content-block 消息；工具调用是嵌套的。
- 在提取显示内容之前剥离网关注入的元数据头部。网关注入的日期前缀如 `[Wed 2026-04-29 00:58 GMT+8]` 在派生显示名称时被移除。
- 会话 ID 格式：`agent:<name>:<uuid>`。

### 5.3 Codex 解析器（`parser/codex.ts`）

- 读取 `~/.codex/sessions/**/*.jsonl`。
- Codex 有原生的 `turn_context` 边界 — 解析器直接使用它，并在每条消息上发出稳定的 `turnId` / `turnIndex`。
- 函数调用（`function_call`、`function_call_output`）和 custom-tool 调用都变为 `TraceToolCall` 活动。
- 子 agent 关系来自 `event_msg` 行，其中 `payload.type === 'collab_agent_spawn_end'`。`sync/index.ts` 中的 `collectCodexRelationships()` 预扫描所有 Codex 文件以构建 child→parent 映射，然后在每个文件同步时应用。

---

## 6. Sync 层

`sync/index.ts` 是编排器。两个公开入口点：

### `syncSource(sourceType, options)`

```ts
export async function syncSource(
  sourceType: 'openclaw' | 'claude-code' | 'codex',
  options?: SyncSourceOptions | string  // string = 旧版 basePath 简写
): Promise<SyncResult>
```

- 发现 `sourceType` 的数据源。
- 收集候选 `.jsonl` 文件（如果设置了 `limit` 或 `sortByMtimeDesc`，按修改时间排序）。
- 对每个文件：调用数据源特定的解析器，修补 `session.name`（来自第一条用户消息）和 `session.project`（如果文件派生的项目路径为空，则来自消息的 `cwd`），然后调用 `writeSessionToDatabase(parseResult, undefined, filePath, { force })`。
- 将每个文件的 `SyncResult` 聚合为每个数据源的总 `SyncResult`。
- 调用 `upsertSyncStatus(sourceType, result)` 在 `sync_status` 表中记录 `last_full_sync_at`、`files_watched`、`last_error`。
- 发出带有总数的 `sync_complete` SSE 事件。

**没有通用数据源回退**（D-21）。添加新数据源需要扩展枚举并在 `syncSource` 中添加新分支。

### Phase 16 增量 append 同步

Claude Code 和 Codex 在安全 append 场景下不再每次重新解析整个 JSONL 文件：

1. sync 层读取文件 `size`、`mtime`、`inode`、`device`，并查询 `ingest_file_cursors`。
2. `decideCursorSync()` 判断文件是否未变、append-only、安全增量，或必须 full reparse。
3. 安全增量只读取 cursor offset 之后的完整 JSONL 行；尾部半行会保留到下一次同步。
4. append parser 返回 `IncrementalParseDelta`，包含新增 messages、tool calls、result events、subagent links 和 cursor 更新。
5. `appendSessionDeltaToDatabase()` 在一个 SQLite transaction 内幂等写入增量行，然后才更新 cursor。
6. truncate、inode/device 变化、parser version 变化、缺少 turn/tool 上下文等情况都会回退到原有 `writeSessionToDatabase()` full replacement 路径。

这个路径解决了常驻 ingest 进程在 5 分钟 resync 或 watcher 事件后反复全量解析大文件的问题。默认解析并发仍为 1；`INGEST_PARSE_CONCURRENCY` 只是有界配置，避免后续优化重新引入无界 fan-out。

### Sync debug status

`GET /api/v1/debug/sync` 返回 scheduler 的运行态：

- `activeRun`：当前 run id、reason、scope、source、当前文件路径、文件大小、当前 offset、文件/写入计数、最大 RSS sample 和运行时长。
- `queue`：是否有排队任务、queued reasons、coalesced count。
- `recentRuns`：有界 ring buffer，默认 20 条，可通过 `INGEST_SYNC_HISTORY_LIMIT` 调整。
- `metrics`：最近完成 run 的文件数、full/incremental parse 数、写入行数、最大文件大小和最大 RSS。
- `config`：吞吐相关配置。

debug payload 只包含路径、大小、offset 和计数，不序列化 JSONL 行内容或 message 内容。

### `writeSessionToDatabase(parseResult, db?, sourceFile?, options?)`

实际的数据库写入。步骤：

1. 如果提供了 `sourceFile`，计算 `sha256(file)` → `cacheFileHash = "<PARSER_CACHE_VERSION>:<source>:<sha>"`。
2. 查询现有的 `sessions WHERE id = ?`。
3. **跳过缓存：** 如果现有行的 `file_hash === cacheFileHash` 且 `force !== true`，仅修补 `file_size`、`file_mtime`、`last_sync_at` 和缺失的 `name`/`project` 字段。返回零计数。
4. 否则打开 `database.transaction(...)`：
   - 如果已存在：按依赖顺序删除此 `session_id` 的 `tool_result_events → tool_calls → turns → messages`。然后 `UPDATE sessions SET ...`。
   - 如果是新的：`INSERT INTO sessions ...`。
   - 插入所有 messages（一个预处理语句，循环执行）。如果解析器未设置 `messages.id`，则回退为 `${sessionId}:${ordinal}`。
   - 插入所有 `tool_call` 活动及其 `tool_result_events`。
5. 提交后，发送 SSE：`session_created` 或 `session_updated`，以及每个会话的事件。

事务包装至关重要：`better-sqlite3` 是同步的，因此写入过程中抛出的异常会自动回滚所有内容。不可能出现部分写入。

### 跳过缓存版本控制

缓存键前缀 `parser-v7-turn-activity-placement` 位于 `sync/index.ts` 顶部作为 `PARSER_CACHE_VERSION`。**每当解析器输出结构发生变化时递增它** — 所有现有的 `sessions.file_hash` 将不匹配新前缀，下次同步将重新解析所有内容。这是手动在迁移中使缓存行失效的安全替代方案。

`db/index.ts` 中的迁移使用相同模式的较温和形式：将元数据提取逻辑发生变化的行的 `file_hash` 设为 `NULL`。

---

## 7. 文件监听器（`src/watcher.ts`）

封装了 `chokidar` 以满足项目的特定需求。

- 监听数据源发现返回的所有目录（每个目录一个 chokidar watcher；聚合到单个 `WatcherInstance` 中）。
- 监听的文件扩展名：`['.jsonl', '.json', '.md']`（Markdown 用于 OpenClaw 笔记文件）。
- **临时文件过滤** — 去除 `~`、`.swp`、`.swo`、`.tmp`、`.temp`、`.bak`、`.DS_Store`、`Thumbs.db`、`.gitkeep`。
- **防抖** — 在 `INGEST_DEBOUNCE_MS` 的静默期（默认 500ms）后，将同一数据源的多个事件合并为单个 `onSyncTrigger(sourceType)` 调用。
- **定期重新同步** — 每 `INGEST_RESYNC_INTERVAL_MS`（默认 5 分钟）对每个数据源调用 `onSyncTrigger`，无论是否有文件事件。这是"watcher 漏掉事件"场景的兜底措施。

`getStatus()` 返回运行标志、监听文件数、上次同步时间、上次错误和数据源数量 — 通过 `/api/v1/sources/:type/status` 暴露。

当 ingest 热重载时（`tsx watch`），watcher 被拆除并重新创建。没有跨重启的事件合并 — 重启后的下一次同步将通过重新同步间隔捕获任何遗漏的变更。

---

## 8. Turn 组装器（`turns/assembler.ts`）

读取 `messages` 和 `tool_calls` 行并生成 `TraceTurn[]`。在查询时运行，而非同步时。

```ts
export async function assembleTurns(sessionId: string, db?: Database.Database): Promise<TraceTurn[]>
```

算法：

1. `SELECT messages WHERE session_id ORDER BY ordinal`。
2. 如果任何消息有非空的 `turn_index`，使用**存储的 turn 边界**（Codex 情况）— 按 `turn_index` 分组。否则即时计算边界。
3. 遍历消息：
   - `user` → 如果前一个 turn 有助手消息则关闭它；打开新 turn。
   - 连续的 `user` 消息（或 `[QUEUED]` 前缀）→ 合并到当前 turn 中（D-05）。
   - `assistant` / `tool_result` → 追加到当前 turn 的 `assistantMessages`。
   - `system` → 添加为 `TraceSystemEvent` 活动。如果内容包含 `[compact]`，还将当前 turn 的 `isTruncated` 设为 `true`（D-10）。
4. `pairToolCalls(turns, sessionId, db)` — JOIN `tool_calls + tool_result_events` 并附加到 `assistantMessages` 包含匹配 `messageOrdinal` 的 turn。
5. `linkSubagents(turns, sessionId, db)` — `SELECT sessions WHERE parent_session_id = ?` 并将 `subagent_link` 活动添加到第一个 turn（按 D-11）。

`getTurnCount(sessionId, db)` 是一个无需完整组装的轻量计数 — 当调用者只需要总数时，API 用它来生成分页头而无需强制进行完整的 assemble 过程。

---

## 9. SSE 管理器（`src/sse.ts`）

模块级单例（`sseManager`）。两种订阅者：

- **全局订阅者**（`sessionId === null`）接收 `session_created`、`session_updated`、`session_removed`、`sync_complete`。
- **每个会话的订阅者** 仅接收其 `sessionId` 的事件，以及 `turn_added`（保留 — 当前未发送）。

每个订阅者获得一个 `ReadableStream<Uint8Array>`，并立即发送 `event: connected\ndata: {}\n\n` 确认。流的 `cancel()` 从映射中移除订阅者；路由处理也连接 `c.req.raw.signal?.addEventListener('abort', close)`，以便客户端断开时也能清理。

`emit(event, data)` 和 `emitSessionEvent(sessionId, event, data)` 是尽力而为的：`controller.enqueue` 失败（流已关闭）会静默删除订阅者。没有重试、没有缓冲、没有重放日志 — 事件是建议性的失效信号（D-12），而非持久变更源。

---

## 10. 限流器（`api/middleware/rate-limit.ts`）

每个 IP 的滑动窗口计数器：

- 直接绕过 `/health` 和 `/version`。
- 从 `x-forwarded-for` 的第一个逗号分隔值中选取 IP，回退到 `127.0.0.1`。
- 将 `{ count, resetAt }` 存储在内存 `Record` 中；清理间隔每 `min(windowMs, 60_000)` 毫秒运行一次，清除过期条目（`.unref()` 避免保持进程存活）。
- 超出预算时返回 **429**，附带 `{ error: "Too many requests", retryAfter: <seconds> }`。

预配置的单例 `rateLimiter` 是 `createRateLimitMiddleware(100, 60_000)` — 即 100 次请求/分钟，与 `INGEST_RATE_LIMIT_RPM` 的默认值匹配。常量不直接读取环境变量；如果需要不同的上限，在代码中覆盖值或重建中间件。

---

## 11. 错误处理

- 每个路由：所有地方显式使用 `c.json({ error: '...' }, status)`，验证失败返回 `400`，缺失行返回 `404`。状态码是有意选择的，而非默认值。
- 全局：`app.onError((err, c) => ...)` 默认返回 `{ error: 'Internal server error' }`（状态码 500）。启用 `INGEST_DEBUG=true` 时，返回 `{ error: err.message, stack: err.stack }` 用于调试 — 切勿在共享环境启用。
- Watcher：`onSyncTrigger` 内部的失败被捕获并记录 `[watcher] Sync failed for <source>: <err>`。Watcher 继续运行。
- Sync：每个文件的解析器失败被捕获并累积到 `SyncResult.errors` 中。同步继续处理下一个文件。

---

## 12. 生命周期和进程管理

- 服务是一个普通的 Node 进程。`pnpm dev:ingest` 在 `tsx watch` 下运行以支持热重载。`pnpm start:ingest` 在 `NODE_ENV=production` 下运行构建好的 `ingest/dist/ingest/index.js`。
- `SIGINT` / `SIGTERM` 处理程序调用 `stop()` → watcher.stop → server.close → closeDatabase。它们仅在通过 `require.main === module`（即 CLI 入口路径）调用时连接。直接在另一个进程中嵌入 `start()` 意味着你需要自己连接信号处理。
- 没有内置的管理器。对于生产环境的长期运行，使用 `pm2`、`systemd` 或你选择的启动器进行包装。

---

## 13. 常见修改的位置

| 想要修改... | 涉及... |
| --- | --- |
| 添加新的 ingest 端点 | 在 `ingest/api/` 中创建导出 `Hono` 路由器的文件；在 `ingest/index.ts` 中挂载 |
| 添加新数据源（如 Goose、Aider） | `parser/goose.ts` + `sync/sources.ts` 发现器 + `sync/index.ts` 分支 + `types/trace.ts` 枚举 + `db/schema.sql` CHECK 约束 + `lib/agent-tools/goose/{definition,server-adapter}.ts` |
| 修改解析器输出结构 | 递增 `sync/index.ts` 中的 `PARSER_CACHE_VERSION`，以便现有行在下一次同步时重新解析 |
| 修改数据库模式 | 在 `db/index.ts` 的 `runMigrations()` 中添加步骤，递增 `targetVersion`，同时更新 `schema.sql` 以供新安装使用 |
| 调整 watcher 行为 | `INGEST_DEBOUNCE_MS` / `INGEST_RESYNC_INTERVAL_MS` 环境变量，或 `src/watcher.ts` 如果需要新常量 |
| 修改限流器 | `api/middleware/rate-limit.ts` — 单例使用 100/分钟 |
| 添加新的 SSE 事件类型 | 在 `src/sse.ts` 中的 `SSEEventType` 添加；在需要的地方从 sync 层发送；在 `API.md` 中记录 |

---

## 14. 运维注意事项

- `data/ingest.db` 是普通的 SQLite 文件 — `sqlite3 data/ingest.db '.schema'` 可用于临时检查。不要在 ingest 运行时执行 `VACUUM`（WAL 持有锁）。
- WAL 模式意味着 `data/ingest.db-wal` 和 `data/ingest.db-shm` 文件会出现在数据库旁边。这是正常的；在 ingest 运行时删除它们会损坏状态。要彻底重置，先停止 ingest 然后删除这三个文件。
- 迁移仅向前进行。没有回滚路径 — 恢复旧状态意味着恢复 `data/ingest.db` 的备份，或删除它并重新同步。
- `parser_malformed_lines` 和 `parser-warning` 路径会显示在 UI 中（`SessionStatusBar` 显示 `PARSE WARNINGS`）；它们是非致命的 — 包含格式错误行的会话仍然会将其可解析的部分进行索引。

关于此服务暴露的公开 API 协议，请跳转到 [`../API.md`](../API.md)。关于它写入的逐表模式，参见 [`../db-schema.md`](../db-schema.md)。
