type: feat
title: Add Agent Session Search Skill
status: todo
priority: p2
created: 2026-05-27
branch:
worktree:

## Description

希望在全局 session 搜索接口落地之后，再补一个 agent/skill 层的接入能力，教导 agent 如何稳定地使用这个程序来检索本地历史会话。

这个需求比 `global-session-search` 更高一层。后者解决的是“跨 session 的消息全文搜索”这个底层 primitive；这个条目关注的是接口有了之后，agent 侧应该如何调用、如何挑选候选、以及何时继续下钻到 messages / turns。

- “帮我找最近分析 GREE 价值的 session”
- “最近有没有讨论过某个公司/bug/需求”
- “告诉我应该打开哪个 source、哪个 sessionId”

当前先不把过多增强能力塞进 ingest 本身。你已经明确排除了下面这些暂时不必要的范围：

- 检索结果内置快速总结
- deep link / 下钻入口编排
- 相关 session 推荐
- 一整套复杂过滤器

所以这个 backlog 的范围应该收敛为：在全局搜索接口存在后，沉淀一个明确的 agent 使用方式，例如 skill、说明文档或调用约定。它解决的是“agent 怎么用”，不是“ingest 再多长几个能力”。

比较合适的形态可能是：

- 一个 skill，告诉 agent 先调用全局搜索接口拿候选 session
- 再根据返回的 `source + sessionId` 去调用现有详情 / messages / turns 接口
- 必要时再在 agent 侧自己做总结，而不是要求 ingest 一步到位产出总结

## Acceptance criteria

- [ ] 在 `global-session-search` 可用后，提供一个 agent-facing 的使用约定或 skill，说明如何检索本地 sessions。
- [ ] 该约定明确第一步用全局搜索接口找候选，第二步用现有 session detail / messages / turns 接口继续读取。
- [ ] 至少覆盖本次核心用例：agent 可以找到相关 session，并向用户返回 `source`、`sessionId`、标题、项目、更新时间。
- [ ] 明确哪些事情由 ingest API 负责，哪些事情由 agent/skill 自己编排，避免再次把增强能力误塞回底层接口。
- [ ] 与 `global-session-search` 的关系被说明清楚：前者偏 agent 使用方式，后者偏底层搜索 primitive。

## Related

- [global-session-search.md](/Users/ebbi/Work/ai-dashboard-projects/agents-tracing-dashboard/docs/backlog/global-session-search.md)
- `ingest/api/sessions.ts`
- `ingest/api/search.ts`
- `app/(tool-shell)/[tool]/sessions/`
- `.agents/skills/`
