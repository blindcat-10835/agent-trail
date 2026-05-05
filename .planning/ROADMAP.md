# OVAO Project Roadmap

**Project**: OpenClaw Visual Agents Office
**Version**: 1.0
**Last Updated**: 2026-05-02
**Status**: In Progress (Phase 4-7 active)

## Vision

Build a cyberpunk HUD-style visual management interface for AI Agents. Real-time Agent status, structured activity logs, and session lifecycle tracking through WebSocket connection to OpenClaw Gateway.

## Project Scope

**In Scope**:
- Agent Dashboard (status grid, KPIs, detail views)
- Office Layout (2D floor plan visualization)
- Activity Console (structured logs, filtering, search)
- Sessions Dashboard (token/cost tracking, message history)

**Out of Scope**:
- Agent creation/configuration (handled by Gateway)
- User authentication (single-user local tool)
- Multi-tenant deployments

## Milestones

### M1: Foundation (Phases 1-3)

**Goal**: 建立可扩展的基础设施和统一的 HUD 视觉系统

**Deliverables**:
- 完整的开发环境（Next.js 16 + Tailwind v4 + ESLint + shadcn/ui）
- 语义化设计令牌系统（light/dark 双主题，WCAG AA 验证）
- Shell 布局和 HUD 基础组件库

**Success Criteria**:
- [x] Phase 1 完成：工具链配置可用
- [x] Phase 2 完成：主题系统可用且通过对比度验证
- [x] Phase 3 完成：Shell 布局和基础组件可用

---

### M2: Dashboard (Phase 4)

**Goal**: 实现 Agent Dashboard 页面，提供 Agent 状态总览、实时监控和单 Agent 详情交互

**Deliverables**:
- Agent 状态网格（卡片布局）
- Agent 状态指示器（颜色编码）
- KPI 摘要条（关键指标）
- Gateway 连接状态指示器
- 搜索和筛选功能
- Agent 详情面板（日志流 + 任务进度 + 能力信息）

**Success Criteria**:
- [x] Phase 4 完成：Dashboard 页面可展示所有 Agent 实时状态，点击 Agent 可查看详情/日志

---

### M3: Office Layout (Phase 5)

**Goal**: 实现 2D 办公室平面图可视化

**Deliverables**:
- 2D 办公室平面图（Agent 工位可视化）
- Agent 位置交互（点击查看状态/跳转 Dashboard 聚焦）

**Success Criteria**:
- [ ] Phase 5 完成：Office Layout 页面可展示 Agent 工位位置

---

### M4: Dashboard Enhancements (Phases 6-7)

**Goal**: 增强 Dashboard 的信息展示能力，用 Activity Console 和 Sessions 替换原有的简单 ALERT/Channels

**Deliverables**:
- Activity Console 页面（结构化日志流 + 过滤搜索 + 详情查看）
- Sessions 页面（AI 会话管理 + token/cost 追踪 + 消息历史）
- Overview 面板改造（Activity 概要 + Sessions 概要）
- 导航和 Right Rail 更新

**Success Criteria**:
- [ ] Phase 6 完成：Activity Console 替换 ALERT，支持 cron/config/activity 事件流
- [x] Phase 7 Plan 1 完成：Sessions 数据层就绪（类型、Store、Selector、API 路由）
- [x] Phase 7 Plan 2 完成：Sessions Stats bar + Filter bar 就绪
- [x] Phase 7 Plan 3 完成：Sessions Table + Detail Rail 就绪
- [ ] Phase 7 完成：Sessions 替换 Channels，支持会话生命周期管理

---

## Coverage

