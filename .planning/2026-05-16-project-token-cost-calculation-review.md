# 本项目 token 与 cost 计算方式复核

日期：2026-05-16

范围：

- 本项目 `agents-tracing-dashboard`
- 对比文档：`.planning/2026-05-16-reference-token-cost-investigation.md`
- 重点 source：Claude Code、Codex、OpenClaw

## 结论摘要

本项目当前更接近“session token 展示”，还不是可靠的 usage/cost accounting。

当前主口径是：

```text
session.totalTokens = sessions.total_input_tokens + sessions.total_output_tokens
overview.totalTokens = SUM(total_input_tokens) + SUM(total_output_tokens)
```

`cost` 口径并不统一：overview/top-models API 返回 `cost: null`，sessions API 返回 `estimatedCost: null`，但部分前端组件用固定 `$2 / 1M tokens` 做粗略估算。项目内没有真实 model pricing table，也没有 Claude cache write/read 或 Codex cached/reasoning 的 cost 公式。

与 `agentsview` / `vibeusage` 对比后，主要不准确点如下：

1. Claude Code 的 `cache_creation_input_tokens`、`cache_read_input_tokens` 当前会被忽略，token 总量和未来 cost 都会显著低估。
2. Codex 的 `cached_input_tokens`、`reasoning_output_tokens`、`total_tokens` 当前不落入 canonical usage，只保留 `input_tokens/output_tokens`；这会阻碍正确 cost 计算，也丢失 overlap/double-count 判断依据。
3. Codex 增量同步路径解析到了 `delta.metricsDelta.totalInputTokens/totalOutputTokens`，但写库时没有使用这两个 delta；由于 Codex message 本身没有 `tokenUsage`，active session 的增量 token 可能不会更新到 `sessions` 表。
4. top models 把整场 session 的 token 都归给该 session 最后一个非空 model；如果 session 内发生 model 切换，模型排行会失真。
5. cost capability 与实际能力不一致：ingest capabilities 标记 Claude Code `cost: true`，但 API 实际不计算 cost。
6. overview 的 `30d` 是滚动最近 30 天，不是自然月；`today` 使用 SQLite `datetime('now', 'start of day')`，即 UTC 日界，不是本地日界。

## 当前数据流

### Canonical 类型与 DB

- `types/trace.ts` 的 `SessionMetrics` 只有 `inputTokens/outputTokens/totalTokens`，没有 session 级 cache/reasoning 字段。
- `types/trace.ts` 的 `TokenUsage` 支持 `cacheReadTokens/cacheWriteTokens`，但当前 Claude/Codex parser 没有填充它们。
- `ingest/db/schema.sql` 的 `sessions` 只有：
  - `total_input_tokens`
  - `total_output_tokens`
- `messages.token_usage_json` 保存 `TokenUsage` JSON，但没有 raw provider usage JSON，也没有 cost/pricing 字段。

### 同步写库

`ingest/sync/index.ts` 的 `getSessionTokenTotals()` 优先使用 parser 给出的 `session.metrics.inputTokens/outputTokens`；如果没有，再从 message `tokenUsage` 累加。

全量写库会把结果写入：

- `sessions.total_input_tokens`
- `sessions.total_output_tokens`
- `messages.token_usage_json`

增量写库则只根据新插入 message 的 `message.tokenUsage` 更新 session token：

```text
insertedInputTokens += message.tokenUsage?.inputTokens ?? 0
insertedOutputTokens += message.tokenUsage?.outputTokens ?? 0
```

这对 Claude/OpenClaw 的普通 assistant usage 可以工作；但对 Codex 的 `token_count` 事件不够，因为 Codex parser 没有把 token_count 挂到 message 上。

## 各 source 现状

### OpenClaw

OpenClaw parser 只读取 `message.usage.input_tokens/output_tokens`：

- session 级：`totalInputTokens += input_tokens`，`totalOutputTokens += output_tokens`
- message 级：`tokenUsage = { inputTokens, outputTokens }`

如果 OpenClaw 日志确实只有 input/output 两个通道，这个口径是自洽的。但 OpenClaw `cost: true` 仍然没有真实 pricing 实现支撑。

### Claude Code

Claude raw type 当前声明为：

```ts
usage?: { input_tokens?: number; output_tokens?: number }
```

parser 也只累加这两个字段：

```text
totalInputTokens += parsed.message.usage.input_tokens || 0
totalOutputTokens += parsed.message.usage.output_tokens || 0
```

message `tokenUsage` 同样只保存：

```text
inputTokens = usage.input_tokens
outputTokens = usage.output_tokens
```

