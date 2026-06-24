---
type: fix
title: Dashboard Data Stale After Extended Idle
status: todo
priority: p1
created: 2026-05-30
branch:
worktree:
---

## Description

下载 agent-trail 后，长时间不打开 dashboard，再次打开时内容不会更新到最新状态。即使 ingest 服务一直在后台收集新数据，前端显示仍是旧的 session 列表和 activity。

可能的根因：

1. **SSE 连接在 tab 长时间后台时断开**，浏览器可能暂停或限流后台 tab 的 EventSource 连接，重新回到前台时没有自动重连。
2. **前端缺少 visibility change 监听** —— 当 `document.visibilityState` 从 `hidden` 变回 `visible` 时，没有触发数据重新拉取或 SSE 重连。
3. **BFF 代理或 ingest 端没有逐出过期连接**，旧连接可能处于半开状态。
4. **Zustand store 缓存没有过期机制** —— 数据在内存中无限期保留，不感知用户离开时间。

## Acceptance criteria

- [ ] Tab 从后台切回前台时自动触发数据刷新（或 SSE 重连）
- [ ] SSE 断开后具备指数退避自动重连
- [ ] 无明显抖动（短暂离开不应触发全量刷新，设置合理的 idle 阈值，如 >5 分钟）
- [ ] Ingest 服务端检测死连接并逐出
- [ ] 两端行为经过实际测试验证（Chrome tab 后台 >30 分钟后恢复）
