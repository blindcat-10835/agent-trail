---
type: feat
title: Copy Session ID
status: review
priority: p2
created: 2026-05-22
updated: 2026-05-22
branch:
worktree:
---

## Description

Add copy-to-clipboard functionality for session IDs in three locations:

1. **Session list page 主表格** (`components/sessions/sessions-list-page.tsx:161-163`) — 每行 session 显示完整 ID，改为带 Copy 图标的可点击按钮
2. **Sessions 页面右侧 rail row** (`components/sessions/sessions-right-rail.tsx:483`) — 显示 ID 后 8 位，改为带 Copy 图标的可点击按钮
3. **Session 详情页顶部 bar** (`components/replay/trace-thread.tsx:599-611`) — 在 `< 01 of n >` 翻 turn 控件左侧，显示 hash 前 8 位 + Copy 图标

Copy 图标在前，点击图标或 hash 区域都能复制完整 `session.id`，复制后图标切换为 `Check` 持续 2 秒。

注意：`replay-right-rail.tsx` 和 `turn-navigator.tsx` 是废弃组件（无引用），应删除。

## Acceptance criteria

- [ ] Session list page 主表格行的 ID 有 Copy 图标，可直接复制
- [ ] Sessions 右侧 rail row 的 ID 有 Copy 图标，可直接复制
- [ ] 详情页顶部 bar `< 01 of n >` 左侧显示前 8 位 hash + Copy 图标，可复制
- [ ] 三处复制后都显示 Check 图标 2 秒
- [ ] Session list page 和右侧 rail row 的 Copy 图标始终可见（opacity-50，不需 hover）
- [ ] 删除废弃组件 `replay-right-rail.tsx` 和 `turn-navigator.tsx`