问题是 Claude Code JSONL 实际包含 cache 字段。本项目自己的 fixture `fixtures/claude-code/valid_session.jsonl` 已经有：

```text
cache_creation_input_tokens
cache_read_input_tokens
```

按这个 fixture 计算：

- 当前项目计入：`input 250 + output 125 = 375`
- 若按 Claude 四通道 usage 计入：`input 250 + output 125 + cache_creation 200 + cache_read 800 = 1375`

也就是说，仅这个 fixture 当前就少计了 1000 个 cache token。未来如果按当前 token 计算 Claude cost，也会低估 cache write/read 成本。

对比参考项目：

- `agentsview` 保留 Claude 四通道，并按 input/output/cache creation/cache read 分别计价。
- `vibeusage` 至少把 cache creation 合入 input、cache read 放入 cached input，不会完全丢掉 cache token。
- 本项目目前是两通道，低估 Claude usage。

另一个风险是去重：本项目只用 Claude 行级 `uuid` 去重；没有找到 `message.id/requestId` 级去重。`agentsview` 和 `vibeusage` 都额外处理 Claude streaming duplicate。如果 Claude Code 某些重复快照使用不同 `uuid` 但相同 `message.id/requestId`，本项目仍可能重复计数。

### Codex

Codex parser 读取 `event_msg.type == "token_count"`，但 `parseCodexUsageRecord()` 只解析：

```text
input_tokens
output_tokens
```

这些字段会用于 full parse 的 session metrics：

```text
inputTokens = tokenUsage.total.inputTokens
outputTokens = tokenUsage.total.outputTokens
totalTokens = inputTokens + outputTokens
```

当前测试 fixture 中 `total_tokens = 1234` 且 `input_tokens + output_tokens = 1200 + 34 = 1234`，所以 full parse 的总量暂时能对上。但 parser 丢弃了：

- `cached_input_tokens`
- `reasoning_output_tokens`
- upstream `total_tokens`

这会造成两个问题：

1. 无法正确做 Codex cost。Codex 的 `input_tokens` 可能已经包含 cached input，`output_tokens` 可能已经包含 reasoning output；正确 cost 需要像 `vibeusage` 那样保存五通道，并在 pricing 层用 overlap 规则避免 double count。
2. 如果未来 Codex `total_tokens` 与 `input_tokens + output_tokens` 不再严格一致，本项目会用派生值覆盖 upstream 权威总量。

增量同步还有一个明确缺口：`parseCodexSessionAppend()` 会把 token_count 写入 `delta.metricsDelta.totalInputTokens/totalOutputTokens`，但 `appendSessionDeltaToDatabase()` 更新 session 时没有使用这两个字段，而是只加新插入 message 的 `tokenUsage`。Codex message 没有 `tokenUsage`，因此 Codex active session 的增量 token 可能保持不变，直到 full reparse 才恢复。

对比参考项目：

- `agentsview` 将 Codex `cached_input_tokens` 从 `input_tokens` 中扣出，转成 cache read 通道，复用四通道 cost 公式。
- `vibeusage` 保留 Codex 五通道和 upstream `total_tokens`，并用 source-specific billable/overlap 规则。
- 本项目只保留 input/output，既不能精确 cost，也不能解释 cached/reasoning 构成。

## Overview / Sessions 聚合

### Overview aggregates

`ingest/api/overview.ts` 的 aggregates 使用 session 表求和：

```sql
SUM(total_input_tokens) AS input_tokens
SUM(total_output_tokens) AS output_tokens
SUM(total_input_tokens) + SUM(total_output_tokens) AS total_tokens
```

这与当前 DB 口径一致，但会继承 parser 层的缺失字段问题。

### Top models

top models 的逻辑先为每个 session 选择“最后一个非空、非 synthetic model”，再把整场 session 的 token 全部归给这个 model。

这避免了 join messages 时重复累计 session totals，但会牺牲精度：

- session 内 model 切换时，早期 model 的 token 会被归到最后一个 model。
- Codex 有 `turn_context.model`，更适合按 turn/token_count 归因。
- `agentsview` 是 message 级 usage，`vibeusage` 是 bucket 级 usage；两者都比本项目的 session-latest model 更细。

### 时间窗口

当前 overview 支持：

- `today`
- `7d`
- `30d`

其中：

```text
today = started_at >= datetime('now', 'start of day')
7d    = started_at >= datetime('now', '-7 days')
30d   = started_at >= datetime('now', '-30 days')
```

所以本项目没有 `month` 语义；`30d` 是滚动最近 30 天，不是自然月。`datetime('now')` 在 SQLite 中是 UTC，因此 `today` 也是 UTC 日界。

