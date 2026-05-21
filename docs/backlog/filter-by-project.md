---
type: feat
title: Filter sessions by project and date range
status: wip
priority: p2
created: 2026-05-21
updated: 2026-05-21
branch: feat/filter-by-project
worktree: .worktree/feat-filter-by-project
---

## Description

在 session 列表页面的右上角加一个漏斗符号，点击展开 filter 面板。支持两种过滤维度：

### 1. By Project

- Filter 面板中列出所有已存在的 project，每个 project 对应一个**可折叠的下拉项**
- 默认状态：全部收起（collapsed）
- 点击 project 行可展开，展开后显示该 project 下的 session 数量或子选项
- 支持多选 project，选中后 session 列表实时过滤，只显示所选 project 的内容
- Project 列表从已有 session 数据中聚合（不依赖外部配置）

### 2. By Date Range

- Filter 面板中提供日期范围选择器：起始日期 + 终止日期
- 使用 shadcn DatePicker 或 Calendar 组件，样式与当前赛博朋克 HUD 风格保持一致
- 选定范围后，session 列表过滤出该时间段内的 session
- 支持只填起始日期（开区间）或只填终止日期

### 视觉风格

前端实现须与现有设计风格（赛博朋克 HUD，OKLCH 颜色，radix-nova shadcn preset）一致，不引入新的视觉语言。

## Acceptance criteria

- [ ] Session 列表页右上角有 filter 漏斗 icon
- [ ] 点击漏斗展开 filter 面板，面板内有 "By Project" 和 "By Date Range" 两个 section
- [ ] By Project：每个 project 对应一个折叠行，默认收起，点击展开
- [ ] By Project：支持多选，选中后 session 列表实时过滤
- [ ] By Date Range：起始日期 + 终止日期选择器，选定后实时过滤
- [ ] Filter 状态在路由切换间保留（Zustand store 或 URL query）
- [ ] Filter 面板有 "Clear all" 入口，一键清除所有已选条件
- [ ] 视觉风格与现有 HUD 设计一致（颜色、字体、边框 token）

## Open questions

- Project 列表从 session 聚合时，是否需要去重 + 排序（按名称 / 按 session 数量）？
- 跟 source switcher（已有的 tool 切换器）如何配合？两者同时生效（AND 关系）还是互斥？
- Date Range 的时区处理：用本地时间还是 UTC？

## Related

- Depends on: source-labels-centralization (filter UI 会显示 source label)
