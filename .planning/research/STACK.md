# 技术栈研究：agent-tracing-dashboard 数据采集层

**项目:** agent-tracing-dashboard  
**研究日期:** 2026-05-06  
**研究范围:** 复刻 agentsview 的本地数据采集模型，并适配 OpenClaw + Claude Code + Codex 的 turn 级回放  
**总体置信度:** HIGH

## 结论

本项目应该采用 **Hybrid Next.js frontend + local Go ingest service + SQLite WAL/FTS5 + REST/SSE**。不要把会话采集、文件监听、JSONL 解析、增量索引和全文检索塞进 Next.js API Routes；Next.js 继续负责 HUD/trace dashboard UI、OpenClaw Gateway live overview 和浏览器端状态管理，新增一个本地 Go 服务负责历史会话采集与回放数据面。

原因很直接：agentsview 的核心价值不是某个页面框架，而是一个已经验证过的本地数据管道：`fsnotify` 监听 + 周期 resync 兜底，agent-specific parser 归一化 OpenClaw/Claude/Codex JSONL，SQLite 保存 sessions/messages/tool_calls/tool_result_events，FTS5 支持搜索，SSE 通知前端变更。当前仓库的 `app/api/sessions/messages/route.ts` 只是请求时递归找 OpenClaw jsonl 并截取最后 30 条消息，无法支撑跨 agent 历史索引、turn replay、工具结果配对、子 agent 链接、全文搜索或大规模增量同步。

具体落地：在本仓库新增 `ingest/` Go module，尽量移植 agentsview 的 `internal/parser`、`internal/db`、`internal/sync`、`internal/server` 中与 OpenClaw/Claude/Codex 相关的子集；Next.js 通过一个 thin client 访问 `http://127.0.0.1:<port>/api/v1/*`，并用 `EventSource` 订阅 ingest SSE。OpenClaw Gateway WebSocket 数据层继续保留，用于实时 agent overview、presence、活跃会话、avatar、channel/usage 等 OpenClaw 平台状态；历史 transcript 和 turn replay 一律来自 ingest SQLite。

## 推荐栈

| 层 | 技术 | 版本/约束 | 用途 | 决策 |
|---|---|---:|---|---|
| UI | Next.js App Router + React + TypeScript | 沿用本仓库 CLAUDE.md 标称栈；实际 package.json 缺失，后续需恢复确认 | Header source switcher、session list、turn replay、OpenClaw overview | 保留，不重写为 Svelte/纯 Go 页面 |
| UI state | Zustand + browser `EventSource` | 已在项目内使用 Zustand | 前端缓存、筛选、选中 session/turn、SSE 触发重拉 | 保留 Zustand；新增 trace API store |
| Live OpenClaw | 现有 `gateway/` WebSocket RPC | Gateway protocol v3 | OpenClaw 当前状态、agent list、active sessions、avatar、channels、usage | 保留并增强，不作为历史索引来源 |
| Ingest service | Go | 新增 `ingest/` module | 目录发现、JSONL parser、fsnotify watcher、SQLite 写入、REST/SSE | 强制推荐 |
| Local DB | SQLite + WAL + FTS5 | `github.com/mattn/go-sqlite3` 或等价 SQLite driver；需要 FTS5 | 本地单用户历史库、全文搜索、turn/tool/subagent 索引 | 强制推荐 |
| Watcher | `github.com/fsnotify/fsnotify` | agentsview 使用 v1.10.0 | 跨平台文件变更监听，配合 debounce 和周期 resync | 强制推荐 |
| API | REST + SSE | `/api/v1` 前缀 | 前端查询 sessions/messages/turns/tools/search；数据变更通知 | 强制推荐；不需要 WebSocket |
| Packaging | 开发期双进程，后续可包成桌面或单命令 launcher | 先不引入 Tauri | 本地工具启动体验 | 分阶段处理，MVP 不做桌面 sidecar |

## 方案对比

