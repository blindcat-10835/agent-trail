# Phase 8 Discussion Log

**Date:** 2026-05-09
**Mode:** Auto-discussion from user-provided bug reports and completed investigation

## User Intent

用户希望创建一个新 phase 来修复 2026-05-08 发现并调查过的 bug，重点是 session 解析、tool/subagent 归入、session finding、refresh/sync 和 fixture 与真实数据不一致。

## Why This Became A New Phase

Phase 7 已覆盖并完成上一批 UI/right rail/session list bug。当前新问题虽然包含 BUG-03/05/07/08，但根因更底层：

- Parser fixtures 与真实 Claude/Codex JSONL 不一致。
- Parser 产生的 tool activity 没有被 sync pipeline 持久化到 SQLite。
- DB message id 为空，仍有数据层面的 key/null 风险。
- Refresh 只 refetch，不保证 ingest re-scan/reindex。
- Parser 修复后旧 `file_hash` cache 可能阻止重新解析。

因此追加 Phase 8，而不是重开 Phase 7。

## Gray Areas Considered

### Real Local Sessions As Test Data

Decision: 可以 pick up 本机真实 Claude Code / Codex sessions，但不能直接把完整原始 session 当作 committed fixture。锁定为两层：从真实 session 抽取脱敏最小切片提交到 repo；完整本机 session 通过 opt-in local smoke/integration test 运行，不进 CI。

Rationale: 完整真实日志最能暴露 parser 假设错误，但包含 prompt、tool output、绝对路径和项目内容；直接提交风险高，且 full snapshot 会因为日志变化和隐私内容变得脆弱。脱敏切片保证 CI 可重复，本机 corpus 保证开发机真实解析不回退。

Selection notes from local inspection: 本机存在覆盖需要的 Claude `tool_result` / subagent session，也存在 Codex `function_call_output` / `custom_tool_call` session。用户报告中的 `606dac00-...` 和 `effac644-...` 应进入 local corpus verification targets。

### Fixture Source

Decision: 真实数据格式优先；fixture 使用脱敏最小真实片段。Synthetic fixture 可以保留，但必须标注或改成真实等价结构。

### Parser Scope

Decision: 本 phase 必修 tool/result/thinking/compact 的真实格式。完整 subagent graph 只做 best-effort，不因 session_index 或父子关系不完整而阻塞 P0/P1 修复。

### Persistence Boundary

Decision: 修复不能停在 parser 返回 activities；必须把 `messages.id`、`tool_calls`、`tool_result_events` 写入 SQLite，并让 `assembleTurns()` 从 DB 读到结构化 activity。

### Refresh Semantics

Decision: UI refresh 先 sync/reindex，再 refetch。普通 refresh 做 normal sync；另提供 force-reparse 路径用于 parser/cache-version 变化后的验证和修复。

### Verification

Decision: 验证以真实 session + DB assertions 为准。目标包括 `606dac00-4f36-40e2-89c8-da91416b6b39`、`effac644-0eb7-4fc8-9e60-6c8127d51eae` 和 `tool_calls` / `tool_result_events` 非空。

## Locked Outputs

- Phase added: Phase 8 `Real-data parser, tool persistence, and sync refresh repair`
- Context written: `.planning/phases/08-real-data-parser-tool-persistence-and-sync-refresh-repair/08-CONTEXT.md`
- Roadmap updated: Phase 8 goal, requirements, success criteria
