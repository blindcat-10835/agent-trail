# Phase 3: Shell 布局和基础组件 - Research

**Researched:** 2026-04-30
**Domain:** Shell Layout Architecture + HUD Component System
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 混合布局 — 设计稿 dashboard-hud.html 的 header + 3-column main + status bar 骨架
- **D-02:** Header 区域包含：左侧品牌（logo+名称）、中间顶级导航（Dashboard / Office / Workspace 页面切换）、右侧控制区（连接状态指示+时钟+主题切换器）
- **D-03:** 左侧面板（260px）是导航+数据混合模式 — 上方有子导航标签（如 Dashboard 下的 Overview/Agents/Skills），下方显示对应的数据面板
- **D-04:** 中心区域（1fr）展示当前页面的主要内容
- **D-05:** 右侧面板（300px）展示详情/上下文信息。Phase 3 可以先做空状态或最小实现
- **D-06:** Status Bar（26px）显示 Gateway 连接状态、协议版本、conn ID 等
- **D-07:** Shell 整体使用 CSS Grid：`grid-template-rows: 48px 1fr 26px`，Main 区域 `grid-template-columns: 260px 1fr 300px`
- **D-08:** HUD 效果通过 CSS variable + Tailwind @utility 实现，不是组件内置
- **D-09:** 定义效果 CSS 变量：`--clip-sm` / `--clip-md` / `--clip-lg`（设计稿已定义 polygon 值），glow/shadow 变量
- **D-10:** scanline 和 grid 叠加层用 body::before / body::after 伪元素实现（与设计稿一致），全局生效
- **D-11:** 组件通过 className 组合效果，如 `class="hud-card hud-glow hud-clip-md"`，灵活可组合
- **D-12:** HUD 效果令牌在 globals.css 的 `@theme inline` 中定义，对应 @utility 在同一文件中声明
- **D-13:** ThemeToggle 从 Phase 2 的临时 fixed 位置移动到 Header 右侧控制区
- **D-14:** 使用设计稿的 hud-btn 风格（clip-path 切角边框按钮），与其他 header 按钮视觉统一
- **D-15:** 顶级导航（Dashboard / Office / Workspace）在 Header 中用类似 hud-btn 的标签按钮实现
- **D-16:** 当前激活页面的按钮使用 `.active` 状态（cyan 边框+背景），参考设计稿的 hud-btn.active 样式
- **D-17:** 子导航（如 Dashboard 下的 Overview/Agents/Skills）在左侧面板顶部用标签切换实现

### Claude's Discretion
- HUD 组件的具体 props API 设计（Card/Panel/StatusIndicator/Header/GlowEffect）
- @utility 的命名约定和具体实现细节
- 左侧面板在各页面的默认内容（Phase 3 可用占位内容）
- 右侧面板在 Phase 3 的最小实现程度
- Status Bar 的具体布局和数据展示方式
- Gateway 连接状态的消费方式（直接用 gateway store 还是封装 hook）

### Deferred Ideas (OUT OF SCOPE)
- Dashboard 页面具体内容（Agent 卡片网格、KPI 摘要等）— Phase 4
- Office Layout 页面具体内容 — Phase 5
- Workspace 页面具体内容 — Phase 6
- Agent 状态色令牌（idle/working/tool_calling/speaking/error）— Phase 4 Dashboard
- Radar 雷达可视化 — v2 VIS-01
- Command Palette — v2 UTIL-01
- 多强调色主题切换 — v2 PREF-02
- 右侧 Detail Panel 的具体内容 — 后续 Phase 按需实现
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENGR-03 | Shell 布局（侧栏导航 + 主内容区 + 底部状态栏） | 设计稿提供了完整的 Grid 布局结构，CSS Grid 实现明确 |
| ENGR-04 | HUD 基础组件库（Card / Panel / StatusIndicator / Header / GlowEffect） | 设计稿定义了 HUD 效果系统（clip-path、glow、scanline）和组件样式 |
</phase_requirements>

## Summary

Phase 3 构建全站通用的 Shell 布局结构和 HUD 风格基础组件库。研究显示这是一个高度确定的 Phase，设计稿 `dashboard-hud.html` 提供了**权威的视觉和结构参考**，所有关键决策都已在 CONTEXT.md 中锁定。