**v1 Requirements Mapped**: 22/22 (100%)

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENGR-01 | Phase 1 | ✅ Complete |
| ENGR-02 | Phase 2 | ✅ Complete |
| ENGR-03 | Phase 3 | ✅ Complete |
| ENGR-04 | Phase 3 | ✅ Complete |
| DASH-01 | Phase 4 | ✅ Complete |
| DASH-02 | Phase 4 | ✅ Complete |
| DASH-03 | Phase 4 | ✅ Complete |
| DASH-04 | Phase 4 | ✅ Complete |
| DASH-05 | Phase 4 | ✅ Complete |
| OFFC-01 | Phase 5 | Pending |
| OFFC-02 | Phase 5 | Pending |
| WORK-01 | Phase 4 | ✅ Complete |
| WORK-02 | Phase 4 | ✅ Complete |
| ACTV-01 | Phase 6 | Pending |
| ACTV-02 | Phase 6 | Pending |
| ACTV-03 | Phase 6 | Pending |
| SESS-01 | Phase 7 | 🔄 In Progress (Plans 1-3 done) |
| SESS-02 | Phase 7 | 🔄 In Progress (Plans 1-3 done) |
| SESS-03 | Phase 7 | 🔄 In Progress (Plans 1-3 done) |

**Orphaned Requirements**: 0
**Unmapped Requirements**: 0

---

## Dependencies

```
Phase 1 (脚手架)
    ↓
Phase 2 (设计令牌)
    ↓
Phase 3 (Shell + 基础组件)
    ↓
Phase 4 (Agent Dashboard) ─────┐
    ↓                          │
Phase 5 (Office Layout)         │
    ↓                          ├─→ Phase 6 (Activity Console)
Phase 7 (Sessions Dashboard) ───┘    └─→ Phase 7 (Sessions Dashboard)
```

**Parallel Execution**: Phase 6 and Phase 7 are independent and can run in parallel after Phase 4.

---

## Phase Details

### Phase 1: Project Scaffolding

**Goal**: 初始化 Next.js 16 项目，配置开发工具链（ESLint, Prettier, TypeScript），建立目录结构和基础配置

**Status**: ✅ Complete

**Plans**: 1 plan — 01-01-PLAN.md

---

### Phase 2: Design Tokens

**Goal**: 使用 Tailwind v4 CSS-first 配置，建立语义化设计令牌系统（light/dark 双主题，WCAG AA 对比度验证）

**Status**: ✅ Complete

**Plans**: 1 plan — 02-01-PLAN.md

---

### Phase 3: Shell & Base Components

**Goal**: 实现 Shell 布局（Grid: Sidebar + Main + Status Bar）和 HUD 基础组件库（HudCard, Button, Badge, Separator）

**Status**: ✅ Complete

**Plans**: 3 plans — 03-01-PLAN.md (Shell layout), 03-02-PLAN.md (HUD components), 03-03-PLAN.md (Status bar + routing)

---

### Phase 4: Agent Dashboard

**Goal**: 实现 Agent Dashboard 页面，提供 Agent 状态总览、实时监控和单 Agent 详情交互（日志流 + 任务进度 + 能力信息）

**Status**: ✅ Complete

**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, WORK-01, WORK-02

**Success Criteria** (what must be TRUE):
1. Agent 状态网格（卡片布局）显示所有 Agent
2. KPI 摘要条显示关键指标（Agent 数/状态分布/任务执行数）
3. 单 Agent 详情面板（Right Rail）显示日志流 + 任务进度 + 能力信息
4. 搜索和筛选功能可用
5. Gateway 连接状态指示器
6. Agent 状态指示器（颜色编码）
7. 实时更新（Gateway WebSocket）

**Plans**: 5 plans — 04-01-PLAN.md (data layer), 04-02-PLAN.md (left panel), 04-03-PLAN.md (center grid), 04-04-PLAN.md (right rail), 04-05-PLAN.md (KPI bar + polish)

**UI hint**: yes

---

### Phase 5: Office Layout

**Goal**: 实现 2D 办公室平面图可视化，Agent 工位位置可交互（点击查看状态/跳转 Dashboard 聚焦）

**Status**: Pending

**Depends on**: Phase 4

**Requirements**: OFFC-01, OFFC-02

**Success Criteria** (what must be TRUE):
1. Office Layout 页面 `/office` 显示 2D 平面图（Agent 工位位置）
2. Agent 位置可交互（点击查看状态/跳转 Dashboard 聚焦）
3. 工位布局从配置文件读取（或硬编码初始布局）
4. Agent 状态颜色编码（与 Dashboard 一致）

