---
type: feat
title: Make Refresh Button More Prominent
status: todo
priority: p2
created: 2026-05-27
branch:
worktree:
---

## Description

右上角的刷新按钮（`shell-header.tsx`）目前是一个 28x28px 的小方块，用纯文本符号 `↻` / `⟳` 表示，和 ThemeToggle、RightRail toggle 挤在一起，辨识度很低。

当前实现（`components/shell/shell-header.tsx:67-74`）：

- 28x28px `hud-clip-sm` 按钮
- 非图标，用文本符号 `↻`（静态）和 `⟳`（syncing）
- 与 ThemeToggle、RightRail toggle 视觉权重相同，没有突出
- 无文字标签，纯 icon 容易被忽略

sessions right rail 里也有一个类似的刷新按钮（`sessions-right-rail.tsx:295-303`），用 `RefreshCw` lucide icon + 11px 尺寸，同样很小。

## Acceptance criteria

- [ ] 刷新按钮视觉权重明显高于旁边的 ThemeToggle / RightRail toggle
- [ ] 使用 lucide `RefreshCw` 图标代替文本符号，尺寸合理（至少 16px）
- [ ] syncing 状态有明显的旋转动画和/或颜色反馈
- [ ] header 和 right rail 的刷新按钮风格统一
- [ ] hover / focus 状态有清晰反馈
