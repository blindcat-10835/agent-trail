# 废弃 / 未使用代码清单

> 用于 refactor 阶段追踪可以删除的组件、函数、代码块。
> 每条目格式：路径 + 状态 + 证据 + 建议动作。

## 状态图例

- `unused` — 完全未被引用（除自身外）
- `partial-unused` — 文件被引用但内部有未使用 export / function / 代码块
- `legacy` — 旧实现已被新实现替代但未删除
- `dead-branch` — 永远进不去的分支（feature flag 关闭、条件死链等）

## 检测方法

```bash
# 在仓库根执行（已排除 node_modules / .worktree / .next）
for f in $(find components lib hooks stores -name "*.tsx" -o -name "*.ts" | grep -v ".worktree" | grep -v ".test.ts" | grep -v "components/ui/"); do
  base=$(basename "$f" | sed 's/\.tsx\?$//')
  count=$(grep -rE --include="*.tsx" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.worktree --exclude-dir=.next "from ['\"][^'\"]*/${base}['\"]" . | grep -v "^\./${f}:" | wc -l)
  [ "$count" = "0" ] && echo "UNUSED: $f"
done
```

---

## Replay 组件（重灾区，疑似 turn-timeline → trace-thread 重构遗留）

### `components/replay/turn-navigator.tsx` — `unused`

- **Export**: `TurnNavigator`
- **证据**: 全仓库无 import。
- **功能**: prev / next / jump-to-turn 控件 + `j/k` / `↑/↓` / `Esc` 键盘快捷键 + session hash copy。
- **建议**: 删除。同等导航逻辑如果未来需要，可直接从 `trace-thread.tsx` 内嵌实现。

### `components/replay/turn-timeline.tsx` — `legacy`

- **Export**: `TurnTimeline`
- **证据**: 仅 `tests/unit/bff/turn-timeline-virtualization.test.ts` 引用（测试也是 legacy）。Replay 页 (`app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx`) 现用 `TraceThread`。
- **功能**: 基于 `@tanstack/react-virtual` 的 virtualized turn 列表 + expand/collapse all + scroll 位置记忆。
- **建议**: 删除组件 **同时** 删除测试文件 `tests/unit/bff/turn-timeline-virtualization.test.ts`，或将测试改写为针对 `trace-thread.tsx`。

### `components/replay/replay-header.tsx` — `unused`

- **Export**: `ReplayHeader`
- **证据**: 全仓库无 import。
- **功能**: 面包屑 `Sessions > <name>` + 状态徽章 + 返回按钮。
- **建议**: 删除。当前 header 逻辑已由 shell + page 自身承担。

### `components/replay/replay-right-rail.tsx` — `unused`（**注意**：git 显示最近被修改）

- **Export**: `ReplayRightRail`
- **证据**: 全仓库无 import。`grep -rE "ReplayRightRail|replay-right-rail"` 仅命中自身。
- **功能**: Session info 右栏（tokens、cost estimate、model、turn list）。
- **风险提示**: 当前工作树 (`git status`) 显示此文件 **modified** — 怀疑用户最近的改动是基于"它还在用"的误解。建议在删除前 **先与用户确认** 这次修改是否被遗弃。
- **建议**: 确认后删除。现役右栏在 `components/sessions/sessions-right-rail.tsx` 与 `components/shell/right-rail.tsx`。

### `components/replay/replay-search-bar.tsx` — `unused`

- **Export**: `ReplaySearchBar`
- **证据**: 全仓库无 import。
- **功能**: Replay 页内 turn 全文搜索条 + 高亮 + match 跳转，依赖 `useReplayStore` 的 `searchQuery / searchMatches / currentMatchIndex`。
- **建议**: 删除组件。如果 `useReplayStore` 中 `searchQuery / searchMatches / currentMatchIndex / setSearchMatches / setCurrentMatchIndex` 也只被这里用，应一并清理（**待二次确认**）。

---

## Sessions 组件

### `components/sessions/aggregate-sessions-view.tsx` — `legacy`

