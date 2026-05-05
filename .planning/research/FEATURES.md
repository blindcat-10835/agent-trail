# Feature Landscape

**Domain:** 本地 AI agent 会话追踪与回放仪表盘  
**Project:** agent-tracing-dashboard  
**Researched:** 2026-05-06  
**Scope:** v1 功能边界，聚焦 OpenClaw、Claude Code、Codex 三个表面；输出供 roadmap 使用。  
**Overall confidence:** HIGH（本地代码和参考实现证据充分；外部生态用于校准表述，不作为硬依赖）

## 结论

v1 应该从 OVAO 的“OpenClaw 实时 Agent 状态监控”收敛为“本地 agent session trace viewer”。核心不是复制 LangSmith/Langfuse/Phoenix 这类平台，而是把本机已有 session 变成可读、可过滤、可按 turn 回放的调试界面。

最小可用版本必须做到两件事：第一，OpenClaw overview 不能退化，当前总览里的 Agent 状态、KPI、sessions、cron、skills、activity、drawer 等信息要保留并增强；第二，Claude Code 和 Codex 必须有结构化 session replay，而不是现在 `ChatBubble` 式的截断聊天记录。一个 turn 定义为一次用户输入到 agent 产出的完整交换，turn 内必须展示 user message、assistant response、tool calls、skills、subagents，以及这一 turn 生成的其他活动。

外部生态验证了同一方向：OpenAI Agents SDK、LangSmith、Langfuse、Phoenix 都把 trace/span/run/session/thread 作为基本对象，并把 LLM 调用、tool call、handoff/subagent、latency、token、error 作为调试必备信息。v1 可以借鉴这些概念，但不要做托管观测、评估、告警、prompt playground 或 OTLP ingestion。

## Table Stakes

