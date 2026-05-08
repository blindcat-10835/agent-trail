# M1 Post-Release Bug Backlog

收集自 `.planning/2026-05-07-bugs-found-by-user-batch-1.md`、`.planning/2026-05-08-bugs-found-by-user-batch-1.md`、以及本次诊断发现的问题。

---

## BUG-01 — 切换 Source 时 URL 保留了旧 session ID

**严重性：** High  
**来源：** 2026-05-07 batch-1

**现象：**  
从 `/openclaw/sessions/7cf1568d-...` 点击 header 中的 Codex tab，跳转到  
`/codex/sessions/7cf1568d-...`，显示"session 不存在"。

**预期：** 切换 source 时应回到该 source 的会话列表首页（不保留 session ID）。

**文件定位：**
- `components/shell/source-switcher.tsx` — source 切换逻辑
- `components/shell/shell-header.tsx` — header 中的 source switcher 入口

---

## BUG-02 — 页面布局：session 列表与 session 详情位置错误

**严重性：** High  
**来源：** 2026-05-07 batch-1

**现象：**  
当前布局：session 列表显示在 children（主内容区）中。  
预期布局：session 列表始终在右侧 right rail，点击 session 后在 children 区展示详情；无 session 选中时 children 区显示 overview。

**参考：** `../references/agentsview` — 左侧列表 + 右侧详情，我们只是方向相反（右侧列表 + 主区详情）。

**文件定位：**
- `app/(tool-shell)/[tool]/sessions/page.tsx` — 当前 Claude Code/Codex 显示 `SessionStatsDashboard`（stats 而非会话列表）
- `app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx` — session 详情页
- `components/sessions/sessions-right-rail.tsx` — 右侧 rail 的 session 列表

---

## BUG-03 — Session 详情页大量 `key=null` React 警告

**严重性：** Medium  
**来源：** 2026-05-07 batch-1

**现象：**  
进入任意 session 详情后，浏览器 console 出现数十条：
```
Encountered two children with the same key, `null`.
```

**文件定位：**
- session 详情渲染组件（turns/messages 列表），key 来自 `turn.id` 或 tool call id，存在 null 值
- 需要排查 `app/(tool-shell)/[tool]/sessions/[sessionId]/` 及 `components/sessions/` 中的列表渲染

---

## BUG-04 — Codex session 排序不正确 / 最新 session 找不到

**严重性：** High  
**来源：** 2026-05-07 batch-1

**现象：**  
- Codex sessions 不按时间排序
- 最新几个 Codex session 在列表中找不到
- 点右上角刷新按钮无效

**DB 现状：** 共 307 条 codex session，排序字段需核查。

**文件定位：**
- `lib/agent-tools/codex/server-adapter.ts` — listSessions 传参
- `ingest/api/sessions.ts` — `UPDATED_AT_EXPR` 逻辑（codex session 是否有 `ended_at`/`file_mtime`？）
- `components/sessions/sessions-right-rail.tsx` — refresh 按钮调用 `sourceSessions.refetch()`

---

## BUG-05 — Session 列表刷新无效

**严重性：** Medium  
**来源：** 2026-05-07 batch-1

**现象：** 点击右上角刷新按钮后，sessions 列表没有拉取到最新数据。  
**注：** 与 BUG-04 相关，可能是同一根因（ingest 未重新 sync 文件 vs. 前端 refetch 问题）。

**文件定位：**
- `components/sessions/sessions-right-rail.tsx` — `handleRefresh → sourceSessions.refetch()`
- `lib/agent-tools/client-hooks.ts` — `useToolSessions` refetch 实现
- `ingest/sync/` — 是否支持手动触发 re-sync

---

## BUG-06 — Session 列表信息展示不完整

**严重性：** Low（布局问题修复后）  
**来源：** 2026-05-07 batch-1

**现象：** Session 列表（right rail）展示的信息不够完整。  
**预期（参考 agentsview）：** session 名称、project 目录、更新时间、使用工具（CLAUDE / CODEX / OPENCLAW）。

**文件定位：** `components/sessions/sessions-right-rail.tsx` — `SessionRailRow` 组件（目前已有 name + project + updated + sourceLabel，需对照 agentsview 补全）

---

## BUG-07 — Session 解析问题（session 信息不准确）

**严重性：** High  
**来源：** 2026-05-08 batch-1

**现象：**  
- 工具调用（tool calls）、subagent/task 派发未被正确归入对应 turn
- 解析结果与 `../references/agentsview` 的解析结果存在差异

**建议：** 对照 agentsview 检查测试数据（`tests/unit/ingest/`），确认测试中假设的 session 样本与 `~/.claude`、`~/.codex` 中实际文件格式一致。

**文件定位：**
- `ingest/parser/claude.ts` — Claude Code JSONL 解析
- `ingest/parser/codex.ts` — Codex JSONL 解析
- `tests/unit/ingest/` — 单元测试 fixture

---

## BUG-08 — Session 名称显示原始 XML 标签（✅ 已修复）

**严重性：** Medium  
**来源：** 本次诊断，2026-05-08

**现象：**  
`/effort`、`/model` 等无参数 slash command 开头的 session，名称显示为  
`<command-name>/effort</command-name>` 而非实际用户首条消息内容。

**根因：**  
`deriveDisplayNameFromUserMessage` 在 `<command-args>` 为空时 fallthrough 到  
`firstMeaningfulLine`，直接返回原始 XML。

**修复：** `ingest/sync/index.ts` — 检测到 `<command-name>` 但无 args 时返回 `''`，  
同时将 `<local-command-stdout` 加入 metadataPrefixes 过滤列表。  
DB 中 44 条错误 name 已清空（`file_hash` 同时清空），等待 ingest 重新 sync。  
**Commit：** `07656e7`

---

## BUG-09 — Right Rail session 加载上限太低（✅ 已修复）

**严重性：** Medium  
**来源：** 本次诊断，2026-05-08

**现象：** Right rail 仅加载最新 40 条 session，超出范围的 session 无法在列表中找到。  
参考：agentsview 默认 200 条、最大 500 条，支持虚拟滚动（`SessionList.svelte`）。

**修复：** `components/sessions/sessions-right-rail.tsx` — limit 从 40 改为 500（aggregate 和 source 两处）。  
当前 session 总量（~130 claude-code / 307 codex / 120 openclaw）在此范围内，无需立即引入虚拟滚动。  
若未来单 source 超过 500 条，建议参考 agentsview 实现虚拟列表。

---

## 优先级建议

| # | Bug | 优先级 |
|---|-----|--------|
| BUG-01 | Source 切换保留旧 session ID | P1 |
| BUG-02 | 布局：sessions 应在 right rail | P1 |
| BUG-04 | Codex session 排序 + 刷新无效 | P1 |
| BUG-07 | Session 解析（tool call / subagent）| P2 |
| BUG-03 | key=null React 警告 | P2 |
| BUG-05 | 刷新按钮无效（与 BUG-04 重叠） | P2 |
| BUG-06 | Session 列表信息展示 | P3（布局修好后） |
| BUG-08 | ✅ 已修复 | — |
| BUG-09 | ✅ 已修复 | — |
