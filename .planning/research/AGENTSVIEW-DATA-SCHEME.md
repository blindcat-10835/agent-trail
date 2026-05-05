# agentsview 数据获取方案分析

**研究日期:** 2026-05-06
**参考实现:** `../references/agentsview`
**目标项目:** agent-tracing-dashboard

## 结论

agentsview 的核心方案不是“前端直接读 jsonl”，而是一个本地索引系统：

```text
Agent 本地会话文件
  -> 文件发现和监视
  -> Agent 专属 parser
  -> 统一 Session / Message / ToolCall 模型
  -> SQLite + FTS5
  -> REST API + SSE 变更通知
  -> 前端按 session/message/tool/subagent 渲染
```

这套方案适合我们复用，但需要针对本项目做一个关键改造：agentsview 的显示单位是 message + tool group，而我们需要把用户交互建模成 **Turn**。Turn 应该成为 Dashboard 回放的核心 UI 和 API 结构，包含一次用户输入、随后的 agent 回复、工具调用、技能调用、subagent 生命周期和结果事件。

## agentsview 的数据链路

### 1. Agent 注册表

`internal/parser/types.go` 里维护 `Registry`，每种 agent 声明：

| 字段 | 作用 |
|------|------|
| `Type` / `DisplayName` | agent 标识和展示名 |
| `EnvVar` / `ConfigKey` | 用户覆盖默认目录的配置入口 |
| `DefaultDirs` | 默认扫描目录 |
| `IDPrefix` | 统一 session id 命名空间 |
| `DiscoverFunc` | 发现该 agent 的 session 文件 |
| `FindSourceFunc` | 按 session id 定位源文件 |

与本项目 v1 相关的默认目录：

| Agent | 默认目录 | ID 前缀 |
|-------|----------|---------|
| Claude Code | `~/.claude/projects` | 无前缀 |
| Codex | `~/.codex/sessions` | `codex:` |
| OpenClaw | `~/.openclaw/agents` | `openclaw:` |

### 2. 文件发现与实时同步

`internal/sync/watcher.go` 使用 `fsnotify` 递归监视 session 目录，变更后防抖，把变更路径交给 `Engine.SyncPaths`。启动时还会做 initial sync，之后有 periodic sync 兜底，避免文件监视器资源耗尽或目录漏监听导致数据不刷新。

值得复用的点：

- 文件变更走防抖批处理，不按每次 write 立即解析。
- 不能递归监听的大目录降级为浅监听 + 定时扫描。
- sync pipeline 用 skip cache 记录解析失败/无效文件，mtime 变化后才重试。
- 变更写入数据库后通过 emitter 推送 `data_changed`，前端再重新拉取对应资源。

### 3. Parser 标准化

每个 agent 的 session 文件格式不同，但最终都落到统一结构：

- `ParsedSession`: id、project、agent、started/ended、message_count、parent_session_id、relationship_type、token aggregate、source file metadata。
- `ParsedMessage`: ordinal、role、content、thinking_text、timestamp、model、token_usage、tool_calls、tool_results、source metadata。
- `ParsedToolCall`: tool_use_id、tool_name、category、input_json、skill_name、subagent_session_id、result_events。
- `ParsedToolResultEvent`: subagent/工具结果的阶段性输出。

三类 parser 的要点：

| Agent | 关键复杂度 | agentsview 处理方式 |
|-------|------------|---------------------|
| OpenClaw | `message.role=toolResult` 单独成行，usage 字段形状不同 | 将 toolResult 转成可配对的 user-side tool result，把 usage 映射到统一 token 字段 |
| Claude Code | JSONL 是 uuid/parentUuid DAG，可能 fork；subagent 信息来自 `queue-operation` 或 `progress` | 先建 DAG，必要时拆成多个 session；将 Agent/Task tool call 标记 `subagent_session_id` |
| Codex | `response_item` 里有 `function_call` / `function_call_output`，subagent 通过 `spawn_agent` / `wait` / notification 组合出现 | 维护 call id 映射，把 wait output 和 subagent notification 附到对应 tool call 的 `result_events` |

### 4. SQLite 数据模型

核心表：

| 表 | 作用 |
|----|------|
| `sessions` | session 元数据、agent 类型、项目、父子关系、token 汇总、健康信号 |
| `messages` | 单条 user/assistant message，按 `session_id + ordinal` 排序 |
| `tool_calls` | message 内的工具/技能/subagent 调用 |
| `tool_result_events` | 工具或 subagent 的阶段性结果流 |
| FTS 表/索引 | 跨 session/message 搜索 |

父子关系用两层机制表达：

- `tool_calls.subagent_session_id` 表示某个 tool call 生成了哪个 subagent session。
- `sessions.parent_session_id + relationship_type='subagent'` 表示该子 session 属于哪个父 session。

这对我们很重要，因为 session replay 中 subagent 不应该只是一个文本块，而应该能在 turn 内 inline 展开，也能跳到完整子 session。

### 5. API 与实时刷新

agentsview 的后端暴露 REST + SSE：

- `GET /api/v1/sessions`
- `GET /api/v1/sessions/{id}`
- `GET /api/v1/sessions/{id}/messages`
- `GET /api/v1/sessions/{id}/tool-calls`
- `GET /api/v1/sessions/{id}/children`
- `GET /api/v1/sessions/{id}/activity`
- `GET /api/v1/sessions/{id}/timing`
- `GET /api/v1/events`

