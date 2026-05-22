---
type: feat
title: Copy Session ID
status: done
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

Copy 图标在前，点击图标或 hash 区域都能复制 session ID，复制后图标切换为 `Check` 持续 2 秒。
当 source-specific 原始 ID 存在时，UI 优先显示并复制 `sourceSessionId`，回退到内部 canonical `id`。

## Acceptance criteria

- [x] Session list page 主表格行的 ID 有 Copy 图标，可直接复制
- [x] Sessions 右侧 rail row 的 ID 有 Copy 图标，可直接复制
- [x] 详情页顶部 bar `< 01 of n >` 左侧显示前 8 位 hash + Copy 图标，可复制
- [x] 三处复制后都显示 Check 图标 2 秒
- [x] Session list page 和右侧 rail row 的 Copy 图标始终可见（opacity-50，不需 hover）
- [x] 当 `sourceSessionId` 存在时，优先显示并复制原始 source session id
