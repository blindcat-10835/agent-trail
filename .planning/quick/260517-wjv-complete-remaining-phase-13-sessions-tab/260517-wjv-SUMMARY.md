---
quick_id: 260517-wjv
status: complete
date: 2026-05-17
commit: this commit
---

# Quick Task 260517-wjv Summary

## 结果

已完成 Phase 13 剩余 Sessions Table & Trace Detail v2 缺口：列表查询改为后端分页/搜索/过滤/排序，ACTIVITY 排序有真实后端路径，列表补齐 branch、summary、model、input/output token split、duration、activity counts，详情页支持继续加载 turns，并在 routed TraceThread 中接入虚拟滚动以支撑长 session。

## 主要改动

- 扩展 `ingest/api/sessions.ts`：新增 `q/search`、`status=truncated`、`starred=true`、多列 sort、activity sort、summary/model/activity counts/token/cost enrichment。
- 扩展 `TraceSession` 类型，统一 session/turn activity counts 结构。
- `SessionsListPage` 改为使用 BFF 查询参数驱动后端分页、过滤、排序和 load more，并渲染缺失字段。
- `useSessionTurns` 增加 `loadMore` 与去重追加逻辑；session detail route 将 `isLoadingMore/loadMore` 传入 TraceThread。
- `TraceThread` 接入 TanStack Virtual，长 session 使用虚拟 rows 和底部 loader 自动续载。
- 补充 sessions API 与 client hook 回归测试。

## 验证

- `PATH=/Users/ebbi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm vitest run tests/hooks/client-hooks.test.tsx`
- `PATH=/Users/ebbi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm vitest run tests/unit/ingest/sessions-api.test.ts`
- `PATH=/Users/ebbi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm typecheck`
- `PATH=/Users/ebbi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm typecheck:ingest`
- 定向 lint：本次改动文件除 `lib/agent-tools/client-hooks.tsx` 既有 overview hook 区域外通过；全量 `pnpm lint` 仍被既有 `.claude/worktrees` 和旧测试 lint debt 阻塞。

## 备注

Vitest 需要使用 workspace runtime Node；Codex.app bundled Node 带 hardened runtime，无法加载当前 ad-hoc signed `rolldown` native binding。
