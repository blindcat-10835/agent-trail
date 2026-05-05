# Phase 1: Trace Contract & Brownfield Reset - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 1-Trace Contract & Brownfield Reset
**Areas discussed:** Trace Contract Design, Fixture Strategy, Brownfield Reset Depth, Preserved Capabilities Boundary, Gateway Timeline, Phase 1 Validation Scope

---

## Trace Contract Design

### Contract file location

| Option | Description | Selected |
|--------|-------------|----------|
| types/trace.ts | 与 gateway/types.ts 平级，前端和 ingest 共同引用，不依赖具体运行时 | ✓ |
| ingest/types/ 内部 | trace contract 放在 ingest 服务内部，前端通过 API JSON 类型推断 | |
| 独立 workspace package | @trace-contract 包，pnpm workspace 引用。最干净但初期复杂度高 | |

**User's choice:** types/trace.ts
**Notes:** 前端和 ingest 都需要引用，放在项目根 types/ 目录最直接。

### File structure

| Option | Description | Selected |
|--------|-------------|----------|
| 单文件 trace.ts | 所有类型放在一个文件，耦合紧密便于全局查看 | ✓ |
| 分模块多文件 | 拆成 trace-source.ts、trace-session.ts 等。模块化但增加 import 复杂度 | |

**User's choice:** 单文件 trace.ts
**Notes:** 约 10 个核心类型，单文件足够。

### Naming alignment

| Option | Description | Selected |
|--------|-------------|----------|
| 对齐 agentsview 字段名 | 字段名/枚举值与 Go 类型一致，便于对照 | |
| TypeScript 惯例命名 | camelCase、联合类型、接口继承，字段含义对齐但风格自由 | ✓ |
| 核心对齐 + TS 增强 | 核心字段名对齐 Go，TypeScript 特有部分惯用写法 | |

**User's choice:** TypeScript 惯例命名
**Notes:** 不强行对齐 Go 命名，用 TS 习惯写。Parser 开发时含义对照即可。

### Gateway type boundary

| Option | Description | Selected |
|--------|-------------|----------|
| 完全独立，运行时桥接 | trace.ts 全新类型，Gateway 不变，通过 key 桥接 | ✓ |
| Trace 引用 Gateway 类型 | Trace extends 部分Gateway 类型，减少重复 | |

**User's choice:** 完全独立，运行时桥接
**Notes:** 用户明确指出 Gateway 未来可能被替代——本地文件解析可能覆盖 Gateway 数据。Trace contract 应该是唯一数据模型，不依赖 Gateway。Gateway 只是当前数据来源之一。

---

## Fixture Strategy

### Fixture source

| Option | Description | Selected |
|--------|-------------|----------|
| 复制 agentsview + 补充 OpenClaw | 从 agentsview testdata 复制 Claude/Codex，本机补充 OpenClaw | ✓ |
| 全部从真实 session 采集 | 更真实但工作量大 | |
| 最小起步，边写边补 | 只建结构不写 fixture | |

**User's choice:** 复制 agentsview + 补充 OpenClaw

### Expected output format

| Option | Description | Selected |
|--------|-------------|----------|
| JSONL + golden JSON | 原始 JSONL + expected.json (TraceSession)，deep equal 测试 | ✓ |
| JSONL + 内联断言 | 断言在测试代码中，灵活但分散 | |
| Snapshot testing | 自动生成 .snap，零手写但可读性差 | |

**User's choice:** JSONL + golden JSON
**Notes:** 用户要求更多背景后选择。golden JSON 便于审查、git diff 追踪变更。

### Fixture count

| Option | Description | Selected |
|--------|-------------|----------|
| 每 source 2 个 | 最小：普通对话 + tool call session | ✓ |
| 每 source 3-5 个 | 中等覆盖，前期工作量大 | |
| 只建结构，不写 fixture | Parser 开发时再填充 | |

**User's choice:** 每 source 2 个

---

## Brownfield Reset Depth

### Rename scope

| Option | Description | Selected |
|--------|-------------|----------|
| 文档 + 可见文案 | 只改文档和页面标题/导航文案，组件/路由不动 | ✓ |
| 文档 + 组件 + 路由 | 也重命名组件和路由路径 | |
| 全面重命名 | 包括 store、CSS 变量、环境变量前缀 | |

**User's choice:** 文档 + 可见文案
**Notes:** Phase 4 会做前端架构重构，现在不需要一步到位。

### Old file cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| 删除旧文件 | 清理旧 .planning/phases/、debug/、quick/ 等 | ✓ |
| 归档到 .planning/archive/ | 保留以防回看 | |
| 不管，让 git 处理 | 已 deleted 但未 commit | |

**User's choice:** 删除旧文件

### HUD design language

| Option | Description | Selected |
|--------|-------------|----------|
| 保留 HUD 风格 | 赛博朋克 HUD 是已投入的视觉资产 | ✓ |
| 转为中性工具风格 | 简洁功能优先，需要重新设计 theme token | |
| 只改文案，风格不变 | 最小改动 | |

**User's choice:** 保留 HUD 风格

---

## Preserved Capabilities Boundary

### Dependency classification

| Option | Description | Selected |
|--------|-------------|----------|
| 分类标记依赖源 | 区分 Gateway 独占 vs 文件可替代 | ✓ |
| 统一标记为保留 | 不区分数据来源 | |
| 只写原则，不列清单 | 灵活但缺乏具体指导 | |

**User's choice:** 分类标记依赖源

### Gateway-exclusive capabilities

| Option | Description | Selected |
|--------|-------------|----------|
| 保留但隔离 | 代码不删，标注 Gateway 依赖，未来可能调整 | ✓ |
| 不列入保留合约 | Gateway 相关组件作为遗留代码不承诺保留 | |
| 全部保留 | Phase 6 再评估 | |

**User's choice:** 保留但隔离

### Source status taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| 双维度独立 | 每个 source 有 ingestStatus + gatewayStatus | ✓ |
| 分离：source + 全局 gateway | source status 只管 ingest，gateway 是全局状态 | |

**User's choice:** 双维度独立
**Notes:** 用户要求更多背景后选择。OpenClaw 两者都有，Claude/Codex 只有 ingestStatus。

---

## Gateway Timeline

| Option | Description | Selected |
|--------|-------------|----------|
| 不急，后续再评 | Phase 1 不定义 migration 路径，保留并隔离 | ✓ |
| Phase 1 做可行性分析 | 写 Gateway-to-file 可行性分析文档 | |
| 明确 Phase 6 去掉 | 所有新代码不依赖 Gateway | |

**User's choice:** 不急，后续再评

---

## Phase 1 Validation Scope

| Option | Description | Selected |
|--------|-------------|----------|
| 最小 parser 函数 + 测试 | parseFixture() → TraceSession 纯函数 + vitest 测试 | ✓ |
| 只写类型 + fixture，不写代码 | 人工审查验证 | |
| 最小 ingest skeleton + parser | 搭建 ingest/ 目录 + Express/Hono 服务 | |

**User's choice:** 最小 parser 函数 + 测试

---

## Claude's Discretion

- trace.ts 内部类型结构设计（字段粒度、联合类型 vs 枚举、可选字段策略）
- Fixture 文件命名规范和目录结构
- 保留能力清单的详细格式
- 测试框架选择（vitest / jest）

## Deferred Ideas

- Gateway migration 路径 — 后续 Phase 评估
- Ingest service 目录结构 — Phase 2
- 组件/路由重命名 — Phase 4
