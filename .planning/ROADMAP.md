# agent-tracing-dashboard Roadmap

**Project**: agent-tracing-dashboard
**Version**: 1.0
**Last Updated**: 2026-05-06
**Status**: Planned
**Granularity**: Standard

## Vision

Build agent-tracing-dashboard as a local multi-source AI agent session tracing dashboard. v1 focuses on OpenClaw, Claude Code, and Codex: users can switch between sources from the header, browse local sessions, and replay each turn with user input, agent response, tool/skill/subagent activity, and failure reasons.

## Project Scope

**In Scope**:

- OpenClaw / Claude Code / Codex 三个 source dashboard
- OpenClaw live overview 保真增强
- 独立 Node/TypeScript ingest service + SQLite WAL/FTS5 + REST/SSE
- OpenClaw / Claude Code / Codex parser 和 canonical trace model
- Turn-first session replay API 和 UI
- Shared frontend architecture：`[tool]` routes、AgentToolProvider、shared Session Explorer、shared Replay blocks
- 本地同步、source health、parse errors、隐私和路径安全

**Out of Scope**:

- SaaS observability 平台、multi-user auth、public share links
- Tool rerun、prompt playground、model execution replay
- v1 支持全部 agentsview agent 类型
- OTLP/OpenTelemetry ingestion server
- AI evals / LLM-as-judge insights
- 移动端专项和 3D/WebGL 可视化

## Milestones

### M1: Trace Foundation (Phases 1-3)

**Goal**: 先把本地 trace 数据面做对，固定合同、parser、索引和 turn read model。

**Deliverables**:

- Trace Contract 和 fixture corpus
- Node/TypeScript ingest service skeleton
- SQLite schema 和 REST API 基础
- OpenClaw / Claude Code / Codex parser
- Turn assembler 和 canonical replay DTO

**Success Criteria**:

- [ ] 三个 source 的 fixture 都能解析为同一个 canonical model
- [ ] API 可列出 sessions 并返回 turn replay 数据
- [ ] tool/result/subagent 关系不依赖前端字符串猜测

---

### M2: Multi-source UI (Phases 4-5)

**Goal**: Migrate the frontend from single-source OVAO dashboard to multi-source tracing dashboard and provide a usable turn replay experience.

**Deliverables**:

- `/openclaw/*`、`/claude-code/*`、`/codex/*` 路由和 header source switcher
- AgentToolProvider / UI profile / capability gates
- Shared Session Explorer
- Virtualized Turn Replay UI
- Tool/skill/subagent/activity blocks

**Success Criteria**:

- [ ] 用户能在三个 source 间切换并看到各自 session surface
- [ ] OpenClaw overview 信息不退化
- [ ] 任意已解析 session 能按 turn 回放

---

### M3: Realtime & Hardening (Phase 6)

**Goal**: 把本地同步、SSE、OpenClaw drilldown、性能和隐私边界补齐到可长期使用。

**Deliverables**:

- chokidar/Node watcher + periodic resync + source health UI
- Global/session SSE invalidation
- OpenClaw overview 到 replay 的 drilldown
- Fixture regression、长 session 性能、path safety 和隐私默认值

**Success Criteria**:

- [ ] 活跃 session 更新能在 UI 中刷新
- [ ] 长 session 不明显卡顿
- [ ] API 不允许任意路径读取

---

## Coverage

**v1 Requirements Mapped**: 43/43 (100%)
**Requirements Complete**: 4/43 (9%)

