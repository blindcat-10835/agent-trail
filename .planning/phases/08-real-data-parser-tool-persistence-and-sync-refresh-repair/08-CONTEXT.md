# Phase 8: Real-data parser, tool persistence, and sync refresh repair - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

修复 2026-05-08 用户反馈和后续调查确认的 replay 数据正确性问题：Claude/Codex parser 与真实 JSONL 格式不一致、tool calls/result events 没有落库、message id 为空导致潜在 React key 风险、刷新按钮只 refetch DB 而不触发 ingest sync，以及 parser 修复后旧 file hash cache 可能阻止重新索引。

这个 phase 是稳定化和数据正确性修复。它不引入新 source、不做 SaaS/分享/导出、不实现完整 agentsview 全功能，也不重新设计 Phase 7 已完成的 right rail/session layout。

</domain>

<decisions>
## Implementation Decisions

### Real Data Is Canonical
- **D-01:** 真实 `~/.claude` / `~/.codex` JSONL 格式优先于现有 synthetic fixture。若 fixture 与真实格式冲突，修 parser 时以真实格式和 `../references/agentsview` 行为为准。
- **D-02:** 新增或替换 fixture 时使用脱敏、最小化的真实片段；不要提交完整本机 session 或敏感路径/输出。
- **D-21:** 测试数据采用分层策略，不把“真实数据”和“可提交 fixture”混成一类：repo 内提交脱敏的真实格式切片；本机完整真实 session 只作为 opt-in smoke/integration corpus。
- **D-22:** Committed fixture 必须来自真实 Claude/Codex session 的结构切片，但要最小化和脱敏：保留 JSONL envelope、`type`、`payload`、`uuid`/`call_id`/`tool_use_id` 配对、parent/child 关系和必要 timestamp；替换 prompt、tool output、绝对路径、文件内容和敏感参数。
- **D-23:** 本机完整 session 测试必须通过显式开关运行，例如 `RUN_REAL_SESSION_TESTS=1` 或类似命令，不进入默认 unit test/CI。缺少本机日志时应 skip，不 fail。
- **D-24:** 本机真实 session corpus 使用 gitignored manifest 管理候选 session id/path/tag，不把 manifest 中的绝对路径、个人项目名或完整 session 内容提交到仓库。
- **D-25:** 本机真实 session 测试不做 full snapshot golden，因为真实日志会变且含敏感内容；只断言结构性不变量：parser 不崩溃、warning 数可控、message id 非空、tool calls/result events 非空并能配对、turn activities 出现在正确 turn。
- **D-26:** Phase 8 planning 必须包含一个 fixture selection/extraction task：从本机真实 Claude/Codex session 中挑选覆盖面最强的样本，生成脱敏 committed fixtures，并配置 opt-in local corpus test。

### Codex Parser Repair
- **D-03:** Codex tool result 必须从 `response_item.payload.function_call_output.output` 读取，而不是只从 `event_msg` 读取。
- **D-04:** `custom_tool_call` / `custom_tool_call_output` 必须作为 tool call/result 进入 canonical model，覆盖 `apply_patch` 等编辑类工具。
- **D-05:** `reasoning` / `web_search_call` 不应产生大量 unknown-type 噪音；本 phase 至少要静默或结构化记录，是否渲染为 Thinking/System block 由 planning 根据现有类型决定。
- **D-06:** Codex subagent 不再依赖 fixture-only 的 top-level `spawn_agent` JSONL 类型。真实子 agent 关联如果需要处理，应基于 function call / wait output / `session_index.jsonl` 做 best-effort；无法可靠链接时记录为 deferred，不阻塞 tool/result 修复。

### Claude Parser Repair
- **D-07:** Claude `message.content[]` 中的 `tool_result` 必须提取内容、`tool_use_id` 和错误状态，并与前序 `tool_use.id` 配对。
- **D-08:** Claude `thinking` 内容块不能静默丢弃；至少作为 canonical thinking/system activity 或 message metadata 保留给 replay。
- **D-09:** Compact/system boundary 要兼容真实 `isCompactSummary` / `file-history-snapshot` 形态；不再依赖 synthetic `type:"compact"`。
- **D-10:** 真实 Claude JSONL 单行没有 `session` 字段；原 parser 中基于 `parsed.session` 的 subagent/fork 分支应修正、删除或明确标为 synthetic-only。

