# Phase 8: Real-data parser, tool persistence, and sync refresh repair - Research

**Researched:** 2026-05-09
**Domain:** 本地 JSONL session parser、SQLite 持久化、Next.js BFF refresh
**Confidence:** HIGH

<user_constraints>
## User Constraints

### Locked Decisions

- 真实 `~/.claude` / `~/.codex` JSONL 格式优先于 synthetic fixture。
- Repo 内只提交脱敏、最小化的真实格式切片；完整本机 session 只作为 opt-in local corpus。
- 本机完整 session 测试必须显式开启，默认 unit test/CI 不运行，缺少本机日志时 skip。
- Local corpus manifest 必须 gitignored，不能提交绝对路径、个人项目名或完整 session 内容。
- Parser 修复必须覆盖 Codex `function_call_output`、`custom_tool_call`、`custom_tool_call_output`，Claude `tool_result`、`thinking`、`isCompactSummary` / file-history snapshot。
- 修复不能停在 parser 返回 `activities`；必须把 `messages.id`、`tool_calls`、`tool_result_events` 写入 SQLite。
- Refresh 必须先 sync/reindex，再 refetch。需要 safe force-reparse 路径绕过旧 `file_hash` skip cache。

### the agent's Discretion

- Parser 内部辅助类型、activity metadata 字段名、fixture 文件组织。
- `thinking` / `reasoning` 的最终映射方式，只要 replay 不丢数据且不产生 unknown warning 噪音。
- Force reparse API 参数名和 BFF route 形态。

### Deferred Ideas

- 完整 agentsview-compatible parent/child subagent graph reconstruction。
- Cross-source global search redesign。
- 支持 OpenClaw/Claude/Codex 以外的新 source。
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| 真实格式 fixture 和 local corpus | Tests | Parser | 默认 CI 需要 deterministic redacted fixtures，本机 corpus 只做 opt-in smoke。 |
| Claude/Codex JSONL 解析 | Parser | Types | 源格式差异必须停留在 parser 层，canonical DTO 不应暴露 raw JSONL 假设。 |
| Tool/result/message id 落库 | Database/Storage | Ingest sync | `assembleTurns()` 从 DB 表读 activity，sync 层必须事务性替换 derived rows。 |
| Force reparse / skip cache | Ingest sync | API | Parser 行为变化时 file content hash 不变，必须有显式缓存失效机制。 |
| Manual refresh | Browser/Client | Next.js BFF, Ingest API | 前端不能直连 ingest；BFF 代理 sync 后再触发 hook refetch。 |
| Target session verification | Tests | Database | 需要用真实 DB assertions 证明用户报告 session 已修复。 |
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 8 的核心不是新增 UI，而是修正数据链路：真实 Claude/Codex JSONL -> parser canonical output -> SQLite derived rows -> turn assembler -> replay UI。当前代码在 parser 层只覆盖了部分 fixture 形态，且 sync 层仍只写 sessions/messages，导致 `tool_calls` 和 `tool_result_events` 永远为空。即使 parser 识别了 tool call，replay 从 DB 读取时也拿不到。

参考 agentsview 的关键模式是：parser message 里同时保留 text、thinking、tool calls、tool results；写库时先删除旧 derived rows，再在一个 transaction 中插入 messages、tool_calls、tool_result_events；tool result 用 `tool_use_id` / `call_id` 精确配对，不在 UI 中字符串猜测。Codex 真实格式中 `function_call_output` 是 `response_item.payload.type`，不是只有 `event_msg`；Claude 真实格式中 `tool_result` 是 user message 的 content block，`thinking` 也是 content block，compact boundary 常用 `isCompactSummary`。

**Primary recommendation:** 先建立脱敏真实格式 fixture 和 opt-in local corpus，再修 parser activity metadata，最后用事务性 sync 写入 `messages.id` / tool 表，并把 refresh 改成 sync-then-refetch。
</research_summary>

<standard_stack>
## Standard Stack

