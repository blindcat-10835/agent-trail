@AGENTS.md

# agent-tracing-dashboard

**Multi-source AI agent session tracing dashboard for OpenClaw, Claude Code, and Codex**

赛博朋克 HUD 风格的 multi-source AI agent session tracing dashboard。支持 OpenClaw、Claude Code、Codex 三个数据来源，提供 session browsing、turn replay 和 activity 追踪。

**Note**: This project was formerly known as OVAO (OpenClaw Visual Agents Office) during initial development.

## Commands

```bash
pnpm dev      # 开发服务器 (http://localhost:3000)
pnpm build    # 生产构建
pnpm start    # 启动生产服务器
pnpm lint     # ESLint (eslint-config-next)
```

包管理器是 **pnpm**（见 `pnpm-workspace.yaml`、`pnpm-lock.yaml`），不要用 npm/yarn。

## Tech Stack

- **Next.js 16.2.4** App Router + **React 19.2.4** + TypeScript
- **Tailwind v4** —— CSS-first 配置，主题在 `app/globals.css` 的 `@theme inline` 中，**没有** `tailwind.config.js`
- **shadcn/ui** —— `radix-nova` style, OKLCH 颜色, 基础色 `neutral`, lucide 图标（见 `components.json`）
- **Zustand** 状态管理
- ESLint 9（flat config in `eslint.config.mjs`）

## Architecture

```text
app/
  (shell)/              # 路由组 — 共享 Shell 布局 (sidebar + main + status bar)
    dashboard/          # Agent Dashboard
    office/             # Office Layout (2D 平面图)
    workspace/          # 单 Agent 终端/日志
    layout.tsx          # Shell layout
  globals.css           # Tailwind v4 + 主题 token (@theme inline)
  layout.tsx            # Root layout (Geist 字体 — 计划在 Phase 2 替换)
gateway/                # WebSocket RPC 客户端 (连接 ws://localhost:18789)
stores/
  gateway/              # Agent / 日志 / UI state (Zustand)
  office-layout/        # Office 平面图布局 store
components/ui/          # shadcn 组件 (button, card, badge, separator)
lib/
  utils.ts              # cn() — clsx + tailwind-merge
  gateway-config.ts     # 读写 .ovao-config.json (Gateway URL/Token)
types/                  # 共享类型
.planning/              # GSD 工作流文档 (PROJECT.md, ROADMAP.md, STATE.md, phases/)
```

路径别名：`@/*` → `./*`（见 `tsconfig.json`）。例：`@/lib/utils`、`@/components/ui/button`。

## Conventions

- **语言**：AI 文档/spec/plan 用**中文**；代码注释、变量名、commit message 用**英文**
- **视觉令牌**：用语义化 token（`bg-background`, `text-foreground`, `border-border`），不要硬编码颜色值
- **双主题**：light/dark 都要验证，WCAG AA 对比度
- **Multi-source 架构**：支持 OpenClaw、Claude Code、Codex 三个数据来源，通过 source switcher 切换
- 遵从代码范式：实现相似功能时先看有没有已经存在的类似代码。并且参考。

## Environment

`.env.local`（gitignored）需要：

- `NEXT_PUBLIC_API_BASE` — HTTP API 端点
- `NEXT_PUBLIC_GATEWAY_WS` — Gateway WebSocket URL

`.ovao-config.json`（运行时由 `lib/gateway-config.ts` 读写，存 Gateway URL/Token，**不要手动编辑**）。

## Gotchas

- **Next.js 16 breaking changes** — 见 AGENTS.md。写代码前读 `node_modules/next/dist/docs/`，不要凭记忆。
- **Tailwind v4 没有 `tailwind.config.js`** — 改主题/添加 token 全部在 `app/globals.css` 的 `@theme inline { ... }` 块里。
- **`(shell)` 是路由组**，不是 URL 段 —— `/dashboard` 而非 `/(shell)/dashboard`。
- **shadcn 添加组件**：`pnpm dlx shadcn@latest add <name>`，组件落在 `components/ui/`。preset 是 `radix-nova`，不要换成默认。
- **Gateway 必须在跑**（默认 `ws://localhost:18789`）才能测试 OpenClaw Dashboard/Workspace —— 没有 Gateway 时 UI 会卡在 loading。Claude Code/Codex sources 不依赖 Gateway。
- **GSD 工作流**：项目用 `.planning/` 跟踪 milestone/phase/plan。开新工作前看 `.planning/STATE.md` 了解当前 phase。不要手编 `.planning/` 里的 STATE/ROADMAP —— 用 `/gsd-*` 命令。
- **历史错误教训** → 见 [`docs/ERRORS_LEARNED.md`](docs/ERRORS_LEARNED.md)，写新组件前查阅避免重复踩坑。

## Skills

实现或修改功能前，**必须**调用以下 skill 获取最新规范，不要凭记忆写代码。调用方式：用 `Skill` tool 或聊天里输入 `/<skill-name>`，**不要**用 Read 读 skill 文件。

### Next.js / 核心栈

| 场景                                                                  | 使用的 skill                     |
| --------------------------------------------------------------------- | -------------------------------- |
| 任何 Next.js 相关功能（路由、渲染、layout、Server Actions）           | `vercel:nextjs`                |
| 写或改 React 组件（结构、hooks、a11y、性能、TS 模式）                 | `vercel:react-best-practices`  |
| 路由拦截、middleware、rewrite/redirect、locale                        | `vercel:routing-middleware`    |
| 缓存策略、Server Component 数据获取、PPR、`use cache`、`cacheTag` | `vercel:next-cache-components` |
| 升级 Next.js 版本（codemods、迁移指南）                               | `vercel:next-upgrade`          |
| 使用或新增 shadcn 组件、theming、自定义 registry                      | `vercel:shadcn`                |
| 处理环境变量（`.env*`、`vercel env`、OIDC token）                 | `vercel:env-vars`              |
| Turbopack 配置、优化 HMR、调试构建问题                                | `vercel:turbopack`             |
| Server-side 代码、Functions、Cron、流式响应                           | `vercel:vercel-functions`      |
| 端到端验证（浏览器 → API → 数据 → 响应）                           | `vercel:verification`          |

### GSD 工作流（本项目用 `.planning/` 跟踪）

| 场景                               | 使用的 skill                                                       |
| ---------------------------------- | ------------------------------------------------------------------ |
| 查看当前进度、决定下一步           | `gsd-progress`                                                   |
| 跨 session 恢复上下文              | `gsd-resume-work`                                                |
| Phase 三段式：讨论 → 规划 → 执行 | `gsd-discuss-phase` / `gsd-plan-phase` / `gsd-execute-phase` |
| 列出全部 GSD 命令                  | `gsd-help`                                                       |
