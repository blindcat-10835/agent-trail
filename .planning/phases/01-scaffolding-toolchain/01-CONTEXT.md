# Phase 1: 脚手架和工具链 - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

建立可扩展的开发环境，配置工具链和基础构建流程。确保 Next.js 16 + Tailwind v4 + ESLint + shadcn/ui 全部就绪可用。

设计令牌、字体替换、HUD 主题属于 Phase 2，不在本 Phase 范围内。

</domain>

<decisions>
## Implementation Decisions

### shadcn/ui 配置策略
- **D-01:** CSS 变量格式使用 OKLCH（shadcn/ui Nova 预设默认，感知均匀性更好），Phase 2 再定制 HUD 主题色值
- **D-02:** Phase 1 安装基础组件：Button, Card, Badge, Separator（后续 phase 按需添加更多）
- **D-03:** shadcn/ui 初始化使用 `npx shadcn@latest init`，采用 Nova 预设（radix-nova style）

### 文件目录结构
- **D-04:** 保持根目录平铺结构（app/, gateway/, stores/, lib/, types/ 在根目录），新增 components/ 目录
- **D-05:** App Router 使用 `(shell)` route group 包裹主页面，共享 Shell 布局
- **D-06:** 页面目录结构：`app/(shell)/dashboard/`、`app/(shell)/office/`、`app/(shell)/workspace/`
- **D-07:** components/ 目录分为 `components/ui/`（shadcn/ui 组件）和 `components/hud/`（Phase 3 自定义 HUD 组件预留）

### Claude's Discretion
- shadcn/ui 具体初始化命令和参数
- components.json 配置细节
- 是否需要额外的 devDependencies

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目上下文
- `.planning/PROJECT.md` — 项目愿景、技术栈约束、开发约定
- `.planning/REQUIREMENTS.md` — ENGR-01 需求定义
- `.planning/ROADMAP.md` §Phase 1 — Phase 1 目标和成功标准

### 调研参考
- `.planning/research/STACK.md` — Tailwind v4 CSS-first 配置、shadcn/ui 定制化策略、Biome 配置

### 代码参考
- `AGENTS.md` — Next.js 16 breaking changes 警告（编码前必读 `node_modules/next/dist/docs/`）
- `package.json` — 当前依赖和脚本
- `eslint.config.mjs` — 当前 ESLint 配置（保持不变）
- `app/globals.css` — 当前 Tailwind v4 CSS-first 配置（`@import "tailwindcss"` + `@theme inline`）

### 设计参考（Phase 2 使用，Phase 1 无需深入）
- `../ovao-design/dashboard-hud.html` — HUD 视觉风格基准

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/layout.tsx`: 根布局已配置 next/font (Geist)，Phase 2 替换为 Rajdhani/JetBrains Mono
- `app/globals.css`: Tailwind v4 CSS-first 配置已就位（`@import "tailwindcss"` + `@theme inline`），Phase 2 扩展 HUD token
- `eslint.config.mjs`: ESLint + eslint-config-next 已配置正确，无需改动
- `postcss.config.mjs`: PostCSS + @tailwindcss/postcss 已配置正确，无需改动
- `tsconfig.json`: TypeScript 配置已就位，`@/*` 路径别名可用

### Established Patterns
- Tailwind v4 CSS-first: 使用 `@theme inline {}` 定义 token，不用 tailwind.config.js
- Next.js 16 App Router: 标准 app/ 目录结构
- pnpm: 包管理器已配置

### Integration Points
- shadcn/ui 组件安装到 `components/ui/`（通过 components.json 配置）
- `(shell)` route group 的 `layout.tsx` 将在 Phase 3 创建
- gateway/ 和 stores/ 已就位，本 phase 不涉及

</code_context>

<specifics>
## Specific Ideas

- 文件结构参考旧版 `../references/openclaw-visual-agent-office/src/` 但不使用 src/ 包裹
- 保持 ESLint（不用 Biome），eslint-config-next 已正确配置
- Route group `(shell)` 的 layout.tsx 在 Phase 3 实现，Phase 1 只建立目录骨架

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---
*Phase: 01-scaffolding-toolchain*
*Context gathered: 2026-04-30*