| Component | Current Tooling | Phase 8 Use |
|-----------|-----------------|-------------|
| Test runner | Vitest 4.x | Parser、sync、BFF、hook、local opt-in corpus tests。 |
| Parser IO | Node `fs` + `readline` | 保持 line-by-line JSONL 解析，不一次性读完整大 session。 |
| DB | `better-sqlite3` | 用 transaction 包住 per-session derived row replacement。 |
| BFF | Next.js route handlers | 前端 refresh 只调 `/api/sync` 或 `/api/agent-tools/[tool]/sync`。 |
| Ingest API | Hono | 扩展 `/api/v1/sources/:type/sync` 支持 `force`。 |

不需要新增 runtime dependency。若新增 fixture extraction helper，优先用现有 Node/Vitest helper，而不是引入专门脱敏库。
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Data Flow

```text
Claude/Codex JSONL
  -> parser reads line-by-line
  -> ParseResult(messages + activities with messageOrdinal/call id metadata)
  -> syncSource(force?)
  -> writeSessionToDatabase transaction
       -> upsert sessions
       -> delete old messages/tool_calls/tool_result_events/turns
       -> insert messages with stable ids
       -> insert tool_calls with message_ordinal
       -> insert tool_result_events linked to tool_call row id
  -> assembleTurns()
       -> group messages into turns
       -> query tool_calls/tool_result_events
       -> replay DTO contains structured activities
  -> BFF hooks refetch after sync completes
```

### Pattern 1: Two-layer Test Corpus

Committed fixtures are redacted, tiny, and deterministic. Full local sessions are discovered from a gitignored manifest or default roots only when `RUN_REAL_SESSION_TESTS=1`.

This protects privacy and CI stability while still catching real parser drift on the developer machine.

### Pattern 2: Parser Activity Metadata

Tool persistence needs more than `TraceToolCall.id`. Each parsed tool call must carry the assistant message ordinal that owns it. For Claude, multiple `tool_use` blocks can share one assistant message ordinal. For Codex, synthetic function-call assistant messages should use the same ordinal as the matching activity.

### Pattern 3: Transactional Derived Row Replacement

Session file reparse should replace all per-session derived rows in one transaction. Delete result events through the session's tool calls first, then tool calls, turns, and messages. Insert all new rows before commit. Partial replacement is worse than stale data because `assembleTurns()` can mix old tool rows with new messages.

### Pattern 4: Sync-then-Refetch Refresh

Manual refresh must call BFF sync, wait for completion, then dispatch `SESSION_REFRESH_EVENT` or directly refetch current hook data. Refetch-only is not a refresh; it only rereads stale SQLite rows.
</architecture_patterns>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Treating Fixtures As Source Truth

**What goes wrong:** Parser passes synthetic fixtures but fails on real logs.

**How to avoid:** Every new parser behavior must have at least one redacted real-shape fixture plus one optional real-session corpus assertion.

### Pitfall 2: Parser-only Tool Fix

**What goes wrong:** `ParseResult.activities` contains tool calls, but replay still lacks tools because `assembleTurns()` reads SQLite tables.

**How to avoid:** Sync tests must assert rows in `tool_calls` and `tool_result_events`, then call `assembleTurns()` and assert turn activities.

### Pitfall 3: Missing `message_ordinal`

**What goes wrong:** Tool rows cannot be assigned to a turn, or attach to the wrong turn after reparse.

**How to avoid:** Parser-generated tool calls must include an owning assistant message ordinal. Do not infer by matching text labels.

### Pitfall 4: Hash Cache Hiding Parser Fixes

**What goes wrong:** Parser changes ship, but existing file hashes match and old DB rows remain.

**How to avoid:** Add `force` to sync/write path and use it in verification. Optionally include a parser/cache version in session metadata later.

### Pitfall 5: Local Corpus Privacy Leak

**What goes wrong:** Full local prompt/tool output or absolute paths get committed.

**How to avoid:** `.local/real-session-corpus.json` is gitignored; committed example files use fake IDs/paths only. Repo fixtures are redacted slices.
</common_pitfalls>

<validation_architecture>
## Validation Architecture

1. Parser unit tests for real-shape fixtures fail before parser repair and pass after.
2. Sync unit tests use in-memory SQLite and temporary JSONL files to prove stable message ids and populated tool tables.
3. Turn assembly tests prove DB rows become `TraceToolCall` activities in the expected turn.
4. BFF/hook tests prove refresh calls sync before refetch.
5. Opt-in local corpus test proves target real sessions parse/reindex cleanly on this machine without committing raw data.
</validation_architecture>