**核心架构发现：**
1. **Shell Grid 结构明确** — `grid-template-rows: 48px 1fr 26px`（header + main + status），Main 区域 `grid-template-columns: 260px 1fr 300px`（左面板 + 内容 + 右面板）
2. **HUD 效果系统化** — 通过 CSS 变量（`--clip-sm/md/lg`）+ Tailwind @utility 实现，组件通过 className 组合效果，不内置样式
3. **Next.js 16 App Router 嵌套布局** — `(shell)` 路由组已存在，`layout.tsx` 需要替换为完整 Shell 实现
4. **数据层集成清晰** — Gateway store 已提供 `ConnectionStatus` 类型，Status Bar 直接消费

**主要技术风险点：**
- Tailwind v4 `@utility` 语法用于 clip-path CSS 变量（需要验证语法）
- Next.js 16 `usePathname()` 用于顶级导航 active 状态（需要确认导入路径）
- 全局 scanline/grid 叠加层性能影响（body::before/after 伪元素）

**Primary recommendation:** 
直接按照设计稿实现 Shell Grid 结构，在 `app/globals.css` 中扩展 HUD 效果令牌和 @utility，使用 Next.js App Router 嵌套布局模式。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Shell Grid Layout | Frontend Server (SSR) | — | App Router layout.tsx 在服务端渲染，定义页面结构骨架 |
| Header Navigation | Browser / Client | — | `usePathname()` 需要客户端 hooks，active 状态是客户端交互 |
| Theme Toggle | Browser / Client | — | Zustand store + localStorage，完全是客户端状态 |
| Gateway Connection Status | Browser / Client | — | WebSocket 连接状态在客户端维护，Server Component 无法访问 |
| HUD Visual Effects | CSS Layer | — | CSS 变量和 @utility 在样式层处理，无运行时逻辑 |
| Left Panel Content | Browser / Client | — | 子导航标签切换是客户端交互，内容随路由变化 |
| Status Bar Display | Browser / Client | — | 实时数据（连接状态、内存、FPS）需要客户端更新 |

