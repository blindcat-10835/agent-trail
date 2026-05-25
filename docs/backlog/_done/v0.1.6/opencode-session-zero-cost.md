---
type: fix
title: OpenCode Sessions Show Zero Cost
status: done
priority: p1
created: 2026-05-25
updated: 2026-05-25
branch: fix/opencode-session-zero-cost
worktree: .worktree/fix-opencode-session-zero-cost
---

## Description

部分 OpenCode session 在 dashboard 上显示的 cost 为 $0，即使这些 session 有 token 使用量。

当前 parser 在 `ingest/parser/opencode.ts:713` 从 `sessionRow.cost` 读取 `sourceCostUsd`。当 opencode 的 JSONL 中 `cost` 字段为 `null` 或不存在时，`sourceCostUsd` 为 null，cost 显示为 $0。但 session 实际有 token 消耗（`totalTokens > 0`）。

需要排查的场景：

1. **opencode JSONL 中 `cost` 字段缺失或为 null** — provider 没有返回价格信息（例如某些免费模型或自定义 endpoint）
2. **opencode JSONL 中 `cost` 字段为 0** — 被标记为 `reported_zero`，但可能实际有消耗
3. **不同 provider 的价格数据不全** — opencode 的 cost 依赖 provider 返回的价格，部分 provider 可能不返回

可能的修复方向：

- 对于 `sourceCostUsd` 为 null 但有 token 使用量的 session，使用 token-based 估算（类似 qoder 的 calibrated estimate）
- 在 UI 上对 `reported_zero` / `null` cost 的 session 显示"价格未知"而非 $0，避免误导
- 区分"无价格数据"和"实际免费"两种情况

## Acceptance criteria

- [ ] 确认 opencode JSONL 中 cost 字段缺失/为 null/为 0 的具体场景和频率
- [ ] 有 token 使用量但无价格的 session 不再显示误导性的 $0
- [ ] UI 能区分"免费 session"和"价格未知 session"
