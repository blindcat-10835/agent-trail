# Requirements: agent-tracing-dashboard

**Defined:** 2026-05-06
**Core Value:** Developers can quickly find local agent sessions and accurately review each turn of user input, agent response, tool/skill/subagent activity, and failure reasons.

## v1 Requirements

### Foundation

- [ ] **FOUND-01**: 项目文档、导航文案和默认入口使用 agent-tracing-dashboard 语义，不再把产品定义为单一 OVAO/OpenClaw visual office。
- [ ] **FOUND-02**: 代码中定义统一 Trace Contract，包含 Source、Session、Turn、Message、ToolCall、SkillUse、Subagent、Activity、TokenUsage、Timing metadata。
- [ ] **FOUND-03**: 建立 OpenClaw、Claude Code、Codex fixture corpus，并为 canonical parser 输出建立黄金样例。
- [ ] **FOUND-04**: 保留现有 OpenClaw Gateway live overview 能力，避免改造期间丢失已完成的 Agent/KPI/Sessions/Cron/Skills/Activity 信息。
- [ ] **FOUND-05**: 前端提供 source-aware 空状态、错误状态和配置状态，能区分未安装、未配置、无 session、读取失败、解析失败。

### Ingest Data Plane

- [x] **DATA-01**: 新增独立 Node/TypeScript ingest service，可启动 health/version/sources/events API，并能独立于 Next.js request lifecycle 长期运行。
- [ ] **DATA-02**: ingest service 使用 SQLite WAL/FTS5 存储本地索引，包含 sessions、messages、tool_calls、tool_result_events、turns/source metadata/sync state。
- [ ] **DATA-03**: ingest service 支持 OpenClaw、Claude Code、Codex 的默认目录发现、env/config 覆盖和 source health 状态。
- [ ] **DATA-04**: ingest service 支持 chokidar/Node 文件监听、debounce、periodic resync fallback、skip cache 和 parse error 记录。
- [ ] **DATA-05**: ingest service 暴露 REST API：sources、sessions、session detail、turns、messages、tools、children、search、sync/resync。
- [ ] **DATA-06**: ingest service 暴露全局和单 session SSE，用于通知前端重新拉取 session/turn 数据。
- [ ] **DATA-07**: API 只能按已索引 session id 读取受控 source file，不接受客户端任意文件路径。

### Source Parsers

- [ ] **SRC-01**: OpenClaw parser 支持 session header、message、toolResult role、usage 字段归一化、agent 子目录 session id 和 archive suffix 处理。
- [ ] **SRC-02**: Claude Code parser 支持 uuid/parentUuid DAG、fork/continuation、queued command、streaming duplicate collapse、compact/system boundary 和 subagent mapping。
- [ ] **SRC-03**: Codex parser 支持 session_meta、turn_context、response_item、event_msg、function_call/function_call_output、spawn_agent/wait/subagent notification 和 token_count 去重。
- [ ] **SRC-04**: 三个 parser 都输出 canonical Message、ToolCall、ToolResultEvent、SubagentLink 和 source metadata。
- [ ] **SRC-05**: parser 记录 termination_status、is_truncated、parser_malformed_lines、source_version、cwd/git_branch 等调试字段。

### Turn Replay Model

- [ ] **TURN-01**: ingest 层提供 turn-first read model，按 user message 边界聚合 assistant response、tool calls、skills、subagents 和 activity。
- [ ] **TURN-02**: 每个 turn 保留 startedAt、endedAt、duration、token usage、model、failure/error 状态和 source provenance。
- [ ] **TURN-03**: Tool call 按 tool_use_id/call_id/toolCallId 精确配对结果，支持并发工具和多 result event。
- [ ] **TURN-04**: Skill 使用以独立 block 呈现，显示 skill name、输入摘要、结果/状态。
- [ ] **TURN-05**: Subagent 调用支持 `subagentSessionId`，可在父 turn 内 lazy 展开，也可打开完整子 session。
- [ ] **TURN-06**: System/compact/queued/interruption 等边界事件保留在数据模型中，UI 默认折叠但可查看。

### Frontend Architecture

- [ ] **UI-01**: 前端采用 source-first 路由和 header switcher，至少支持 `/openclaw/*`、`/claude-code/*`、`/codex/*`。
- [ ] **UI-02**: 实现 AgentToolProvider/registry/capability flags/UI profiles，三种 source 共享 Shell、Session Explorer、Replay 组件。
- [ ] **UI-03**: 保留 legacy redirects，使 `/dashboard`、`/sessions`、`/activity` 等旧入口能跳到 OpenClaw 对应页面。
- [ ] **UI-04**: Session Explorer 支持 source、project/workspace、model、status、时间、搜索、失败、tool/subagent facets 过滤。
- [ ] **UI-05**: 前端通过 trace API client/store/selectors 读取 ingest API，不在 replay 组件中直接 fetch 文件或解析 JSONL。

### OpenClaw Dashboard

- [ ] **OPEN-01**: OpenClaw dashboard 保留并增强现有 overview：Agent 状态、Gateway 状态、KPI、sessions、skills、cron、activity、usage。
- [ ] **OPEN-02**: OpenClaw live Gateway 数据和 ingest 历史 session 通过 session key/session id 做 best-effort link，支持从 overview drill down 到 turn replay。
- [ ] **OPEN-03**: OpenClaw 无 Gateway 或 ingest 未启动时仍显示明确状态，不把 loading 当成永久空白。

