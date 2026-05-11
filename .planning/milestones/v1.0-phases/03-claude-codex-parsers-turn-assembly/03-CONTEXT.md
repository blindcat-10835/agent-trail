# Phase 3: Claude/Codex Parsers + Turn Assembly - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Claude Code and Codex parser parity to the ingest service, and complete turn assembly with complex boundary handling (DAG/fork, compact, queued commands, system messages, subagent mapping, tool call pairing). Produce reliable turn-level replay data across all three sources.

**Deliverables:**
- `ingest/parser/claude.ts` — Claude Code JSONL parser with DAG/fork/continuation, compact/system boundaries, streaming dedup, subagent mapping
- `ingest/parser/codex.ts` — Codex JSONL parser with turn_context mapping, function_call pairing, spawn_agent handling, token_count dedup
- Enhanced `ingest/turns/assembler.ts` — Complete turn assembly: compact/queued/system boundaries, multi-turn tool call pairing, subagent linking
- Updated `ingest/sync/sources.ts` — Claude Code and Codex source discovery functions
- All three parsers output canonical Message, ToolCall, ToolResultEvent, SubagentLink
- Parser fixture tests pass for OpenClaw, Claude Code, and Codex golden outputs

**Not in this phase:**
- Skill block rendering or subagent inline UI expansion (Phase 5)
- File watcher / chokidar / real-time sync (Phase 6)
- SSE real push (Phase 6)
- Frontend integration (Phase 4)
- Subagent session lazy-load UI (Phase 5)
</domain>

<decisions>
## Implementation Decisions

### Claude Code Parser
- **D-01:** 完整支持 Claude DAG 结构 — `parentUuid` 映射为 `parent_session_id`，fork/continuation 映射为 `relationship_type`。与 agentsview Claude parser 行为对齐。
- **D-02:** Compact 和 system message 作为独立 `TraceMessage` 存储（role:"system"），不合并也不隐藏。Turn assembler 中默认折叠但可通过 flag 查看。
- **D-03:** Streaming 重复按 message UUID 去重，保留第一个出现的 message。后续同 UUID 行丢弃。
- **D-04:** Subagent 会话用引用存储：父 session 的 tool call 中存 `subagent_session_id`，子 session 的 `parent_session_id` 指向父，`relationship_type = 'subagent'`。子 session 单独解析和索引，不内联到父 session。
- **D-05:** Queued command 在 turn assembly 时合并为一个 user message。

### Codex Parser
- **D-06:** 利用 Codex 自带的 `turn_context` 边界：`response_item`（role:"user"）开始新 turn，`turn_context` 提供 model name，与 TraceTurn 概念一致。不需要 assembler 推断边界。
- **D-07:** Codex `response_item` 直接映射：`input_text` → TraceMessage（user），`text` → TraceMessage（assistant），`function_call` → TraceToolCall，`function_call_output` → TraceToolResultEvent。
- **D-08:** Codex `spawn_agent` 与 Claude subagent 一致，用引用存储。父 session 的 function_call 中标记 `subagent_session_id`。
- **D-09:** Codex 也按 token_count 去重 streaming 重复（与 Claude UUID 去重策略等效，但按 token_count 变化判断是否新消息）。

### Turn Assembly Completeness
- **D-10:** 完整处理 compact/system/queued 边界。Compact 前后消息独立存储，前面消息标记 `is_truncated`。System message 作为独立 message 存储但默认不在 turn 中渲染。
- **D-11:** Tool call 和 tool result 在 assembler 中按 `tool_use_id`/`call_id` 精确配对，支持跨 turn 配对。存入 `tool_calls` 和 `tool_result_events` 表。

### Source Discovery
- **D-12:** Claude Code 默认路径 `~/.claude/sessions/`，Codex 默认路径 `~/.codex/sessions/`。可通过 `CLAUDE_SESSIONS_PATH` / `CODEX_SESSIONS_PATH` 环境变量覆盖。
- **D-13:** 每个 source 有独立 discovery 函数：`discoverClaudeSources()` / `discoverCodexSources()`，保持与 `discoverOpenClawSources()` 一致的模式。

### the agent's Discretion
- Claude/Codex parser 内部实现细节（line-by-line streaming vs batch）
- parse error recovery 策略和 logging verbosity
- JSONL 文件内 session/project 名提取策略
- 测试 fixture 的选择（从 agentsview testdata 选取覆盖 DAG/fork/compact/function_call/spawn_agent 的场景）
- Turn assembler 中 compact/system 折叠/展开的 flag 设计
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Trace Contract & Types
- `types/trace.ts` — Canonical trace types (TraceSource, TraceSession, TraceTurn, TraceMessage, TraceActivity, TraceToolCall, TraceToolResultEvent)。所有 parser 必须输出这些类型。
- `.planning/phases/01-trace-contract-brownfield-reset/01-CONTEXT.md` — Trace contract 设计决策（D-01 到 D-15）

