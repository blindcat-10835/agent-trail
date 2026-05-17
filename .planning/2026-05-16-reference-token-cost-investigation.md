# agentsview / vibeusage token 与 cost 计算调查

日期：2026-05-16

调查对象：

- `../references/agentsview`
- `../references/vibeusage`

目标：梳理两个 reference 项目分别如何从 Claude Code、Codex session 中归集 token，并如何估算 cost。

## 结论摘要

`agentsview` 是本地 SQLite 索引型实现：parser 把 Claude/Codex 的 usage 统一写进 `messages.token_usage`，usage 查询直接按 message 扫描、按模型价格表计算 cost。它保留 Claude 的四个 Anthropic 通道：`input_tokens`、`output_tokens`、`cache_creation_input_tokens`、`cache_read_input_tokens`；Codex 则先把 `cached_input_tokens` 从 `input_tokens` 里扣出来，转成 `cache_read_input_tokens`，从而复用同一套四通道公式。

`vibeusage` 是上传半小时聚合 bucket 的实现：本地 parser 只生成 `source/model/hour_start` 维度的 token bucket，后端 ingest 写入 `vibeusage_tracker_hourly`，usage API 再按 pricing profile 计算 cost。它为不同 source 维护不同的 `billable_total_tokens` 规则：Claude / OpenCode 用 `input + cached + output + reasoning`，Codex / Every-Code 用 `input + output + reasoning`，其中 Codex 的 cached input 不再额外加到 billable total；美元 cost 层再用 `overlap` 模式判断 cached/reasoning 是否已经包含在 input/output 中。

## agentsview

### Claude Code token 归集

入口是 `internal/parser/claude.go`。

- 读取 `~/.claude/projects/**/*.jsonl` 后，只保留 `type=user|assistant` 的消息记录；Claude 流式过程中会多次写同一个 `message.id`，parser 会折叠连续 assistant streaming snapshot，只保留最后一条，避免把逐步增长的 token usage 多算一次。证据：`collapseStreamingDuplicates` 在 `../references/agentsview/internal/parser/claude.go:241` 和 `../references/agentsview/internal/parser/claude.go:920`。
- 对 assistant 行读取：
  - `message.model`
  - `message.id`
  - `requestId`
  - `message.usage`
- `message.usage` 原样保存为 `ParsedMessage.TokenUsage`，同时派生：
  - `OutputTokens = output_tokens`
  - `ContextTokens = input_tokens + cache_creation_input_tokens + cache_read_input_tokens`
  - `HasContextTokens` 只要任一 input/cache 字段存在即为 true
  - 证据：`extractClaudeTokenFields`，`../references/agentsview/internal/parser/claude.go:1113`。
- session 级 token 不是重新 tokenization，而是从 message 显式 usage 聚合：
  - `TotalOutputTokens` = 有输出 token 的 message 的 `OutputTokens` 总和
  - `PeakContextTokens` = 各 message 的 `ContextTokens` 最大值
  - 证据：`accumulateMessageTokenUsage`，`../references/agentsview/internal/parser/types.go:527`。

### Codex token 归集

入口是 `internal/parser/codex.go`。

- Codex parser 读取 `event_msg` 中的 `payload.type == "token_count"`，取 `payload.info.last_token_usage`。如果 raw usage 与上一次完全相同则跳过，避免 streaming/重复事件重复计数。证据：`../references/agentsview/internal/parser/codex.go:183`。
- token usage 会挂到当前 turn 中最后一个尚未有 usage 的 assistant message；遇到 user message 边界就停止，避免跨 turn 归因。证据：`../references/agentsview/internal/parser/codex.go:199`。
- Codex 的字段会被转成 agentsview 的 Anthropic-style 通道：
  - `totalInput = input_tokens`
  - `cached = cached_input_tokens`
  - `uncached = max(totalInput - cached, 0)`
  - 保存为 `{"input_tokens": uncached, "output_tokens": output_tokens, "cache_read_input_tokens": cached}`
  - `ContextTokens = uncached + cached`
  - 证据：`applyCodexTokenUsage`，`../references/agentsview/internal/parser/codex.go:214`。
- 从代码看，agentsview 的 Codex parser 没有单独保存 `reasoning_output_tokens`，也没有使用 Codex 的 `total_tokens`。如果上游 `output_tokens` 已经包含 reasoning，才会体现在 output 通道中。

### agentsview cost 计算

成本计算在 `internal/db/usage.go`。

- 参与 usage/cost 的 message 条件是 `m.token_usage != ''`、`m.model != ''`、`m.model != '<synthetic>'`，且 session 未删除。证据：`usageMessageEligibility`，`../references/agentsview/internal/db/usage.go:118`。
- `GetDailyUsage` 扫描 message 的 `token_usage` JSON，按本地日期 bucket 聚合。证据：`../references/agentsview/internal/db/usage.go:272`。
- Claude 相关去重发生在查询阶段：如果 `claude_message_id` 与 `claude_request_id` 都存在，则按 `(message_id, request_id)` 去重；去重在日期过滤之后做，避免时区 padding 拉进来的范围外记录抢占 key。证据：`../references/agentsview/internal/db/usage.go:407`。
- 价格公式统一为：

