# M1 Post-Release Bug Backlog

来源：`.planning/2026-05-07-bugs-found-by-user-batch-1.md`、`.planning/2026-05-08-bugs-found-by-user-batch-1.md`、以及本次代码审查。

已修复的 bug 见文末"已修复记录"章节。

---

## 待修 Bug

### BUG-03 — Session 详情进入时大量 `key=null` React 警告

**严重性：** Medium  
**状态：** 待验证（key-utils.ts 已全部使用安全 fallback，但错误仍被用户报告过）

**现象：**  
进入任意 session 详情后，浏览器 console 出现数十条：
```
Encountered two children with the same key, `null`.
```
（出现在 `GET /api/agent-tools/claude-code/sessions/606dac00-.../turns` 200 OK 之后）

**已排查：**
- `key-utils.ts` 的 `getTurnKey / getMessageKey / getActivityKey` 均有 string fallback，不会产生 null
- 所有 replay 组件中的 `.map()` 都使用 key-utils 工具函数
- 汇编器（`ingest/turns/assembler.ts`）中 `turn.id` 始终为 `${sessionId}-turn-${index}`，不会为 null

**下一步：** 启动 dev server，打开 session `606dac00-4f36-40e2-89c8-da91416b6b39` 详情页，在 console 中捕获完整 stack trace 定位 null key 来源。

**文件定位：**
- `components/replay/turn-card.tsx`
- `components/replay/turn-timeline.tsx`
- `ingest/turns/assembler.ts`

---

### BUG-05 — Session 刷新按钮不触发 Ingest 重新扫描文件

**严重性：** Medium  
**状态：** 待修

**现象：** 点击右上角刷新按钮，`refetch()` 重新查询 ingest DB，但 DB 只反映上次文件扫描的内容——新写入磁盘的 session 文件不会被索引进来。

**根因：** `refetch()` 仅重新 fetch API，没有向 ingest service 发送 re-sync 信号。Ingest 服务靠文件监听（watcher）或定时轮询来发现新文件，refresh 按钮无法触发它。

**预期：** 点击刷新应该：① 触发 ingest 扫描新文件，② 然后 refetch session 列表。

**文件定位：**
- `components/sessions/sessions-right-rail.tsx` — `handleRefresh → sourceSessions.refetch()`  
- `lib/agent-tools/client-hooks.ts` — `useToolSessions` refetch 实现
- `ingest/sync/index.ts` — 是否有手动触发 sync 的 API 端点？若无则需新增
- `ingest/api/` — 可考虑增加 `POST /api/v1/sync` 端点，由 refresh 按钮调用

---

### BUG-07 — Session 解析不完整（tool call / subagent 归入问题）

**严重性：** High  
**状态：** 待修

**现象：**  
- 工具调用（tool calls）、subagent/task 派发在 turn 详情中显示不完整或位置不正确  
- 与 `../references/agentsview` 解析结果存在差异

**建议：** 对照 agentsview，检查 `tests/unit/ingest/` 中 fixture 文件是否与 `~/.claude`、`~/.codex` 中实际 JSONL 格式一致。

**文件定位：**
- `ingest/parser/claude.ts`
- `ingest/parser/codex.ts`
- `ingest/turns/assembler.ts`
- `tests/unit/ingest/`

---

### BUG-08（延伸）— DB 中 44 条错误 Session 名称等待 Ingest 重新同步

**严重性：** Low  
**状态：** 部分修复，等待自动完成

**现象：** 已将 44 条 `name LIKE '<command-name>%'` 的记录 name/file_hash 清空（commit `07656e7`），  
等待 ingest 服务在下次文件扫描时自动修正这些 session 名称。  
若 ingest 服务未在运行或文件未更新，这些 session 名称会一直显示为空。

**建议：** 在 BUG-05（手动 sync）修复后顺带验证，或手动 touch 对应 `.jsonl` 文件触发重新 parse。

---

## 已修复记录

| Bug | 描述 | 修复方式 | Commit |
|-----|------|----------|--------|
| BUG-01 | 切换 source 时 URL 保留旧 session ID | `source-switcher-routing.ts` 检测 `sessions/[id]` 路径，切换时截断到 `/[tool]/sessions` | 已有 |
| BUG-02 | 布局：sessions 应在 right rail，详情在 children | 当前实现已正确：right rail = `SessionsRightRail`，children = stats/detail | 已有 |
| BUG-04 | Codex session 排序错乱 / 最新 session 找不到 | right rail limit 40→500（`01b80a5`），ingest 排序字段 `UPDATED_AT_EXPR` 对 codex 有效 | `01b80a5` |
| BUG-06 | Session 列表信息不完整 | `SessionRailRow` 已显示 name + source badge + project + relative time | 已有 |
| BUG-09 | Right rail 40 条硬限制 | limit 40→500（aggregate 和 source 均已修改） | `01b80a5` |
| ~~BUG-name-xml~~ | Session 名称显示原始 XML 标签 | `ingest/sync/index.ts` 跳过无参数 slash command，44 条错误记录清空 | `07656e7` |
