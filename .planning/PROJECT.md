# agent-tracing-dashboard

## What This Is

**agent-tracing-dashboard** is a local AI agent session tracing dashboard for OpenClaw, Claude Code, and Codex. It helps developers quickly find and replay past agent sessions on their machine, accurately reviewing each turn of user input, agent response, and tool/skill/subagent activity.

OpenClaw retains its existing real-time overview value: Agent status, Gateway status, sessions, skills, cron, activity, and usage information remain visible and integrate with historical trace drilldown.

**Note:** This project was formerly known as OVAO (OpenClaw Visual Agents Office) during initial development.

## Core Value

Developers can quickly find local agent sessions and accurately review each turn of user input, agent response, tool/skill/subagent activity, and failure reasons.

## Requirements

### Validated

（来自 OVAO 当前代码和参考实现的已验证基础能力）

- ✓ Next.js App Router HUD Shell 可承载 dashboard、sessions、activity 等页面 — existing
- ✓ OpenClaw Gateway WebSocket/RPC 可提供实时 Agent 状态、active sessions、skills、cron、usage、activity 等 overview 数据 — existing
- ✓ 当前 OpenClaw overview、sessions table、session detail drawer 已证明基础 UI 方向可行 — existing
- ✓ agentsview 参考实现已验证本地 session 文件发现、parser、SQLite 索引、REST/SSE、message/tool/subagent 渲染方案 — reference

### Active

- [ ] 顶层支持 OpenClaw、Claude Code、Codex 三个 source dashboard，并通过 header/source switcher 切换。
- [ ] OpenClaw overview 保真增强，保留现有 Agent/KPI/Sessions/Cron/Skills/Activity 信息并支持进入 trace drilldown。
- [ ] 建立本项目统一 Trace Contract：Source、Session、Turn、Message、ToolCall、SkillUse、Subagent、Activity、Token/Timing metadata。
- [ ] 新增独立 Node/TypeScript ingest service，复刻 agentsview 的目录发现、source-specific parser、SQLite WAL/FTS5、REST API、SSE 变更通知；Go 作为参考实现和后续可选优化。
- [ ] 支持 OpenClaw、Claude Code、Codex 本地 session 文件解析，并输出统一 canonical model。
- [ ] 提供 turn-first replay API：每个 turn 聚合 user message、assistant response、tool calls、skills、subagents 和相关 activity。
- [ ] 前端采用共享 `[tool]` 路由、AgentToolProvider、Session Explorer 和 Replay 组件架构，避免为三种 agent 重复实现页面。
- [ ] Session 列表支持 source、project/workspace、model、status、time、search、failure/tool/subagent facets。
- [ ] Session replay 支持长 transcript 虚拟化、tool/skill/subagent 展开、block filters、in-session search、copy turn/tool/message。
- [ ] 本地同步和解析状态可观测：source path、last sync、watcher 状态、parse errors、empty/error states。
- [ ] 默认只读、安全本地访问：API 不接受任意路径，敏感内容默认不上传、不公开分享。

### Out of Scope

- 复制 LangSmith/Langfuse/Phoenix 的完整 SaaS 观测平台 — 本项目是本地 session trace viewer，不做云端 observability 平台。
- v1 支持 agentsview 的全部 agent 类型 — v1 只做 OpenClaw、Claude Code、Codex，schema 保留扩展点。
- Tool rerun / prompt edit / replay execution — “回放”只观察已有过程，不重新执行工具或模型。
- Prompt playground、model comparison、AI evals、LLM-as-judge insights — 非本地复盘核心，后续再评估。
- Public publish/share links — 本地 session 可能包含代码、路径、命令输出和密钥，v1 不上传。
- Multi-user auth / RBAC / team collaboration — 当前定位是单用户本地工具。
- OTLP/OpenTelemetry ingestion server — 内部概念可接近 trace/span，但 v1 不做通用 telemetry collector。
- 移动端专项优化和 3D/WebGL 可视化 — 桌面开发者调试优先。
- Agent 配置编辑或控制 OpenClaw/Claude/Codex 行为 — v1 只读观察，不做控制面。

