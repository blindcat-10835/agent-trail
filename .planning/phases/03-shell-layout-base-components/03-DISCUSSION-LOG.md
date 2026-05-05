# Phase 3: Shell 布局和基础组件 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 03-shell-layout-base-components
**Areas discussed:** Shell 布局结构, 导航侧栏角色, HUD 效果实现模式, 主题切换器位置

---

## Shell 布局结构

**讨论背景:** ROADMAP/PROJECT.md 写"左侧导航栏 + 主内容区 + 底部状态栏"，设计稿 dashboard-hud.html 是 CSS Grid 三段式（header + 3-column main + status bar），没有侧栏导航。两者结构冲突。

| Option | Description | Selected |
|--------|-------------|----------|
| 跟随设计稿 | Header + 3-column main + status bar。导航在 header 中用标签按钮。严格跟随 dashboard-hud.html。 | |
| 跟随 ROADMAP | 左侧导航栏（图标+标签切换页面）+ 右侧主内容区 + 底部状态栏。传统 dashboard 布局。 | |
| 混合方式 | 设计稿的 header + status bar 骨架，左侧换成导航侧栏（260px），保留右侧 detail panel。 | ✓ |

**User's choice:** 混合方式
**Notes:** 用户进一步明确 — Dashboard/Workspace 切换在 header（顶级导航），左侧面板是子导航+数据混合（Dashboard 下显示 Overview/Agents/Skills 标签 + 对应数据面板）

---

## 导航侧栏角色

**讨论背景:** 确认左侧面板在 Dashboard 下的具体角色。

| Option | Description | Selected |
|--------|-------------|----------|
| 纯导航标签 | 左侧纯粹是 Overview/Agents/Skills 导航标签，点击后中心区域内容变化。 | |
| 导航+数据混合 | 左侧既是导航又显示数据。上方有标签切换，下方显示对应数据面板（stats/alerts 等）。 | ✓ |
| 左侧纯数据（设计稿风格） | 左侧是数据面板（radar/stats/alerts），导航完全在 header 中处理。 | |

**User's choice:** 导航+数据混合
**Notes:** 左侧面板上方是子导航标签，下方是对应的数据内容。内容随当前页面变化。

---

## HUD 效果实现模式

**讨论背景:** clip-path 切角、霓虹发光、scanline/grid 叠加层的实现方式。影响 HUD 组件 API 设计。

| Option | Description | Selected |
|--------|-------------|----------|
| Utility class 组合 | CSS variable + @utility 定义效果。组件通过 class 组合，如 `class="hud-card hud-glow hud-clip-md"`。灵活。 | ✓ |
| 组件内置效果 | 每个 HUD 组件内部自带效果，通过 props 控制。简单但灵活性低。 | |
| 组件默认值 + utility 覆盖 | 两者结合：组件提供默认值，也提供 utility class 自由组合。 | |

**User's choice:** Utility class 组合
**Notes:** 效果令牌定义在 globals.css，组件通过 className 组合效果

---

## 主题切换器位置

**讨论背景:** Phase 2 临时放在右上角 fixed，Phase 3 要移到 Shell 正式位置。

| Option | Description | Selected |
|--------|-------------|----------|
| Header 右侧 | 设计稿 header 右侧有控制按钮区域。主题切换器放这里和其他按钮一起。 | ✓ |
| Status Bar | 状态栏右侧，但空间有限（26px 高）。 | |
| 左侧面板底部 | 类似设置入口，不占用 header 空间。 | |

**User's choice:** Header 右侧
**Notes:** 使用 hud-btn 风格，与其他 header 按钮视觉统一

---

## Claude's Discretion

- HUD 组件的具体 props API 设计
- @utility 命名约定和实现细节
- 左侧面板在各页面的默认内容（Phase 3 可用占位内容）
- 右侧面板 Phase 3 的最小实现程度
- Status Bar 具体布局和数据展示方式
- Gateway 连接状态消费方式

## Deferred Ideas

- Dashboard 具体内容 — Phase 4
- Office Layout 具体内容 — Phase 5
- Workspace 具体内容 — Phase 6
- Agent 状态色 — Phase 4
- Radar 雷达 — v2
- Command Palette — v2