缺少这些功能，v1 会不像一个 agent tracing dashboard。

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---|---|---:|---|---|
| 三个顶层表面：OpenClaw / Claude Code / Codex | 用户明确要求三套 dashboard/surface 可通过 header 切换；v1 不能只保留 OVAO 页面 | Medium | Shell header routing、source/provider 状态、页面级空状态 | 当前 `ShellHeader` 只有 `Dashboard` / `Office`；v1 应替换为 source-first 导航，Office 可降级为 OpenClaw 内部视图或 v2 |
| OpenClaw overview 保真增强 | brownfield pivot 不能丢掉已完成的 OpenClaw 总览价值 | Medium | 现有 `overview-tab.tsx`、Gateway store、OpenClaw WebSocket RPC | 必须保留 Agent 状态网格、Fleet/Session/Spend/Error KPI、sessions、cron、skills、activity、agent/cron/session drawer |
| Source 健康与配置状态 | 本地工具最常见失败是 Gateway 断开、Claude/Codex 目录不存在、session 文件不可读 | Medium | OpenClaw WS status、Claude/Codex data dir discovery、parse error reporting | 每个 surface 顶部需要显示 connected/indexing/empty/error，并给出具体路径或缺失原因 |
| Session 列表与过滤 | tracing 工具的入口是“找到要看的 session” | Medium | 统一 `SessionInfo` / reference API session page、source filter、status/model/project/kind/search | 当前 sessions table 有基础状态/模型/搜索；v1 需要按 source、project/workspace、最近更新时间、token/cost、异常标记过滤 |
| 结构化 Session Detail | session replay 是产品核心；不能只展示最后 30 条截断 message | High | Claude/Codex parser、OpenClaw session reader、统一 Message/ToolCall/Activity schema、分页/虚拟列表 | 当前 `app/api/sessions/messages/route.ts` 会截断、丢 tool result、只回 `{role,content,timestamp}`，不足以支撑 v1 |
| Turn-first transcript | 用户明确要求 turn 是 user-agent exchange；每个 turn 聚合所有活动 | High | Turn assembler、message ordinal/timestamp、tool call/result linkage、system/compact boundary handling | turn 不等于单条 message；应从 user message 开始，包含后续 assistant、tool、skill、subagent、activity，直到下一条 user message 或边界 |
| User message 与 Assistant response 完整渲染 | 回放时首先要能读懂用户问了什么、agent 回了什么 | Medium | Markdown renderer、code block、copy action、role label、timestamp/token/model metadata | 参考 `MessageContent.svelte` 支持 Markdown、code、copy、pin、token/model/timestamp；v1 至少保留 Markdown/code/copy/timestamp |
| Tool call viewer | agent 调试的关键是工具选择、输入、输出、失败与耗时 | High | `tool_calls[]`、`result_events[]`、tool_use_id、duration/timing、collapse/expand UI | 参考实现支持 tool group、parallel group、legacy fallback；v1 要展示 tool name、input、output/result、status、duration、error、copy |
| Skills 展示 | 用户明确要求 turn 内展示 skills；OpenClaw overview 也已有 skills 列表 | Medium | ToolCall.skill_name 或内容解析、OpenClaw `skills.status`、skill metadata | turn 内显示触发的 skill block；OpenClaw overview 保留 registered skills 列表与跳转 |
| Subagent / child session 展示 | 用户明确要求 turn 内展示 subagents；Claude/Codex 调试常涉及代理嵌套 | High | parent_session_id、relationship_type、subagent_session_id、children endpoint or file lookup | 参考 `SubagentInline.svelte` 支持 lazy load 子 session、token/model/meta、open as full session；v1 应复刻核心行为 |
| Other activity in turn | “其他 activity” 包括 lifecycle、assistant stream、error、cron/config 关联事件等 | Medium | Activity event schema、timestamp join、source badges、severity | OpenClaw 已有 activity feed；turn replay 需要把同一 session/runId/time window 的 activity 归入对应 turn |
| Session process replay | 用户明确说“replaying a session process”；只是静态 transcript 不够 | High | Turn ordering、timing data、active/running state、scroll-to-turn、step controls | v1 建议做轻量 replay：上一 turn/下一 turn、当前 turn 高亮、elapsed/duration、tool call 展开状态；不要做视频式动画 |
| In-session search 与 block filters | 长 session 没搜索不可用；tool/thinking/code 太多时需要过滤 | Medium | Search index or client search、display item filters、virtualized list | 参考 `MessageList.svelte` 有 transcript mode、block visibility、find bar；v1 至少支持文字搜索和 user/assistant/tool/skill/subagent filters |
| 长 transcript 性能 | Claude/Codex session 可能上千条 message/tool result；全量渲染会卡 | High | Virtualized list、incremental loading、stable item keys、overscan | 参考实现使用 `@tanstack/virtual-core`；v1 不应渲染所有 message DOM |
| Token / cost / duration metadata | tracing dashboard 的基本调试维度是成本和延迟 | Medium | session totalTokens/cost、message token_usage、timing endpoint 或本地计算 | 不要求 v1 成本 100% 精确，但要显示来源、空值和估算状态 |
| Error and failure surfacing | 用户需要快速定位失败 turn/tool，而不是逐行读日志 | Medium | Tool result status、activity level、termination_status、health/failure signals | Session 列表、turn header、tool block 都要能标红 failure/error |
| Copy/export local debug artifacts | 开发者会把单个 turn、tool call、完整 session 贴到 issue 或 prompt 中 | Low | Clipboard utility、safe serialization、Markdown export optional | v1 至少做 copy turn / copy tool / copy message；完整 JSON/Markdown export 可后置但仍在 v1 候选 |
| Privacy by default | 本地 session 常包含路径、tokens、shell output、prompt 内容 | Medium | Local-only API、no external publish、long output collapse、redaction hooks | OpenAI Agents SDK 文档明确指出 LLM/tool spans 可能含敏感输入输出；v1 默认不要上传或公开分享 |
| Empty/loading/error states | 本地多 source dashboard 会频繁遇到没有安装或没有 session | Low | Source status model、error boundary、retry/rescan action | 必须区分 “没有 session”“未配置路径”“读取失败”“解析失败”“Gateway disconnected” |

## Differentiators

