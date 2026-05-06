# Phase 4: Multi-source Frontend Shell + Session Explorer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 04-multi-source-frontend-shell-session-explorer
**Areas discussed:** 路由 + Shell 架构, API 代理层, 会话浏览器数据源, OpenClaw 概览处理, 实现顺序

---

## 路由 + Shell 架构

| Option | Description | Selected |
|--------|-------------|----------|
| 提取共享 ShellFrame，然后在新的 [tool] 布局中组装 | Extract generic shell into components/shell/shell-frame.tsx, create new [tool] layout with AgentToolProvider | ✓ |
| 原地改造现有的 (shell) 布局 | Modify existing layout to accept optional tool param via context | |
| 保留现有布局 + 并行的按 tool 分配布局 | Duplicate shell per tool (anti-pattern warning from research) | |

**User's choice:** Extract shared ShellFrame, assemble in new [tool] layout.
**Notes:** Research ARCHITECTURE.md recommendation aligned. Avoids per-tool shell duplication.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Header 中放源切换器，sidebar 中放页面导航 | Source switcher in header brand area, sidebar for page-level nav from profile | ✓ |
| Source switcher in sidebar top | Tabs at top of sidebar, header stays consistent | |
| Header tabs for source | Second nav row below header for source tabs | |

**User's choice:** Header source switcher + sidebar page nav.
**Notes:** Header brand area becomes OpenClaw/Claude Code/Codex tabs. Sidebar nav built from definition.nav by profile.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Server Component layout + Client Provider wrapper | [tool]/layout.tsx validates params.tool, renders AgentToolProvider as client wrapper | ✓ |
| Client Component layout | Layout as client component with useEffect invalidation | |
| Middleware rewrites | Next.js middleware handles tool routing | |

**User's choice:** Server Component layout + Client Provider wrapper.
**Notes:** Avoids multi-root-layout full page reload issue documented in ARCHITECTURE.md anti-patterns.

---

| Option | Description | Selected |
|--------|-------------|----------|
| 方案B：聚合入口 + [tool] URL 段 | `/openclaw/dashboard`, `/codex/sessions` — deep-linkable, parallel-tab comparable | ✓ |
| 方案A：Tool 作为状态（无 URL 段） | Tool as client state only, URLs stay `/dashboard` regardless of active source | |

**User's choice:** Aggregate landing + [tool] URL segments.
**Notes:** User considered both approaches and chose URL segments for deep-linking and comparison benefits.

---

## API 代理层

| Option | Description | Selected |
|--------|-------------|----------|
| BFF 模式：/api/agent-tools/[tool]/... | Next.js API routes proxy ingest, same-origin, Server Component compatible | ✓ |
| 前端直接调用 ingest | Client fetch directly to localhost:8078 with CORS | |
| 混合模式 | Server Components via proxy, client fetch via direct ingest | |

**User's choice:** BFF proxy pattern.
**Notes:** Unified same-origin access, no CORS issues, Server Component support, error sanitization.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Gateway 仅保留给 Overview | Gateway data only for OpenClaw Overview; all session browsing via ingest | ✓ |
| Overview 也移除 Gateway | Rewrite overview to fetch via API proxy immediately | |

**User's choice:** Gateway preserved for Overview only.
**Notes:** User expressed intent to eventually deprecate Gateway entirely toward local file analysis, but that migration belongs to Phase 6+. Phase 4 keeps Gateway scoped to Overview.

---

| Option | Description | Selected |
|--------|-------------|----------|
| 统一按 tool 路由 | `/api/agent-tools/[tool]/sessions`, `/api/agent-tools/[tool]/sessions/:id/turns`, etc. | ✓ |
| 源专属 API | Separate route paths per source (duplication risk) | |
| 前端直接调用 ingest | Revert to direct ingest access | |

**User's choice:** Unified per-tool routing under `/api/agent-tools/`.
**Notes:** Shared hooks (`useToolSessions`, `useReplayPage`) consume the same URL pattern for all tools.

---

## 会话浏览器数据源

| Option | Description | Selected |
|--------|-------------|----------|
| 只展示已索引的 ingest 数据 | Session Explorer queries only ingest; live Gateway sessions not merged | ✓ |
| 混合展示 ingest + Gateway | Merge both data sources, dedup, normalize | |
| 全部走 Gateway（OpenClaw 特殊处理） | OpenClaw stays on Gateway store, separate explorer per source | |

**User's choice:** Ingest-only for Session Explorer.
**Notes:** Consistency advantage — all sessions through same SQL query pipeline. New sessions appear after ingest sync.

---

| Option | Description | Selected |
|--------|-------------|----------|
| 跨源聚合 session 列表 + 右侧横栏 | Landing page merges all 3 sources' sessions, right rail shows detail | ✓ |
| 简单的源选择面板（3 卡片入口） | Just 3 source cards, no aggregated session list | |
| OpenClaw 概览作为默认入口 | `/` shows full OpenClaw Overview (current behavior) | |

**User's choice:** Aggregate cross-source session list + right rail.
**Notes:** "All sessions on this machine" quick-glance entry before drilling into a specific source.

---

## OpenClaw 概览处理

| Option | Description | Selected |
|--------|-------------|----------|
| 保留 UI 骨架暂不填充 Gateway 数据 | Keep shell but don't populate cron/skills/agents/activity | ✓ |
| 作为 OpenClaw 专属页面，保留 Gateway 数据 | Full overview preserved at /openclaw/dashboard | |
| 拆解为共享模板 + slots | Extract shared KPI bar, tool-specific card slots | |

**User's choice:** Keep UI skeleton, defer data population.
**Notes:** User wants Phase 4 focus on sessions. Overview content (cron, skills, agents, activity) to be filled from local file data in Phase 6+. Claude/Codex dashboards show session summary stats.

---

## 实现顺序

| Option | Description | Selected |
|--------|-------------|----------|
| Wave 1 基础设施 → Wave 2 API → Wave 3 Shell → Wave 4 Session Explorer → Wave 5 Dashboard | Types/registry first, then proxy routes, then shell extraction, then session explorer, finally dashboard pages | ✓ |
| Shell 先行 | Shell architecture and routing first, then populate | |
| Session Explorer 优先 | Core user value (session browsing) first, then shell | |

**User's choice:** Progressive waves from foundation to surface.
**Notes:** Each wave leaves the app functional. No broken intermediate state.

---

## the agent's Discretion

- AgentToolProvider internal implementation (context shape, registry lookup, href builder)
- Exact AgentToolDefinition type structure
- Server adapter interface design (method signatures, error handling)
- Session Explorer column definitions per tool
- HUD design token preservation strategy during component extraction
- GatewayBootstrap scope (OpenClaw layout only vs global)
- Right rail visibility toggle behavior across tools
- Claude Code and Codex tool profile structures (capabilities, nav items, session columns)

---

## Deferred Ideas

- Gateway 长期逐渐废弃，迁入本地文件分析模型 → Phase 6 或后续里程碑
- OpenClaw Overview cron/skills/agents/activity 模块从本地数据源填充 → Phase 6+
- Claude Code dashboard: subagents/todos/hooks/transcript boundaries → Phase 5+
- Codex dashboard: sandbox approvals/patch summaries/command execution → Phase 5+
