# 数据流：JSON 文件 → Sessions → Turns

本文档说明完整的数据管道——从 AI 工具写到本地磁盘的原始 JSONL 文件，经过 ingest 服务处理、写入 SQLite，最终被组装成 turns 返回给前端。

---

## 总览

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     本地磁盘（source 文件）                          │
│  ~/.claude/projects/{project}/{uuid}.jsonl   (Claude Code)          │
│  .openclaw/agents/{name}/sessions/*.jsonl    (OpenClaw)             │
│  {codex-dir}/*.jsonl                         (Codex)                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  chokidar 文件监听 + 定时全量 resync
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   INGEST 服务（port 8078）                           │
│                                                                     │
│  1. Parser（claude.ts / openclaw.ts / codex.ts）                    │
│     JSONL 逐行解析 → ParseResult                                    │
│     { session, messages[], activities[], errors[] }                 │
│                                                                     │
│  2. Sync 层（sync/index.ts）                                        │
│     SHA-256 skip cache → writeSessionToDatabase()                   │
│     发出 SSE 事件：session_created / session_updated                │
│                                                                     │
│  3. SQLite DB（data/ingest.db，WAL 模式）                           │
│     sessions / messages / tool_calls / turns / sync_status         │
│                                                                     │
│  4. REST API（Hono）                                                │
│     GET /api/v1/sessions                                            │
│     GET /api/v1/sessions/:id/turns  ← 按需运行 assembler            │
│     GET /api/v1/events              ← SSE 失效推送流                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  HTTP（经 BFF 代理，前端不直连）
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│           NEXT.JS BFF（app/api/agent-tools/[tool]/...）             │
│  代理到 ingest；注入 source= 过滤；限流 limit 上限为 100            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  fetch()
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       前端（React）                                  │
│  渲染 sessions 列表、session 详情、turn-by-turn replay              │
│  收到 SSE 失效事件后重新 fetch                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 阶段 1：Source 文件

每个 AI 工具将对话历史写成 JSONL 文件（每行一个 JSON 对象）。Ingest 服务在启动时发现这些目录：

- 扫描目录由 `ingest/config/tool-dirs.ts` 中的**工具目录注册表**集中管理，按优先级解析：环境变量 > 配置文件（`~/.agents-tracing/config.json`）> 内置默认值。
- 发现器（`ingest/sync/sources.ts`）从 `IngestConfig.toolDirs` 读取目录列表，每个数据源可配置多个目录。

| Source | 默认路径 | Session ID |
| --- | --- | --- |
| Claude Code | `~/.claude/projects/{encoded-cwd}/{uuid}.jsonl` | 从文件名提取 UUID |
| OpenClaw | `~/.openclaw/agents/{name}/sessions/{key}.jsonl` | `agent:{name}:{uuid}` |
| Codex | `~/.codex/sessions/*.jsonl` | 从文件名派生 |

每行 JSONL 包含一条消息，具有 role（`user`、`assistant`、`system`、`tool_result`）、content、timestamp，以及可选的工具调用块。Claude Code 的行还携带 `uuid` 和 `parentUuid`，用于 DAG 关系追踪。

---

## 阶段 2：Parser

`ingest/parser/claude.ts`、`openclaw.ts`、`codex.ts` 各自实现同一接口：逐行读取 JSONL 文件并产出 `ParseResult`：

```typescript
interface ParseResult {
  session: TraceSession      // 元数据：id、source、project、时间戳、统计指标
  messages: TraceMessage[]   // 全部消息的有序平铺列表
  activities: TraceActivity[] // 从 assistant content blocks 提取的工具调用
  errors: ParseError[]       // 格式错误行记录
  warnings: string[]
}
```

**各 source 的特殊处理：**

- **Claude Code**：UUID 去重（跳过重复 UUID）、DAG 解析（`parentUuid` → 关系类型）、compact 边界检测（上下文窗口压缩事件）
- **OpenClaw**：content block 提取、去除 gateway 注入的元数据前缀以提取展示名
- **Codex**：`turn_context` 边界检测，利用原生 turn 标记

Parser 不操作数据库——它只将磁盘上的字节转换为内存中的类型化对象。

---

## 阶段 3：Sync 层

`ingest/sync/index.ts` 中的 `writeSessionToDatabase()` 接收 `ParseResult` 并写入 SQLite。在执行完整写入前，它会检查 **skip cache**：

```text
fileHash = SHA-256（磁盘上的文件）
cacheKey = "{PARSER_CACHE_VERSION}:{source}:{fileHash}"

if sessions.file_hash === cacheKey:
    跳过重新解析，仅在 name/project 为空时补充填充
    提前返回
else:
    upsert session 行
    删除并重新插入该 session 的所有 messages
```

Skip cache 防止定时 resync 时重复解析未变化的文件。当元数据 schema 发生变更时（如 project 路径提取逻辑修复），迁移脚本会将对应 session 的 `file_hash` 置为 NULL，强制下次同步时重新解析。

每次写入后，sync 层都会发出 SSE 事件（`session_created` 或 `session_updated`），通知已连接的浏览器重新 fetch。

---

## 阶段 4：SQLite 数据库

`data/ingest.db` 是一个启用了 WAL 模式的 SQLite 数据库。WAL 允许多个并发读取者和单个写入者——文件监听器在写入时不会阻塞 HTTP API 的读取服务。

### 为什么需要 DB

如果每次 HTTP 请求都从头解析 JSONL 文件，速度会极慢。DB 是读取模型（read model）：

| 需求 | DB 的解决方式 |
| --- | --- |
| 快速的 session 列表过滤/排序 | `sessions` 表上有 `source`、`project`、`started_at` 索引，O(log n) 查询 |
| 跨数百个 session 的分页 | SQL `LIMIT / OFFSET` 配合 count 查询 |
| 跨 session 的关系查询 | `parent_session_id` / `root_session_id` 外键支持 subagent 树查询 |
| 增量同步的 skip cache | `file_hash` 列存储 SHA-256；未变化的文件直接跳过 |
| 同步健康状态追踪 | `sync_status` 表按 source 类型记录上次同步时间和错误 |
| Turn 组装的输入 | `messages` 表存储平铺的有序消息列表，供 assembler 读取 |
| 工具调用配对 | `tool_calls` 和 `tool_result_events` 表独立存储工具调用与其输出 |

### Schema 概览

```text
sessions            — 每个 session 文件一行，含元数据和文件溯源信息
messages            — 平铺有序的消息（session_id + ordinal），外键关联 sessions
tool_calls          — 工具调用，关联到 message_ordinal
tool_result_events  — 工具调用的输出事件
turns               — 预计算的 turn 行（也可由 assembler 按需构建）
sync_status         — 每个 source 的同步状态记录
```

---

## 阶段 5：Turn Assembler

Turns 不存储在 JSON 文件中——它们是一个派生视图。Assembler（`ingest/turns/assembler.ts`）在**查询时**运行，即前端请求 `/sessions/:id/turns` 时触发。

**组装算法：**

```text
messages（按 ordinal 排序）
  ↓ 逐条遍历
  user 消息      → 关闭前一个 turn（若有 assistant 响应），开启新 turn
  assistant 消息 → 追加到当前 turn 的 assistantMessages[]
  tool_result    → 追加到当前 turn 的 assistantMessages[]
  system/compact → 作为 activity 事件添加；若为 compact 则标记 turn 为 isTruncated
  queued user    → 合并到当前 user 消息（D-05：连续 user 消息合并）
  ↓ 后处理
  pairToolCalls()   → JOIN tool_calls + tool_result_events，附加到对应 turn
  linkSubagents()   → 查找子 session，在第一个 turn 上添加 subagent_link activity
```

**Turn 边界规则（D-08）：** 每条 user 消息开启一个新 turn，下一条 user 消息到来时关闭前一个 turn。尚无 assistant 响应的末尾 turn 也会被包含。

`TraceTurn` 的结构：

```typescript
{
  id: "sessionId-turn-0",
  index: 0,
  userMessage: TraceMessage,         // 人类的提问
  assistantMessages: TraceMessage[], // 所有模型响应和 tool_result
  activities: TraceActivity[],       // 工具调用、系统事件、subagent 链接
  startedAt, endedAt, durationMs,
  tokenUsage,
  isTruncated?,
}
```

---

## 阶段 6：REST API → BFF → 前端

Ingest 服务在 8078 端口暴露 Hono REST API：

| Endpoint | 返回内容 |
| --- | --- |
| `GET /api/v1/sessions` | 分页 session 列表，支持 source/project/status 过滤 |
| `GET /api/v1/sessions/:id` | 单个 session 元数据 |
| `GET /api/v1/sessions/:id/turns` | Turn 组装视图，支持分页 |
| `GET /api/v1/sessions/:id/messages` | 原始平铺消息列表 |
| `GET /api/v1/events` | 全局失效 SSE 流 |
| `GET /api/v1/events/:sessionId` | 单 session 失效 SSE 流 |

前端**不直接调用 ingest 服务**（D-07）。Next.js BFF 路由 `app/api/agent-tools/[tool]/...` 代理所有请求，自动注入 `source={tool}` 参数，使每个工具的数据隔离。BFF 层还额外将单次请求的 limit 上限限制为 100。

**实时更新循环：**

```text
1. 前端订阅 SSE：/api/agent-tools/{tool}/events
2. 文件监听器检测到磁盘上的 JSONL 变化
3. 防抖（500ms）→ syncSource() → parser → DB 写入
4. sseManager.emit('session_updated', ...) → SSE 推送到前端
5. 前端收到事件 → 重新 fetch session 列表 / session 详情
```

---

## 数据流总结

```text
JSONL 文件（磁盘）
  → Parser：逐行解析 → ParseResult { session, messages[], activities[] }
  → Skip cache 检查：SHA-256(文件) vs sessions.file_hash
      [未变化] → 提前返回
      [已变化] → upsert session + 删除并重新插入 messages 到 SQLite
  → SSE 事件：session_created / session_updated → 前端重新 fetch

前端请求 /sessions/:id/turns 时：
  → assembleTurns(sessionId)
      → SELECT messages WHERE session_id ORDER BY ordinal
      → 按 user 消息边界分组 → TraceTurn[]
      → pairToolCalls：JOIN tool_calls + tool_result_events
      → linkSubagents：JOIN sessions WHERE parent_session_id
  → JSON 响应给 BFF → JSON 响应给 React
```

**DB 是连接「持续文件监听写入路径」和「按需 HTTP 读取路径」的桥梁。没有 DB，每次请求都需要从头解析所有 JSONL 文件。**