这些不是所有 tracing 产品都必须有，但它们让 v1 符合这个项目的独特定位。

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---|---|---:|---|---|
| OpenClaw + Claude Code + Codex 的本地统一视图 | 一处查看 live agent fleet 与本机 coding agent 历史 session | High | 三个 source adapter、统一 schema、source-aware navigation | agentsview 支持很多 agent，但 v1 只做这三类，避免 scope 爆炸 |
| Turn-first 而不是 raw chat/log | 直接回答“这个 turn 发生了什么”，比纯 chat 或 span tree 更适合开发调试 | High | Turn assembler、tool/subagent/activity join、UI grouping | 这是 v1 最重要的差异化；roadmap 应把它放在 OpenClaw 保真之后 |
| Inline subagent replay | 不离开父 session 就能展开子代理过程，必要时再打开为完整 session | High | Child session lookup、lazy loading、nested transcript rendering | 参考实现已有可借鉴模式；v1 应限制嵌套深度，避免无限递归 |
| OpenClaw operational overview + local trace drilldown | 从 fleet status 直接进入 session/turn 细节，连接实时监控与事后调试 | Medium | Agent activeSessionKey、session drawer、activity feed link-to-session | 当前 overview 已有 session drawer，但需要升级为结构化 turn viewer |
| Cross-source health/failure signals | 把失败工具、上下文压力、compaction、retry、aborted 等聚合成 session flags | Medium | Reference Session health fields、local parser enrichment、OpenClaw activity | 可以先显示已存在信号，不在 v1 生成复杂 AI diagnosis |
| Tool/skill/subagent 时间线条 | 在 turn 内用紧凑时间线展示并行/串行工具和子任务 | Medium | Timing data、tool result events、duration rendering | 比完整 span tree 更轻量，适合 dashboard surface |
| Source-aware quick filters | 一键看“最近失败”“高 token”“tool-heavy”“有 subagent”“active now” | Medium | Session metadata、computed indexes | 比通用全文搜索更贴合 agent debugging |
| Future OTEL/OpenInference-compatible mental model | 内部命名靠近 trace/span/session，不做 v1 exporter 也减少未来迁移成本 | Medium | Normalized schema design | OpenTelemetry GenAI conventions 仍是 Development，v1 不应承诺标准兼容，只保持概念接近 |

## Anti-Features

v1 明确不要做这些；否则会吞掉核心 replay 工作。