```text
cost =
  (input_tokens * input_rate
 + output_tokens * output_rate
 + cache_creation_input_tokens * cache_creation_rate
 + cache_read_input_tokens * cache_read_rate) / 1_000_000
```

证据：`../references/agentsview/internal/db/usage.go:426`。

- `TopSessionsByCost` 使用同一套 eligibility、Claude 去重和四通道公式；`TotalTokens` 是四个通道直接相加。证据：`../references/agentsview/internal/db/usage.go:755` 和 `../references/agentsview/internal/db/usage.go:892`。
- 价格来源：
  - 首选 LiteLLM 的 `model_prices_and_context_window.json`，把 per-token rate 转成 USD / million tokens。证据：`../references/agentsview/internal/pricing/litellm.go:11`。
  - 启动时先写 fallback pricing，再后台刷新 LiteLLM；CLI usage 查询也会先拉 LiteLLM，失败才 fallback。证据：`../references/agentsview/cmd/agentsview/usage.go:282` 和 `../references/agentsview/cmd/agentsview/usage.go:319`。
  - fallback 中 Claude 模型有 cache creation/read 价格，Codex/OpenAI 模型只有 input/output 价格；因此在离线 fallback 下，Codex cached input 如果被转成 `cache_read_input_tokens`，其 cache read 价格为 0。证据：`../references/agentsview/internal/pricing/fallback.go:34`。

## vibeusage

### Claude Code token 归集

主流程在 `src/lib/rollout.js` 的 `parseClaudeFile`。

- 读取 Claude JSONL 行中的 `message.usage` 或顶层 `usage`。证据：`../references/vibeusage/src/lib/rollout.js:795`。
- 使用 `message.id || requestId` 做 dedupe，cursor 中最多保留最近 500 个 seen id，避免 Claude Code 同一 assistant response 多次写入导致重复计数。证据：`../references/vibeusage/src/lib/rollout.js:836`。
- `normalizeClaudeUsage` 的通道转换：
  - `input_tokens = input_tokens + cache_creation_input_tokens`
  - `cached_input_tokens = cache_read_input_tokens`
  - `output_tokens = output_tokens`
  - `reasoning_output_tokens = 0`
  - `total_tokens = upstream total_tokens`，若上游没有则 `input + cached + output`
  - 证据：`../references/vibeusage/src/lib/rollout.js:2346`。
- 归集粒度是 UTC 半小时 bucket：`source/model/hour_start`，不是 session row。证据：`../references/vibeusage/src/lib/rollout.js:852`。
- audit strategy 会递归扫描 Claude 主 session 与 subagent session，因为 subagent 也会消耗真实 Anthropic token。证据：`../references/vibeusage/src/lib/ops/sources/claude.js:12`。

一个重要差异：vibeusage 把 Claude `cache_creation_input_tokens` 合并进普通 `input_tokens`，后端 pricing profile 没有单独的 cache creation rate 通道，因此 cache creation 在 cost 层按普通 input rate 计价，而不是按 Anthropic 的 cache write surcharge 单独计价。

### Codex token 归集

主流程在 `src/lib/rollout.js` 的 `parseRolloutFile`。

- Codex session 文件来自 rollout JSONL；parser 关心两类记录：
  - `turn_context` / `session_meta`：更新当前 model / cwd
  - `token_count`：读取 `payload.info.last_token_usage` 与 `payload.info.total_token_usage`
  - 证据：`../references/vibeusage/src/lib/rollout.js:709`。
- `pickDelta` 负责从 `last_token_usage` 或累计 `total_token_usage` 中得到本次 delta：
  - 如果当前 `total_token_usage` 与 cursor 里的上一份 total 相同，跳过，避免重复 token_count 行重复计数。
  - 如果有 `last_token_usage`，优先使用它。
  - 如果没有 last，但有当前 total 与历史 total，则逐字段做差。
  - 如果 total 回退，视为 reset，使用当前 total。
  - 证据：`../references/vibeusage/src/lib/rollout.js:2286`。
- `normalizeUsage` 保留五个通道：`input_tokens`、`cached_input_tokens`、`output_tokens`、`reasoning_output_tokens`、`total_tokens`。证据：`../references/vibeusage/src/lib/rollout.js:2331`。
- Codex audit strategy 明确指出：Codex 的 `input_tokens` 已包含 cached input，`output_tokens` 已包含 reasoning output，直接把五个通道相加会 double count；权威总量是 upstream `total_tokens`。证据：`../references/vibeusage/src/lib/ops/sources/_rollout-base.js:14`。

### vibeusage ingest 与 billable token

后端 ingest 在 `insforge-src/shared/core/ingest.mjs`。