| 方案 | 数据采集能力 | 与当前仓库契合度 | 实时更新 | 打包/运维 | 主要风险 | 结论 |
|---|---|---|---|---|---|---|
| **Go + SQLite + SSE（agentsview 原型）** | 最强。已经覆盖文件发现、parser registry、增量同步、SQLite/FTS5、REST/SSE | 中等。若完全替换 UI，会丢失当前 Next.js/HUD/OpenClaw Gateway 数据层 | 强。fsnotify + broadcaster + SSE 已验证 | 单二进制体验好 | 直接照搬会把 UI 栈从 Next.js 拉向 Go embedded SPA | 作为 ingest 服务的实现基础，不直接替换整个应用 |
| **Next.js-only Node backend** | 弱到中。Route Handler 能读文件和返回 JSON，但常驻 watcher、批量 sync、SQLite 写入串行化、FTS 维护都需要额外自建 | 表面最契合，因为代码都在 TS/Next；实际会让 API Route 承担 daemon 职责 | 可做 SSE，但 watcher 生命周期和 dev/prod 行为容易漂移 | 最简单 | request-scope API 容易退化成每次请求扫文件；大目录、半写入 JSONL、fork/subagent 解析会快速复杂化 | 不推荐做核心采集层；只可做 ingest API 的 BFF/proxy |
| **Rust/Tauri sidecar** | 强，可实现 watcher/SQLite；Tauri 也支持 external binary sidecar | 低。当前是 Web dashboard，不是桌面应用 | 强 | 桌面体验最好，但引入 Rust/Tauri 发布矩阵 | 对 MVP 是额外产品形态和构建负担；无法复用 agentsview Go parser | 暂不采用。等 Web dashboard 稳定后再考虑桌面壳 |
| **Hybrid Next.js frontend + local ingest service** | 最强。复用 Go parser/sync/db，Next.js 专注 UI | 最高。保留现有 Next.js + OpenClaw Gateway，同时补齐历史追踪数据面 | 强。ingest SSE 通知 Next.js/浏览器重拉 | 开发期双进程；后续可 launcher 化 | 需要处理端口发现、CORS/token、本地服务生命周期 | **推荐方案**。这是本仓库的正确落点 |

## 具体架构建议

```text
Browser
  |
  | Next.js UI: header source switcher / trace replay / OpenClaw overview
  v
Next.js App Router
  |-------------------- WebSocket --------------------> OpenClaw Gateway
  |                                                     live overview / agents / active sessions
  |
  |-------------------- REST + SSE -------------------> local Go ingest service
                                                        historical sessions / turns / tools / search

local Go ingest service
  |
  | fsnotify + periodic resync
  v
OpenClaw JSONL     Claude Code JSONL      Codex JSONL
  |
  v
SQLite WAL + FTS5
  sessions / messages / turns / tool_calls / tool_result_events / source_files / sync_state
```

### 代码布局

建议新增这些目录，而不是把 Go 代码混进 `app/api`：

```text
ingest/
  go.mod
  cmd/agent-trace-ingest/
  internal/config/
  internal/parser/
    types.go
    openclaw.go
    claude.go
    codex.go
  internal/db/
    schema.sql
    store.go
    sessions.go
    turns.go
    messages.go
    tools.go
    search.go
  internal/sync/
    engine.go
    watcher.go
  internal/server/
    server.go
    sessions.go
    turns.go
    events.go
    sse.go

lib/trace-api/
  client.ts
  types.ts
  events.ts

stores/trace/
  trace-store.ts
  selectors.ts
```

### API 边界

Next.js 不直接读 session 文件。它只调用 ingest API：

| Endpoint | 用途 |
|---|---|
| `GET /api/v1/sources` | 返回 `openclaw`、`claude`、`codex` 支持状态、扫描路径、最后同步时间 |
| `GET /api/v1/sessions?source=&project=&q=&page=` | session 列表、筛选、搜索入口 |
| `GET /api/v1/sessions/{id}` | session 元数据、source、project、cwd、token/cost、first/last time |
| `GET /api/v1/sessions/{id}/turns` | turn 级回放主数据，前端默认消费这个 |
| `GET /api/v1/sessions/{id}/messages` | message 级原始视图，用于 debugging/export |
| `GET /api/v1/sessions/{id}/tools` | tool/skill/subagent 调用表 |
| `GET /api/v1/search?q=` | SQLite FTS5 全文搜索 |
| `POST /api/v1/sync` | 手动增量同步 |
| `POST /api/v1/resync` | 手动全量重建索引 |
| `GET /api/v1/events` | 全局 `data_changed` SSE |
| `GET /api/v1/sessions/{id}/watch` | 单 session 更新 SSE |

