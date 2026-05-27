---
quick_id: 260527-rhm
slug: complete-backlog-item-docs-backlog-globa
status: executing
created: 2026-05-27
---

# Quick Task: Global Session Content Search

## Goal

补齐“跨所有 session 的消息正文搜索”缺口，让 agent 在不知道 session ID 的前提下，直接按消息内容关键词反查候选会话。

## Scope

1. 在 ingest 新增全局 session 内容搜索接口，返回去重后的 session 级结果和命中 snippet。
2. 在 Next.js BFF 新增对应代理接口，支持 `all` 作用域和按 source 的工具作用域。
3. 补充 targeted tests，覆盖路由行为、去重、source 过滤和基础参数校验。
4. 更新 API / data-flow / ingest 服务文档，并明确与 metadata 搜索、session 内搜索的职责边界。
5. 回写 backlog 状态与 quick task summary / STATE 记录。

## Out Of Scope

- 不做新的 sessions 页面 UI。
- 不做 deep link、相关推荐、总结聚合。
- 不改现有 `/api/v1/sessions?q=...` 的 metadata 搜索语义。

## API Shape

- Ingest: `GET /api/v1/sessions/search?q=...&limit=...&source=...`
- BFF: `GET /api/agent-tools/[tool]/sessions/search?q=...&limit=...`
- 返回字段至少包含：`id`、`sessionId`、`source`、`sourceSessionId`、`displayTitle`、`name`、`project`、`updatedAt`、`summary`、`snippet`

## Verification

- `pnpm test:run ingest/api/search.test.ts tests/unit/bff/session-search-route.test.ts`
- `pnpm typecheck`
- `git diff --check`
