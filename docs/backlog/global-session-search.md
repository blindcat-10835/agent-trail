---
type: feat
title: Add Global Session Content Search
status: done
priority: p2
created: 2026-05-27
branch:
worktree:
---

## Description

希望支持一个“跨所有 session 的全局内容搜索”能力，优先给 agent 使用。目标很收敛：在不知道具体 session ID 的情况下，按消息正文直接找历史会话，并返回足够的 session 元数据，让 agent 能继续定位目标会话。

这次需求来自一个具体用例：想让 agent 借助本地 ingest 服务，找到“最近分析 GREE / 3632 价值”的 session。排查后确认，当前系统已经有两块相邻能力，但中间还缺一段：

- `http://localhost:3030/all/sessions` 里的搜索，会把 `q` 透传到各个 source 的 `GET /sessions`，再由前端聚合结果。
- ingest 的 `GET /api/v1/sessions` 目前只在 `name / project / id` 上做 `LIKE` 过滤，不搜索 messages 内容。
- ingest 已经有单个 session 的消息级搜索 `GET /api/v1/sessions/:id/search?q=...`，底层也有 FTS5，但它只能在已知 session ID 的前提下使用。

这意味着现在能靠标题或项目名找到像 “分析一下日经3632的价值” 这样的 session，但不能直接在全量历史里搜索消息正文关键词，例如 `gree`、`3632`、`valuation`、某段分析结论，来反向定位目标 session。

现阶段不需要把这个能力做成完整的前端产品能力，也不需要一口气加入总结、相关推荐、deep link 等增强功能。第一步只要提供一个风格和现有接口一致的全局搜索 API，让 agent 能拿到候选 session 列表即可。

排查现有代码后，前端 session 列表已经依赖并展示了下面这些字段：

- `source`
- `id`
- `sourceSessionId`
- `displayTitle` / `name`
- `project`
- `updatedAt`
- `summary`

所以新的全局搜索接口不需要重新发明结果结构，尽量直接复用现有 `TraceSession` 里的可用字段，再补一个命中 `snippet` 即可。

## Acceptance criteria

- [x] 提供一个跨 session 的搜索接口，支持按消息正文关键词检索 session 级结果，而不是只返回某条 message 命中。
- [x] 接口风格与现有 session/read API 保持一致，并适合后续经由 BFF 或 skill 被 agent 调用。
- [x] 搜索结果至少返回 `source`、`id/sessionId`、`sourceSessionId`、`displayTitle/title/name`、`project`、`updatedAt`，以及一个命中 `snippet`。
- [x] 同一个 session 在结果中只出现一次；基础排序和去重属于这个接口范围。
- [x] 支持最小必要的查询参数，例如 `q` 和结果条数上限；如果实现成本合理，可顺带支持 `source` 过滤。
- [x] 能覆盖本次用例：无需先知道 session ID，直接搜索 `gree` / `3632` 即可定位最近的 GREE 价值分析 session。
- [x] 明确和现有 `/all/sessions` 元数据搜索、`/sessions/:id/search` 会话内搜索之间的职责边界，并补充相应文档。

## Related

- `/all/sessions` 当前通过前端聚合各 source 的 session list 工作，不依赖单独的 `all/sessions` BFF 列表接口
- `ingest/api/sessions.ts`
- `ingest/api/search.ts`
- `components/sessions/sessions-list-page.tsx`
