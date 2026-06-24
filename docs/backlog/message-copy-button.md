---
type: feat
title: Add Per-Message Copy Button in Turn Replay
status: todo
priority: p3
created: 2026-06-05
branch:
worktree:
---

## Description

在 turn replay 视图（`trace-thread.tsx`）中，每条 human 和 AI 的消息都应有一键复制按钮，方便用户快速复制消息文本内容。

### 现状

- **`turn-card.tsx`**（用于 subagent 嵌套 turns）已实现 `CopyMessageButton`，hover 时显示，点击复制消息内容，2 秒 `Check` 反馈。
- **`trace-thread.tsx`**（主 replay 视图）的消息气泡（`v2-bubble user` / `v2-bubble asst`）**没有** per-message 复制按钮。用户如果想复制某条消息，只能手动选中文字。
- 项目已有可复用的 `SessionIdCopyButton`（`components/ui/session-id-copy-button.tsx`），设计精良（hover 显示、copied 反馈、error handling），可作为参考。

### 实现思路

1. `trace-thread.tsx` 内的 `TurnCard` 在每个 user bubble 和 assistant bubble 中加入复制 icon button
2. 样式：与现有设计语言一致 — 小型 icon button，hover 时出现（`opacity-0 group-hover:opacity-100`），使用 lucide `Copy` / `Check` 图标
3. 复制逻辑：`navigator.clipboard.writeText(content)`，与现有 `CopyMessageButton` 保持一致
4. 可选：提取 `CopyMessageButton` 为独立组件（目前定义在 `turn-card.tsx` 内部），两处共用

## Acceptance criteria

- [ ] 每条 user 消息气泡有复制按钮，hover 显示
- [ ] 每条 assistant 消息气泡有复制按钮，hover 显示
- [ ] 点击后复制消息纯文本到剪贴板，icon 切换为 `Check` 2 秒后恢复
- [ ] 复制按钮不干扰消息内容的阅读和选中
- [ ] 不影响 `turn-card.tsx` 中已有的复制功能
- [ ] Light / dark 主题下均正常显示
