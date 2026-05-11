# Phase 1: Trace Contract & Brownfield Reset - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

定义 trace canonical model (TypeScript types)、建立 parser fixture corpus、明确 OpenClaw overview 保留能力边界、完成项目从 OVAO 到 agent-tracing-dashboard 的语义重定位。Phase 1 不构建 ingest service（Phase 2）、不写 parser（Phase 2-3）、不改前端架构（Phase 4）。

**Deliverables:**
- `types/trace.ts` — 独立于 Gateway 的 canonical trace 类型定义
- Fixture corpus — OpenClaw / Claude Code / Codex 各 2 个 JSONL + golden JSON
- 最小 parseFixture() 函数 + 测试，验证 contract 可行性
- 保留能力清单（分类标记 Gateway 独占 vs 文件可替代）
- 项目文档/文案重定位 + 旧 .planning 清理

</domain>

<decisions>
## Implementation Decisions

### Trace Contract Design
- **D-01:** Trace contract 放在 `types/trace.ts`，与 `gateway/types.ts` 和 `gateway/adapter-types.ts` 平级。前端和 ingest service 都可直接引用。
- **D-02:** 所有 trace 类型（Source, Session, Turn, Message, ToolCall, SkillUse, Subagent, Activity, TokenUsage, Timing）放在单文件 `trace.ts`。类型耦合紧密，单文件便于全局查看和对照。
- **D-03:** 字段命名用 TypeScript 惯例（camelCase、联合类型、接口继承），字段含义对齐 agentsview Go 类型但命名风格自由。Parser 开发时用 TypeScript 习惯写，不强行对齐 Go 命名。
- **D-04:** Trace contract 与现有 Gateway 类型完全独立。Gateway 是当前数据来源之一，未来可能被本地文件解析替代。Trace contract 是唯一的数据模型，不引用 Gateway 类型。两者通过 source key / session key 在运行时桥接。
- **D-05:** Gateway 去留不急，后续 Phase 再评估。Phase 1 不定义 Gateway migration 路径，保留 Gateway 代码并隔离即可。

### Fixture Strategy
- **D-06:** Fixture 来源：从 agentsview `internal/parser/testdata/` 复制已有 Claude (3 JSONL) 和 Codex (6 JSONL) fixture，从本机真实 session 补充 OpenClaw fixture。
- **D-07:** Fixture 格式：每个 fixture 由原始 JSONL 文件 + 期望输出的 golden JSON (canonical TraceSession) 组成。测试时 parser 读 JSONL → 输出 TraceSession → 与 golden JSON 做 deep equal。
- **D-08:** Fixture 数量最小起步：每个 source 至少 2 个（普通对话 session + 含 tool call 的 session）。Edge case fixture 在 Phase 2/3 写 parser 时按需添加。

### Brownfield Reset Depth
- **D-09:** 重命名范围：只改文档（PROJECT.md、AGENTS.md 等）和页面可见文案（header 标题、导航标签）。组件名、路由路径、目录结构不动。Phase 4 做前端架构重构时再调整。
- **D-10:** 旧 .planning/phases/、debug/、quick/、ui-reviews/ 等遗留文件全部删除。新项目有新的 .planning 结构。
- **D-11:** OVAO 赛博朋克 HUD 设计语言（glow、scanline、monospace、dark-first）保留。这是已投入的视觉资产，和 agent tracing 定位不冲突。

### Preserved Capabilities Boundary
- **D-12:** OpenClaw overview 当前所有能力分类标记依赖源：区分"Gateway 独占"（Agent 状态、Gateway 连接、Activity 实时流）和"文件可替代"（Sessions 列表、KPI、Skills）。
- **D-13:** Gateway 独占能力"保留但隔离"——代码不删，明确标注这些依赖 Gateway，未来可能随 Gateway 评估一起调整。
- **D-14:** Source status 采用双维度独立模型：每个 source 有 `ingestStatus`（installed/configured/empty/indexing/error/parser-warning）和 `gatewayStatus`（connected/disconnected/connecting/error）。OpenClaw 两者都有，Claude Code / Codex 只有 ingestStatus。