## Context

- **当前项目来源**：agent-tracing-dashboard（formerly OVAO - OpenClaw Visual Agents Office）。当前代码已有 Next.js App Router Shell、OpenClaw Gateway 类型、overview/session/activity UI。
- **项目定位**：Multi-source AI agent session tracing dashboard supporting OpenClaw, Claude Code, and Codex。
- **参考实现**：`../references/agentsview`。它用 Go 单二进制实现本地 session 文件发现、parser registry、SQLite/FTS5、REST/SSE 和 Svelte 前端。我们复用其数据获取思路和 parser 行为。
- **当前不足**：`app/api/sessions/messages/route.ts` 只按需读取 OpenClaw JSONL 的最后 30 行，返回扁平 `{role, content, timestamp}`，不能支撑 turn replay、tool result、subagent、搜索或多 source。
- **关键产品模型**：Turn 是用户定义的核心单位，一次 user-agent exchange 内必须包含用户输入、agent 回复、工具/技能/subagent/activity。
- **技术方向**：Next.js 前端保留，新增独立 Node/TypeScript ingest service 负责历史数据面；OpenClaw Gateway WebSocket 继续负责实时 overview。

## Constraints

- **Tech Stack**: Next.js + React + TypeScript + Tailwind v4 + shadcn/ui + Zustand + pnpm 继续作为前端栈；ingest service v1 也使用 Node/TypeScript — 保留单语言维护优势。
- **Data Plane**: 历史 session replay 必须来自本地 ingest/index，不再继续扩展 request-time JSONL 扫描 route — 避免性能和数据准确性问题。
- **Source Scope**: v1 仅支持 OpenClaw、Claude Code、Codex — 用户明确范围，降低 parser 和 UI 复杂度。
- **Local-first**: 默认 localhost、本地文件、本地 SQLite，不上传 session 内容 — 保护敏感代码和命令输出。
- **Read-only**: v1 不执行工具、不修改原始 session 文件、不控制 agent — 降低安全和副作用风险。
- **Frontend Architecture**: 三个 source 共享 Shell、Session Explorer、Replay 组件和 Trace API store，差异通过 adapter/profile/slots 表达 — 防止页面分叉。
- **Parser Rigor**: Claude DAG/fork、Codex function_call/subagent、OpenClaw toolResult 必须 source-specific 处理 — 不能通用字符串扫描。
- **Language**: AI 文档/spec/plan 用中文，代码注释、变量名、commit message 用英文 — 沿用项目约定。

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hybrid Next.js frontend + Node/TypeScript ingest service | 保留 OVAO 前端投入和单语言维护优势，同时复刻 agentsview 已验证的数据采集/索引方案 | — Pending |
| Turn-first read model | 用户目标是重现每轮过程，turn 比 raw message 更贴合核心体验 | — Pending |
| OpenClaw Gateway 只负责 live overview，ingest 负责历史 replay | 避免把实时状态和历史真相混成一个不稳定 store | — Pending |
| v1 只做 OpenClaw / Claude Code / Codex | 明确范围，避免复刻 agentsview 全 agent support | — Pending |
| Source-specific parsers 输出 canonical trace model | 三种日志格式差异大，必须把复杂度留在 adapter/parser 层 | — Pending |
| 前端采用 `[tool]` 路由 + AgentToolProvider + UI profiles | 三个 dashboard 共享架构，只在能力/slots/columns 上差异化 | — Pending |
| 默认只读本地工具 | 保护用户机器和 session 敏感内容，避免 tool rerun 副作用 | — Pending |
| 不在 v1 做 SaaS observability / OTLP / AI evals | 聚焦本地 session replay，不扩大产品边界 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-06 after agent-tracing-dashboard initialization*
