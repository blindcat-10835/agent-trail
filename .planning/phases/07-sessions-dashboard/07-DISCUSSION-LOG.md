# Phase 7: Sessions Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 07-sessions-dashboard
**Areas discussed:** Sessions page layout, Session detail view, Data & real-time updates, Overview & navigation

---

## Sessions page layout

| Option | Description | Selected |
|--------|-------------|----------|
| Table | 每个 Session 一行，列显示 key/model/status/tokens/cost/lastMessage。可排序、可展开详情。 | ✓ |
| Card grid | 类似 Agent 卡片网格，每张卡片展示 Session 概要。 | |
| List rows | 每行一个 Session，像聊天列表。紧凑但字段有限。 | |

**User's choice:** Table — 确认用表格，紧凑 4 列（Label + Status + Model + Updated）

### Stats bar

| Option | Description | Selected |
|--------|-------------|----------|
| 4-stat bar | Total Sessions / Active / Total Tokens / Total Cost，HudCard 风格 | ✓ |
| Minimal 2-stat | 只显示 Total + Active | |
| Claude's discretion | 信息密度和 Dashboard KPI bar 一致 | |

**User's choice:** 4-stat bar

### Filter bar

| Option | Description | Selected |
|--------|-------------|----------|
| Inline filters | Status/Model/Kind/搜索水平排列一行 | |
| Collapsible panel | 点击展开面板，包含所有过滤选项 | ✓ |
| Chip tags (reference) | 参考项目用的标签按钮组，分三组 | |

**User's choice:** Collapsible panel — 保持了最初的选择，没换参考项目的 chips

### Table columns

| Option | Description | Selected |
|--------|-------------|----------|
| Full 7 columns | Label + Model + Kind + Status + Tokens + Cost + Updated | |
| Compact 4 columns | Label + Status + Model + Updated，其他展开后显示 | ✓ |
| Claude's discretion | 可排序且不拥挤即可 | |

**User's choice:** Compact 4 columns

---

## Session detail view

| Option | Description | Selected |
|--------|-------------|----------|
| Right rail panel | 右侧 360px 面板，中心表格保持可见 | ✓ |
| Separate page | 跳转 /sessions/[key] 独立页面 | |
| Modal popup (reference) | 参考项目用模态弹窗 700px 宽 | |

**User's choice:** Right rail panel — 保持最初选择

### Message history style

| Option | Description | Selected |
|--------|-------------|----------|
| Chat bubbles | 类似聊天界面，role-based 对齐 + 时间戳 | ✓ |
| Terminal style | 黑色背景 + 等宽字体 + 彩色编码 role | |
| Plain list | 纯列表，每行 role + 时间戳 + 内容 | |

**User's choice:** Chat bubbles

### Panel layout

| Option | Description | Selected |
|--------|-------------|----------|
| Messages-first | 消息历史为主，上方小 info 区 | ✓ |
| Split info + messages | info 区 + 图表 + 状态时间线 + 消息历史 | |

**User's choice:** Messages-first

---

## Data & real-time updates

| Option | Description | Selected |
|--------|-------------|----------|
| Research first | 研究 Gateway RPC 文档，设计数据获取策略 | |
| Assume rich RPCs | 假设有 sessions.detail 和 sessions.messages | |
| Compose from existing | 从 agents + usage 数据组装 | |

**User's choice:** User provided reference project path — data comes from Gateway's sessions.json + .jsonl files, referenced `../references/openclaw-dashboard-html/` for session data design.

**Resolution:** SessionInfo 需扩展对齐参考项目字段。Gateway `sessions.list` 已有基础数据，消息历史需对应 .jsonl RPC。

---

## Overview & navigation

### Overview Sessions概要

| Option | Description | Selected |
|--------|-------------|----------|
| Mini list + count | 活跃数 + 最近 5 条 session 活动 + "View All" 链接 | ✓ |
| Stats only | 只显示总数和活跃数 | |

**User's choice:** Mini list + count

### Navigation placement

| Option | Description | Selected |
|--------|-------------|----------|
| Both header + sidebar | Header 加 Sessions，Sidebar 加 SES | ✓ |
| Header only | 只在 header 加，sidebar 不加 | |

**User's choice:** Both header + sidebar

---

## Claude's Discretion

- 表格具体 CSS Grid 列宽配置和排序图标实现
- Filter 面板内部控件排布
- Chat bubble 的具体颜色和圆角样式
- Session 状态 LIVE 动画的具体实现
- 右侧面板 info 区的布局细节
- Overview Sessions 概要的截断策略和空状态
- SessionInfo 字段映射到 UI 的格式化
- 消息历史的加载策略

## Deferred Ideas

- Session 对比功能（checkbox 多选 + 并排比较）— v2
- Session Timeline 可视化 — 参考项目有但优先级低
- Session 导出（CSV/JSON）— v2
- Session 终止/重启操作 — 后续 Phase
- 消息搜索 — v2
