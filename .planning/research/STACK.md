# 技术栈研究：agent-tracing-dashboard 数据采集层

**项目:** agent-tracing-dashboard  
**研究日期:** 2026-05-06  
**更新日期:** 2026-05-06 after implementation-language decision  
**研究范围:** 复刻 agentsview 的本地数据采集模型，并适配 OpenClaw + Claude Code + Codex 的 turn 级回放  
**总体置信度:** HIGH

## 结论

本项目 v1 推荐采用 **Hybrid Next.js frontend + independent Node/TypeScript ingest service + SQLite WAL/FTS5 + REST/SSE**。

这里的 ingest service 是一个本地后端数据采集/索引服务：

```text
OpenClaw / Claude Code / Codex 本地 session 文件
  -> independent Node/TypeScript ingest service
  -> source-specific parser
  -> canonical Session / Turn / Message / ToolCall / Skill / Subagent model
  -> SQLite WAL/FTS5
  -> REST API + SSE
  -> Next.js frontend
```

关键不是 Go vs TypeScript，而是 **ingest 必须独立于 Next.js request lifecycle 长期运行**。不要把文件监听、JSONL parser、增量同步、SQLite 索引和全文搜索塞进 `app/api/*/route.ts`。Next.js 继续负责 HUD/trace dashboard UI、OpenClaw Gateway live overview 和浏览器端状态管理；独立 Node/TypeScript ingest service 负责历史会话采集和回放数据面。

Go 仍然很重要，但角色调整为：**agentsview 的参考实现语言和后续可选优化方向**。v1 不选择 Go 作为首选实现语言，原因是 TypeScript 足以满足性能要求，并能降低维护成本。

## 性能判断

v1 规模下，Node/TypeScript 和 Go 的性能差异不是主要风险。真正决定体验的是架构：

| 维度 | 错误做法 | 正确做法 |
|------|----------|----------|
| 文件读取 | 打开 session 时临时递归扫文件 | service 启动后增量 ingest/index |
| JSONL 解析 | 前端或 API route 每次重新解析 | parser 解析后写 SQLite |
| 搜索 | 在文件或数组里线性搜索 | SQLite FTS5 |
| 长会话 | 一次性返回/渲染全部 message | range pagination + virtualized UI |
| 实时刷新 | 高频轮询完整 session | SSE invalidation + targeted refetch |

在这些正确前提下，TypeScript 的性能足够支撑 v1。Go 的优势主要在单二进制分发、并发文件扫描、长期 daemon 稳定性和直接复用 agentsview 代码；它不是本项目 v1 的必要条件。

## 推荐栈

| 层 | 技术 | 用途 | 决策 |
|---|---|---|---|
| UI | Next.js App Router + React + TypeScript | Header source switcher、OpenClaw overview、session explorer、turn replay | 保留 |
| UI state | Zustand + browser `EventSource` | 前端缓存、筛选、选中 session/turn、SSE 触发重拉 | 保留 |
| Live OpenClaw | 现有 `gateway/` WebSocket RPC | OpenClaw 当前状态、agent list、active sessions、avatar、channels、usage | 保留并增强 |
| Ingest service | Independent Node/TypeScript process | 目录发现、JSONL parser、watcher、SQLite 写入、REST/SSE | v1 首选 |
| Watcher | `chokidar` 或 Node fs watcher wrapper | 跨平台文件变更监听，配合 debounce 和 periodic resync | Phase 1/2 选型 |
| Local DB | SQLite + WAL + FTS5 | 本地单用户历史库、全文搜索、turn/tool/subagent 索引 | 强制推荐 |
| API | REST + SSE | 前端查询 sessions/turns/tools/search；数据变更通知 | 强制推荐 |
| Go | agentsview reference / future optional ingest | 行为参考、fixture 对照、后续可迁移的高性能实现 | 不作为 v1 首选 |

## 方案对比

| 方案 | 数据采集能力 | 与当前仓库契合度 | 性能 | 主要风险 | 结论 |
|---|---|---|---|---|---|
| **Independent Node/TypeScript ingest service** | 强。可实现 watcher、parser、SQLite、REST/SSE | 最高。前端和 ingest 共享语言、类型和 workspace 工具链 | v1 足够；瓶颈主要由索引/分页/虚拟化决定 | 需要认真移植 agentsview parser 行为，不能写成 request-time scanner | **v1 首选** |
| **Go ingest service** | 很强。最接近 agentsview 实现 | 中。引入第二语言和第二套构建/测试/发布链路 | 很强，尤其适合单二进制 daemon | 团队维护成本高；与 TS 前端共享类型更麻烦 | 作为后续可选优化或重写目标 |
| **Next.js API Routes 直接读取文件** | 弱。适合 fallback，不适合长期 ingest | 表面简单 | 小数据可用，大数据会退化 | request lifecycle、HMR/restart、每次请求扫文件、parser 分散 | 不推荐 |
| **Rust/Tauri sidecar** | 强 | 低 | 强 | 过早引入桌面产品形态和 Rust 生态 | v1 暂不采用 |
| **直接依赖 agentsview 二进制/API** | 快速验证可行 | 中 | 强 | 产品控制弱，难做 OpenClaw overview 深度融合 | 可做调研，不作为产品形态 |

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
  |-------------------- REST + SSE -------------------> local Node/TypeScript ingest service
                                                        historical sessions / turns / tools / search