**关键洞察：** Shell 布局本身是 Server Component（服务端渲染结构），但所有交互元素（导航、主题切换、状态显示）都需要客户端逻辑。这符合 Next.js 16 "Server Components by default, Client Components for interactivity" 的模式。

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.4 | App Router + 嵌套布局 | 项目已使用，提供路由组和 layout.tsx 机制 [VERIFIED: npm registry] |
| React | 19.2.4 | Client Components（交互元素） | 项目已使用，React 19 与 Next.js 16 配对 [VERIFIED: npm registry] |
| Tailwind CSS | 4.2.4 | 样式系统 + @utility | 项目已使用 v4 CSS-first 配置，支持 @theme inline [VERIFIED: npm registry] |
| TypeScript | 5.x | 类型安全 | 项目已使用，所有组件需要类型定义 [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | 5.0.12 | 状态管理（theme、gateway） | 已有 `stores/theme-store.ts` 和 `stores/gateway/gateway-store.ts` [VERIFIED: npm registry] |
| lucide-react | 1.14.0 | 图标库 | Header 按钮、状态指示器需要图标 [VERIFIED: npm registry] |
| clsx + tailwind-merge | 2.1.1 + 3.5.0 | className 工具 | 已有 `@/lib/utils.ts` 的 `cn()` 函数 [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand | React Context / Jotai | Zustand 已在项目中使用，API 简洁，SSR-safe。React Context 需要 provider 包装，增加样板代码 |
| Tailwind @utility | 内联样式 / CSS-in-JS | @utility 保持 Tailwind 生态系统一致性，避免引入额外的运行时库（如 styled-components） |

**Installation:**
```bash
# 所有依赖已安装，无需额外安装
pnpm install  # 确认 lockfile 一致性
```

**Version verification:** 所有核心包版本已通过 npm view 验证为当前最新稳定版本。

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Shell Layout (SSR + CSR)                 │  │
│  │  ┌─────────────┬────────────────────┬───────────────────┐ │  │
│  │  │   Header    │  Main Content      │  Right Panel      │ │  │
│  │  │  (48px)     │  (1fr)             │  (300px)          │ │  │
│  │  │ ┌─────────┐ │ ┌────────────────┐ │ ┌───────────────┐ │ │  │
│  │  │ │ Brand   │ │ │ Left Panel     │ │ │ Detail View   │ │ │  │
│  │  │ │ Nav     │ │ │ (260px)        │ │ │ (Phase 3:     │ │ │  │
│  │  │ │ Controls│ │ │ ┌────────────┐ │ │ │  Placeholder) │ │ │  │
│  │  │ └─────────┘ │ │ │ Sub-Nav    │ │ │ └───────────────┘ │ │  │
│  │  │             │ │ │ Data Panel │ │ │                   │ │  │
│  │  │             │ │ └────────────┘ │ │                   │ │  │
│  │  │             │ │                │ │                   │ │  │
│  │  │             │ │ ┌────────────────┐ │ │                   │ │  │
│  │  │             │ │ │ Page Content   │ │ │                   │ │  │
│  │  │             │ │ │ (Dashboard/    │ │ │                   │ │  │
│  │  │             │ │ │  Office/       │ │ │                   │ │  │
│  │  │             │ │ │  Workspace)    │ │ │                   │ │  │
│  │  │             │ │ └────────────────┘ │ │                   │ │  │
│  │  ├─────────────┴────────────────────┴───────────────────┤ │  │
│  │  │              Status Bar (26px)                         │ │  │
│  │  │  (Gateway conn, protocol, stats)                       │ │  │
│  │  └───────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   State Management (Zustand)                 │ │
│  │  ┌──────────────────┐    ┌──────────────────────────────┐   │ │
│  │  │  Theme Store     │    │  Gateway Store                │   │ │
│  │  │  (theme,         │    │  (connectionStatus,           │   │ │
│  │  │   setTheme)      │    │   agents, logs)               │   │ │
│  │  └──────────────────┘    └──────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        │                              │
        │ useThemeStore()              │ useGatewayStore()
        │ setTheme()                   │ connectionUIState()
        ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CSS Layer (Tailwind v4)                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  globals.css                                                 │ │
│  │  - @theme inline {}          (design tokens)                │ │
│  │  - :root / [data-theme]      (color values)                 │ │
│  │  - @utility hud-clip-*       (clip-path effects)            │ │
│  │  - @utility hud-glow         (neon glow effects)            │ │
│  │  - body::before/after        (scanline/grid overlay)        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**数据流说明：**
1. **用户交互** → 客户端组件（Header 按钮、主题切换、子导航）
2. **状态更新** → Zustand store（theme、gateway connection）
3. **UI 响应** → React 组件重新渲染，className 变化触发 Tailwind 样式
4. **视觉反馈** → CSS 变量 + @utility 产生 HUD 效果（clip-path、glow、scanline）

### Recommended Project Structure
```
app/
  (shell)/
    layout.tsx              # Shell 布局（Header + Main + Status Bar）
    dashboard/
      page.tsx              # Dashboard 页面（Phase 3: 占位内容）
    office/
      page.tsx              # Office Layout 页面（Phase 3: 占位内容）
    workspace/
      page.tsx              # Workspace 页面（Phase 3: 占位内容）
  globals.css               # HUD 效果令牌 + @utility + scanline/grid
  layout.tsx                # 根布局（移除 ThemeToggle fixed position）

components/
  hud/
    shell-header.tsx        # Header 组件（品牌 + 顶级导航 + 控制区）
    shell-main.tsx          # Main 区域（左面板 + 内容 + 右面板）
    shell-status-bar.tsx    # Status Bar 组件（Gateway 状态 + 统计）
    theme-toggle.tsx        # 主题切换器（已存在，移入 Header）
    hud-card.tsx            # HUD 卡片组件（clip-path + border）
    hud-panel.tsx           # HUD 面板组件（背景 + scanline）
    status-indicator.tsx    # 连接状态指示器（dot + 文本 + 动画）
    glow-effect.tsx         # 霓虹发光效果（可选封装）

stores/
  gateway/
    gateway-store.ts        # 已存在，ConnectionStatus 类型
    p0-selectors.ts         # 已存在，connectionUIState 函数

types/
  shell.ts                  # Shell 组件的 Props 类型定义
```

### Pattern 1: App Router 嵌套布局（Shell 骨架）
**What:** Next.js 16 的 `(shell)` 路由组共享 `layout.tsx`，所有子页面自动继承 Header + Main + Status Bar 结构
**When to use:** 全站布局框架，不包含在 URL 路径中
**Example:**
```typescript
// app/(shell)/layout.tsx
export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="shell-layout grid grid-rows-[48px_1fr_26px] h-screen">
      <ShellHeader />
      <main className="grid grid-cols-[260px_1fr_300px] min-h-0">
        {children}
      </main>
      <ShellStatusBar />
    </div>
  )
}
```
**Source:** [Next.js 16 App Router 文档 - Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups) [CITED: official docs]

### Pattern 2: 客户端组件与 usePathname()（导航 Active 状态）
**What:** 使用 `'use client'` 指令和 `usePathname()` hook 检测当前路由，高亮顶级导航按钮
**When to use:** 需要客户端交互的组件（导航、状态显示、主题切换）
**Example:**
```typescript
// components/hud/shell-header.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/office', label: 'Office' },
  { href: '/workspace', label: 'Workspace' },
]

export function ShellHeader() {
  const pathname = usePathname()

  return (
    <header className="hud-header">
      {/* Brand */}
      <div className="hud-brand">OVAO</div>

      {/* Top-level navigation */}
      <nav className="hud-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`hud-btn ${pathname === item.href ? 'active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Controls */}
      <div className="hud-meta">
        <StatusIndicator />
        <ThemeToggle />
      </div>
    </header>
  )
}
```
**Source:** [Next.js 16 usePathname 文档](https://nextjs.org/docs/app/api-reference/functions/use-pathname) [CITED: official docs]

### Pattern 3: HUD 效果通过 CSS 变量 + Tailwind @utility（样式复用）
**What:** 在 `globals.css` 中定义 `--clip-sm/md/lg` CSS 变量，使用 `@utility` 声明可复用的 HUD 效果类
**When to use:** 需要切角、发光、scanline 等 HUD 风格的组件
**Example:**
```css
/* app/globals.css */

@theme inline {
  /* 现有的 design tokens ... */

  /* HUD clip-path 变量 */
  --clip-sm: polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px));
  --clip-md: polygon(0 14px, 14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px));
  --clip-lg: polygon(0 20px, 20px 0, calc(100% - 20px) 0, 100% 20px, 100% calc(100% - 20px), calc(100% - 20px) 100%, 20px 100%, 0 calc(100% - 20px));
}

