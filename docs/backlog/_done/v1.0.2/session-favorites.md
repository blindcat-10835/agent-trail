---
type: feat
title: Session Favorites
status: done
priority: p3
created: 2026-05-22
updated: 2026-05-22
branch: feat/session-favorites
worktree: .worktree/feat-session-favorites
---

## Description

在 session 详情页面提供收藏功能，让用户可以标记某个 session 为"已收藏"，方便后续快速找回重要的 session。

收藏状态应持久化（本地存储或 ingest DB），并在 sessions 列表页提供过滤入口（"只看收藏"）。

## Acceptance criteria

- [ ] Session 详情页顶部/标题区域有收藏按钮（星形图标），点击切换收藏状态
- [ ] 收藏状态在刷新后保持（持久化）
- [ ] Sessions 列表页支持按收藏过滤（filter chip 或 toggle）
- [ ] 收藏状态在 light/dark 两个主题下样式正常，WCAG AA 对比度
- [ ] 各 source（OpenClaw、Claude Code、Codex）均支持

## Related

- Sessions 列表页: `app/(tool-shell)/[tool]/sessions/`
- Session 详情页: `app/(tool-shell)/[tool]/sessions/[sessionId]/`