local Node/TypeScript ingest service
  |
  | chokidar/fs watch + periodic resync
  v
OpenClaw JSONL     Claude Code JSONL      Codex JSONL
  |
  v
SQLite WAL + FTS5
  sessions / messages / turns / tool_calls / tool_result_events / source_files / sync_state
```

## 代码布局

建议新增 repo-local TypeScript service，而不是把逻辑混进 `app/api`：

```text
ingest/
  package.json              # or workspace package entry
  tsconfig.json
  src/
    main.ts
    config/
      paths.ts
      sources.ts
    parser/
      types.ts
      openclaw.ts
      claude-code.ts
      codex.ts
      turn-assembler.ts
    db/
      schema.sql
      connection.ts
      sessions.ts
      turns.ts
      messages.ts
      tools.ts
      search.ts
    sync/
      engine.ts
      watcher.ts
      file-state.ts
    server/
      server.ts
      routes.ts
      sse.ts

lib/trace-api/
  client.ts
  types.ts
  events.ts

stores/trace/
  trace-store.ts
  selectors.ts
```

Phase 1 应决定 ingest 是独立 workspace package，还是主 package 下的 `tsx ingest/src/main.ts` 脚本。无论哪种，都必须是长期运行进程。

## API 边界

Next.js 不直接读 session 文件。它只调用 ingest API：

| Endpoint | 用途 |
|---|---|
| `GET /api/v1/sources` | 返回 `openclaw`、`claude-code`、`codex` 支持状态、扫描路径、最后同步时间 |
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

agentsview 的 `sessions`、`messages`、`tool_calls`、`tool_result_events` 应作为基础表参考，但本项目必须新增/强化 **turn 级视图**。用户目标是“按 turn 回放：user message、assistant response、tools/skills/subagents generated in that turn”，如果 UI 每次自己从 messages 推断 turn，会导致 Claude/Codex/OpenClaw 三套格式的边界逻辑散落到前端。

推荐在 ingest 层提供稳定 read model：

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

也可以先不物化 `turns` 表，而是在 ingest API 查询时从 `messages + tool_calls + tool_result_events` 生成 `TurnDTO`。但 MVP 后应该物化，因为 turn replay 会成为主界面，后续还要挂载 filters、search hit、token/cost、subagent timeline。

推荐 DTO：

```ts
type TraceSource = "openclaw" | "claude-code" | "codex";

