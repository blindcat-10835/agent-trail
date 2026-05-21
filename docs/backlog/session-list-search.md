---
type: fix
title: Session list search does not work well
status: todo
priority: p2
created: 2026-05-21
branch:
worktree:
---

## Description

Session 列表页的搜索框工作得不好。需要先确认具体表现：

- 是搜不到结果？
- 还是搜结果不对（匹配规则有问题）？
- 还是性能慢 / 延迟？

## Approach to investigate

- 找到 session 列表搜索的实现（搜 `app/(tool-shell)/[tool]/sessions/`）
- 当前匹配是 title? id? content?
- 期望匹配范围：title、project 名、message 内容片段？

## Acceptance criteria

- [ ] 列出当前匹配行为
- [ ] 跟期望对齐
- [ ] 修复后能可靠地用部分关键字找到 session
