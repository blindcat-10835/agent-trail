---
type: fix
title: Session List Search and Sort Broken
status: done
priority: p2
created: 2026-05-21
updated: 2026-05-22
branch: fix/session-list-search
worktree: .worktree/fix-session-list-search
---

## Description

Session 列表页有两个问题，计划一起修复。

### 1. 搜索字段范围太宽，需要收窄

**现状（已确认）：** `ingest/api/sessions.ts:205–220` 的 `q` 参数目前匹配：

1. `s.name` — session 名称 ✅ 保留
2. `s.project` — 项目路径 ✅ 保留
3. `s.id` — session ID ✅ 保留
4. `s.git_branch` — git 分支名 ❌ 去掉（不在搜索范围内）
5. `messages.content` (user + assistant) — 消息全文 ❌ 去掉（慢、结果意外）

**期望：** 搜索只命中 **session 名称、project 名、session ID** 三个字段。去掉 git_branch 和消息全文匹配。

**搜索覆盖范围（已确认）：** 搜索是服务端过滤，`q` 参数直接传入 SQL WHERE，命中所有已扫描的 session，不受已加载条数限制。前端只是发了带 `q` 的请求，结果集是服务端全量匹配的。✅ 不需要额外修改覆盖逻辑。

### 2. 排序不覆盖全量 session（仅限已加载页）

**现状（已确认）：** 排序在服务端做（SQL `ORDER BY`），但 `limit=100` 导致只排序了第一批结果。用户按 cost/token/turns 排序时，看到的"第一名"实际只是前 100 条里的第一名，后续页的 session 可能更高。

**本质问题：** 前端 `loadMore` 是往已有列表 append，而不是重新请求一个全局排好序的大列表。排序只在已加载的数据集内有意义。

**期望：** 按指标字段排序时，应该保证看到全局最高/最低值，即按排序字段拉取足够多的数据，或者通过某种方式提示用户当前排序只在已加载数据上生效。

**可能的修复方向：**
- 方案 A：排序时自动增大 limit（如 `limit=1000`），覆盖绝大多数场景
- 方案 B：在 UI 上加提示"排序仅在已加载的 N 条内生效，点击 LOAD MORE 获取更多"
- 方案 C：排序切换时重置 offset 并重新 fetch 全量（可能太重）

## 文件位置

| 文件 | 内容 |
|---|---|
| `ingest/api/sessions.ts:205–220` | 服务端 `q` 参数搜索逻辑（需收窄字段） |
| `components/sessions/sessions-list-page.tsx:208–219` | 前端 query 组装，`q` 传入 server |
| `lib/agent-tools/client-hooks.tsx:471–472` | `buildSessionsQuery`，默认 `limit: '100'` |
| `lib/agent-tools/client-hooks.tsx:621–641` | `loadMore` — append 模式，不重排 |

## Acceptance criteria

- [ ] 搜索：去掉 `git_branch` 和 `messages.content` 匹配，仅保留 `name`、`project`、`id`
- [ ] 搜索：用 session 名的部分关键字、project 路径片段、或 session ID 前缀均能可靠命中
- [ ] 搜索：确认搜索覆盖全部已扫描 session（不仅是当前已加载的条数）
- [ ] 排序：选择方案 A/B/C 之一，保证按 cost/token/turns 排序时结果有实际意义
- [ ] 排序：null/缺失值的 session 排到末尾，不影响有数据的排序结果