interface TurnDTO {
  id: string;
  sessionId: string;
  source: TraceSource;
  index: number;
  user: TraceMessageDTO | null;
  assistant: TraceMessageDTO | null;
  tools: TraceToolCallDTO[];
  skills: TraceSkillDTO[];
  subagents: TraceSubagentDTO[];
  activities: TraceActivityDTO[];
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

1. 不要只读 `WORKSPACE_PATH` 推导出来的单一 `.openclaw/agents`。支持 `OPENCLAW_DIR`、配置文件 paths、默认 `~/.openclaw/agents`，与 agentsview `AgentDef` 风格一致。
2. 保留 OpenClaw agentId 在 session id 中。使用 `openclaw:{agentId}:{sessionId}`，避免多个 agent 的 UUID 冲突。
3. 继续保留 Gateway live overview。SQLite 历史库展示 session replay；Gateway WebSocket 展示当前 agent 状态、active sessions、channels、avatars、usage snapshot。
4. 解析 toolResult 独立消息。OpenClaw 的 `toolResult` role 应配对到对应 tool call，并保存 result length/content preview。
5. 支持 archive suffix：`.jsonl.deleted.*`、`.jsonl.reset.*`、`.jsonl.full.bak` 等。

## 对 Claude Code 的改进

1. 必须保留 DAG/fork 解析。Claude Code 的 `uuid/parentUuid` 不是简单线性日志。
2. 把 `attachment.type=queued_command` 当真实用户 turn，按 timestamp 拼回 timeline。
3. 识别 subagent 映射：`queue-operation` 和 `progress agent_progress` 里能建立 `tool_use_id -> agent-*` 关系。
4. 保留 system/compact metadata。UI 默认可折叠，但 DB 不应丢。
5. 支持增量但安全降级。检测到 DAG fork 或截断写入时回退 full parse。

## 对 Codex 的改进

1. 按 Codex JSONL event 类型解析：`session_meta`、`turn_context`、`response_item`、`event_msg`。
2. `function_call` 转 tool call，`exec_command/write_stdin/apply_patch/spawn_agent/wait` 要归类为 Bash/Edit/Task 等 UI 类别。
3. subagent 生命周期要挂到 tool call。`spawn_agent`、`wait`、`subagent_notification`、wait output status 应进入 `tool_result_events`。
4. token usage 要去重，cached input 要从 input 中拆出，避免成本/上下文重复计算。
5. `task_started/task_complete/turn_aborted` 用于判断“仍在工作、等待用户、已中止”。

## 为什么不推荐 Next.js-only backend

Next.js Route Handlers 适合 request/response handler 和 thin BFF；本需求的核心是长期运行的本地 ingest daemon。把 watcher、parser、SQLite writer、FTS、resync 和 skip cache 放进 `app/api/*/route.ts` 会导致：

- 首屏和列表查询触发文件扫描，延迟随历史量线性增长。
- dev server HMR / production server restart 破坏 watcher 生命周期。
- SQLite writer/reader、WAL、FTS trigger、schema migration 逻辑混在 UI server 层。
- OpenClaw/Claude/Codex parser 复杂度散落在 API routes 和 React 组件之间。

正确的 TypeScript 方案是 **独立 Node service**：

```text
watch files -> parse -> write SQLite -> frontend queries SQLite-backed API
```

## MVP 分期建议

1. **Phase 1：Trace contract + ingest skeleton**
   - 定义 shared TypeScript DTO。
   - 新增 independent Node/TypeScript service。
   - 建立 SQLite schema、health/version/sources/events API。
   - 建立 OpenClaw/Claude/Codex fixture corpus。

2. **Phase 2：OpenClaw ingest**
   - 实现 OpenClaw source discovery、parser、toolResult pairing。
   - Next.js session detail 从 `/api/sessions/messages` 迁移到 ingest `GET /api/v1/sessions/{id}/turns`。

3. **Phase 3：Claude + Codex parity**
   - 移植 Claude DAG parser 行为、Codex event/function_call/subagent 行为。
   - 实现 turn assembler 和 canonical result event linkage。

4. **Phase 4：搜索与回放体验**
   - SQLite FTS5 search、session filters、tool/skill/subagent facets。
   - Turn replay UI：user prompt、assistant answer、tool timeline、subagent expandable detail。

5. **Phase 5/6：本地服务生命周期和 hardening**
   - `pnpm dev` 或 workspace script 同时启动 Next + ingest。
   - 补 watcher fallback、SSE reconnect、path safety、long-session performance。

## 需要避免的技术债

- 不要继续扩展 `app/api/sessions/messages/route.ts` 的递归读文件模式；它应被废弃或改成 ingest proxy。
- 不要在前端用字符串规则推断 tool/subagent/turn；这些属于 parser/read model。
- 不要把 OpenClaw Gateway live events 当成历史真相；Gateway 是当前状态通道，SQLite ingest 是历史回放通道。
- 不要为了保持 TypeScript 而牺牲架构边界；TypeScript ingest 也必须是独立 service。
- 不要在 MVP 引入 Tauri；桌面包装解决启动体验，不解决数据模型。

## 来源与证据

### 本地代码证据

- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/docs/ARCHITECTURE.md`：agentsview 是本地 SQLite、parser registry、fsnotify、REST/SSE 的分层架构。
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/docs/API.md`：已有 `/api/v1/sessions`、messages、tool-calls、children、activity、watch、search、events、sync/resync 等 API 面。
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/internal/parser/types.go`：`AgentDef` registry 已覆盖 `openclaw`、`claude`、`codex`。
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/internal/parser/openclaw.go`：OpenClaw session header、message、toolResult、usage、archive suffix、agentId-from-path 解析逻辑已存在。
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/internal/parser/claude.go`：Claude DAG/fork、queued command、subagent mapping、compact boundary、incremental fallback 逻辑已存在。
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/internal/parser/codex.go`：Codex event type、function_call、spawn_agent/wait/subagent notification、token_count 去重逻辑已存在。
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/internal/db/schema.sql`：sessions/messages/tool_calls/tool_result_events/FTS 基础模型已满足 trace dashboard 的大部分持久化需求。
- `/Users/ebbi/Work/ai-dashboard-projects/agents-tracing-dashboard/app/api/sessions/messages/route.ts`：当前 Next API 只按需读 OpenClaw jsonl 并截断消息，不具备索引和多源 replay 能力。

## 置信度

| 领域 | 置信度 | 原因 |
|---|---|---|
| Independent TypeScript ingest 推荐 | HIGH | 性能足够 v1，且保留单语言维护优势 |
| Go 作为参考/后续可选 | HIGH | agentsview 已验证 Go 实现，但引入第二语言不是 v1 必需 |
| Next.js API Routes 不推荐承担 ingest | HIGH | request lifecycle 与长期 watcher/indexer 职责不匹配 |
| OpenClaw 改进项 | HIGH | agentsview OpenClaw parser 已覆盖当前项目缺失点 |
| Claude/Codex 改进项 | HIGH | agentsview parser 对 DAG、subagent、token、tool events 已有明确实现 |