## 数据模型建议

agentsview 的 `sessions`、`messages`、`tool_calls`、`tool_result_events` 应作为基础表保留，但本项目必须新增/强化 **turn 级视图**。用户目标是“按 turn 回放：user message、assistant response、tools/skills/subagents generated in that turn”，如果 UI 每次自己从 messages 推断 turn，会导致 Claude/Codex/OpenClaw 三套格式的边界逻辑散落到前端。

推荐在 ingest 层提供一个稳定 read model：

```sql
CREATE TABLE turns (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL,
  user_message_id INTEGER REFERENCES messages(id),
  assistant_message_id INTEGER REFERENCES messages(id),
  started_at TEXT,
  ended_at TEXT,
  summary TEXT NOT NULL DEFAULT '',
  source_trace_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(session_id, turn_index)
);

CREATE INDEX idx_turns_session_index ON turns(session_id, turn_index);
```

也可以先不物化 `turns` 表，而是在 Go API 查询时从 `messages + tool_calls + tool_result_events` 生成 `TurnDTO`。但 **MVP 后应该物化**，因为 turn replay 会成为主界面，后续还要挂载 filters、search hit、token/cost、subagent timeline。

推荐 DTO：

```ts
type TraceSource = "openclaw" | "claude" | "codex";

interface TurnDTO {
  id: string;
  sessionId: string;
  source: TraceSource;
  index: number;
  user: TraceMessageDTO | null;
  assistant: TraceMessageDTO | null;
  tools: TraceToolCallDTO[];
  subagents: TraceSubagentDTO[];
  startedAt: string | null;
  endedAt: string | null;
  tokenUsage?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
}
```

## 对 OpenClaw 的改进

1. **不要只读 `WORKSPACE_PATH` 推导出来的单一 `.openclaw/agents`。** 支持 `OPENCLAW_DIR`、配置文件 paths、默认 `~/.openclaw/agents`，与 agentsview `AgentDef` 风格一致。
2. **保留 OpenClaw agentId 在 session id 中。** 使用 `openclaw:{agentId}:{sessionId}`，避免多个 agent 的 UUID 冲突，并让 header source switcher 能按 agent 聚合。
3. **继续保留 Gateway live overview。** SQLite 历史库展示 session replay；Gateway WebSocket 展示当前 agent 状态、active sessions、channels、avatars、usage snapshot。两者通过 `sessionKey/sessionId` 做 best-effort link，不强行合并成一个 store。
4. **解析 toolResult 独立消息。** OpenClaw 的 `toolResult` role 应配对到对应 tool call，并保存 result length/content preview；当前 Next.js API route 会把它简化成一条 user message，信息损失太大。
5. **补 OpenClaw overview 表。** 在 SQLite 中增加轻量 `openclaw_agents_snapshot` 或 `source_status`，保存 agent display name、avatar hint、last_seen、active_session_id；这样无 Gateway 时仍可展示 stale overview。
6. **处理 archive suffix。** 支持 `.jsonl.deleted.*`、`.jsonl.reset.*`、`.jsonl.full.bak`，但如果 active `.jsonl` 存在，应跳过旧 archive，沿用 agentsview 的选择逻辑。

## 对 Claude Code 的改进

