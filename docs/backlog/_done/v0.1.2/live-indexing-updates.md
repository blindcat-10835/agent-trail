---
type: feat
title: Live Data Updates During Indexing
status: done
priority: p2
created: 2026-05-22
updated: 2026-05-22
branch: feat/live-indexing-updates
worktree: .worktree/feat-live-indexing-updates
---

## Description

初次加载数据库时，ingest 服务尚未完成全量索引，前端显示的统计数值（session 数量、token 用量、cost 等）是不完整的。目前只有手动刷新页面才能看到最新数据。

应通过已有的 SSE 端点（ingest 服务已有 SSE 基础设施）将索引进度/数据变更推送到前端，让 dashboard 和 sessions 列表在不刷新的情况下自动更新数值。

## Acceptance criteria

- [x] 前端订阅 SSE 事件，indexing 期间数值变化时自动刷新相关数据（KPI、session 列表等）
- [x] 可选：显示一个 indexing 进度指示器（如 loading bar 或 "Indexing..." chip），让用户感知到数据还在变化中
- [x] 索引完成后指示器消失，数值稳定
- [x] 不影响已完成索引时的正常加载性能（无多余轮询）
- [x] 多 source（OpenClaw、Claude Code、Codex）均支持

## Notes

ingest 服务已有 SSE 支持（`ingest/src/`），BFF 代理路由在 `app/api/agent-tools/[tool]/`。前端目前有 Zustand store，可以在 SSE 事件触发时 invalidate 或 patch store 数据。

优先复用现有 SSE 基础设施，不要引入 WebSocket 或额外轮询。

## Related

- Ingest SSE 基础设施: `ingest/src/`
- BFF 代理: `app/api/agent-tools/[tool]/`
- Zustand stores: `stores/`
