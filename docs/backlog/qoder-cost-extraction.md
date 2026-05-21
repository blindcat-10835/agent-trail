---
type: fix
title: Qoder cost is not extracted
status: todo
priority: p2
created: 2026-05-21
branch:
worktree:
---

## Description

Qoder session 的 cost 字段没有取到，目前显示为空 / 0。

## Approach to investigate

- Qoder 原始数据里有没有 cost 字段？还是要从 credits 推算？
- 可以用消耗的 credits × 单价进行计算？需要确认 credit 单价规则
- 看看 `ingest/parser/qoder/` 里 cost 提取逻辑（如果有）

## Acceptance criteria

- [ ] 找到 cost 数据源（原始字段或 credits 推算公式）
- [ ] Parser 正确提取并写入 `turn_metrics` 表
- [ ] Dashboard 上 Qoder session 显示真实 cost