1. **必须保留 DAG/fork 解析。** Claude Code 的 `uuid/parentUuid` 不是简单线性日志；fork、small-gap retry、sidechain、compact boundary 都要在 ingest 层处理。
2. **把 queued command 当真实用户 turn。** `attachment.type=queued_command` 要按 timestamp 拼回主 timeline，否则用户在工具运行中输入的下一条 prompt 会丢失。
3. **识别 subagent 映射。** `queue-operation` 和 `progress agent_progress` 里能建立 `tool_use_id -> agent-*` 关系，必须落到 `tool_calls.subagent_session_id`。
4. **保留 system/compact metadata。** UI 默认可折叠，但 DB 不应丢；它影响长会话理解和“为什么上下文变化”的回放。
5. **支持增量但安全降级。** append-only linear 可以增量 parse；检测到 DAG fork 或截断写入时回退 full parse。

## 对 Codex 的改进

1. **按 Codex JSONL event 类型解析。** `session_meta`、`turn_context`、`response_item`、`event_msg` 必须分流；不能只找 `role/content`。
2. **工具调用要格式化为可读 trace。** `function_call` 转 tool call，`exec_command/write_stdin/apply_patch/spawn_agent/wait` 要归类为 Bash/Edit/Task 等 UI 类别。
3. **subagent 生命周期要挂到 tool call。** `spawn_agent`、`wait`、`subagent_notification`、wait output status 应进入 `tool_result_events`，前端显示为同一个 turn 内的子 agent timeline。
4. **token usage 要去重。** Codex `token_count` 事件可能重复，且 cached input 要从 input 中拆出，避免成本/上下文重复计算。
5. **termination_status 要解析。** `task_started/task_complete/turn_aborted` 用于判断“仍在工作、等待用户、已中止”，对 replay header 和 session list 很有用。

## 为什么不推荐 Next.js-only backend

Next.js Route Handlers 适合自定义 request handler 和 thin BFF；官方文档也明确 route handler 以 Web `Request`/`Response` API 处理请求，并支持 `runtime = 'nodejs'`。但本需求的核心是一个长期运行的本地 ingest daemon：递归目录监听、防抖、周期 resync、SQLite 写入串行化、FTS 维护、半写入 JSONL 容错、parse skip cache、源文件 mtime/hash 水位。把这些塞进 `app/api/*/route.ts` 会导致：

- 首屏和列表查询触发文件扫描，延迟随历史量线性增长。
- dev server HMR / production server restart 会破坏 watcher 生命周期。
- SQLite writer/reader pool、WAL、FTS trigger、schema migration 逻辑会混在 Next API 层。
- OpenClaw/Claude/Codex parser 的复杂度会散落在 TypeScript API routes 和 React 组件之间。
- 无法自然复用 agentsview 的 Go parser/sync/db 代码和测试夹具。

Next.js 只应该做两件事：提供 UI，以及在需要同源访问时代理 ingest API。核心采集服务必须独立。

## MVP 分期建议

1. **Phase 1：引入 ingest skeleton**
   - 新增 Go service、SQLite schema、health/version/sources/events API。
   - 移植 OpenClaw parser 和 `fsnotify` watcher。
   - Next.js session detail 从 `/api/sessions/messages` 改为 ingest `GET /api/v1/sessions/{id}/turns`。

2. **Phase 2：Claude + Codex parity**
   - 移植 Claude DAG parser、Codex builder、tool call/result event 存储。
   - 实现 `turns` read model。
   - Header source switcher 支持 OpenClaw / Claude Code / Codex。

3. **Phase 3：搜索与回放体验**
   - SQLite FTS5 search、session filters、tool/skill/subagent facets。
   - Turn replay UI：user prompt、assistant answer、tool timeline、subagent expandable detail。

4. **Phase 4：本地服务生命周期**
   - 开发期 `pnpm dev` 启动 Next + Go ingest。
   - 生产期提供 `agent-tracing-dashboard` launcher 或文档化双进程。
   - 再评估是否需要 Tauri/desktop 包装。

## 需要避免的技术债

- 不要继续扩展 `app/api/sessions/messages/route.ts` 的递归读文件模式；它应被废弃或改成 ingest proxy。
- 不要在前端用字符串规则推断 tool/subagent/turn；这些属于 parser/read model。
- 不要把 OpenClaw Gateway live events 当成历史真相；Gateway 是当前状态通道，SQLite ingest 是历史回放通道。
- 不要为了“全栈 TypeScript”重写 agentsview parser；Claude DAG、Codex subagent、OpenClaw toolResult 配对已经证明 parser 层复杂度高于普通 CRUD。
- 不要在 MVP 引入 Tauri；桌面包装解决启动体验，不解决数据模型。