### Persistence + Turn Assembly
- **D-11:** `writeSessionToDatabase()` 必须写入 stable `messages.id`，不能继续让 DB 中 message id 为 `NULL`。
- **D-12:** `writeSessionToDatabase()` 必须写入 `tool_calls` 和 `tool_result_events`；当前 parser 返回 activities 但 sync 不落库，导致 `assembleTurns()` 永远拿不到 structured tool activity。
- **D-13:** 每次重写 session 时，在单个 transaction 中替换该 session 的 derived rows：messages、tool calls、tool result events、turns/metadata（按当前 schema 可行范围）。避免旧 tool rows 与新 parser 输出混合。
- **D-14:** `assembleTurns()` 应继续从 DB 表读取 structured activities；不要在 UI 中用字符串猜 tool/result。

### Refresh + Reindex
- **D-15:** 右上角/右栏 refresh 必须先调用 BFF sync endpoint，BFF 再调用 ingest sync/resync endpoint，完成后再 refetch 当前可见 session list / selected session turns。
- **D-16:** 需要一个安全 force-reparse 路径，用于 parser/cache-version 变化后绕过或失效 `file_hash` skip cache。普通 refresh 可以做 normal sync；修复发布后验证必须能强制重建 affected sources。
- **D-17:** BUG-08 的旧错误 session name 清理依赖 reindex；Phase 8 完成后应验证这些空 name 能通过 sync 重新计算。

### Verification Priority
- **D-18:** BUG-03 `key=null` 的首要修复点是数据完整性：DB message id 不再为空；前端 fallback 保留但不是唯一防线。
- **D-19:** 必须用真实数据库断言验证 `tool_calls` / `tool_result_events` 非空，并用目标 session 验证 replay 中 tool/result 归入 turn。
- **D-20:** `effac644-0eb7-4fc8-9e60-6c8127d51eae` 的 session finding 问题目前更像 sync/index freshness 问题；本 phase 用 force reparse + list ordering/discovery 验证兜底，不另开搜索系统。
- **D-27:** Local corpus 必须至少覆盖用户点名/调查中使用过的真实 session 类别：Claude `606dac00-...` key/null risk、Claude `effac644-...` discoverability、Codex real `function_call_output`/`custom_tool_call` session、以及含 Claude subagent directory 的 session。

### the agent's Discretion
- Parser 内部辅助类型、fixture 文件组织、transaction helper 拆分方式。
- `reasoning` / `thinking` 最终映射到 existing `ThinkingBlock` 还是 system event，只要 replay 不丢数据且不制造噪音。
- Force reparse API 的具体参数名，例如 `force=true`、`mode=reparse` 或 internal maintenance endpoint。
- Local corpus manifest 的具体路径和命令名，只要默认不进入 CI、缺失时 skip、并且能在开发机上稳定复现真实日志解析。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug Reports And Investigation
- `.planning/2026-05-08-bugs-found-by-user-batch-1.md` — 用户原始反馈：session 解析、tool/subagent 归入、session finding。
- `.planning/2026-05-08-bugs-m1-post-release.md` — BUG-03/05/07/08 backlog 和初步定位。
- `.planning/2026-05-08-fixture-vs-realdata-analysis.md` — fixture 与真实 Claude/Codex JSONL 差异分析。
- `.planning/phases/07-m1-residual-dashboard-bug-fixes/07-CONTEXT.md` — 已完成的 UI/right rail/freshness 修复边界，避免重复规划。

### Code References
- `ingest/parser/codex.ts` — Codex `response_item` / `event_msg` parser 分支，当前 tool output/custom tool/subagent 假设的主要修复点。
- `ingest/parser/claude.ts` — Claude `content[]` block parser，当前忽略 `tool_result` / `thinking`，且存在 synthetic compact/session 分支。
- `ingest/sync/index.ts` — `writeSessionToDatabase()` 当前只写 sessions/messages，message id omitted，tool tables deferred。
- `ingest/turns/assembler.ts` — turn assembler 从 `tool_calls` / `tool_result_events` 组装 activities；DB 空表会导致 replay 缺 tool。
- `ingest/db/schema.sql` — sessions/messages/tool_calls/tool_result_events schema 和 transaction 约束。
- `ingest/api/sources.ts`、`ingest/index.ts` — source sync API 挂载点和新增 global/per-source sync endpoint 的位置。
- `app/api/agent-tools/[tool]/sync/route.ts` 或相邻 BFF route — 前端 refresh 到 ingest sync 的代理层。
- `components/sessions/sessions-right-rail.tsx`、`components/shell/shell-header.tsx`、`lib/agent-tools/client-hooks.tsx` — refresh/refetch 触发和 visible session hooks。
- `components/replay/key-utils.ts`、`components/replay/turn-card.tsx`、`components/replay/turn-timeline.tsx` — BUG-03 key fallback 验证点。

