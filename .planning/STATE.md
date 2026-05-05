# OVAO Project State

**Project:** OpenClaw Visual Agents Office
**Core Value:** Agent 状态实时可视化 — 用户一眼掌握所有 Agent 运行状态
**Last Updated:** 2026-05-02

---

## Project Reference

**What This Is**:
OVAO 是 OpenClaw 平台的 Agent 可视化管理界面，让用户通过赛博朋克 HUD 风格的仪表盘实时监控、管理和交互多个 AI Agent。面向开发者和运维人员，提供 Agent 状态总览、Office 可视化布局和单 Agent 工作区视图。

**Core Value**:
Agent 状态实时可视化 — 用户一眼掌握所有 Agent 的运行状态，快速定位问题 Agent。

**Current Focus**:
Milestone M4 — Sessions Dashboard (✅ Complete) 和 Office Layout/Activity Console 待规划

---

## Current Position

**Milestone**: M4
**Phase**: 07-sessions-dashboard
**Plan**: 04 (complete) — Phase 7 complete
**Status**: Phase 7 complete — Full Sessions Dashboard with page integration, navigation updates, and Overview integration

**Progress Bar**:
```
M1 Foundation: [██████████] 100% (3/3 phases complete)
M2 Dashboard: [██████████] 100% (1/1 phases complete)
M3 Advanced Views: [░░░░░░░░░░] 0% (0/1 phases complete)
M4 Dashboard Enhancements: [██████████] 100% (4/4 plans complete, Phase 7 done)

Overall: [███████░░░] 71% (5/7 phases complete, Phase 7 done)
```

**Phase Progress**:
- Phase 1 (脚手架和工具链): ✅ Complete
- Phase 2 (设计令牌和主题系统): ✅ Complete (2026-04-30)
- Phase 3 (Shell 布局和基础组件): ✅ Complete (2026-04-30)
- Phase 4 (Agent Dashboard): ✅ Complete (2026-04-30)
- Phase 5 (Office Layout): Not started
- Phase 6 (Activity Console): Not started
- Phase 7 (Sessions Dashboard): ✅ Complete (2026-05-02)

---

## Performance Metrics

**Velocity**: 18 min/plan (Phase 2 Plan 1 completed in 18 min)
**Cycle Time**: TBD (after more completed phases)
**Lead Time**: TBD (after more completed phases)

**Quality Metrics**:
- ESLint violations: 0 (all builds passing)
- Theme contrast failures: 0 (WCAG AA compliant by design)
- Component test coverage: TBD (not tracking in M1)

---

## Accumulated Context

### Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 全站 HUD 风格 | 统一视觉体验，减少设计系统复杂度 | ✅ Implemented (Phase 2) |
| 数据层小范围适配 | 主体锁定降低风险，但允许加 selector 方便 UI 消费 | Pending |
| Tailwind v4 + shadcn/ui | 最新版本，Tailwind v4 用 CSS-first 配置，shadcn/ui 提供可复用组件基础 | ✅ Implemented (Phase 1-2) |
| 保持 ESLint | 项目已有 eslint-config-next，无需迁移到 Biome | Pending |
| M1 先做脚手架+令牌+Shell | 先建立基础设施再逐页面开发 | ✅ In progress (Phase 2 complete) |
| 设置/偏好推迟到 v2 | 不是核心价值，先聚焦可视化 | Pending |
| data-theme attribute switching | 替代 .dark class，支持未来多主题扩展（v2 accent colors） | ✅ Implemented (Phase 2) |
| Zustand over React Context | SSR-safe theme state management with less boilerplate | ✅ Implemented (Phase 2) |
| JetBrains Mono + Inter fonts | 替换 Geist，JetBrains Mono 用于数据/代码，Inter 用于 sans 场景 | ✅ Implemented (Phase 2) |

### Roadmap Evolution

- Phase 6 added: Activity Console — 替换 ALERT 为结构化事件日志流 (2026-05-02)
- Phase 7 added: Sessions Dashboard — 替换 Channels 为 AI 会话管理 (2026-05-02)
- M4 milestone added: Dashboard Enhancements (Phases 6-7)

### Technical Context

**Tech Stack**:
- Next.js 16 App Router + React 19 + TypeScript
- Tailwind v4 (CSS-first config with @theme inline)
- shadcn/ui (HUD-themed CSS variable overrides)
- Zustand (state management)
- ESLint (not Biome — keep existing eslint-config-next)
- pnpm (package manager)