| Requirement | Phase   | Status  |
| ----------- | ------- | ------- |
| FOUND-01    | Phase 1 | Pending |
| FOUND-02    | Phase 1 | Pending |
| FOUND-03    | Phase 1 | Pending |
| FOUND-04    | Phase 1 | Pending |
| FOUND-05    | Phase 1 | Pending |
| DATA-01     | Phase 2 | Complete |
| DATA-02     | Phase 2 | Complete |
| DATA-03     | Phase 2 | In Progress (OpenClaw only) |
| DATA-04     | Phase 6 | Pending |
| DATA-05     | Phase 2 | Pending |
| DATA-06     | Phase 6 | Pending |
| DATA-07     | Phase 6 | Pending |
| SRC-01      | Phase 2 | Complete |
| SRC-02      | Phase 3 | Pending |
| SRC-03      | Phase 3 | Pending |
| SRC-04      | Phase 3 | Pending |
| SRC-05      | Phase 3 | Pending |
| TURN-01     | Phase 3 | Pending |
| TURN-02     | Phase 3 | Pending |
| TURN-03     | Phase 3 | Pending |
| TURN-04     | Phase 5 | Pending |
| TURN-05     | Phase 5 | Pending |
| TURN-06     | Phase 5 | Pending |
| UI-01       | Phase 4 | Pending |
| UI-02       | Phase 4 | Pending |
| UI-03       | Phase 4 | Pending |
| UI-04       | Phase 4 | Pending |
| UI-05       | Phase 4 | Pending |
| OPEN-01     | Phase 4 | Pending |
| OPEN-02     | Phase 6 | Pending |
| OPEN-03     | Phase 6 | Pending |
| REPLAY-01   | Phase 5 | Pending |
| REPLAY-02   | Phase 5 | Pending |
| REPLAY-03   | Phase 5 | Pending |
| REPLAY-04   | Phase 5 | Pending |
| REPLAY-05   | Phase 5 | Pending |
| REPLAY-06   | Phase 5 | Pending |
| REPLAY-07   | Phase 5 | Pending |
| HARD-01     | Phase 6 | Pending |
| HARD-02     | Phase 6 | Pending |
| HARD-03     | Phase 6 | Pending |
| HARD-04     | Phase 6 | Pending |
| HARD-05     | Phase 6 | Pending |

**Orphaned Requirements**: 0
**Unmapped Requirements**: 0

---

## Dependencies

```text
Phase 1: Trace Contract & Brownfield Reset
    ↓
Phase 2: Local Ingest Core + OpenClaw Parser
    ↓
Phase 3: Claude/Codex Parsers + Turn Assembly
    ↓
Phase 4: Multi-source Frontend Shell + Session Explorer
    ↓
Phase 5: Turn Replay UI
    ↓
Phase 6: Sync, OpenClaw Drilldown & Hardening
```

**Parallel Execution**:

- Phase 4 UI architecture can start once Phase 1 contracts are stable, but should not finalize data hooks until Phase 2/3 API shapes exist.
- Phase 5 replay UI depends on Phase 3 turn DTOs and Phase 4 route/provider structure.
- Phase 6 hardening depends on all prior phases.

---

## Phase Details

### Phase 1: Trace Contract & Brownfield Reset

**Goal**: Reframe the project from OVAO into agent-tracing-dashboard, lock the canonical trace/turn contract, and create parser fixtures before implementing data or UI against unstable shapes.

**Status**: Planned

**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05

**Success Criteria** (what must be TRUE):

1. Project docs, visible product labels, and default entry points refer to agent-tracing-dashboard while keeping OpenClaw as one source.
2. TypeScript trace contract is documented with Source, Session, Turn, Message, ToolCall, SkillUse, Subagent, Activity, TokenUsage, Timing metadata, and remains portable enough to compare with agentsview fixtures.
3. Fixture corpus exists for OpenClaw, Claude Code, and Codex with golden expected canonical output.
4. Existing OpenClaw overview capabilities are listed as preserved contracts, not accidental legacy behavior.
5. Source status taxonomy covers installed/configured/empty/indexing/error/parser-warning states.

**Plans**: 4 plans

- [X] 01-01-PLAN.md — Define canonical trace contract and set up test infrastructure
- [ ] 01-02-PLAN.md — Create fixture corpus and parser validation infrastructure
- [ ] 01-03-PLAN.md — Document preserved OpenClaw overview capabilities
- [ ] 01-04-PLAN.md — Update project documentation and visible labels to agent-tracing-dashboard