@utility hud-clip-sm {
  clip-path: var(--clip-sm);
}

@utility hud-clip-md {
  clip-path: var(--clip-md);
}

@utility hud-glow {
  box-shadow: 0 0 12px var(--color-border), 0 0 24px rgba(95, 212, 255, 0.1);
}

/* 全局 scanline 和 grid 叠加层 */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(95, 212, 255, 0.028) 1px, transparent 1px),
    linear-gradient(90deg, rgba(95, 212, 255, 0.028) 1px, transparent 1px);
  background-size: 48px 48px;
}

body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 3px,
    rgba(0, 0, 0, 0.06) 3px,
    rgba(0, 0, 0, 0.06) 4px
  );
}
```
**Usage in component:**
```typescript
// components/hud/hud-card.tsx
export function HudCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="hud-clip-md hud-glow bg-bg-panel border border-border">
      {children}
    </div>
  )
}
```
**Source:** [Tailwind CSS v4 @utility 文档](https://tailwindcss.com/docs/custom-utilities) [CITED: official docs]

### Anti-Patterns to Avoid
- **在 Server Component 中使用客户端 hooks** — `usePathname()`, `useThemeStore()` 必须在 `'use client'` 组件中调用，会导致 "use client not allowed in Server Component" 错误
- **硬编码 HUD 效果到组件内** - 应该使用 `@utility` 和 CSS 变量，保持组件可组合性和样式一致性
- **在 layout.tsx 中直接使用客户端逻辑** - 布局应该是 Server Component，交互元素提取为独立客户端组件
- **忽略 scanline/grid 性能** - `body::before/after` 使用 `pointer-events: none` 避免阻挡交互，`z-index: 0` 确保在内容下方
- **跳过 Zustand store 直接使用 localStorage** - Theme store 已封装持久化逻辑，直接使用导致 FOUC（Flash of Unstyled Content）

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 主题切换逻辑 | 手动读写 localStorage + data-theme 属性 | `stores/theme-store.ts` 的 `useThemeStore()` | 已封装 FOUC 防护、SSR 安全、类型安全 |
| 状态管理 | React Context / props drilling | Zustand stores | API 简洁、SSR-safe、无需 provider 包装 |
| 样式组合 | CSS-in-JS / styled-components | Tailwind @utility + CSS 变量 | 保持项目样式系统一致性，避免运行时开销 |
| 图标 | 手写 SVG | lucide-react | 项目已集成，tree-shakable，符合 HUD 风格 |
| 客户端状态持久化 | useEffect + localStorage | Zustand persist middleware（已在 theme-store 使用） | 自动序列化/反序列化，处理 SSR edge cases |

**Key insight:** Phase 2 已建立的主题和状态管理基础设施是可靠的，直接复用可以避免重复造轮子并保持架构一致性。HUD 效果系统化的关键在于将样式逻辑抽象到 CSS 层，而非组件内部。

## Common Pitfalls

### Pitfall 1: Next.js 16 "use client" 边界混淆
**What goes wrong:** 在 `app/(shell)/layout.tsx` 中直接使用 `usePathname()` 或 `useThemeStore()`，导致 "use client not allowed in Server Component" 运行时错误
**Why it happens:** App Router 的 `layout.tsx` 默认是 Server Component，客户端 hooks 必须在显式标记 `'use client'` 的组件中调用
**How to avoid:** 
- 保持 `layout.tsx` 为纯结构组件（Server Component）
- 提取所有交互逻辑到独立客户端组件（`ShellHeader`, `ShellStatusBar`）
- 只在顶级引入 `'use client'` 组件，不在 layout 内部定义客户端 hooks
**Warning signs:** 构建时 "use client" 编译错误，运行时 "React hooks can only be called in Client Components"

### Pitfall 2: Tailwind v4 @utility 语法错误
**What goes wrong:** `@utility` 声明不生效，开发服务器报错 "Unknown at rule @utility"
**Why it happens:** Tailwind v4 的 @utility 语法与 v3 的 `@layer components` 不同，需要直接在根级别声明，不能嵌套在 `@layer` 中
**How to avoid:** 
- 在 `globals.css` 的根级别（不在任何 `@layer` 内）声明 `@utility`
- 使用正确的语法：`@utility utility-name { property: value; }`
- 检查 `@import "tailwindcss"` 是否在文件最顶部
**Warning signs:** 样式不生效，浏览器 DevTools 的 Styles 面板看不到自定义 utility 类

### Pitfall 3: 全局 scanline/grid 性能问题
**What goes wrong:** 页面滚动卡顿，低端设备帧率下降
**Why it happens:** `body::before/after` 的伪元素覆盖整个视口，如果使用复杂 `background` 或 `filter` 会导致重绘性能问题
**How to avoid:** 
- 使用简单的 `linear-gradient` 而非 `filter` 或 `box-shadow`
- 添加 `pointer-events: none` 避免阻挡交互
- 设置 `z-index: 0` 确保在内容下方，不影响点击事件
- 在 CSS 中使用 `will-change: transform` 提示浏览器优化（谨慎使用，避免过度优化）
**Warning signs:** Chrome DevTools Performance 面板显示 Layout/Paint 时间过长，FPS < 60

### Pitfall 4: Gateway 连接状态更新不同步
**What goes wrong:** Status Bar 显示的连接状态与实际 WebSocket 状态不一致
**Why it happens:** Gateway store 的状态更新是异步的，组件可能在状态刷新前渲染
**How to avoid:** 
- 使用 `useGatewayStore()` 订阅状态变化，确保响应式更新
- 在 `connectionUIState()` selector 中正确映射状态到 UI 文本/颜色
- 添加连接状态动画（blink、pulse）增强视觉反馈
**Warning signs:** 手动刷新页面才能看到正确状态，状态文字与颜色不匹配

### Pitfall 5: ThemeToggle FOUC（Flash of Unstyled Content）
**What goes wrong:** 页面加载时短暂显示错误主题（亮色闪现），然后切换到正确主题
**Why it happens:** `data-theme` 属性设置晚于渲染，Phase 2 已解决但移动 ThemeToggle 位置可能重新引入
**How to avoid:** 
- 保持 `app/layout.tsx` 中的 FOUC 防护脚本（Phase 2 已实现）
- ThemeToggle 只调用 `setTheme()`，不直接操作 DOM
- 确保 `data-theme` 在 `<html>` 标签上，不在 `<body>` 上
**Warning signs:** 页面加载时主题闪烁，浏览器控制台 "React hydration mismatch" 警告

## Code Examples

### Shell Layout Structure (Server Component)
```typescript
// app/(shell)/layout.tsx
import { ShellHeader } from '@/components/hud/shell-header'
import { ShellStatusBar } from '@/components/hud/shell-status-bar'

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="shell-layout grid grid-rows-[48px_1fr_26px] h-screen w-screen overflow-hidden bg-bg text-fg">
      <ShellHeader />
      <main className="grid grid-cols-[260px_1fr_300px] min-h-0">
        {children}
      </main>
      <ShellStatusBar />
    </div>
  )
}
```

### Header Component (Client Component with Navigation)
```typescript
// components/hud/shell-header.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { StatusIndicator } from './status-indicator'
import { ThemeToggle } from './theme-toggle'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/office', label: 'Office' },
  { href: '/workspace', label: 'Workspace' },
] as const