### Phase 1 Validation Scope
- **D-15:** Phase 1 写一个最小 `parseFixture(filePath) → TraceSession` 纯函数 + 测试，不启动任何服务。验证 trace contract 类型和 fixture 格式可行。

### Claude's Discretion
- 具体 trace.ts 内部的类型结构设计（字段粒度、联合类型 vs 枚举、可选字段策略）由 planner/researcher 决定
- Fixture 文件命名规范和目录结构
- 保留能力清单的详细格式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — 产品定位、约束、关键决策
- `.planning/REQUIREMENTS.md` — FOUND-01 到 FOUND-05 是 Phase 1 直接需求
- `.planning/ROADMAP.md` § Phase 1 — Phase goal, success criteria, requirements mapping
- `.planning/STATE.md` — 当前项目状态和技术上下文

### Reference Implementation
- `../references/agentsview/internal/parser/types.go` — AgentType, AgentDef, Registry 等 Go 类型定义，作为 trace contract 的行为参考
- `../references/agentsview/internal/parser/testdata/` — Claude/Codex JSONL fixture 示例
- `../references/agentsview/internal/db/schema.sql` — SQLite schema 参考（sessions, messages, tool_calls 等表结构）
- `../references/agentsview/internal/parser/openclaw.go` — OpenClaw parser 行为参考
- `../references/agentsview/internal/parser/claude.go` — Claude Code parser 行为参考
- `../references/agentsview/internal/parser/codex.go` — Codex parser 行为参考

### Research
- `.planning/research/SUMMARY.md` — 项目研究综合摘要
- `.planning/research/STACK.md` — 技术栈选择分析
- `.planning/research/AGENTSVIEW-DATA-SCHEME.md` — agentsview 数据方案分析

### Existing Code (preserved, not modified)
- `gateway/types.ts` — Gateway WebSocket 协议类型（trace contract 不引用，但需要了解边界）
- `gateway/adapter-types.ts` — Dashboard 展示类型（同上）
- `app/globals.css` — HUD 设计 token（保留不动）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gateway/types.ts` — Gateway 协议类型保留，trace contract 独立不引用
- `gateway/adapter-types.ts` — 展示类型（ChannelInfo, SkillInfo, SessionInfo 等）保留，overview 组件继续使用
- `app/globals.css` @theme inline — HUD 设计 token 完整保留
- `components/ui/*` — shadcn 基础组件保留

### Established Patterns
- TypeScript strict mode — trace contract 应遵循项目 TS 严格模式
- `@/*` 路径别名 — types/trace.ts 通过 `@/types/trace` 引用
- pnpm workspace — 单一 package.json，无 monorepo

### Integration Points
- `types/` 目录是新的 — 当前只有 gateway/ 下的类型文件，trace.ts 是 types/ 目录下的第一个文件
- agentsview testdata 通过相对路径 `../references/agentsview/` 可访问
- Phase 2 ingest service 将引用 `types/trace.ts` 作为 canonical model

</code_context>

<specifics>
## Specific Ideas

- Gateway 未来可能被本地文件解析替代，trace contract 应被设计为唯一数据模型
- OpenClaw 的 JSONL 格式和 Claude Code 有重叠（agentsview 复用了部分 parser 逻辑），fixture 需要注意区分

</specifics>

<deferred>
## Deferred Ideas

- Gateway migration 路径 — 后续 Phase 评估 Gateway 去留
- Ingest service 目录结构设计 — Phase 2
- 测试框架选择（vitest / jest）— Phase 1 实现时由 planner 决定
- 组件/路由重命名 — Phase 4 前端架构重构

</deferred>

---

*Phase: 1-Trace Contract & Brownfield Reset*
*Context gathered: 2026-05-06*
