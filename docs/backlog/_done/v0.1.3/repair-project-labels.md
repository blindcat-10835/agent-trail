---
type: fix
title: Repair Stale Project Labels
status: done
priority: p1
created: 2026-05-22
updated: 2026-05-22
branch:
worktree:
---

## Description

修复 ingest 将部分 session 解析成错误 project 名的问题：

- Claude Code 的 encoded project 目录名中包含真实连字符时，旧逻辑会把所有 `-` 都替换成 `/`，导致 `ai-dashboard-projects/agents-tracing-dashboard` 被错误显示为 `ai/dashboard/projects/agents/tracing/dashboard`，前端短路径进一步显示为 `dashboard`。
- Codex session 文件位于 `~/.codex/sessions/YYYY/MM/DD/` 时，旧增量同步会把日期目录日号（如 `21`、`22`）写入 `sessions.project`。

v1.0.3 通过 parser/sync 修复阻止新脏数据写入，并通过 database migration v20 自动修复用户已有数据库中的 stale project labels。

## Acceptance criteria

- [x] Claude Code project path 不再通过简单 `-` → `/` 破坏真实连字符路径
- [x] Codex 增量同步不再用日期目录名覆盖已有 project
- [x] Claude/Codex append parser 只有拿到真实 `cwd` 时才 patch `project`
- [x] migration v20 自动修复已有 `//Users/...`、Codex `21`/`22` 等错误 project label
- [x] migration v20 清理相关 cursor/cache，使后续 sync 以修复后的逻辑继续索引

## Release note

更新到 v1.0.3 后，用户需要重启 app / ingest 服务。启动时 migration v20 会自动修复本地 SQLite 中已存在的错误 project label；无需手动执行 SQL。

## Related

- `ingest/sync/index.ts`
- `ingest/parser/codex.ts`
- `ingest/parser/claude.ts`
- `ingest/db/index.ts`