- 上传 bucket 必须是 UTC 半小时边界，五个 token 字段都必须是非负整数。证据：`parseHourlyBucket`，`../references/vibeusage/insforge-src/shared/core/ingest.mjs:112`。
- 写入 hourly row 时会计算并保存 `billable_total_tokens`。证据：`../references/vibeusage/insforge-src/shared/core/ingest.mjs:222`。
- `billable_total_tokens` 的 source 规则在 `usage-metrics-core.js`：
  - Claude / OpenCode：`input + cached + output + reasoning`
  - Codex / Every-Code：`input + output + reasoning`，显式排除 cached input
  - Gemini：`total_tokens`
  - unknown：优先 `total_tokens`
  - 证据：`../references/vibeusage/insforge-src/shared/usage-metrics-core.js:3` 和 `../references/vibeusage/insforge-src/shared/usage-metrics-core.js:31`。

注意：`billable_total_tokens` 是 token 排名/汇总口径，不等同于美元 cost。美元 cost 还要走 pricing profile。

### vibeusage cost 计算

成本计算在 `insforge-src/shared/pricing-core.js` 与 `usage-pricing-core.js`。

- pricing profile 来自后端表：
  - `vibeusage_pricing_model_aliases`
  - `vibeusage_pricing_profiles`
  - 会按 effective date 与 model alias 解析。证据：`../references/vibeusage/insforge-src/shared/pricing-core.js:122`。
- 如果不能查库，fallback default profile 是 `gpt-5.2-codex` / `openrouter`，默认 rates 是 micro USD per million token：input 1.75 USD/MTok、cached input 0.175 USD/MTok、output/reasoning 14 USD/MTok。证据：`../references/vibeusage/insforge-src/shared/pricing-core.js:7`。
- `computeUsageCost` 先判断 `pricing_mode`：
  - `add`：按 `input + cached + output + reasoning` 四通道分别计价。
  - `overlap`：如果 `total_tokens` 更接近 `input + output`，且 `cached <= input`、`reasoning <= output`，则认为 cached/reasoning 与 input/output 有重叠；计价为 `input - cached` 的普通 input、`cached` 的 cached input、`output` 的 output，不再另计 reasoning。
  - 证据：`../references/vibeusage/insforge-src/shared/pricing-core.js:215`。
- 这个 `overlap` 模式主要是在处理 Codex 这种通道语义时有意义：Codex 的 `input_tokens` 可能已经包含 cached input，`output_tokens` 可能已经包含 reasoning output。

## 差异对照

| 维度 | agentsview | vibeusage |
| --- | --- | --- |
| 本地数据模型 | message/session 级 SQLite 索引 | UTC 半小时 usage bucket |
| Claude 去重 | parser 折叠连续 streaming duplicate；query 阶段按 `(message.id, requestId)` 去重 | parser/cursor 按 `message.id || requestId` 去重，保留最近 500 个 seen id |
| Claude cache creation | 独立保留 `cache_creation_input_tokens`，按 cache creation rate 计价 | 合并进 `input_tokens`，无单独 cache creation cost 通道 |
| Claude cache read | 独立保留 `cache_read_input_tokens`，按 cache read rate 计价 | 转为 `cached_input_tokens`，按 cached input rate 计价 |
| Codex input/cached | `input_tokens` 扣掉 cached，cached 转成 `cache_read_input_tokens` | 保留 upstream 五通道，靠 billable/pricing overlap 规则避免 double count |
| Codex total_tokens | parser 不使用 | 保留并视为权威总量之一 |
| reasoning_output_tokens | 未单独处理 | 保留；Codex billable 会计入 reasoning，美元 cost 可通过 overlap 模式避免与 output 重复计价 |
| pricing 来源 | LiteLLM 价格表 + fallback + custom override | 后端 pricing profiles / aliases + default OpenRouter profile |
| cost 计算时机 | 本地查询时直接计算 | usage API 聚合时按 profile 计算 |

## 对本项目的启发

如果 `agents-tracing-dashboard` 要实现 token/cost：

1. Claude Code 可以采用 agentsview 的四通道模型，因为它最贴近 Anthropic usage 语义，能正确区分 cache write 与 cache read。
2. Codex 不应直接把 `input_tokens + cached_input_tokens + output_tokens + reasoning_output_tokens` 当成总量；需要先确认 Codex 当前 JSONL 中这些通道是否互相包含。vibeusage 的经验是把 upstream `total_tokens` 作为权威总量，并在 cost 层使用 overlap 规则。
3. 若目标是“按 session 展示 cost”，agentsview 的 message 级归因更适合；若目标是“同步到远端排行榜/趋势”，vibeusage 的半小时 bucket 更适合。
4. 对本地 dashboard 而言，建议保留 provider 原始 usage JSON，同时派生 canonical 字段。这样后续可以同时支持：
   - Claude 四通道精确 cost
   - Codex overlap/billable 规则
   - UI 中展示 raw provider totals 与 normalized totals 的差异