### Replay UI

- [ ] **REPLAY-01**: Session replay 页面按 turn 展示用户输入、assistant 响应、tool/skill/subagent/activity，并支持展开/折叠。
- [ ] **REPLAY-02**: Replay UI 支持长 session 虚拟化或 range pagination，切换 session/filter 后滚动测量缓存不会串场。
- [ ] **REPLAY-03**: Tool block 显示 tool name/category、input JSON/摘要、result/status/error/duration，并支持 copy。
- [ ] **REPLAY-04**: Subagent inline view 支持 lazy load 子 session messages/turns，并限制嵌套深度防止无限展开。
- [ ] **REPLAY-05**: Replay 页面支持 in-session search、user/assistant/tool/skill/subagent/system block filters、上一/下一 turn 导航。
- [ ] **REPLAY-06**: Replay 页面支持 copy message、copy tool、copy turn，输出适合调试和 issue/prompt 复用。
- [ ] **REPLAY-07**: Replay 页面明确展示 running/awaiting user/aborted/error/truncated/parser warning 等状态。

### Hardening

- [ ] **HARD-01**: parser fixture tests 覆盖普通对话、工具调用、失败工具、subagent、queued command、compact boundary、截断尾行、malformed line 和 archive file。
- [ ] **HARD-02**: ingest API 和前端能处理 1k+ messages / 10k+ tool events 的长 session，不出现明显卡顿或内存暴涨。
- [ ] **HARD-03**: 本地路径、session id、source roots 和错误信息经过安全约束，避免读取任意文件或泄露不必要路径。
- [ ] **HARD-04**: 隐私默认值明确：不上传、不公开分享、不执行工具；导出/copy 前只处理用户主动选择的内容。
- [ ] **HARD-05**: 开发期启动流程能同时启动/连接 Next.js 和 ingest service，并在 UI 中展示 ingest 连接状态。

## v2 Requirements

### Extended Sources

- **EXT-01**: 支持 agentsview 中更多 agent 类型，如 Gemini、OpenCode、Cursor、Copilot。
- **EXT-02**: 支持导入 Claude.ai / ChatGPT export。

### Advanced Analysis

- **ANALY-01**: Session health/outcome/failure signals 更丰富地评分和解释。
- **ANALY-02**: Session/turn 对比、成本趋势、tool failure trend 和 project heatmap。
- **ANALY-03**: 可选 AI insight generation，基于本地 trace 生成问题总结。

### Productization

- **PROD-01**: 单命令 launcher 或桌面打包，自动管理 ingest service 生命周期。
- **PROD-02**: Markdown/JSON/CSV export 和可配置 redaction。
- **PROD-03**: 可选 OpenTelemetry/OpenInference exporter，而非 v1 ingestion server。

## Out of Scope

| Feature | Reason |
|---------|--------|
| SaaS observability / multi-tenant backend | 当前定位是本地 developer tool |
| Public share links | 本地 session 可能含敏感代码、路径、shell output |
| Tool rerun / prompt replay execution | 会产生副作用和安全问题，v1 只观察已有过程 |
| Prompt playground / model comparison | 不服务当前 session replay 核心 |
| LLM evals / LLM-as-judge | 需要额外模型调用和评估质量设计，后置 |
| RBAC / team collaboration | 单用户本地工具不需要 |
| 全 agent 类型支持 | v1 只做用户明确要求的 OpenClaw、Claude Code、Codex |
| 移动端专项 | 桌面开发者调试优先 |
| 3D/WebGL 可视化 | 不提升调试效率，增加性能和可访问性风险 |
| 修改/删除原始 session 文件 | 原始日志是审计证据，v1 只读索引 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Pending |
| DATA-01 | Phase 2 | Complete |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 6 | Pending |
| DATA-05 | Phase 2 | Pending |
| DATA-06 | Phase 6 | Pending |
| DATA-07 | Phase 6 | Pending |
| SRC-01 | Phase 2 | Pending |
| SRC-02 | Phase 3 | Pending |
| SRC-03 | Phase 3 | Pending |
| SRC-04 | Phase 3 | Pending |
| SRC-05 | Phase 3 | Pending |
| TURN-01 | Phase 3 | Pending |
| TURN-02 | Phase 3 | Pending |
| TURN-03 | Phase 3 | Pending |
| TURN-04 | Phase 5 | Pending |
| TURN-05 | Phase 5 | Pending |
| TURN-06 | Phase 5 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |
| UI-04 | Phase 4 | Pending |
| UI-05 | Phase 4 | Pending |
| OPEN-01 | Phase 4 | Pending |
| OPEN-02 | Phase 6 | Pending |
| OPEN-03 | Phase 6 | Pending |
| REPLAY-01 | Phase 5 | Pending |
| REPLAY-02 | Phase 5 | Pending |
| REPLAY-03 | Phase 5 | Pending |
| REPLAY-04 | Phase 5 | Pending |
| REPLAY-05 | Phase 5 | Pending |
| REPLAY-06 | Phase 5 | Pending |
| REPLAY-07 | Phase 5 | Pending |
| HARD-01 | Phase 6 | Pending |
| HARD-02 | Phase 6 | Pending |
| HARD-03 | Phase 6 | Pending |
| HARD-04 | Phase 6 | Pending |
| HARD-05 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-06*
*Last updated: 2026-05-06 after project initialization*
