---
type: fix
title: Qoder cost is not extracted
status: done
priority: p2
created: 2026-05-21
branch: fix/qoder-cost-extraction
worktree: .worktree/fix-qoder-cost-extraction
updated: 2026-05-24
---

## Description

Qoder session 的 cost 字段没有取到，目前显示为空 / 0。

## Approach to investigate

- Qoder 原始数据里有没有 cost 字段？还是要从 credits 推算？
- 可以用消耗的 credits × 单价进行计算？需要确认 credit 单价规则
- 看看 `ingest/parser/qoder/` 里 cost 提取逻辑（如果有）

## Acceptance criteria

- [x] 找到 cost 数据源（原始字段或 credits 推算公式）
- [x] Parser 正确提取并写入 cost 字段
- [x] Dashboard 上 Qoder session 显示真实 cost

## Resolution

- Implemented calibrated Qoder token usage cost estimation in branch `fix/qoder-cost-extraction`.
- Implementation commit: `f1b70b0 fix(qoder): calibrate usage cost estimates`.