**UI hint**: yes

---

---

### Phase 2: Local Ingest Core + OpenClaw Parser

**Goal**: Build the local ingest service foundation and migrate OpenClaw history parsing from request-time JSONL scanning to indexed, queryable session/turn data.

**Status**: In Progress (2/5 plans complete)

**Depends on**: Phase 1

**Requirements**: DATA-01, DATA-02, DATA-03, DATA-05, SRC-01

**Success Criteria** (what must be TRUE):

1. `ingest/` Node/TypeScript service starts locally and exposes health/version/sources/events endpoints.
2. SQLite schema stores sessions, messages, tool calls, tool result events, turns, source metadata, and sync state.
3. OpenClaw source discovery supports default path plus env/config override.
4. OpenClaw parser handles session headers, messages, toolResult role, usage normalization, agent-scoped session ids, and archive suffixes.
5. REST API can list OpenClaw sessions and return turn-first replay DTOs from SQLite.

**Plans**: 5 plans

- [X] 02-01-PLAN.md — Ingest service skeleton + SQLite schema + health/version endpoints
- [X] 02-02-PLAN.md — OpenClaw source discovery + parser (database storage deferred to 02-03)
- [x] 02-02b-PLAN.md — Turn assembler (group messages into turns, pair tool calls with results)
- [x] 02-03-PLAN.md — REST API (sessions, turns, messages) + database integration
- [x] 02-04-PLAN.md — Local file discovery + watcher + auto-ingest

**UI hint**: no

---

### Phase 3: Claude/Codex Parsers + Turn Assembly

**Goal**: Add Claude Code and Codex parser parity and produce reliable turn-level replay data across all three sources.

**Status**: Pending

**Depends on**: Phase 2

**Requirements**: SRC-02, SRC-03, SRC-04, SRC-05, TURN-01, TURN-02, TURN-03

**Success Criteria** (what must be TRUE):

1. Claude Code parser handles DAG/fork/continuation, queued command, compact/system boundary, streaming duplicate collapse, subagent mapping, truncation and malformed lines.
2. Codex parser handles session_meta, turn_context, response_item, event_msg, function calls, function outputs, spawn_agent/wait/subagent notification, token_count dedupe and termination status.
3. All three parsers output canonical Message, ToolCall, ToolResultEvent, SubagentLink, source metadata and parser warning fields.
4. Turn assembler groups user message, assistant responses, tool calls, result events and subagent references without UI-side guessing.
5. Parser fixture tests pass for OpenClaw, Claude Code and Codex golden outputs.

**Plans**: 5 plans

Plans:
- [ ] 03-01-PLAN.md — Parser types extension + source discovery functions
- [ ] 03-02-PLAN.md — Claude Code JSONL parser (DAG, dedup, compact, subagent)
- [ ] 03-03-PLAN.md — Codex JSONL parser (turn_context, function_call, spawn_agent)
- [ ] 03-04-PLAN.md — Enhanced turn assembler + sync pipeline wiring
- [ ] 03-05-PLAN.md — Parser fixture tests (Claude + Codex golden outputs)

**UI hint**: no

---

### Phase 4: Multi-source Frontend Shell + Session Explorer

**Goal**: Reshape the Next.js frontend into a reusable multi-source dashboard shell and connect session browsing to the ingest API.

**Status**: Pending

**Depends on**: Phase 1, Phase 2

**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, OPEN-01

**Success Criteria** (what must be TRUE):

