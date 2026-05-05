# Phase 2: 设计令牌和主题系统 - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

建立 HUD 视觉风格的语义化颜色令牌系统和字体配置，实现 light/dark 双主题切换。覆盖 shadcn/ui 标准令牌的 HUD 色值，替换字体为 JetBrains Mono + Inter，创建主题切换器组件。

HUD 效果令牌（clip-path、glow、scanline、grid）属于 Phase 3，不在本 Phase 范围内。
Agent 状态色（idle/working/tool/speaking/error）属于 Phase 4 Dashboard，不在本 Phase 范围内。

</domain>

<decisions>
## Implementation Decisions

### 字体策略
- **D-01:** 主字体 JetBrains Mono（等宽编程字体，全站 UI 元素），辅助字体 Inter（无衬线，`.sans` class 场景）
- **D-02:** 使用 next/font/google 加载字体，通过 CSS 变量 `--font-sans`（Inter）和 `--font-mono`（JetBrains Mono）注入 Tailwind
- **D-03:** 字体 feature settings 启用 `"ss01", "ss02", "cv01"`（JetBrains Mono stylistic sets）

### 主题切换机制
- **D-04:** 使用 `data-theme` 属性切换主题（`data-theme="dark"` / `data-theme="light"`），不用 `.dark` class
- **D-05:** globals.css 中 `.dark` 选择器全部替换为 `[data-theme="dark"]`，`@custom-variant` 相应调整
- **D-06:** 默认跟随系统偏好（`prefers-color-scheme`），用户手动切换后用 localStorage 记住选择，下次访问恢复
- **D-07:** 根布局 `<html>` 标签添加 `data-theme` 属性，使用 inline script 避免闪烁（FOUC）

### 令牌范围
- **D-08:** Phase 2 覆盖 shadcn/ui 标准令牌的 HUD OKLCH 色值（background, foreground, primary, secondary, muted, accent, destructive, border, input, ring, card, popover, sidebar 等）
- **D-09:** Phase 2 新增强调色变体令牌：`--accent-bright`（主强调），`--accent-dim`（弱化），`--accent-ghost`（幽灵），基于设计稿 OKLCH 值
- **D-10:** HUD 效果令牌（clip-path, glow, scanline, grid overlay）推迟到 Phase 3 与 HUD 组件库一起实现
- **D-11:** Agent 状态色令牌推迟到 Phase 4 Dashboard 实现

### 主题切换器组件
- **D-12:** Phase 2 创建简单的亮/暗切换按钮组件，临时放在根布局可见位置
- **D-13:** Phase 3 Shell 布局时将切换器集成到正式位置（侧栏或 header 区域）
- **D-14:** 切换器使用 Zustand store 或 React context 管理主题状态，保持全局一致

### Claude's Discretion
- globals.css 具体的 OKLCH 色值映射（参考设计稿提取的色值）
- 主题状态管理的具体实现方式（Zustand store vs React context vs 自定义 hook）
- 切换器组件的具体样式和位置
- FOUC 防止脚本的具体实现
- 是否需要 `suppressHydrationWarning` 在 html 标签上

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目上下文
- `.planning/PROJECT.md` — 项目愿景、技术栈约束、开发约定
- `.planning/REQUIREMENTS.md` — ENGR-02 需求定义
- `.planning/ROADMAP.md` §Phase 2 — Phase 2 目标和成功标准

### 设计参考（核心）
- `../ovao-design/dashboard-hud.html` — HUD 视觉风格基准，颜色/字体/效果的权威参考
- `../ovao-design/dashboard.css` — CSS 样式，包含完整的 OKLCH 色值定义
- `../ovao-design/dashboard.html` — 布局结构参考

### 调研参考
- `.planning/research/STACK.md` — Tailwind v4 CSS-first 配置、shadcn/ui 定制化策略

### Phase 1 产出（前置依赖）
- `.planning/phases/01-scaffolding-toolchain/01-CONTEXT.md` — Phase 1 决策（OKLCH 格式、Nova 预设等）

### 代码参考
- `AGENTS.md` — Next.js 16 breaking changes 警告
- `app/globals.css` — 当前 shadcn/ui OKLCH 变量骨架（需覆盖）
- `app/layout.tsx` — 当前根布局（需替换字体、添加 data-theme）
- `components.json` — shadcn/ui 配置（确认 cssVariables: true）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/globals.css`: 已有完整的 `:root` 和 `.dark` OKLCH 变量骨架，需要替换色值和选择器
- `app/layout.tsx`: 已配置 next/font (Geist)，需要替换为 JetBrains Mono + Inter
- `@custom-variant dark` 已配置，需要调整为 data-theme 方式
- `@theme inline {}` 块已建立 Tailwind v4 令牌映射模式

### Established Patterns
- Tailwind v4 CSS-first: `@theme inline {}` 定义 token 映射，`:root` / `.dark` 定义色值
- OKLCH 格式: Phase 1 已确立，Phase 2 继续使用
- next/font: 通过 CSS 变量注入字体（`--font-geist-sans`, `--font-geist-mono`），Phase 2 替换变量名

### Integration Points
- 主题切换器需要与 `app/layout.tsx` 集成
- `data-theme` 属性需要在 SSR 和 CSR 中保持一致（防 FOUC）
- Zustand stores 已存在（`stores/`），可以添加主题状态 store
- Phase 3 的 Shell 布局和 HUD 组件将消费 Phase 2 建立的令牌

</code_context>

<specifics>
## Specific Ideas

- 设计稿已定义完整的 OKLCH 色值体系（accent 三级变体、背景四级层次、文本四级层次、边框两级），直接映射到 CSS 变量
- 强调色 hue 75 对应 cyan/teal 色调，设计稿使用 `--accent-h: 75` 实现动态 hue 旋转
- 字体 base size 12px（设计稿），比 Tailwind 默认的 16px 小，可能需要调整
- 宽 letter-spacing（0.18em-0.3em）用于 uppercase 标签，需要在字体令牌中考虑

</specifics>

<deferred>
## Deferred Ideas

- Rajdhani 字体 — 用户选择跟随设计稿使用 JetBrains Mono + Inter，不使用 Rajdhani
- HUD 效果令牌（clip-path, glow, scanline, grid overlay）— Phase 3 与 HUD 组件库一起实现
- Agent 状态色令牌（idle/working/tool/speaking/error）— Phase 4 Dashboard 实现
- 多强调色主题切换（cyan/amber/green/purple/red）— v2 PREF-02，data-theme 机制为此预留了扩展性

</deferred>

---
*Phase: 02-design-tokens-theme*
*Context gathered: 2026-04-30*