**Plans**: TBD

**UI hint**: yes

---

### Phase 6: Activity Console

**Goal**: 替换当前 ALERT 系统为 Activity Console，展示 cron 执行记录、config 变更审计、agent 活动事件等结构化日志流，支持过滤、搜索和详情查看

**Depends on**: Phase 4

**Requirements**: ACTV-01, ACTV-02, ACTV-03

**Success Criteria** (what must be TRUE):
1. 新增 Activity 类型（source: cron/config/activity, level: info/warn/error, category, summary, details）
2. Activity Console 独立页面 `/activity`，包含 Summary cards（总数/错误数/来源分布）+ LogBrowser（过滤/搜索/展开详情）
3. Overview 中原 Alerts 面板替换为 Top 10 Activity 概要，点击跳转到 `/activity`
4. Right Rail 中 ALERTS tab 替换为 ACTIVITY tab
5. 导航 sidebar 中 ALR 替换为 ACT
6. Activity 数据通过文件系统读取（cron runs JSONL + config audit JSONL）

**Plans**: 4 plans — 06-01-PLAN.md (data layer), 06-02-PLAN.md (API route), 06-03-PLAN.md (UI components), 06-04-PLAN.md (Dashboard integration)

**UI hint**: yes

---

### Phase 7: Sessions Dashboard

**Goal**: 替换当前 Channels 为 Sessions，展示 AI 会话的完整生命周期（token 用量、费用、消息历史、状态追踪），支持多维过滤、会话详情和实时更新

**Depends on**: Phase 4

**Requirements**: SESS-01, SESS-02, SESS-03

**Success Criteria** (what must be TRUE):
1. 新增 Session 类型（key, label, model, totalTokens, contextTokens, kind: main/sub/cron/group, cost, status, lastMessage）
2. Sessions 独立页面 `/sessions`，包含 Stats bar（总数/token/费用）+ Filter bar（状态/模型/日期/搜索）+ Sessions 表格（排序/展开/详情）
3. Overview 中原 Channels 面板替换为 Sessions 概要（活跃数/模型分布/最近活动），点击跳转到 `/sessions`
4. Session 详情展示消息历史（role-based 样式、时间戳）
5. 状态指示器（Active=绿/Idle=灰/Aborted=红）+ LIVE 动画指示
6. Session 数据通过 Gateway RPC 或已有 store 获取
7. 消息历史通过 Next.js API route 读取 Gateway .jsonl 文件

**Plans**: 4 plans
- [x] 07-01-PLAN.md — Data layer + Message API (SessionInfo type extension, Gateway store integration, P0 selector, /api/sessions/messages route)
- [x] 07-02-PLAN.md — Filter components (SessionsStatsBar, SessionsFilterBar with useSessionsFilter hook)
- [x] 07-03-PLAN.md — Table + Detail components (SessionsTable, ChatBubble, SessionsDetailRail with REAL message fetching)
- [x] 07-04-PLAN.md — Page assembly + Navigation (Sessions page, Sidebar/Header, Overview integration)

**UI hint**: yes

---

## Future Enhancements (v2+)

- Agent creation/configuration UI
- Session comparison (side-by-side view)
- Session timeline visualization
- Message search within sessions
- Session export (CSV/JSON)
- Advanced filtering (date ranges, cost thresholds)
- Custom office layout editor
- Agent group management
- Real-time collaboration (multi-user)

---

## Glossary

- **HUD**: Heads-Up Display — cyberpunk-style UI with clip-path corners, glow effects, monospace fonts
- **Gateway**: OpenClaw Gateway server (WebSocket + RPC) — manages Agents, Sessions, configuration
- **Agent**: AI agent instance (name, model, status, tasks, logs)
- **Session**: AI conversation session (tokens, cost, messages, status)
- **Activity**: Structured event log (cron runs, config changes, agent events)
- **Shell**: Main app layout (Sidebar + Main + Status Bar)
- **Right Rail**: 360px right panel for detail views
- **P0**: Priority-zero selector pattern — memoized state + data selectors

---

**EOF**