1. Header source switcher supports OpenClaw, Claude Code and Codex, with source-specific labels and status.
2. Source-first routes exist for `/openclaw/*`, `/claude-code/*`, `/codex/*`, with legacy redirects from old routes.
3. AgentToolProvider/registry/capabilities/UI profiles drive nav items, empty states, columns and source-specific slots.
4. Shared Session Explorer lists and filters sessions from ingest API by source, project/workspace, model, status, time, search and failure/tool/subagent facets.
5. OpenClaw overview remains available and retains existing Agent/KPI/Sessions/Cron/Skills/Activity information.

**Plans**: TBD

**UI hint**: yes

---

### Phase 5: Turn Replay UI

**Goal**: Implement the main user-facing replay experience: a virtualized turn timeline that shows each user-agent exchange with tools, skills, subagents and activity in context.

**Status**: Pending

**Depends on**: Phase 3, Phase 4

**Requirements**: TURN-04, TURN-05, TURN-06, REPLAY-01, REPLAY-02, REPLAY-03, REPLAY-04, REPLAY-05, REPLAY-06, REPLAY-07

**Success Criteria** (what must be TRUE):

1. Session replay page renders turn cards with user input, assistant response and structured activity blocks.
2. Tool blocks show category/name, input, output/result events, status/error/duration and copy action.
3. Skill blocks show skill name, input summary and result/status.
4. Subagent blocks lazy-load child session replay and allow opening the child as a full session, with bounded nesting.
5. Long sessions use virtualization or range pagination without scroll/cache corruption when filters or sessions change.
6. In-session search, block filters, next/previous turn navigation and copy turn/message/tool are usable.
7. Running/awaiting-user/aborted/error/truncated/parser-warning states are visible in replay.

**Plans**: TBD

**UI hint**: yes

---

### Phase 6: Sync, OpenClaw Drilldown & Hardening

**Goal**: Make the dashboard reliable as a local daily-use tool by adding incremental sync, SSE refresh, OpenClaw live-to-history drilldown, security boundaries and regression/performance checks.

**Status**: Pending

**Depends on**: Phase 5

**Requirements**: DATA-04, DATA-06, DATA-07, OPEN-02, OPEN-03, HARD-01, HARD-02, HARD-03, HARD-04, HARD-05

**Success Criteria** (what must be TRUE):

1. ingest service uses chokidar/Node watcher + debounce + periodic resync fallback and exposes last sync/watch/parser error status.
2. Frontend subscribes to global/session SSE and refreshes active session data without full-page reload.
3. OpenClaw live sessions and activity can drill down to indexed session replay where a matching session exists.
4. API reads only indexed sessions under configured roots and returns safe errors for unknown ids or unavailable sources.
5. Fixture regression covers parser edge cases; performance checks cover long sessions; privacy defaults are documented in UI and docs.
6. Development startup flow can run/connect Next.js and ingest service, and UI clearly reports ingest disconnected/starting states.

**Plans**: TBD

**UI hint**: yes

---

## Future Enhancements

- Add more agents from agentsview registry.
- Import Claude.ai / ChatGPT exports.
- Session comparison and diff views.
- Richer health/outcome/failure signal scoring.
- Markdown/JSON/CSV export with redaction profiles.
- Single-command launcher or desktop shell.
- Optional OpenTelemetry/OpenInference exporter.

---

## Glossary

- **Source**: OpenClaw, Claude Code, Codex 等本地 agent 数据来源。
- **Session**: 一次 agent 会话，可能来自本地 JSONL 文件或 OpenClaw active session。
- **Turn**: 一次用户输入到 agent 产出之间的完整交换，是 replay 的核心单位。
- **ToolCall**: agent 在 turn 中调用的工具，包含输入、状态、结果事件和错误。
- **SkillUse**: 以 skill 形式触发的专门能力，作为独立 block 展示。
- **Subagent**: 由父 session/turn 生成的子 agent session，可 inline 展开或作为完整 session 打开。
- **Ingest service**: 本地独立 Node/TypeScript 服务，负责发现、解析、索引和服务 session trace 数据。
- **Gateway**: OpenClaw WebSocket/RPC 实时状态通道。

---

**EOF**