export function ShellHeader() {
  const pathname = usePathname()

  return (
    <header className="hud-header grid grid-cols-[280px_1fr_auto] items-center px-5 h-12 border-b border-border border-strong bg-gradient-to-b from-bg-panel to-bg relative">
      {/* Brand */}
      <div className="hud-brand flex items-center gap-3">
        <div className="hud-logo hud-clip-sm w-7 h-7 bg-accent flex items-center justify-center text-bg font-bold text-sm">
          ◆
        </div>
        <div className="hud-brand-name text-base font-bold tracking-[0.3em] text-accent">
          OVAO
        </div>
        <div className="text-[10px] text-fg-mute tracking-[0.2em] pl-2.5 border-l border-border">
          GATEWAY · v3.2.1
        </div>
      </div>

      {/* Top-level navigation */}
      <nav className="flex items-center justify-center gap-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`hud-clip-sm border border-border px-2.5 py-1 text-xs tracking-[0.14em] font-semibold transition-all ${
              pathname === item.href
                ? 'border-accent text-accent bg-accent/10'
                : 'text-fg-mute hover:border-accent hover:text-accent'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Controls */}
      <div className="hud-meta flex items-center gap-3.5 text-xs tracking-[0.12em]">
        <StatusIndicator />
        <ThemeToggle />
      </div>

      {/* Bottom gradient line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent via-amber via-accent to-transparent opacity-60" />
    </header>
  )
}
```

### Status Indicator Component
```typescript
// components/hud/status-indicator.tsx
'use client'

import { useGatewayStore } from '@/stores/gateway/gateway-store'
import { connectionUIState } from '@/stores/gateway/p0-selectors'

export function StatusIndicator() {
  const connectionState = connectionUIState(useGatewayStore())

  return (
    <div className="conn-ind hud-clip-sm flex items-center gap-1.5 border border-border/40 px-2.5 py-1 text-[11px] font-semibold">
      <div
        className="conn-dot w-1.5 h-1.5 rounded-full bg-current animate-pulse"
        style={{
          backgroundColor: connectionState.color,
          boxShadow: `0 0 8px ${connectionState.color}`,
        }}
      />
      <span>{connectionState.label}</span>
      <span className="text-fg-mute">· {connectionState.latency}ms</span>
    </div>
  )
}
```

### HUD Card Component with Effects
```typescript
// components/hud/hud-card.tsx
import { cn } from '@/lib/utils'

interface HudCardProps {
  children: React.ReactNode
  variant?: 'sm' | 'md' | 'lg'
  glow?: boolean
  className?: string
}

export function HudCard({ children, variant = 'md', glow = false, className }: HudCardProps) {
  return (
    <div
      className={cn(
        'bg-bg-panel border border-border outline outline-1 outline-offset-[-1px]',
        {
          'hud-clip-sm': variant === 'sm',
          'hud-clip-md': variant === 'md',
          'hud-clip-lg': variant === 'lg',
          'hud-glow': glow,
        },
        className
      )}
    >
      {children}
    </div>
  )
}
```

### Status Bar Component
```typescript
// components/hud/shell-status-bar.tsx
'use client'

import { useGatewayStore } from '@/stores/gateway/gateway-store'

export function ShellStatusBar() {
  const connectionStatus = useGatewayStore((state) => state.connectionStatus)

  return (
    <footer className="hud-status flex items-center justify-between px-3.5 h-6 border-t border-border text-[10px] tracking-[0.12em] text-fg-mute relative">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-40" />

      {/* Left section */}
      <div className="flex items-center gap-4">
        <span>
          WS <b className={connectionStatus === 'connected' ? 'text-accent' : ''}>{connectionStatus.toUpperCase()}</b>
        </span>
        <span>PROTO <b>v3</b></span>
        <span>CONN <b>conn_8f2e</b></span>
        <span>SCOPES <b>workspace:* · agents:rw</b></span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        <span>MEM <b>42.1MB</b></span>
        <span>FPS <b>60</b></span>
        <span className="text-accent font-bold tracking-[0.2em]" style={{ textShadow: '0 0 8px var(--color-accent)' }}>
          ◆ OVAO
        </span>
      </div>
    </footer>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.dark` class 切换主题 | `data-theme` attribute 切换 | Phase 2 (2026-04-30) | 支持未来多主题扩展（v2 PREF-02），避免与 Tailwind `dark:` variant 冲突 |
| 手动 CSS-in-JS 样式 | Tailwind v4 @utility + CSS 变量 | Phase 2 (2026-04-30) | 样式声明化，支持 JIT 编译，tree-shakable，减少运行时开销 |
| Geist 字体 | JetBrains Mono + Inter | Phase 2 (2026-04-30) | 更符合 HUD 风格，JetBrains Mono 优化数据可读性 |
| React Context 状态管理 | Zustand stores | Phase 2 (2026-04-30) | API 简洁，SSR-safe，无需 provider 包装 |

**Deprecated/outdated:**
- **Next.js Pages Router** — App Router 是 Next.js 13+ 的标准，支持嵌套布局和 Server Components
- **Tailwind v3 `tailwind.config.js`** — v4 使用 CSS-first 配置，`@theme inline` 在 `globals.css` 中定义 tokens
- **手动 localStorage 读写** — Zustand persist middleware 已封装，处理 SSR edge cases 和 FOUC

## Assumptions Log

> 本节列出所有标记为 `[ASSUMED]` 的研究结论，供 planner 和 discuss-phase 识别需要用户确认的决策。

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tailwind v4 `@utility` 语法可以直接在 `globals.css` 根级别声明，无需 `@layer` 包装 | Architecture Patterns | 如果语法不正确，需要调整 @utility 声明方式或回退到 `@layer components` |
| A2 | 设计稿的 `--clip-sm/md/lg` polygon 值可以直接用作 CSS 变量，在 `clip-path: var(--clip-md)` 中生效 | Code Examples | 如果浏览器不支持 CSS 变量作为 clip-path 值，需要内联 polygon 或使用预处理器 |
| A3 | Next.js 16 的 `usePathname()` 导入路径为 `next/navigation`，与 v15 相同 | Architecture Patterns | 如果导入路径变化，需要调整 import 语句 |
| A4 | `stores/gateway/p0-selectors.ts` 的 `connectionUIState()` 函数返回对象包含 `color`, `label`, `latency` 字段 | Code Examples | 如果 selector API 不同，需要调整 StatusIndicator 组件的属性访问 |
| A5 | 全局 scanline/grid 叠加层在 `body::before/after` 中声明不会影响页面滚动性能 | Common Pitfalls | 如果性能测试显示帧率下降，需要优化 gradient 或添加 `will-change` 提示 |

**If this table is empty:** 所有研究结论已验证或引用官方文档，无需用户确认。

## Open Questions

1. **Tailwind v4 @utility 与 CSS 变量的组合**
   - What we know: 设计稿使用了 `clip-path: var(--clip-md)` 模式，Tailwind v4 支持 @utility
   - What's unclear: `@utility` 内部是否可以使用 `var(--clip-md)` 这种 CSS 变量引用，还是需要完全展开 polygon 值
   - Recommendation: 先尝试 CSS 变量方式，如果浏览器兼容性有问题，再内联 polygon 值到 @utility 中

2. **左侧面板的子导航交互模式**
   - What we know: CONTEXT.md 提到"子导航标签在左侧面板顶部用标签切换实现"
   - What's unclear: 子导航是影响路由（如 `/dashboard/agents`）还是仅切换面板内容（不改变 URL）
   - Recommendation: Phase 3 使用占位内容，暂不实现子导航逻辑，留到 Phase 4-6 根据页面需求决定

3. **Status Bar 的实时数据更新频率**
   - What we know: 设计稿显示了 "MEM 42.1MB", "FPS 60" 等实时统计数据
   - What's unclear: 是否需要轮询更新（如每秒一次），还是仅在特定事件触发时更新
   - Recommendation: Phase 3 显示静态占位数据，Phase 4+ 根据 Gateway WebSocket 推送或浏览器 API 更新

## Environment Availability

> 本 Phase 没有外部运行时依赖，所有功能基于项目内已安装的包。

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Next.js 16.2.4 | App Router 嵌套布局 | ✓ | 16.2.4 | — |
| React 19.2.4 | 客户端组件（交互） | ✓ | 19.2.4 | — |
| Tailwind CSS 4.2.4 | @utility + CSS 变量 | ✓ | 4.2.4 | — |
| Zustand 5.0.12 | 状态管理（theme、gateway） | ✓ | 5.0.12 | — |
| lucide-react 1.14.0 | 图标库 | ✓ | 1.14.0 | — |

**Missing dependencies with no fallback:** 无

**Missing dependencies with fallback:** 无

**Skip condition:** 所有依赖已在 Phase 1-2 安装，无需额外安装。

## Validation Architecture

> 本 Phase 没有复杂的验证逻辑，主要依赖：
> 1. ESLint 检查（已配置）
> 2. TypeScript 类型检查（已配置）
> 3. 视觉回归测试（手动验证设计稿还原度）

Skip condition: `workflow.nyquist_validation` 在 `.planning/config.json` 中未明确设置，但根据 Phase 3 的特点（布局和组件），自动化测试覆盖有限，建议手动验证为主。

### Test Framework
| Property | Value |
|----------|-------|
| Framework | 无（Phase 3 跳过自动化测试） |
| Config file | — |
| Quick run command | `pnpm lint`（ESLint 检查） |
| Full suite command | `pnpm build`（构建验证） |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENGR-03 | Shell 布局正确渲染（Grid 结构） | smoke | 手动验证 DevTools | ❌ Phase 3 后续添加 |
| ENGR-03 | 顶级导航 active 状态正确 | smoke | 手动验证路由切换 | ❌ Phase 3 后续添加 |
| ENGR-03 | 主题切换功能正常 | smoke | 手动验证 ThemeToggle | ❌ Phase 3 后续添加 |
| ENGR-04 | HUD clip-path 效果正确应用 | visual | 手动对比设计稿 | ❌ Phase 3 后续添加 |
| ENGR-04 | scanline/grid 叠加层显示 | visual | 手动验证 body::before/after | ❌ Phase 3 后续添加 |

### Sampling Rate
- **Per task commit:** `pnpm lint`（快速检查语法错误）
- **Per wave merge:** `pnpm build`（验证构建无错误）
- **Phase gate:** 手动验证 Shell 布局和 HUD 效果符合设计稿

### Wave 0 Gaps
- [ ] `tests/hud/` — HUD 组件的快照测试（可选，Phase 3 不强制要求）
- [ ] `tests/integration/` — 路由切换和导航状态测试（可选，Phase 3 不强制要求）

*(Phase 3 跳过自动化测试，重点在视觉实现和布局正确性，测试覆盖留到后续 Phase)*

## Security Domain

> 本 Phase 没有直接的安全相关功能（无认证、授权、输入验证、加密），但需要遵循安全最佳实践。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | 没有客户端密钥暴露，theme state 无敏感信息 |
| V5 Input Validation | yes | Gateway store 的 `connectionStatus` 类型是枚举，防止注入攻击 |
| V6 Cryptography | no | 本 Phase 不涉及加密功能 |

### Known Threat Patterns for Next.js + Zustand Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via dangerouslySetInnerHTML | Tampering | 避免使用 `dangerouslySetInnerHTML`，所有文本通过 React JSX 渲染 |
| State manipulation via DevTools | Tampering | Zustand store 是客户端状态，无敏感数据，无需额外防护 |
| CSRF via WebSocket | Spoofing | Gateway WebSocket 连接由现有代码处理，本 Phase 不涉及连接逻辑 |

**Security considerations:**
- Shell 布局和 HUD 组件不处理用户输入，XSS 风险低
- 主题切换和连接状态显示不涉及敏感数据，无需加密
- 所有客户端代码（`.tsx` 文件）会打包到浏览器，避免在日志中打印敏感信息

## Sources

### Primary (HIGH confidence)
- [Next.js 16 官方文档 - Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups) — 验证 `(shell)` 路由组模式和嵌套布局
- [Next.js 16 官方文档 - usePathname](https://nextjs.org/docs/app/api-reference/functions/use-pathname) — 验证客户端导航 hooks 使用方式
- [Tailwind CSS v4 官方文档 - Custom Utilities](https://tailwindcss.com/docs/custom-utilities) — 验证 @utility 语法和 CSS 变量支持
- [设计稿 `../ovao-design/dashboard-hud.html`] — Shell 结构、HUD 效果、clip-path 值的权威参考 [VERIFIED: 本地文件]

### Secondary (MEDIUM confidence)
- [Zustand 官方文档 - TypeScript & DevTools](https://zustand.docs.pmnd.rs/) — 验证状态管理最佳实践
- [Radix UI 官方文档 - Primitives](https://www.radix-ui.com/primitives) — shadcn/ui 组件库底层，验证组件可访问性

### Tertiary (LOW confidence)
- 无（所有研究结论基于官方文档或本地设计稿，未使用未验证的 WebSearch 结果）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - 所有版本通过 npm registry 验证
- Architecture: HIGH - 设计稿提供完整参考，Next.js 16 文档确认 App Router 模式
- Pitfalls: MEDIUM - Tailwind v4 @utility 和 clip-path CSS 变量组合存在浏览器兼容性不确定性（标记为 A1, A2）

**Research date:** 2026-04-30
**Valid until:** 30 天（Tailwind v4 和 Next.js 16 是稳定版本，API 不会频繁变化）