## 来源与证据

### 本地代码证据

- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/docs/ARCHITECTURE.md`：agentsview 是 Go 单进程、本地 SQLite、parser registry、fsnotify、REST/SSE 的分层架构。
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/docs/API.md`：已有 `/api/v1/sessions`、messages、tool-calls、children、activity、watch、search、events、sync/resync 等 API 面。
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/internal/parser/types.go`：`AgentDef` registry 已覆盖 `openclaw`、`claude`、`codex`，并定义默认目录、env override、ID prefix、discover/find source 函数。
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/internal/parser/openclaw.go`：OpenClaw session header、message、toolResult、usage、archive suffix、agentId-from-path 解析逻辑已存在。
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/internal/parser/claude.go`：Claude DAG/fork、queued command、subagent mapping、compact boundary、incremental fallback 逻辑已存在。
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/internal/parser/codex.go`：Codex event type、function_call、spawn_agent/wait/subagent notification、token_count 去重逻辑已存在。
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/internal/db/schema.sql`：sessions/messages/tool_calls/tool_result_events/FTS 基础模型已满足 trace dashboard 的大部分持久化需求。
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/internal/sync/engine.go` 与 `watcher.go`：已实现 classify paths、sync mutex、skip cache、debounce watcher、recursive/shallow watch、periodic resync 所需核心。
- `/Users/ebbi/Work/ai-dashboard-projects/agents-tracing-dashboard/app/api/sessions/messages/route.ts`：当前 Next API 只按需读 OpenClaw jsonl 并截断消息，不具备索引和多源 replay 能力。
- `/Users/ebbi/Work/ai-dashboard-projects/agents-tracing-dashboard/gateway/types.ts`：当前 Gateway 类型适合 OpenClaw live events/RPC，不等价于历史 session 存储模型。

### 官方/上游资料

- Next.js Route Handlers 文档：Route Handlers 是基于 Web `Request`/`Response` 的自定义请求处理器，并支持 `runtime = 'nodejs'` segment config。来源：https://nextjs.org/docs/app/api-reference/file-conventions/route
- Next.js Custom Server 文档：自定义 server 是 eject 场景，官方提示通常不需要，且会移除部分优化。来源：https://nextjs.org/docs/app/guides/custom-server
- MDN Server-Sent Events：浏览器用 `EventSource` 连接 SSE，服务端响应 MIME type 为 `text/event-stream`。来源：https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
- SQLite WAL：WAL 通常提供更高并发，读写可以并行；仍需处理 `SQLITE_BUSY`。来源：https://www.sqlite.org/wal.html
- SQLite FTS5：FTS5 用虚拟表支持全文搜索，可配置 external content 和 tokenizer。来源：https://www.sqlite.org/fts5.html
- fsnotify Go package：提供跨平台文件系统通知，支持 Linux/macOS/Windows/BSD 等。来源：https://pkg.go.dev/github.com/fsnotify/fsnotify
- Tauri sidecar：Tauri v2 支持通过 `externalBin` 打包外部二进制。来源：https://v2.tauri.app/develop/sidecar/

## 置信度

| 领域 | 置信度 | 原因 |
|---|---|---|
| Go ingest + SQLite + SSE 推荐 | HIGH | agentsview 已有完整参考实现，且需求与其数据管道高度一致 |
| Next.js-only backend 不推荐 | HIGH | 当前 API route 已暴露按需扫文件的局限；官方 Route Handler 更适合 request handler/BFF，不是采集 daemon |
| OpenClaw 改进项 | HIGH | agentsview OpenClaw parser 已覆盖当前项目缺失点 |
| Claude/Codex 改进项 | HIGH | agentsview parser 对 DAG、subagent、token、tool events 已有明确实现 |
| Tauri 暂缓 | MEDIUM | Tauri sidecar 能解决包装，但用户是否需要桌面分发尚未确认 |