**Data Layer** (already exists and stable):
- `gateway/` — WebSocket RPC client (connects to ws://localhost:18789)
- `stores/` — Zustand stores (manage agent/logs/UI state)

**Design System**:
- Fonts: JetBrains Mono (primary, data/code) + Inter (secondary, sans scenarios)
- Semantic tokens: text-foreground / bg-background / border-border (4-level hierarchy)
- Themes: light/dark dual theme with WCAG AA validation (data-theme attribute switching)
- HUD style: clip-path 切角 + scanline/grid overlay + 霓虹发光 (✅ Phase 3)

**Language Convention**:
- AI docs/spec/plan: 中文
- Code comments and variable names: 英文

**Critical Constraint**:
- AGENTS.md has Next.js 16 breaking changes warning — read `node_modules/next/dist/docs/` before writing code

### Dependencies

**External Dependencies**:
- OpenClaw Gateway (WebSocket RPC) — must be running for Dashboard/Workspace testing
- 旧版源码 (../references/openclaw-visual-agent-office/) — reference for data layer patterns
- 新设计稿 (../ovao-design/) — dashboard-hud.html is visual style baseline

**Internal Dependencies**:
- Phase 2 depends on Phase 1 (Tailwind v4 config needed for design tokens)
- Phase 3 depends on Phase 2 (design tokens needed for Shell/HUD components)
- Phase 4 depends on Phase 3 (Shell layout needed for Dashboard page)
- Phase 5 depends on Phase 3 (Shell layout needed for Office Layout page)

### Blockers

**Current Blockers**: None

**Potential Blockers**:
- Next.js 16 breaking changes — may impact App Router patterns
- Tailwind v4 CSS-first config — unfamiliar to team, requires learning
- Gateway connection — need running Gateway instance for integration testing
- shadcn/ui theming — need to override CSS variables for HUD style

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 20260502-001 | Stale-while-revalidate dashboard snapshot cache | 2026-05-02 | 2fa2dfb | [20260502-001-dashboard-snapshot-cache](./quick/20260502-001-dashboard-snapshot-cache/) |
| 260502-a1b | Overview cron activity 行点击弹出右侧 detail 面板 | 2026-05-02 | aca3525 | [260502-a1b-cron-activity-detail-panel](./quick/260502-a1b-cron-activity-detail-panel/) |
| 20260502-002 | Phase 7 UI fixes: remove Sessions header nav, session detail overlay drawer, SES page layout | 2026-05-02 | 8ce7800 | [20260502-002-phase7-ui-fixes](./quick/20260502-002-phase7-ui-fixes/) |
| 20260502-003 | Session fixes: graceful message fetch failure + center sessions page layout | 2026-05-02 | a150ccc | [20260502-003-session-fixes](./quick/20260502-003-session-fixes/) |

### Todos

**Immediate** (Phase 6/7 planning):
- [ ] Run `/gsd-plan-phase 6` or `/gsd-plan-phase 7` to plan Activity Console / Sessions
- [ ] Phase 5/6/7 可并行 — 选择优先级

**Upcoming**:
- [ ] Phase 5: Office Layout (run `/gsd-discuss-phase 5`)
- [ ] v2 features (settings, radar visualization, command palette, etc.)

---

## Session Continuity

**Last Session**: 2026-05-02 - Completed quick task 20260502-002: Phase 7 UI fixes (sessions overlay drawer, header nav cleanup)

**What Was Done**:
- ✅ Created Sessions page (`/sessions`) with complete layout (Stats bar + Filter bar + Table + Detail rail)
- ✅ Updated Sidebar navigation to add SES item (6th item: OVR/AGT/USD/SKL/ACT/SES)
- ✅ Updated Header navigation to add Sessions link (3rd item: Dashboard/Office/Sessions)
- ✅ Replaced Overview Channels section with Sessions summary (active count + recent 5 activities + View All link)
- ✅ All verification checks passed (TypeScript, ESLint)
- ✅ Phase 7 (Sessions Dashboard) now complete!

**What's Next**:
- Phase 5: Office Layout (run `/gsd-discuss-phase 5`)
- Phase 6: Activity Console (run `/gsd-discuss-phase 6`)
- Both phases are independent and can be parallelized

**Context Handoff**:
- Phase 7 (Sessions Dashboard): ✅ Complete
- Full Sessions Dashboard functionality:
  - Data layer: SessionInfo type, store integration, P0 selector, API route (Plan 07-01)
  - UI components: Stats bar, Filter bar, Table, Detail rail, Chat bubbles (Plans 07-02, 07-03)
  - Page integration: /sessions page, navigation updates, Overview integration (Plan 07-04)
- User journey: Navigate from Sidebar/Header → View Sessions → Filter → Select → View details with messages

**Open Questions**:
- None

---

*State created: 2026-04-30*
*Last updated: 2026-05-02*