前端长期订阅 `/events`，收到 `data_changed` 后重新拉取 sessions/messages。这个模型比 WebSocket RPC 更适合本地文件索引，因为后端是数据索引者，前端只是读模型。

## 本项目应采用的统一模型

agentsview 的 Message 模型可以作为底层存储，但 UI/API 应额外提供 Turn 聚合：

```ts
interface TraceSession {
  id: string
  agentKind: 'openclaw' | 'claude-code' | 'codex'
  project: string
  startedAt: string | null
  endedAt: string | null
  status: 'active' | 'idle' | 'aborted' | 'error' | 'unknown'
  rootSessionId?: string
  parentSessionId?: string
  relationshipType?: 'root' | 'subagent' | 'fork' | 'continuation'
  metrics: SessionMetrics
}

interface TraceTurn {
  id: string
  sessionId: string
  index: number
  userMessage: TraceMessage | null
  assistantMessages: TraceMessage[]
  activities: TraceActivity[]
  startedAt: string | null
  endedAt: string | null
  durationMs: number | null
}

type TraceActivity =
  | TraceToolCall
  | TraceSkillCall
  | TraceSubagentCall
  | TraceThinkingBlock
  | TraceSystemEvent
```

Turn 聚合规则建议：

1. 按 `ordinal` 升序扫描 messages。
2. 遇到真实 user message 开启新 turn。
3. 在下一个 user message 前的 assistant message、tool call、tool result event、thinking block 都归入当前 turn。
4. 对 queued command、system message、compaction boundary 保留 source metadata，但默认在普通回放里折叠。
5. subagent session 在父 turn 的 `TraceSubagentCall` 中保留 `subagentSessionId`，支持 inline lazy load。

## 可选语言和框架比较

| 方案 | 优点 | 风险 | 适合程度 |
|------|------|------|----------|
| 独立 Node/TypeScript ingest service + SQLite + REST/SSE，前端继续 Next.js | 单语言维护；可共享 DTO/fixtures/tooling；性能足够 v1；架构上仍能复刻 agentsview 的 Registry / Parser / SQLite / SSE 分层 | 需要认真移植 agentsview parser 行为；仍然要管理 Next.js 和 ingest 两个本地进程 | **v1 首选** |
| Go + SQLite + REST/SSE，前端继续 Next.js | 最接近 agentsview；文件监视、并发解析、单二进制分发成熟；parser 可按 agentsview 迁移 | 引入第二语言；需要第二套构建/测试/发布链路；与 TS 前端共享类型更麻烦 | 后续可选优化，或作为长期 daemon 重写方向 |
| Next.js-only Node backend + SQLite + chokidar | 单语言、集成快；API route/server action 直接服务前端 | 长驻文件 watcher 与 Next dev/prod 生命周期耦合；复杂 parser、增量索引和 SSE 生命周期容易变成 request-time scanner | 只适合 read-only 原型，不适合作为最终索引层 |
| Rust/Tauri sidecar + SQLite | 桌面分发体验好；文件系统和性能强 | parser 迁移成本最高；当前 repo 和参考实现都不是 Rust | 不建议 v1 |
| 直接接入 agentsview 二进制/API | 最快验证数据模型；少造索引轮子 | 产品控制弱；难做 OpenClaw overview 深度融合；部署依赖外部工具 | 适合临时调研，不适合产品形态 |

推荐路线：

1. **v1 采用 Next.js 前端 + 独立 Node/TypeScript ingest service 的混合架构。**
2. ingest service 复刻 agentsview 的 Registry / Parser / SQLite / SSE 分层，但用 TypeScript 实现 parser、同步和 API。
3. Go 版本 agentsview 作为行为参考、fixture 对照和未来可选优化方向，不作为 v1 默认实现语言。
4. 前端不直接读 jsonl，只读本项目定义的 `/api/traces/*` 或 ingest service 代理出的等价 trace API。
5. 初期可以保留很薄的 Next.js route handler 做 API facade，但文件监听、解析、索引和 SSE 必须留在独立 ingest 进程中。

## 相比 agentsview 的改进点

- **Turn-first API:** 不只返回 messages，而是返回能直接渲染回放的 turns。
- **Agent profile adapter:** OpenClaw、Claude Code、Codex 共享 session/turn 结构，但允许各自定义 overview cards、status mapping、source metadata 和 tool icon mapping。
- **Parser provenance:** 每条 message/activity 保留原始文件 path、line number、source type，方便调试 parser 误判。
- **增量索引可观测:** UI 展示最近 sync 时间、文件监视状态、解析失败数、跳过文件数。
- **subagent inline + full page 双入口:** turn 内可展开子 session，也可打开完整子 session dashboard。
- **schema versioning:** 标记 parser version / data version，避免 parser 更新后旧索引 silent mismatch。
- **安全边界:** 所有本地路径必须经过配置白名单和 path normalization，前端 API 不接受任意文件路径。

## 对当前代码的直接影响

当前 `app/api/sessions/messages/route.ts` 只递归搜索 OpenClaw session 文件，并解析最后 30 行文本。这只能作为临时 fallback，不能满足 v1：

- 不支持 Claude Code / Codex。
- 不保留 tool call input/output/result event。
- 不支持 subagent session 关系。
- 不支持 turn 聚合。
- 不支持搜索、分页、增量刷新和解析错误可观测。

因此第一阶段应先建立 `trace-core` 数据模型和 ingest adapter，而不是继续扩展这个 route 的字符串解析逻辑。
