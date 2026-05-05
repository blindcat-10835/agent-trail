# OVAO — OpenClaw Visual Agents Office

## What This Is

OVAO 是 OpenClaw 平台的 Agent 可视化管理界面，让用户通过赛博朋克 HUD 风格的仪表盘实时监控、管理和交互多个 AI Agent。面向开发者和运维人员，提供 Agent 状态总览、Office 可视化布局和单 Agent 工作区视图。

旧版（openclaw-visual-agent-office）功能完整但 UI 过时，本次重写仅替换 UI 层，数据层（WebSocket RPC + Zustand stores）完整复用。

## Core Value

Agent 状态实时可视化 — 用户一眼掌握所有 Agent 的运行状态，快速定位问题 Agent。

## Requirements

### Validated

（旧版已验证的能力，本次 UI 重写需完整继承）

- ✓ WebSocket RPC 连接 OpenClaw Gateway — existing
- ✓ Agent 列表和状态实时同步 — existing
- ✓ Agent 日志流实时展示 — existing
- ✓ Office 可视化布局（Agent 在办公室中的位置） — existing
- ✓ 单 Agent 工作区（终端/任务详情） — existing
- ✓ Zustand store 管理 Agent/日志/UI 状态 — existing

### Active

- [ ] 全站赛博朋克 HUD 视觉风格（Rajdhani + JetBrains Mono，clip-path 切角，scanline/grid overlay，霓虹发光）
- [ ] 响应式 Shell 布局（侧栏导航 + 主内容区 + 状态栏）
- [ ] 设计令牌系统（语义化 token，light/dark 双主题）
- [ ] Agent Dashboard 页面（Agent 列表/状态卡片/实时监控）
- [ ] Office Layout 页面（可视化 Agent 办公室位置布局）
- [ ] Workspace 视图页面（单 Agent 终端/日志/任务详情）
- [ ] 脚手架和工具链配置（Biome, shadcn/ui, Tailwind v4）

### Out of Scope

- 用户设置/偏好页面 — v2 再做，当前使用默认配置
- 国际化 (i18n) — 当前只需中文界面，但代码结构需支持未来扩展
- 多 Gateway 管理 — 当前只连接单个 Gateway (ws://localhost:18789)
- Agent 配置编辑 — 只做可视化展示，不做编辑操作
- 认证/权限 — 单用户本地工具，无认证需求
- 移动端适配 — 桌面优先，响应式但不专门优化移动端

## Context

- **旧版源码**：`../references/openclaw-visual-agent-office/` — 功能完整的 Next.js 14 项目，`src/gateway/` 和 `src/stores/` 数据层稳定
- **新设计稿**：`../ovao-design/` — `dashboard-hud.html` 是视觉风格基准，`dashboard.html` 是布局结构参考
- **当前项目**：`ovao/` — Next.js 16 App Router 脚手架已搭建，`gateway/` 和 `stores/` 已从旧版迁移过来
- **数据层**：gateway/ (WebSocket RPC 客户端) + stores/ (Zustand) 已就位，允许小范围适配（加 selector/类型导出）
- **HUD 风格**：全站统一赛博朋克 HUD — Rajdhani 标题字体，JetBrains Mono 数据字体，clip-path 切角卡片，scanline 和 grid 叠加层，霓虹发光效果

## Constraints

- **Tech Stack**: Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Zustand + ESLint + pnpm — 用户明确指定
- **Data Layer**: gateway/ 和 stores/ 主体不改，允许小范围适配 — 数据层稳定，避免引入回归
- **Visual Style**: 必须遵循 dashboard-hud.html 设计稿的 HUD 赛博朋克风格 — 设计约束
- **Semantic Tokens**: 视觉令牌走语义化 (text-foreground / bg-background / border-border) — 维护性要求
- **Dual Theme**: light/dark 双主题都要验证 — 可访问性要求
- **Language**: AI 文档/spec/plan 用中文，代码注释和变量名用英文 — 开发约定
- **AGENTS.md**: 项目有 Next.js 16 breaking changes 警告，编码前必须读 `node_modules/next/dist/docs/`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 全站 HUD 风格 | 统一视觉体验，减少设计系统复杂度 | — Pending |
| 数据层小范围适配 | 主体锁定降低风险，但允许加 selector 方便 UI 消费 | — Pending |
| Tailwind v4 + shadcn/ui | 最新版本，Tailwind v4 用 CSS-first 配置，shadcn/ui 提供可复用组件基础 | — Pending |
| 保持 ESLint | 项目已有 eslint-config-next，无需迁移到 Biome | — Pending |
| M1 先做脚手架+令牌+Shell | 先建立基础设施再逐页面开发 | — Pending |
| 设置/偏好推迟到 v2 | 不是核心价值，先聚焦可视化 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-30 after initialization*
