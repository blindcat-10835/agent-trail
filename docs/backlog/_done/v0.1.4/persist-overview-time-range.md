---
type: feat
title: Persist Overview Time Range Across Source Switches
status: done
priority: p2
created: 2026-05-22
branch:
worktree:
---

## Description

在 Dashboard Overview 页面选择时间范围（today / 7d / 30d / all）后，切换到另一个 tool source 时，该选择应保持不变，不应重置回默认值。

当前行为：切换 source 后时间范围 reset。
期望行为：时间范围选择持久化，跨 source 切换保持一致。

## Acceptance criteria

- [ ] 选中 today/7d/30d/all 后切换 source，时间范围选择保持不变
- [ ] 时间范围存储在全局状态（Zustand store）而非局部组件状态
- [ ] 页面刷新可以不持久（session-level 即可），不要求写入 localStorage
