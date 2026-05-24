---
type: feat
title: Daily Token Rollups
status: done
priority: p1
created: 2026-05-24
updated: 2026-05-25
branch:
worktree:
---

## Description

当前 overview 的 `TODAY` token 统计按 session `started_at` 归因，导致跨天继续使用的 Codex session 被漏算；如果改成 last activity 又会把整个 session 累计 token 归到最后一天，造成严重高估。

需要在 ingest 层建立跨 source 的日级 token rollup：优先使用事件级 token usage 的 timestamp 归因；没有事件级 usage 的 source 使用 session 级汇总按最合理的时间锚点归因。overview 的 daily tokens 和 today token 展示应读取该 rollup，而不是直接按 session `started_at` 聚合。

## Acceptance criteria

- [x] Codex `token_count.last_token_usage` 按事件 timestamp 写入日级 token rollup。
- [x] Claude Code / OpenClaw / OpenCode / Qoder 在没有事件级 usage 时有一致的 session-level fallback 归因。
- [x] `/api/v1/overview/daily-tokens` 使用日级 rollup 返回 token series。
- [x] `window=today` 的 aggregate token 字段与 daily rollup 的当天值一致。
- [x] 刷新后新写入的 token rollup 能被 overview 查询到。
- [x] 增加覆盖跨天 session 的回归测试。
