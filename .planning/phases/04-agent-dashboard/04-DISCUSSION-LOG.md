# Phase 4: Agent Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 04-agent-dashboard
**Areas discussed:** Agent 卡片网格布局, Agent 详情面板交互, 左侧面板内容, 日志流风格, KPI 位置

---

## Agent 卡片网格布局

**讨论背景:** 中心区域展示 Agent 卡片，需要决定布局密度。

| Option | Description | Selected |
|--------|-------------|----------|
| 紧凑网格（多列自适应） | 自适应网格，每个卡片 ~180-200px 宽。显示头像、名称、状态色点、当前工具名。 | ✓ |
| 宽松卡片（2-3列固定） | 固定 2-3 列，卡片更大，显示更多信息。 | |
| 列表视图 | 单列列表，每行一个 Agent。简洁但占更多垂直空间。 | |

**User's choice:** 紧凑网格（多列自适应）
**Notes:** 使用 HudCard 组件（variant sm/md），自适应多列

---

## Agent 详情面板交互

**讨论背景:** 点击 Agent 卡片后详情展示位置。右侧面板 300px，中心区域 1fr。

| Option | Description | Selected |
|--------|-------------|----------|
| 右侧面板 | 右侧 300px 面板展示选中 Agent 详情。中心卡片网格保持可见。空间有限但上下文不丢失。 | ✓ |
| 替换中心内容 | 中心区域切换为全屏详情视图，带返回按钮。空间充足但需要导航回去。 | |
| 混合 | 右侧面板显示简要信息，点击"展开"后中心切换为完整视图。两步交互。 | |

**User's choice:** 右侧面板
**Notes:** 选中卡片高亮边框，右侧面板展示状态/日志/能力

---

## 左侧面板 Dashboard 内容

**讨论背景:** 左侧 260px 面板在 Dashboard 模式下显示什么。Phase 3 已决定是导航+数据混合模式。

| Option | Description | Selected |
|--------|-------------|----------|
| 子导航 + 数据混合 | 上方子导航标签（Overview/Agents/Skills），下方对应数据面板。 | ✓ |
| 筛选面板 | 搜索框 + 状态筛选下拉 + Agent 数量统计。 | |
| 全局事件流 | 左侧显示全局实时事件流（所有 Agent 事件汇总）。 | |

**User's choice:** 子导航 + 数据混合
**Notes:** Overview=stats+alerts, Agents=列表, Skills=技能列表

---

## 日志流展示风格

**讨论背景:** 右侧面板中 Agent 日志的展示方式。面板只有 300px 宽。

| Option | Description | Selected |
|--------|-------------|----------|
| 终端风格 | 黑色背景 + 等宽字体（JetBrains Mono）+ 彩色编码事件。底部自动滚动。 | ✓ |
| 列表风格 | 普通列表，每条日志是一个卡片/行。白色背景，彩色标签。 | |

**User's choice:** 终端风格
**Notes:** lifecycle=白色、tool=黄色、assistant=绿色、error=红色

---

## KPI 摘要位置

**讨论背景:** KPI 摘要条（活跃 Agent 数/工作中/错误数/Token 用量）放在哪里。

| Option | Description | Selected |
|--------|-------------|----------|
| 中心顶部 | 中心区域顶部一行 KPI 卡片。搜索框和筛选器在 KPI 行内或下方。 | ✓ |
| 左侧面板内 | 左侧面板 Overview 标签页内显示 KPI 数据。中心区域纯粹是卡片网格。 | |
| 两者都显示 | 中心顶部 + 左侧面板都显示。中心是简要数字，左侧是详细统计。 | |

**User's choice:** 中心顶部
**Notes:** 一行 KPI 卡片（活跃/工作中/错误/Token）

---

## Claude's Discretion

- Agent 卡片的具体 CSS Grid 配置（列数/间距/断点）
- 搜索/筛选组件的具体 UI 实现
- Agent 状态色令牌的具体色值（OKLCH）
- 右侧面板的 tab/section 切换交互
- 日志行的具体格式（时间戳格式、内容截断方式）
- 左侧面板各标签的数据展示密度
- KPI 卡片的具体布局和数值格式化
- 空状态（无 Agent / 未连接 Gateway）的展示方式

## Deferred Ideas

- Radar 雷达可视化 — v2 VIS-01
- Command Palette — v2 UTIL-01
- 多强调色主题切换 — v2 PREF-02
- Agent 交互控制（启动/停止/配置）— 后续 Phase
- 实时 MEM/FPS 更新 — 后续 Phase