## Cost 现状

当前没有真实 cost accounting。

API 层：

- `/overview/top-models` 固定返回 `cost: null`
- `/sessions` 返回 `estimatedCost: null`

前端层：

- `components/sessions/sessions-stats-bar.tsx` 用 `totalTokens * 0.000002` 估算，即 `$2 / 1M tokens`
- `components/replay/replay-right-rail.tsx` 也用同样估算
- `components/overview/top-models-table.tsx` 的 cost 模式会展示 `—`

capabilities 层：

- `ingest/config/capabilities.ts` 标记 `openclaw.cost = true`、`claude-code.cost = true`、`codex.cost = false`
- 但 `lib/agent-tools/claude-code/definition.ts` 标记 Claude Code `cost = false`
- API capabilities 与前端 tool definition 不一致，而且 ingest API 标记的 Claude cost 能力没有真实 cost 返回值支撑

因此当前所有美元展示都应视为 placeholder/rough estimate，不能用于账单对账或模型成本比较。

## 与 reference 项目的差异表

| 维度 | agentsview | vibeusage | 本项目当前 |
| --- | --- | --- | --- |
| 数据粒度 | message/session SQLite | UTC 半小时 bucket | session totals + message JSON |
| Claude token 通道 | input/output/cache creation/cache read | input/cached/output/reasoning，其中 cache creation 合入 input | 只保留 input/output |
| Claude duplicate | parser 折叠 streaming duplicate，并在 usage query 按 `(message.id, requestId)` 去重 | parser/cursor 按 `message.id || requestId` 去重 | 只看到行级 `uuid` 去重 |
| Codex token 通道 | input 扣 cached，cached 转 cache read | 保留 input/cached/output/reasoning/total | 只保留 input/output |
| Codex total_tokens | 不使用 | 保留并作为权威总量之一 | 不保留，用 input+output 派生 |
| Codex incremental | token_count 归到 message usage | token_count delta 进 bucket | parser 有 delta，sync 写库未使用 |
| Model attribution | message usage model | bucket source/model | session 最后一个 model |
| Cost | LiteLLM/fallback 四通道公式 | pricing profile + overlap/add | API null，局部 UI 固定 `$2/MTok` |
| 30 天/月 | usage query 支持日期范围 | month 是自然月，last_30d 是滚动 30 天 | 只有滚动 `30d` |

## 正确性判断

### 目前可以接受的部分

- 对只有 `input_tokens/output_tokens` 的简单日志，session token 展示是自洽的。
- Overview 聚合没有重复 join messages，避免了 session totals 被消息行放大。
- OpenClaw 如果没有 cache/reasoning 通道，目前 token 汇总逻辑基本成立。

### 需要修正的部分

1. Claude Code token 总量不正确：cache creation/read 被完全忽略。
2. Claude Code cost 目前无法正确实现：缺少四通道 token 和 pricing。
3. Codex cost 目前无法正确实现：缺少 cached/reasoning/total 原始字段和 overlap 规则。
4. Codex 增量 token 写库不正确：`metricsDelta` 被解析但未用于 session totals。
5. Top models 对混合 model session 不准确。
6. Cost UI 和 capabilities 会误导用户，以为已有真实成本计算。
7. `today`/`30d` 的 UTC/rolling 语义需要在 UI 或文档中明确。

## 建议修复顺序

1. 扩展 usage 数据模型：
   - `inputTokens`
   - `outputTokens`
   - `cacheReadTokens`
   - `cacheWriteTokens`
   - `reasoningTokens`
   - `totalTokens`
   - `rawUsageJson`
   - `usageSemantics` 或 `sourceUsageKind`
2. Claude parser 改为读取四通道，并在 session totals 中至少保存完整 usage token；cost 层按 Anthropic input/output/cache write/cache read 分别计价。
3. Codex parser 保留五通道和 upstream `total_tokens`；展示总量优先用 upstream `total_tokens`，cost 层使用 overlap/billable 规则。
4. 修复增量写库：Codex token_count delta 应写入 session totals，或者把 token_count 事件归属到 turn/message usage 后再统一累加。
5. 将 top models 从 session-latest model 改成 message/turn/bucket 级归因，至少对 Codex 使用 `turn_context.model`。
6. 在真实 pricing 表完成前，移除或显式标注 `$2/MTok` 为 rough estimate，并把 Claude/OpenClaw capabilities 的 `cost` 调整为 false 或 partial。
7. 明确时间窗口：保留 `30d` 滚动窗口；若要自然月，新增独立 `month`，不要复用 `30d`。