- **Export**: `AggregateSessionsView`
- **证据**: 全仓库无 import。聚合视图逻辑已被合并入 `components/sessions/sessions-list-page.tsx`（其中 `useAggregateSessions` + `isAll` 分支处理 all/dashboard）。
- **建议**: 删除。

### `components/sessions/session-filter-dropdown.tsx` — `unused`

- **Export**: `SessionFilterDropdown`、`SessionFilterState`、`GroupMode`
- **证据**: 全仓库无 import。
- **风险提示**: 导出了 `SessionFilterState` 与 `GroupMode` 类型 — 删前用 `grep` 确认这些类型名无外部 type-only import（当前 grep 也未发现引用）。
- **建议**: 删除。当前 filter 走 `components/sessions/sessions-filter-panel.tsx`。

---

## Activity 组件（activity page 已退化为 stub）

> `app/(tool-shell)/[tool]/activity/page.tsx` 当前只渲染一行标题，未引用任何 activity 组件。

### `components/activity/activity-summary-cards.tsx` — `unused`

- **Export**: `ActivitySummaryCards`
- **证据**: 全仓库无 import。
- **建议**: 删除（或与下面两个 activity 组件一起整体保留，看是否短期内会重启 activity 页面）。

### `components/activity/activity-entry-drawer.tsx` — `unused`

- **Export**: `ActivityEntryDrawer`
- **证据**: 全仓库无 import。
- **建议**: 同上。

### `components/activity/log-browser.tsx` — `unused`

- **Export**: `LogBrowser`
- **证据**: 全仓库无 import。
- **建议**: 同上。**用户判断决定**：若 activity 页将在近期重做，可暂留；否则三个 activity 组件 + 整个 `app/(tool-shell)/[tool]/activity/` 路由都可清理。

---

## Stores（OVAO 时期遗留）

### `stores/office-layout/office-layout-store.ts` — `unused`

- **Export**: `useOfficeLayoutStore`
- **证据**: 全仓库无 import。
- **背景**: OVAO（OpenClaw Visual Agents Office）时期的"工位布局"状态，已不在产品形态中。
- **建议**: 删除整个 `stores/office-layout/` 目录（连同下方 `office-map.ts`）。

### `stores/office-layout/office-map.ts` — `unused`（仅被 ↑ 引用）

- **Export**: `DEFAULT_SLOTS`、`DeskSlot`、`ZoneId`
- **证据**: 唯一引用方是 `office-layout-store.ts`（本身也是 unused）。
- **建议**: 与 `office-layout-store.ts` 一起删除。

---

## Lib 工具函数

### `lib/agent-avatar-utils.ts` — `unused`

- **Exports**: `isValidAgentId`, `mimeTypeToExtension`, `pickAgentAvatarUrl`, `AvatarExtension` 类型
- **证据**: 全仓库无 import。
- **建议**: 删除。Avatar 相关现役实现在 `components/dashboard/agent-avatar.tsx`。

### `lib/env.ts` — `unused`

- **Exports**: `requireEnv`, `optionalEnv`
- **证据**: 全仓库无 import。`process.env.*` 的访问点（如 `ingest/config/tool-dirs.ts`）都直接读 `process.env`，未走这两个 helper。
- **建议**: 删除。如果未来需要 env validation，建议改为更强类型方案（如 `@t3-oss/env-nextjs` 或 zod schema）。

---

## 待二次复核（可能存在的内部 dead code）

下列文件被外部引用，但内部可能有未使用的 export 或分支，需要单文件细读后才能下结论：

- `stores/replay-store.ts` — `searchQuery / searchMatches / currentMatchIndex` 等字段如果只服务于上面 `replay-search-bar.tsx`，则相关 state + setters 也是死代码。
- `lib/agent-tools/client-hooks.tsx` — `AggregateSourceStatus` 是否还被现役聚合视图使用（`aggregate-sessions-view.tsx` 删后需复核）。

---

## 关联测试

- `tests/unit/bff/turn-timeline-virtualization.test.ts` — 测试 `TurnTimeline`（已 legacy）。删 `turn-timeline.tsx` 时一并处理。

---

<!-- 后续条目继续追加到此 -->
