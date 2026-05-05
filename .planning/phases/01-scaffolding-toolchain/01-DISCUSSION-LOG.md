# Phase 1: 脚手架和工具链 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 01-scaffolding-toolchain
**Areas discussed:** shadcn/ui 配置策略, 文件目录结构

---

## shadcn/ui 配置策略

| Option | Description | Selected |
|--------|-------------|----------|
| HSL (默认) | shadcn/ui 默认格式，生态兼容好，HUD 主题覆盖直接改 HSL 值 | ✓ |
| OKLCH (现代) | 感知均匀性更好，色彩过渡更自然，浏览器支持较新 | |
| 你来决定 | Phase 2 设计令牌时再决定，Phase 1 用默认配置 | |

**User's choice:** HSL (默认)
**Notes:** 无额外说明

### 基础组件选择

| Option | Description | Selected |
|--------|-------------|----------|
| Button | 最基础的交互组件，HUD 按钮会大量复用 | ✓ |
| Card | Agent 状态卡片、信息面板的基础 | ✓ |
| Badge | Agent 状态标签、分类标记 | ✓ |
| Separator | HUD 分隔线、发光效果容器 | ✓ |

**User's choice:** 全选（Button, Card, Badge, Separator）
**Notes:** 无额外说明

---

## 文件目录结构

### 项目文件组织

| Option | Description | Selected |
|--------|-------------|----------|
| 根目录平铺（现状） | app/gateway/stores/lib/types 在根目录，加 components/ 目录 | ✓ |
| src/ 包裹 | 统一收到 src/ 下，旧版就是这个结构 | |

**User's choice:** 根目录平铺（现状）
**Notes:** 保持当前结构，不迁移到 src/

### Route Group 方案

**讨论背景:** 用户询问 Shell 布局是什么以及为什么需要。解释了 Shell 布局 = 侧栏导航 + 主内容区 + 底部状态栏的固定框架，以及 Next.js App Router 通过 Route Group `(shell)` 实现。

**User's choice:** 同意使用 `(shell)` route group 方案
**Notes:** 目录结构 `app/(shell)/dashboard/`、`app/(shell)/office/`、`app/(shell)/workspace/`

---

## Claude's Discretion

- shadcn/ui 具体初始化命令和参数
- components.json 配置细节
- 是否需要额外的 devDependencies

## Deferred Ideas

None — discussion stayed within phase scope