| Anti-Feature | Why Avoid | What to Do Instead | Complexity Avoided | Dependencies Avoided |
|---|---|---|---:|---|
| 复制 LangSmith/Langfuse/Phoenix 的完整 SaaS 观测平台 | 会引入账号、项目、评估、告警、数据集、云端 retention 等非 v1 问题 | 只做本地三 source 的 session browser 和 turn replay | High | Cloud backend、tenant/auth、billing、retention policy |
| v1 支持 agentsview 的全部 agent 类型 | agentsview 支持二十类左右 agent，但用户只要求 OpenClaw/Claude Code/Codex | schema 保留 `source` 扩展点，v1 adapter 只实现三类 | High | 每个 agent 的 parser、测试夹具、目录配置 |
| Agent 配置编辑/控制台控制 | 读写操作会带来权限、误操作和状态一致性风险 | v1 只读观察；必要时提供 copy/open path | Medium | `agents.update` 以外的 mutation、ACL、undo |
| Tool rerun / prompt edit / replay execution | “回放 session process”应是观察已有过程，不是重新执行过程 | 做 UI step-through replay，不执行 tool 或模型 | High | Sandbox、credentials、side-effect isolation |
| Prompt playground / model comparison / experiments | 外部 observability 产品的高级功能，不服务当前本地回放 MVP | 只展示原始 prompt/response/tool result，最多 copy 到外部工具 | High | Model provider integration、eval dataset、run orchestration |
| LLM-as-judge / AI insights | 需要额外模型调用、成本、prompt 设计和评估质量验证 | v1 显示结构化 failure signals 和人工可读证据 | Medium | API keys、streaming insight generation、eval storage |
| Public publish/share links | 本地 session 含敏感代码和 shell output；公开分享不是 v1 目标 | 提供本地 copy/export，默认不上传 | Medium | Hosting, auth, link revocation, redaction UI |
| Multi-user auth / RBAC / team collaboration | 当前是单用户本地工具，协作会扩大安全和产品边界 | 保持 localhost/local network read-only 假设 | High | Accounts、permissions、audit log |
| Mobile-first dashboard | 目标是开发者桌面调试，大量表格/trace/代码不适合手机优先 | 桌面优先，基本响应式，不专门优化移动端 | Medium | Mobile IA、touch-specific interactions |
| 3D/WebGL/炫技可视化 | 不提升调试效率，增加性能和可访问性风险 | 用紧凑 timeline、cards、tables、drawer | Medium | Three.js/WebGL, GPU perf QA |
| 精确全量成本账单 | 不同 agent/provider 的 token/cost 数据不完整，v1 容易误导 | 显示可用 token/cost，并标注 unknown/estimated | Medium | Pricing catalog、provider rate sync |
| OpenTelemetry/OTLP ingestion server | v1 数据来自本机 OpenClaw/Claude/Codex，不是通用 telemetry collector | 内部 schema 靠近 trace/span 概念，export/import 后置 | High | OTLP receiver、semantic convention churn |
| 删除/修改原始 session 文件 | 原始日志是审计证据，v1 不应破坏 | 只读索引，出错时提示原始路径 | Medium | File mutation, backup, recovery |
| 自动执行 MCP/server 管理 | Dashboard 是观察工具，不是 MCP 管理控制面 | 只展示工具调用和 MCP 相关活动 | Medium | Credentials, server lifecycle control |

## Feature Dependencies

```text
Source adapters
  ├─ OpenClaw Gateway adapter
  ├─ Claude Code local session adapter
  └─ Codex local session adapter
      ↓
Normalized domain model
  ├─ Source
  ├─ Session
  ├─ Message
  ├─ ToolCall
  ├─ SkillUse
  ├─ SubagentLink / ChildSession
  ├─ ActivityEvent
  └─ Timing / TokenUsage
      ↓
Turn assembler
  ├─ user message boundary
  ├─ assistant response grouping
  ├─ tool result linkage
  ├─ skill/subagent attachment
  └─ activity attribution
      ↓
UI surfaces
  ├─ Source switcher in header
  ├─ OpenClaw overview
  ├─ Session list/filter
  ├─ Turn-first session detail
  ├─ Replay controls
  └─ Search/block filters
```

关键依赖顺序：

1. **先统一数据模型，再做 turn UI。** 如果继续从 `/api/sessions/messages` 返回扁平 `{role, content, timestamp}`，后续 tool/skill/subagent 都会返工。
2. **先保留 OpenClaw overview，再接入 Claude/Codex。** 这是 brownfield pivot 的风险控制点，避免把已完成 dashboard 做坏。
3. **先做静态完整 replay，再做实时/增量。** v1 的最大价值是历史 session 可读；实时 watch 可以在结构稳定后补。
4. **先做 source-specific parser，再抽象 extension。** 不要为未来所有 agent 设计过度泛化插件系统。

## MVP Recommendation

Prioritize:

1. **Source switcher + OpenClaw overview 保真**
   - Header 切换 OpenClaw / Claude Code / Codex。
   - OpenClaw 保留现有 overview 信息：Agent/KPI/sessions/cron/skills/activity/drawers。
   - 所有 source 都有清晰 loading/empty/error/config 状态。

2. **Claude Code / Codex session browser**
   - 列出本地 session，支持 source、project/workspace、model、status、search、updated sort。
   - 显示 message count、token/cost 可用值、failure flags、last activity。

3. **Turn-first session detail**
   - 每个 turn 展示 user message、assistant response、tool calls、skills、subagents、activity。
   - 支持 tool input/output/result collapse、copy turn/tool/message、duration/token badges。
   - 支持长 transcript 虚拟化或增量加载。

