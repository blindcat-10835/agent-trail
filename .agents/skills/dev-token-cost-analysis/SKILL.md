---
name: dev-token-cost-analysis
description: 分析 agent-trail 中 skill 和 tool call 的 token 消耗情况的评估方法。用于估算每个技能调用或工具调用消耗了多少 token（输入/输出/缓存），按 session 级别 token 数据分摊到各 tool call。
---

# Token Cost Analysis for Skills & Tool Calls

agent-trail 目前的 token 数据在三个层级存在，精度不同：

| 层级 | 数据位置 | 精度 | 可用性 |
|------|----------|------|--------|
| Session | `sessions.total_tokens`, `sessions.total_input_tokens`, `sessions.total_output_tokens` | 精确 | ✅ 有数据（~195M tokens） |
| Message | `messages.token_usage_json` | 精确 | ⚠️ 大部分为 0 |
| Tool Call | 无 | 无 | ❌ 不存储 |

## 分摊估算方法

因为没有 tool call 粒度的 token 记录，必须用 session 级别数据做分摊：

### 方法 1：按调用次数均摊（最简单）

```
skill_token_share = session_total_tokens * (skill_call_count / total_tool_calls_in_session)
```

- 优点：简单，可实时计算
- 缺点：假设每个 tool call 消耗相同 token（不准确——read 远小于 write）

### 方法 2：按耗时加权分摊（推荐）

```
tool_weighted_share = session_total_tokens * (tool_duration_ms / total_duration_ms_of_session)
```

- 优点：耗时长的调用（如 large edit）分到更多 token，更接近真实
- 缺点：不完全是线性关系

### 方法 3：按 message 级别精确分摊（最精确，但数据有限）

当 `messages.token_usage_json` 有非零值时：
1. 找到 tool call 所在的 message (`tool_calls.message_ordinal = messages.ordinal`)
2. 用该 message 的 token 值（如果一条消息有多个 tool call，均分）
3. 回退到方法 2

## 实现方案

在现有 stats API 端点基础上，额外返回估算的 token 消耗：

```typescript
// GET /api/v1/sessions/skills-stats 的增强响应
interface SkillStatWithTokens extends SkillStat {
  estimated_input_tokens: number
  estimated_output_tokens: number
  estimated_cache_read_tokens: number
  estimated_total_tokens: number
  estimation_method: 'weighted' | 'equal' | 'exact'
}
```

SQL 实现（按耗时加权）：

```sql
WITH session_totals AS (
  SELECT
    tc.session_id,
    s.total_input_tokens,
    s.total_output_tokens,
    s.total_cache_read_tokens,
    s.total_tokens,
    SUM(tc.duration_ms) as session_duration
  FROM tool_calls tc
  JOIN sessions s ON s.id = tc.session_id
  GROUP BY tc.session_id
)
SELECT
  json_extract(tc.input_json, '$.name') as skill_name,
  COUNT(*) as total_calls,
  -- 按耗时加权估算 token
  COALESCE(SUM(
    CASE WHEN st.session_duration > 0
      THEN CAST(st.total_input_tokens AS REAL) * tc.duration_ms / st.session_duration
      ELSE 0
    END
  ), 0) as estimated_input_tokens,
  COALESCE(SUM(
    CASE WHEN st.session_duration > 0
      THEN CAST(st.total_output_tokens AS REAL) * tc.duration_ms / st.session_duration
      ELSE 0
    END
  ), 0) as estimated_output_tokens
FROM tool_calls tc
JOIN session_totals st ON st.session_id = tc.session_id
WHERE tc.name = 'skill'
GROUP BY skill_name
```

## 数据质量说明

| 数据源 | token 数据质量 | 原因 |
|--------|---------------|------|
| OpenCode | 完整 | session 级 token 齐全 |
| Claude Code | 完整 | session 级 token 齐全 |
| OpenClaw | 部分 | gateway session 有，local 不一定 |
| Codex | 不完整 | 部分 session 无 token |
| Qoder | 不完整 | 仅 total_tokens 有值，input/output 分离 |

## 使用建议

1. 标注 `estimated_` 前缀，前端展示时加 `~` 或 `EST.` 标记
2. 提供 `estimation_method` 字段让 UI 知道数据可信度
3. 对于 `total_tokens = 0` 的 session，完全跳过分摊（不产出估算值）
4. 考虑加一个 `confidence` 评分：1.0 = exact message-level，0.7 = weighted，0.3 = equal-share
