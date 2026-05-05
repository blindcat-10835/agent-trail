# Phase 3: Shell 布局和基础组件 - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

构建全站通用的 Shell 布局结构和 HUD 风格基础组件库。包含三个部分：

1. **Shell 布局** — Header（品牌+顶级导航+控制按钮）+ 3-column Main（左侧面板+中心内容+右侧面板）+ Status Bar（连接状态/系统信息）
2. **HUD 效果令牌系统** — clip-path 切角、霓虹发光、scanline/grid 叠加层的 CSS variable + @utility 实现
3. **HUD 基础组件库** — Card / Panel / StatusIndicator / Header / GlowEffect 等可复用 HUD 组件

Agent 状态色令牌（idle/working/tool_calling/speaking/error）属于 Phase 4 Dashboard，不在本 Phase 范围内。
具体的 Dashboard/Office/Workspace 页面内容属于后续 Phase，本 Phase 只提供 Shell 骨架和占位页面。

</domain>

<decisions>
## Implementation Decisions

### Shell 布局结构
- **D-01:** 采用混合布局 — 设计稿 dashboard-hud.html 的 header + 3-column main + status bar 骨架，不是 ROADMAP 原始描述的"左侧导航栏+主内容区+状态栏"
- **D-02:** Header 区域包含：左侧品牌（logo+名称）、中间顶级导航（Dashboard / Office / Workspace 页面切换）、右侧控制区（连接状态指示+时钟+主题切换器）
- **D-03:** 左侧面板（260px）是导航+数据混合模式 — 上方有子导航标签（如 Dashboard 下的 Overview/Agents/Skills），下方显示对应的数据面板（stats/alerts 等）。面板内容随当前页面变化
- **D-04:** 中心区域（1fr）展示当前页面的主要内容
- **D-05:** 右侧面板（300px）展示详情/上下文信息。Phase 3 可以先做空状态或最小实现
- **D-06:** Status Bar（26px）显示 Gateway 连接状态、协议版本、conn ID 等。参考设计稿的 hud-status 组件
- **D-07:** Shell 整体使用 CSS Grid：`grid-template-rows: 48px 1fr 26px`，Main 区域 `grid-template-columns: 260px 1fr 300px`

### HUD 效果实现
- **D-08:** HUD 效果通过 CSS variable + Tailwind @utility 实现，不是组件内置
- **D-09:** 定义效果 CSS 变量：`--clip-sm` / `--clip-md` / `--clip-lg`（设计稿已定义 polygon 值），glow/shadow 变量
- **D-10:** scanline 和 grid 叠加层用 body::before / body::after 伪元素实现（与设计稿一致），全局生效
- **D-11:** 组件通过 className 组合效果，如 `class="hud-card hud-glow hud-clip-md"`，灵活可组合
- **D-12:** HUD 效果令牌在 globals.css 的 `@theme inline` 中定义，对应 @utility 在同一文件中声明

### 主题切换器位置
- **D-13:** ThemeToggle 从 Phase 2 的临时 fixed 位置移动到 Header 右侧控制区
- **D-14:** 使用设计稿的 hud-btn 风格（clip-path 切角边框按钮），与其他 header 按钮视觉统一

### 页面导航
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目上下文
- `.planning/PROJECT.md` — 项目愿景、技术栈约束、开发约定
- `.planning/REQUIREMENTS.md` — ENGR-03 (Shell 布局) + ENGR-04 (HUD 基础组件库) 需求定义
- `.planning/ROADMAP.md` §Phase 3 — Phase 3 目标和成功标准
- `.planning/STATE.md` — 当前进度和上下文

### 设计参考（核心）
- `../ovao-design/dashboard-hud.html` — Shell 布局的权威参考：header 结构 (hud-head)、main 布局 (hud-main)、status bar (hud-status)、HUD 按钮样式 (hud-btn)
- `../ovao-design/dashboard.css` — CSS 样式，clip-path 变量、效果定义

### 前置 Phase 产出
- `.planning/phases/01-scaffolding-toolchain/01-CONTEXT.md` — Phase 1 决策（route group、组件目录）
- `.planning/phases/02-design-tokens-theme/02-CONTEXT.md` — Phase 2 决策（OKLCH tokens、data-theme、字体）

