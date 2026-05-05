# Research Summary: agent-tracing-dashboard

**Synthesized:** 2026-05-06  
**Inputs:** `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `AGENTSVIEW-DATA-SCHEME.md`  
**Scope:** 基于 OVAO 改造为 OpenClaw / Claude Code / Codex 本地 session tracing dashboard

## Key Findings

### Stack

推荐采用 **Next.js 前端 + 本地 Go ingest service + SQLite WAL/FTS5 + REST/SSE** 的混合架构。

- Next.js 继续承载 HUD dashboard、source switcher、OpenClaw live overview、session/replay UI。
- Go ingest service 负责长期运行的本地数据面：目录发现、JSONL parser、增量同步、SQLite 索引、FTS 搜索、REST API、SSE 变更通知。
- OpenClaw Gateway WebSocket 继续用于实时 agent 状态和 overview；历史 session replay 统一来自 ingest SQLite。
- 不建议把文件监视、复杂 parser、SQLite 索引和全文搜索塞进 Next.js API Routes；当前 `app/api/sessions/messages/route.ts` 只能作为临时 fallback。

### Table Stakes

v1 必须具备：

- 顶层 OpenClaw / Claude Code / Codex source 切换。
- OpenClaw overview 信息保真并增强，不能因为 pivot 丢掉现有 dashboard 价值。
- 本地 session 列表、source/project/model/status/search 过滤。
- Turn-first session replay：一个 turn 包含 user message、assistant response、tool calls、skills、subagents 和相关 activity。
- Tool call、skill、subagent 结构化展示，而不是普通聊天气泡。
- 长 transcript 虚拟化、搜索、block filters、copy turn/tool/message。
- Source 健康状态、同步状态、解析错误、空状态和路径配置提示。

### Architecture

前端应采用 **单一 Shell + `[tool]` 路由维度 + AgentToolProvider + shared templates + UI profile slots**。

推荐 URL：

```text
/openclaw/dashboard
/openclaw/sessions
/openclaw/sessions/[sessionId]
/claude-code/dashboard
/claude-code/sessions
/claude-code/sessions/[sessionId]
/codex/dashboard
/codex/sessions
/codex/sessions/[sessionId]
```

共享部分：

- Shell header/sidebar/status/right rail frame
- Session explorer
- Replay toolbar/list/message card
- Message content parser
- Tool/skill/subagent blocks
- Trace API client/store/selectors

差异部分只进入：

- source adapter
- capability flags
- UI profile/slots
- session column definitions
- source-specific overview cards

### agentsview Data Scheme

agentsview 的核心方案是本地索引系统：

```text
Agent 本地会话文件
  -> 文件发现和监视
  -> Agent 专属 parser
  -> 统一 Session / Message / ToolCall 模型
  -> SQLite + FTS5
  -> REST API + SSE 变更通知
  -> 前端按 session/message/tool/subagent 渲染
```

可直接借鉴的结构：

- `AgentDef` registry：声明 agent 默认目录、env override、ID prefix、discover/find source 函数。
- `ParsedSession` / `ParsedMessage` / `ParsedToolCall` / `ParsedToolResultEvent`。
- SQLite `sessions`, `messages`, `tool_calls`, `tool_result_events`。
- `fsnotify` watcher + debounce + periodic resync fallback。
- `/api/v1/sessions`, `/messages`, `/tool-calls`, `/children`, `/activity`, `/timing`, `/events`。

本项目的改进点是新增 **Turn read model**，把 agentsview 的 message/tool 结构聚合成 UI 主消费对象。

### Watch Outs

主要风险：

- 把 JSONL 当“最近 30 条聊天消息”，会丢工具、subagent、usage、system boundary 和早期上下文。
- 用一个通用 JSON path 扫描器解析三种 agent，会静默误判 Claude DAG、Codex function_call 和 OpenClaw toolResult。
- 工具调用/结果配对必须按 ID，不可按相邻消息猜。
- Claude Code 必须处理 uuid/parentUuid DAG、fork、queued command、streaming duplicate、compact boundary。
- Codex subagent 生命周期必须关联 `spawn_agent`、`wait`、function output 和 notification。
- 长会话需要 SQLite range pagination + virtualized list，不能一次性渲染。
- API 不能接受任意路径，只能按已索引 session id 查受控 source file。

## Recommended Roadmap Shape

1. **Trace Contract & Brownfield Reset** — 固定 source/trace/session/turn/tool/subagent 模型，建立 fixture corpus，梳理 OVAO 保留边界。
2. **Local Ingest Core** — Go service、SQLite schema、source discovery、OpenClaw parser、REST/SSE 基础。
3. **Claude + Codex Parser Parity** — Claude DAG parser、Codex event/function_call parser、subagent/result event linkage、turn assembler。
4. **Multi-source Frontend Shell** — `[tool]` routing、AgentToolProvider、source switcher、shared session explorer。
5. **Turn Replay Experience** — virtualized replay、tool/skill/subagent/activity blocks、search/filter/copy/replay controls。
6. **Sync, Hardening & OpenClaw Integration** — watcher/poll fallback、SSE live invalidation、privacy/path safety、OpenClaw overview drilldown、performance regression.

## Decisions Carried Forward

| Decision | Rationale |
|----------|-----------|
| Hybrid Next.js + Go ingest | 保留当前前端投入，同时复用 agentsview 已验证的数据采集形态 |
| Turn-first read model | 用户目标是按 turn 重现 session 过程，而不是浏览原始 message list |
| v1 只支持 OpenClaw / Claude Code / Codex | 用户明确范围；避免 agentsview 全 agent 覆盖导致范围爆炸 |
| OpenClaw Gateway 和 ingest 分工 | Gateway 是实时状态通道；ingest 是历史回放和搜索通道 |
| Source-specific parser + canonical model | 三种日志协议差异大，不能用通用扫描器 |
| 默认只读本地工具 | 不做 tool rerun、prompt playground、公开分享、RBAC 或 OTLP collector |