### Reference Implementation
- `../references/agentsview/internal/parser/codex.go` — Codex real format parser behavior, especially `function_call_output` inside `response_item.payload` and function call/wait modeling.
- `../references/agentsview/internal/parser/claude.go` — Claude content block extraction, compact summary handling, tool result pairing.
- `../references/agentsview/internal/parser/content.go` — Parsed tool result/thinking text handling.
- `../references/agentsview/internal/db/schema.sql` — messages/tool_calls/tool_result_events persistence model.

</canonical_refs>

<code_context>
## Existing Code Insights

### Confirmed Findings
- `tool_calls` and `tool_result_events` tables were empty in the local DB while sessions had `has_tool_calls=1`, proving parser-level detection is not enough because sync does not persist structured activities.
- The reported Claude session `606dac00-4f36-40e2-89c8-da91416b6b39` had DB messages with `id IS NULL`, so data integrity can still produce null-key risk even if replay components use fallback helpers.
- `components/sessions/sessions-right-rail.tsx` refresh currently refetches BFF/DB data; it does not guarantee ingest scans new or modified JSONL files first.
- Existing unit tests passed against old assumptions, so passing tests do not prove real-data correctness.

### Parser Mismatches To Fix
- Codex real logs use `response_item.payload.type === "function_call_output"` with `output`, while current parser mainly handles output under `event_msg`.
- Codex real logs include `custom_tool_call` / `custom_tool_call_output`, which current fixtures do not cover.
- Claude real logs use user messages with `content[].type === "tool_result"` linked by `tool_use_id`; current `parseMessage()` extracts only text blocks.
- Claude real logs include `thinking` blocks and compact summary markers that differ from synthetic `type:"compact"` fixtures.
- Local inspection confirmed there are enough real Claude/Codex sessions on this machine to seed both fixture extraction and opt-in corpus tests; no raw prompt/tool output should be copied without redaction.

### Integration Constraints
- Frontend data access should remain through BFF routes under `/api/agent-tools/...`, not direct ingest calls.
- Original JSONL files remain read-only audit evidence; reindex updates SQLite only.
- Phase 7 UI layout fixes should be treated as baseline, not reopened unless required for refresh wiring.

</code_context>

<specifics>
## Specific Ideas

- Create `tests/fixtures/real-shape/claude/` and `tests/fixtures/real-shape/codex/` for committed, redacted real-shape JSONL snippets plus deterministic golden assertions.
- Create a gitignored local manifest such as `.planning/local-real-sessions.json` or `.local/real-session-corpus.json` with session ids/tags for local-only smoke tests.
- Add a local-only test command such as `pnpm test:real-sessions` that requires `RUN_REAL_SESSION_TESTS=1`, reads the manifest/default roots, and skips cleanly when logs are absent.
- Add focused tests that build tiny real-shape JSONL strings inline for Codex function output/custom tool output and Claude tool_result/thinking.
- Extend parser output or internal parse records so each tool call/result can be persisted with session id, message id/ordinal, turn ordinal, call id, status, input, output, and timestamps.
- Add sync tests that parse a session, call `writeSessionToDatabase()`, and assert non-null `messages.id`, non-empty `tool_calls`, and paired `tool_result_events`.
- Add `POST /api/v1/sources/:type/sync` or `POST /api/v1/sync` if missing; expose BFF route from the Next app and call it before `notifySessionsRefresh()`.
- Add a parser/cache version or `force` option so old rows affected by parser fixes are reparsed even when file content hash is unchanged.
- Validate with DB queries after force reparse, not only with component snapshots.

</specifics>

<deferred>
## Deferred Ideas

- Full agentsview-compatible parent/child subagent graph reconstruction for all Codex/Claude historical sessions.
- Cross-source global search redesign and advanced session ranking.
- Additional source support beyond OpenClaw, Claude Code, and Codex.
- Rich export/share flows for replay artifacts.

</deferred>

---

*Phase: 08-real-data-parser-tool-persistence-and-sync-refresh-repair*
*Context gathered: 2026-05-09*