4. **Lightweight replay controls**
   - 上一 turn / 下一 turn、当前 turn 高亮、timeline/minimap、running/failed turn 标识。
   - 不重新执行 tool/model，只回放已有数据。

Defer:

- 多 agent 类型导入、云端分享、AI insights/evals、prompt playground、OTLP ingestion、RBAC、移动端专项、3D/复杂动画、原始文件删除/编辑。

## Source-Specific Notes

### OpenClaw

- 当前项目已有 OpenClaw 数据获取和 overview UI：`components/dashboard/overview-tab.tsx` 展示 fleet/session/spend/error KPI、Agent grid、sessions、cron、skills、activity。
- `gateway/adapter-types.ts` 已有 `SessionInfo`、`SkillInfo`、`CronTask`、`UsageProviderInfo` 等 dashboard 所需类型。
- v1 风险不是“是否能显示 OpenClaw”，而是 pivot 时导航/信息架构变了导致 overview 退化。

### Claude Code

- 参考实现通过统一 parser 把 Claude Code session 转成 `Session`、`Message`、`ToolCall`、child session 等结构。
- v1 应优先复用参考实现的产品形态：message metadata、tool grouping、skill block、subagent inline、session-level search。
- 注意 Claude Code transcript 可能包含 thinking、compact/system boundary、shell output、file paths；默认应折叠长 tool output。

### Codex

- 目标与 Claude Code 相同：本地 session browser + turn replay。
- Codex surface 不应为了“像 OpenClaw dashboard”而造不真实的 live fleet；如果只有历史 session，就清晰表达为 local sessions。
- 统一 turn schema 后，Claude Code 与 Codex UI 应共享大部分组件，仅 adapter/parser 不同。

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| OpenClaw table stakes | HIGH | 直接来自当前项目 `PROJECT.md`、`REQUIREMENTS.md`、`overview-tab.tsx`、Gateway 类型 |
| Turn-first replay | HIGH | 用户明确要求；参考实现具备 Message/ToolCall/Subagent/Timing 的 UI 和类型证据 |
| Claude/Codex local session features | HIGH | agentsview 文档明确支持 Claude Code、Codex、OpenClaw；API 有 sessions/messages/tool-calls/children/activity/timing |
| External ecosystem alignment | MEDIUM | 官方文档一致支持 trace/span/run/session/thread、tool call、latency/token/error；但不要求 v1 实现云观测平台功能 |
| Cost accuracy | LOW | 当前数据可能来自不同来源且不完整，v1 只能做可用值展示与估算标注 |

## Sources

Local project:

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `components/dashboard/overview-tab.tsx`
- `components/sessions/sessions-detail-rail.tsx`
- `components/sessions/chat-bubble.tsx`
- `components/sessions/sessions-table.tsx`
- `components/sessions/sessions-filter-bar.tsx`
- `app/api/sessions/messages/route.ts`
- `gateway/adapter-types.ts`
- `gateway/types.ts`
- `.planning/research/DATA-FETCHING.md`

Reference implementation:

- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/docs/API.md`
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/docs/ARCHITECTURE.md`
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/docs/GETTING-STARTED.md`
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/frontend/src/lib/api/types/core.ts`
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/frontend/src/lib/components/content/MessageList.svelte`
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/frontend/src/lib/components/content/MessageContent.svelte`
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/frontend/src/lib/components/content/ToolCallGroup.svelte`
- `/Users/ebbi/Work/ai-dashboard-projects/references/agentsview/frontend/src/lib/components/content/SubagentInline.svelte`

External ecosystem:

- OpenAI Agents SDK Tracing: https://openai.github.io/openai-agents-python/tracing/
- LangSmith Observability Concepts: https://docs.langchain.com/langsmith/observability-concepts
- Langfuse Sessions: https://langfuse.com/docs/observability/features/sessions
- Arize Phoenix Tracing Overview: https://arize.com/docs/phoenix/tracing/llm-traces
- OpenTelemetry GenAI Semantic Conventions: https://opentelemetry.io/docs/specs/semconv/gen-ai/
