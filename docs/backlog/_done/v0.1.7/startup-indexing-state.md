---
type: feat
title: Surface Indexing State During Ingest Startup Sync
status: done
priority: p2
created: 2026-06-24
updated: 2026-06-25
branch: feat/startup-indexing-state
worktree:
---

## Description

启动 `pnpm dev`(或生产首启)后,ingest 会跑一轮全量 startup sync。对大 corpus 来说这段很长 —— 实测仅 claude-code 一次 `startup` 同步就耗 ~69s(712 文件、解析 310、写入 14376 条 message)。

ingest 用 better-sqlite3(同步、单线程),sync 期间 HTTP 事件循环被解析任务饿死,`/api/v1/sessions` 等查询排不上队。而 BFF 对每个 ingest 请求只有 5s 超时(`lib/agent-tools/server-adapter.ts:192` `INGEST_FETCH_TIMEOUT_MS = 5_000`),超时被 `sanitizeError` 转成 **504 "Ingest service is still indexing. Retry shortly."**(`server-adapter.ts:166-167`)。

结果:冷启动那 ~1 分钟里,前端 session 列表刷一片 504,看起来像服务挂了,实际只是还在建索引,sync 完成后自动恢复(已验证:索引完成后各端点 200 / 0.02–0.2s)。

**目标**:把这段从"超时报错"变成"明确的 indexing 中"状态 —— 后端已有 `/health` 暴露 `ready` / `sync.phase` / `startupComplete` 等字段可用,前端应据此给出"正在建立索引,请稍候"的友好提示并自动重试,而不是抛 504。

## Acceptance criteria

- [ ] 启动 startup sync 期间,session 列表页显示明确的 "indexing / 正在建立索引" 状态,而非 504 错误
- [ ] indexing 完成后前端自动恢复(轮询 `/health` 的 `ready`/`startupComplete`,或对 504 "still indexing" 自动重试),无需手动刷新
- [ ] 区分"indexing 中的 504"与"ingest 真正不可达的 502",两者前端表现不同
- [ ] light/dark 双主题下该状态样式都验证过

## Related

- `lib/agent-tools/server-adapter.ts` — `INGEST_FETCH_TIMEOUT_MS`、`sanitizeError` 里的 "still indexing" 504 分支
- `lib/ingest-url.ts` — ingest base url 解析
- ingest `/health` 端点已暴露 `ready` / `sync.phase` / `sync.startupComplete` 可供前端门控
- 相关但不同:`dashboard-stale-after-idle.md`(空闲后数据陈旧,非启动期)
