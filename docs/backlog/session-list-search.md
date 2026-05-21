---
type: fix
title: Session List Search and Sort Broken
status: todo
priority: p2
created: 2026-05-21
updated: 2026-05-22
branch:
worktree:
---

## Description

Session 列表页有两个问题，计划一起修复：

### 1. 搜索不正常

搜索框工作得不好。需要先确认具体表现：

- 是搜不到结果？
- 还是搜结果不对（匹配规则有问题）？
- 还是性能慢 / 延迟？

### 2. 排序不正常

当前按 token、cost、title、turns 排序无法真正对所有 session 生效。可能原因：

- 排序只在当前页/已加载数据上做客户端排序，而不是全量排序
- 排序字段数据缺失（某些 session 的 token/cost 为 null/0，排序结果混乱）
- 排序状态与数据加载顺序不同步

## Approach to investigate

**搜索：**
- 找到 session 列表搜索的实现（搜 `app/(tool-shell)/[tool]/sessions/`）
- 当前匹配是 title? id? content?
- 期望匹配范围：title、project 名、message 内容片段？

**排序：**
- 找到排序逻辑所在位置（store? component? API query param?）
- 确认排序是客户端还是服务端
- 检查 token/cost/turns 字段的数据完整性

## Acceptance criteria

- [ ] 搜索：列出当前匹配行为并跟期望对齐
- [ ] 搜索：修复后能可靠地用部分关键字找到 session
- [ ] 排序：按 title / turns / token / cost 排序能对全部 session 生效
- [ ] 排序：null/缺失值的 session 排到末尾，不影响有数据的排序结果