### Phase 2 Existing Code
- `.planning/phases/02-local-ingest-core-openclaw-parser/02-CONTEXT.md` — Ingest service 架构决策（D-01 到 D-11），parser 模块结构，API 设计
- `ingest/parser/openclaw.ts` — OpenClaw parser 实现参考（ParseResult → TraceSession 模式）
- `ingest/parser/types.ts` — Parser 内部类型（ParseResult, SessionContext, OpenClawJsonlLine）
- `ingest/turns/assembler.ts` — 当前 turn assembler（user message 边界，Phase 3 扩展）
- `ingest/db/schema.sql` — SQLite schema（sessions, messages, tool_calls, tool_result_events, turns 表）
- `ingest/sync/sources.ts` — Source discovery 模式（SourceConfig, DiscoveredSource, discoverOpenClawSources）
- `ingest/sync/index.ts` — 数据库写入层（writeSessionToDatabase, syncSource）

### Reference Implementation
- `../references/agentsview/internal/parser/claude.go` — Claude Code parser 行为参考（DAG/fork/continuation, compact boundary, UUID dedup, subagent mapping）
- `../references/agentsview/internal/parser/codex.go` — Codex parser 行为参考（turn_context, response_item, function_call, spawn_agent, token_count dedup）
- `../references/agentsview/internal/parser/types.go` — AgentType, AgentDef, Registry 结构参考
- `../references/agentsview/internal/parser/testdata/claude/` — Claude JSONL fixture 示例
- `../references/agentsview/internal/parser/testdata/codex/` — Codex JSONL fixture 示例

### Research
- `.planning/research/AGENTSVIEW-DATA-SCHEME.md` — agentsview 数据方案分析
- `.planning/research/STACK.md` — 技术栈选择分析
- `.planning/research/SUMMARY.md` — 项目研究综合摘要
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ingest/parser/openclaw.ts` — 已实现的 OpenClaw parser（JSONL line-by-line 解析、SessionContext 提取、ParseResult 输出）。Claude/Codex parser 遵循相同模式。
- `ingest/parser/types.ts` — ParseResult, ParseError, SessionContext 等共享类型。Claude/Codex parser 可直接导入使用。
- `ingest/turns/assembler.ts` — 已有 `assembleTurns()` 函数实现基本的 user-message 边界分组。Phase 3 扩展这个函数以处理 compact/system/queued 边界和 tool call 配对。
- `ingest/sync/sources.ts` — 已有 `discoverOpenClawSources()` 和 `SourceConfig`/`DiscoveredSource` 类型。Claude/Codex discovery 函数遵循相同接口。
- `ingest/sync/index.ts` — 已有 `writeSessionToDatabase()` 和 `syncSource()`。Claude/Codex sync 可复用。

### Established Patterns
- Parser → ParseResult → writeSessionToDatabase 的流水线模式
- Source-specific parser 在 `ingest/parser/` 下，内部类型在 `types.ts`
- Source discovery 在 `ingest/sync/sources.ts`，每 source 一个独立函数
- 测试 fixture 放在 `tests/fixtures/` 下
- Hono 路由在 `ingest/api/` 下，每 API 域一个文件

### Integration Points
- Claude/Codex parser 输出相同的 ParseResult 类型 → `writeSessionToDatabase` 无需修改
- Source discovery 函数被 `syncSource()` 调用 → 扩展 source type 即可
- Turn assembler 被 `ingest/api/turns.ts` 调用 → 接口不变，内部逻辑增强
- 新增 `CLAUDE_SESSIONS_PATH` / `CODEX_SESSIONS_PATH` 环境变量
</code_context>

<specifics>
## Specific Ideas

- Claude parser 行为完整对齐 agentsview Go parser — 不发明新的 DAG/fork/compact 处理逻辑
- Codex parser 利用已有的 `turn_context` 边界，比 Claude 的纯 message 流更直接
- Subagent 引用存储保持数据库模型简单，Phase 5 UI 再处理展开逻辑
</specifics>

<deferred>
## Deferred Ideas

- Subagent session inline 展开 UI — Phase 5
- Skill block 渲染 — Phase 5
- Chokidar file watcher 实时同步 — Phase 6
- SSE 实时 push — Phase 6
- parser regression tests 全覆盖 — Phase 6
- API path 安全约束（不接收任意路径）— Phase 6

None — discussion stayed within phase scope
</deferred>

---

*Phase: 03-claude-codex-parsers-turn-assembly*
*Context gathered: 2026-05-06*
