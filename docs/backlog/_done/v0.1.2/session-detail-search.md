---
type: fix
title: Session Detail In-Turn Search Broken
status: done
priority: p2
created: 2026-05-22
updated: 2026-05-22
branch: fix/session-detail-search
worktree: .worktree/fix-session-detail-search
---

## Description

Session 详情页（turn replay / trace-thread）的搜索功能行为不符合预期。

### 现状（已确认）

`components/replay/trace-thread.tsx:387–395` 的搜索采用**过滤模式**：输入关键字后只显示匹配的 turn，其余 turn 全部隐藏。

- 计数器（`v2-step-pos`，line 602）显示的是"当前聚焦的 turn 序号 / 总 turn 数"，**不是搜索命中计数**
- 无 "x / n matches" 反馈
- 无逐条匹配跳转（仅有 j/k 在过滤后的 turn 列表里逐 turn 移动）
- 匹配位置在 turn 内部没有高亮

### 已存在但未接入的实现

`components/replay/replay-search-bar.tsx` 有一套更完整的逻辑：

- 扫描 turn 内容并收集 `{ turnId, matchCount }[]`
- 显示 `currentMatchIndex of searchMatches.length`（x / n 格式）
- Enter / Shift+Enter 逐条跳转，调用 `scrollToTurn` 滚动到 `<mark>` 元素
- 支持 `/` 快捷键聚焦搜索框

**问题**：该组件已定义但从未被引用 —— 整个 codebase 中无任何 import（`grep -rn ReplaySearchBar` 只返回自身文件）。

### 期望行为

1. 搜索时**保留所有 turn 可见**，不过滤，只高亮匹配内容
2. 显示"x / n"命中计数（如 `3 / 12 matches`）
3. Enter / Shift+Enter 或 ▲▼ 按钮在命中位置之间逐条跳转并滚动到视图
4. 清空搜索框恢复原始视图

## 修复方向

- **方案 A（推荐）**：将 `trace-thread.tsx` 中现有的 filter 搜索替换为 `ReplaySearchBar` 的 highlight 模式，同时确保 `turn-card.tsx` / `markdown-content.tsx` 里的 `<mark>` 高亮已正确渲染（已有 `mark` selector 逻辑，line 68–70 of replay-search-bar）
- **方案 B**：在 filter 模式基础上补充命中计数和滚动，不改主逻辑（改动最小，但 UX 仍非最佳）

## 关键文件

| 文件 | 内容 |
|---|---|
| `components/replay/trace-thread.tsx:387–395` | 当前 filter 搜索逻辑 |
| `components/replay/trace-thread.tsx:584–611` | 搜索输入框 + 步进控件 |
| `components/replay/replay-search-bar.tsx` | 完整的 highlight+计数+跳转实现（dead code，待接入） |
| `components/replay/turn-card.tsx` | turn 渲染，需确认 `<mark>` 高亮样式 |
| `components/replay/markdown-content.tsx` | markdown 渲染，需确认搜索词高亮注入 |
| `stores/replay-store.ts` | `searchQuery` / `searchMatches` / `currentMatchIndex` 已在 store 中定义 |

## Acceptance criteria

- [ ] 搜索时不隐藏 turn，所有 turn 保持可见
- [ ] 匹配内容在 turn 卡片内高亮显示（`<mark>` 标签）
- [ ] 搜索框旁显示命中计数"x / n"
- [ ] Enter / Shift+Enter（或 ▲▼ 按钮）在命中处间逐条滚动跳转
- [ ] 清空搜索后视图恢复正常，无残留高亮