### 代码参考
- `AGENTS.md` — Next.js 16 breaking changes 警告
- `app/globals.css` — 现有 CSS 变量和 @theme inline 定义（需扩展 HUD 效果令牌）
- `app/layout.tsx` — 根布局（ThemeToggle 集成点、FOUC 脚本）
- `app/(shell)/layout.tsx` — 占位 Shell 布局（需替换为完整实现）
- `components/hud/theme-toggle.tsx` — ThemeToggle 组件（需从 fixed 位置移到 header）
- `stores/gateway/gateway-store.ts` — Gateway 状态（ConnectionStatus 类型、连接状态）
- `stores/gateway/p0-selectors.ts` — Gateway selectors（connectionUIState 函数）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/globals.css`: 完整的 OKLCH token 系统已建立，`@theme inline {}` 和 `@custom-variant dark` 已配置。Phase 3 在此基础上添加 HUD 效果变量和 @utility
- `app/layout.tsx`: 根布局已配置 JetBrains Mono + Inter、data-theme switching、FOUC prevention。Phase 3 需要调整 ThemeToggle 的位置
- `app/(shell)/layout.tsx`: 占位 Shell 布局，Phase 3 替换为完整的 3-column Grid 布局
- `app/(shell)/dashboard/page.tsx`: 占位 Dashboard 页面，Phase 3 保持占位但嵌入 Shell 骨架
- `components/hud/theme-toggle.tsx`: ThemeToggle 组件，Phase 3 移入 header 右侧
- `stores/gateway/gateway-store.ts`: Zustand store，导出 `ConnectionStatus` 类型（"connecting" | "connected" | "reconnecting" | "disconnected" | "error"），Status Bar 消费此状态
- `stores/gateway/p0-selectors.ts`: `connectionUIState()` 函数映射连接状态到 UI 状态

### Established Patterns
- Tailwind v4 CSS-first: `@theme inline {}` 定义 token，`:root` / `[data-theme="dark"]` 定义色值
- OKLCH 格式: Phase 1-2 已确立
- data-theme attribute switching: `[data-theme="dark"]` 选择器
- Zustand stores: `stores/` 目录下按 domain 组织
- `(shell)` route group: 共享布局，页面路由不包含 (shell) 前缀

### Integration Points
- Shell 布局在 `app/(shell)/layout.tsx` 中实现，所有 (shell) 下的页面自动继承
- Header 中的顶级导航使用 Next.js `usePathname()` + `<Link>` 组件
- Status Bar 消费 `stores/gateway/gateway-store.ts` 的 `connectionStatus` 字段
- ThemeToggle 移入 Header 右侧，从 `app/layout.tsx` 的 fixed position 移除
- HUD 组件放在 `components/hud/` 目录

</code_context>

<specifics>
## Specific Ideas

- 设计稿的 Shell Grid 尺寸：`grid-template-rows: 48px 1fr 26px`，Main 区域 `grid-template-columns: 260px 1fr 300px`
- clip-path 值已定义：`--clip-sm` (8px) / `--clip-md` (14px) / `--clip-lg` (20px) 的 polygon
- scanline 效果：`repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,.06) 3px, rgba(0,0,0,.06) 4px)`
- grid 效果：`linear-gradient` 交叉网格 48px 间距，rgba(95,212,255,.028) 色值
- Header 底部有渐变发光线：`linear-gradient(90deg, transparent, var(--cyan), var(--amber), var(--cyan), transparent)` opacity .6
- Status Bar 顶部有渐变发光线：`linear-gradient(90deg, transparent, var(--cyan), transparent)` opacity .4
- hud-btn 样式：clip-path 切角 + border + letter-spacing + hover/active 状态
- 连接状态指示器：绿色圆点 + blink 动画 + 状态文字

</specifics>

<deferred>
## Deferred Ideas

- Dashboard 页面具体内容（Agent 卡片网格、KPI 摘要等）— Phase 4
- Office Layout 页面具体内容 — Phase 5
- Workspace 页面具体内容 — Phase 6
- Agent 状态色令牌（idle/working/tool_calling/speaking/error）— Phase 4 Dashboard
- Radar 雷达可视化 — v2 VIS-01
- Command Palette — v2 UTIL-01
- 多强调色主题切换 — v2 PREF-02
- 右侧 Detail Panel 的具体内容 — 后续 Phase 按需实现

</deferred>

---
*Phase: 03-shell-layout-base-components*
*Context gathered: 2026-04-30*
