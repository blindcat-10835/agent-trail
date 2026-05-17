# Phase 17: OpenCode Source Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 17-opencode-source-integration
**Areas discussed:** SQLite Reader 策略, Part-to-Activity 映射, Schema 迁移策略, Cost 混合显示策略

---

## SQLite Reader 策略

### Connection Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| 每次 sync 重新 open/close | Stateless，跟现有 JSONL parser 一致 | ✓ |
| 长连接复用 | 减少 open 开销但需处理 lifecycle | |
| You decide | 交给 planner 决定 | |

**User's choice:** 每次 sync 重新 open/close
**Notes:** Recommended — keeps parity with existing stateless parser pattern

### Skip Cache Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| time_updated + count hash | 用 opencode session 的 time_updated + message/part count 做 skip key | ✓ |
| 仅 time_updated | 更简单但可能漏掉内容变更 | |
| No skip (全量重解析) | 简单但性能差 | |

**User's choice:** time_updated + count hash

### WAL Lock Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Retry 3 次 + skip | retry 3 次 + 100ms delay，仍然 busy 则 skip 当前 session | ✓ |
| 立即 skip | 最快但可能漏数据 | |
| Skip 整个 sync run | 避免部分数据不一致 | |

**User's choice:** Retry 3 次 + skip

### Schema Guard

| Option | Description | Selected |
|--------|-------------|----------|
| 表存在检查 | 检查 4 个核心表存在，不检查列名 | ✓ |
| 表 + 关键列检查 | 更严格但更脆弱 | |
| 无检查，catch 错误 | 最简单但错误信息不明确 | |

**User's choice:** 表存在检查

---

## Part-to-Activity 映射

### Turn Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| user message = turn 边界 | 跟 claude-code/codex parser 一致 | ✓ |
| assistant message = turn | 更简单但可能丢失多轮语义 | |
| You decide | 交给 planner 决定 | |

**User's choice:** user message = turn 边界

### Step Parts (step-start/step-finish)

| Option | Description | Selected |
|--------|-------------|----------|
| 不映射，内部用 | 只用于 token/cost 计算 | |
| 映射为 system event | 显示 step 边界和 token/cost | ✓ |
| 仅 step-finish | 只映射 finish | |

**User's choice:** 映射为 system event

### Patch Parts

| Option | Description | Selected |
|--------|-------------|----------|
| System event + 文件列表 | 显示修改了哪些文件 | |
| Tool call (Edit 类) | files 数组作为 inputJson，跟 Claude Code Edit 一致 | |
| 不映射 | 最简单但丢失信息 | |

**User's choice:** User requested to check how existing tools (Claude Code) display similar data and stay consistent. After investigation: Claude Code maps edit/write tool calls as `TraceToolCall` category `Edit` with diff content. Patch parts should follow the same pattern → `TraceToolCall` category `Edit`, tool name `"patch"`.
**Notes:** Key user direction: "这些都要尽量和已经存在的tool保持统一"

---

## Schema 迁移策略

### Migration Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Rebuild table | 创建新表 + 复制数据 + DROP + RENAME | ✓ |
| Additive columns (双列过渡) | 新增无 CHECK 的列，逐步迁移 | |
| Disable CHECK + 应用层过滤 | 风险高 | |

**User's choice:** Rebuild table

### New Columns

| Option | Description | Selected |
|--------|-------------|----------|
| 仅 cost 字段 | source_cost_usd + cost_source + cost_pricing_status | ✓ |
| reasoning + cost 字段 | 同时添加 reasoning_tokens 列 | |
| 不加新列 | 靠 activities/JSON 存储 | |

**User's choice:** 仅 cost 字段

---

## Cost 混合显示策略

### Cost Source Priority

| Option | Description | Selected |
|--------|-------------|----------|
| 优先 source-reported | opencode reported cost 优先，标记 reported_zero | ✓ |
| 始终用 pricing registry | 统一逻辑但丢失精确数据 | |
| 取较大值 | 避免低估但不准确 | |

**User's choice:** 优先 source-reported

### UI Distinction

| Option | Description | Selected |
|--------|-------------|----------|
| ~ 前缀区分 | ~$1.23 = 估算，$1.23 = reported | ✓ |
| 后缀标签 (est. / rpt.) | 更明确但 UI 拥挤 | |
| 不区分 | 最简洁但信息丢失 | |

**User's choice:** ~ 前缀区分

### source=all Aggregation

| Option | Description | Selected |
|--------|-------------|----------|
| 混合加总 | reported + estimated 混合加总 | ✓ |
| 仅 reported source | 不完整 | |
| 统一估算 | 丢失精确度 | |

**User's choice:** 混合加总

---

## the agent's Discretion

- Exact parser file organization (single file vs split)
- DB query structure (prepared statements vs raw)
- Skip key hash algorithm
- Exact migration version number
- File part rendering in message content
- Whether to query session_message table for agent/model-switched events

## Deferred Ideas

- Incremental/append sync for opencode DB — after baseline is stable
- Watcher-based real-time sync for opencode.db/opencode.db-wal
- todo table integration — future phase
- session_diff JSON visualization — future phase
- Snapshot/Git object reading — future phase
- opencode export --sanitize for automated fixture generation
