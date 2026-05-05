# Phase 2: 设计令牌和主题系统 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 02-design-tokens-theme
**Areas discussed:** 字体策略, 主题切换机制, 令牌扩展范围, 主题切换器组件

---

## 字体策略

**讨论背景:** PROJECT.md 写 Rajdhani（标题）+ JetBrains Mono（数据），但设计稿 dashboard-hud.html 实际使用 JetBrains Mono（全站主字体）+ Inter（辅助字体）。两者有冲突。

| Option | Description | Selected |
|--------|-------------|----------|
| Rajdhani + JetBrains Mono | 标题用 Rajdhani（科幻感显示字体），正文/数据用 JetBrains Mono。更接近 PROJECT.md 原始规划。 | |
| JetBrains Mono + Inter | 严格跟随设计稿。所有 UI 用 JetBrains Mono，辅助用 Inter。无 Rajdhani。 | ✓ |
| Rajdhani + JetBrains Mono + Inter | 标题用 Rajdhani，正文/数据用 JetBrains Mono，辅助用 Inter。三字体方案。 | |

**User's choice:** JetBrains Mono + Inter
**Notes:** 严格跟随设计稿方案，不使用 Rajdhani

---

## 主题切换机制

### 切换方式

| Option | Description | Selected |
|--------|-------------|----------|
| .dark class | shadcn/ui 默认方式，零改动。v2 强调色切换时再迁移。 | |
| data-theme 属性 | 设计稿方式，需改 globals.css 选择器。但 v2 多强调色扩展更顺畅。 | ✓ |

**User's choice:** data-theme 属性
**Notes:** 为 v2 多强调色主题（PREF-02）预留扩展性

### 默认主题策略

| Option | Description | Selected |
|--------|-------------|----------|
| 跟随系统 + 手动覆盖 | 默认跟随系统偏好，用户手动切换后记住选择。下次访问恢复上次选择。 | ✓ |
| 默认 dark + 手动切换 | 默认 dark（HUD 风格默认暗色），用户可手动切换。 | |

**User's choice:** 跟随系统 + 手动覆盖
**Notes:** 无额外说明

---

## 令牌扩展范围

| Option | Description | Selected |
|--------|-------------|----------|
| 颜色令牌 + 字体 | Phase 2 只做颜色令牌 + 字体 + 主题切换器。clip-path、glow、scanline、grid 等 HUD 效果令牌推到 Phase 3。 | ✓ |
| 全部令牌（设计稿完整映射） | Phase 2 把设计稿的所有令牌全部实现。Phase 3 直接用。 | |

**User's choice:** 颜色令牌 + 字体
**Notes:** HUD 效果令牌与 HUD 组件库在 Phase 3 一起实现更合理

---

## 主题切换器组件

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 2 创建简单切换器 | Phase 2 实现一个简单的亮/暗切换按钮。Phase 3 Shell 布局时再集成到正式位置。 | ✓ |
| 推到 Phase 3 | Phase 2 只实现 CSS 变量和切换逻辑，不创建 UI 组件。Phase 3 和 Shell 布局一起做。 | |

**User's choice:** Phase 2 创建简单切换器
**Notes:** Phase 3 时集成到 Shell 布局的正式位置

---

## Claude's Discretion

- globals.css 具体的 OKLCH 色值映射
- 主题状态管理实现方式
- 切换器组件的具体样式和位置
- FOUC 防止脚本的具体实现

## Deferred Ideas

- Rajdhani 字体 — 不使用，跟随设计稿
- HUD 效果令牌 — Phase 3
- Agent 状态色令牌 — Phase 4
- 多强调色主题 — v2 PREF-02
