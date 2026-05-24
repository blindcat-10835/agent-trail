# 开发指南

这是面向开发者的日常工作参考：介绍如何运行、热重载、调试和贡献本项目中的两个服务。架构上下文参见 [`ARCHITECTURE.md`](ARCHITECTURE.md)；初次运行设置参见 [`GETTING-STARTED.md`](GETTING-STARTED.md)。

---

## 1. 日常命令

```bash
# Run both services (default)
pnpm dev

# Run one at a time
pnpm dev:next             # Next.js with --webpack (NOT turbopack)
pnpm dev:ingest           # tsx watch on ingest/index.ts

# Type-check
pnpm typecheck            # entire workspace, project + ingest references
pnpm typecheck:ingest     # ingest project only

# Lint
pnpm lint                 # eslint-config-next flat config

# Build
pnpm build                # Next.js production build
pnpm build:ingest         # tsc -p ingest/tsconfig.json → ingest/dist/

# Production start (requires the corresponding build)
pnpm start                # node server/index.mjs (Next standalone server)
pnpm start:ingest         # node ingest/dist/ingest/index.js

# Tests — see TESTING.md for fixtures and golden flow
pnpm test                 # vitest watch
pnpm test:run             # vitest run (single pass)
pnpm test:real-sessions   # tests/local/real-session-corpus.test.ts (uses your local sessions; gitignored)
```

`pnpm dev` 使用 `concurrently -k --names "INGEST,NEXT" --prefix-colors "green,blue"` 启动。按一次 `Ctrl+C` 即可同时终止两个服务。

---

## 2. 热重载机制

| 服务 | 触发重载的条件 |
| --- | --- |
| Next (`dev:next`) | 对 `app/`、`components/`、`lib/`、`stores/`、`types/`、`app/globals.css` 下的文件进行编辑。使用 Webpack 运行——**不要**切换到 Turbopack（参见 `../ERRORS_LEARNED.md`）。 |
| Ingest (`dev:ingest`) | 对 `ingest/**/*.ts` 下的文件进行编辑。`tsx watch` 会重启进程；chokidar 监视器和 SSE 管理器会被拆除并重新打开。 |

**数据库不受影响。** 每次重启都会读取 schema 文件，但 `data/ingest.db` 在重启期间会保持不变。如果你对 `schema.sql` 的修改需要数据库迁移，请在 `ingest/db/index.ts` 的 `runMigrations()` 中添加步骤并递增 `targetVersion`。

**SSE 流会自动重连。** 当 ingest 重启时，BFF SSE 代理 `/api/agent-tools/[tool]/events` 会发现上游 `fetch` 被关闭并将此状态传递下去。浏览器的 `EventSource` 会自动重试；仪表盘的状态栏会闪烁显示 `RECONNECTING → ONLINE`。

---

## 3. 项目规范

以下几点值得特别强调：

### Language

- **AI-facing artifacts** (specs, plans, decisions in `.planning/`, AI prompts) are in **Chinese**.
- **Code, comments, commit messages, PRs** are in **English**.
- This repo follows that split. Don't switch one without the other.

### 视觉令牌

- 所有颜色均来自 `app/globals.css` 的 `@theme inline { ... }` 块中定义的语义令牌：`bg-background`、`text-foreground`、`border-border`、`text-muted-foreground`、`bg-card`、`accent`、`destructive` 等。
- **不要**硬编码颜色。如果需要新颜色，请在 `@theme inline` 中添加新令牌。
- 浅色和深色主题都必须通过 WCAG AA 对比度标准。`app/layout.tsx` 中的主题引导脚本在页面绘制前同步执行，以避免 FOUC。

### Tailwind v4

- **本项目没有 `tailwind.config.js`。** 不要添加——添加了也不会生效。
- 插件配置在 `postcss.config.mjs` 中（目前只有 `@tailwindcss/postcss`）。
- 主题令牌、自定义工具类和组件样式全部定义在 `app/globals.css` 中。

### shadcn

- 使用 `pnpm dlx shadcn@latest add <name>` 添加组件。不要在 `components/ui/` 下手动创建它们。
- 样式风格为 `radix-nova`（见 `components.json`）。如果组件以不同风格（如 `default`）安装，其主题令牌将无法匹配——请用正确的风格重新安装。
- 图标库为 `lucide`。当 shadcn 已完成导入配置时，不要在组件文件头部直接从 `lucide-react` 导入——请使用与现有文件相同的导入模式。

### 路径别名

`@/*` → `./*`。请使用 `@/lib/utils`、`@/components/ui/button`、`@/types/trace` 等——不鼓励跨功能目录使用相对导入。

### 代码风格

- **仅在 WHY 不明显时才写注释。** 不要复述代码内容或为显而易见的东西写文档注释。
- 不要在常规函数上编写多段落的文档字符串；给函数取一个好名字即可。
- 代码库有意避免向后兼容的过渡代码和"在版本 X 中移除"的注释——当某段代码不再使用时，直接删除。

---

## 4. 编辑各层代码

### 4.1 添加 API 端点

**Ingest 端点**（例如新的 `/api/v1/something`）：

1. 在 `ingest/api/` 下创建或扩展文件，并导出一个 `Hono` 路由器。
2. 在 `ingest/index.ts` 中注册它：
   ```ts
   import { somethingRoutes } from './api/something.js';
   app.route('/', somethingRoutes);
   ```
3. 验证每个 URL/查询输入。使用现有模式：
   - `sessionId` → `/^[a-zA-Z0-9:\-_.]{1,256}$/`
   - `source` → 白名单 `['openclaw', 'claude-code', 'codex']`
   - `limit`/`offset` → 非负整数，`limit` 上限为 1000
4. 通过 `c.json()` 返回 JSON。设置明确的状态码（400 / 404 / 500）——不要依赖默认值。
5. 在 `ingest/api/*.test.ts` 或 `tests/unit/ingest/` 下添加测试。

**BFF 端点**（`app/api/` 下的代理或聚合路由）：

1. 创建 `app/api/<path>/route.ts`，导出 `GET` / `POST` 等。
2. 从 `params` 中提取 tool，并运行 `assertSourceToolId(tool)`（或对仅 shell 路由使用 `assertAgentToolId`）。
3. 使用 `lib/agent-tools/server-adapter.ts` 中的 `fetchIngest<T>(...)` 调用 ingest。它已处理 5 秒超时、AbortController 和 JSON 序列化。
4. 将调用包装在 `try/catch` 中并返回 `sanitizeError(err)`。
5. 对于变更操作，同时从查询字符串和 JSON body 中接受 `force`（与现有的 `/api/sync` 和 `/api/agent-tools/[tool]/sync` 一致）。

BFF 必须始终注入 source——绝不要相信调用者提供的 `?source=`。

### 4.2 添加解析器

各 source 的解析器位于 `ingest/parser/{claude,openclaw,codex}.ts`。要添加新的 source：

1. 将 source 名称添加到 `types/trace.ts` 中的 `TraceSource` 和 `ingest/db/schema.sql` 中的 `CHECK` 约束。
2. 在 `ingest/sync/sources.ts` 中添加一个 discoverer（`discoverFooSources()`），返回 `DiscoveredSource[]`。默认路径为 `~/.foo/sessions`，并接受 `FOO_SESSIONS_PATH`。使用 `isWithinRoot` 过滤发现的路径。
3. 实现 `parseFooSession(filePath, project): Promise<ParseResult>`，满足 `ingest/parser/types.ts` 中定义的合约。
4. 在 `ingest/sync/index.ts` 中添加 `syncFooSource()` 分支（`syncSource()` 枚举各类型——根据 D-21，有意不设置通用回退）。
5. 将新 source 接入 `ingest/index.ts → initializeSourcesAndSync` 和预热循环。
6. 在 `fixtures/foo/` 下添加 fixtures + golden 文件，并在 `tests/unit/ingest/` 下添加解析器测试。
7. 更新 BFF：添加 `lib/agent-tools/foo/{definition.ts, server-adapter.ts}`，在 `lib/agent-tools/registry.ts` 中注册，添加到 `TOOL_IDS`。
8. 更新 `assertSourceToolId`，它会通过 `TOOL_IDS` 自动匹配。

关于规范合约详情和解析器规则，请参见 [`services/ingest.md`](services/ingest.md)。

### 4.3 添加前端页面

1. 创建 `app/(tool-shell)/[tool]/<page>/page.tsx`。路由组 `(tool-shell)` 不会出现在 URL 中。
2. 如果页面仅应对某些 tool 显示，请在 `lib/agent-tools/<tool>/definition.ts` 中的相关 `nav` 项添加 `requiredCapability`。没有 nav 项的页面仍会渲染——能力限制仅用于侧边栏。
3. 使用 `useAgentTool()` 读取当前的 `toolId` 和 `href(route)` 构建器。
4. 使用类型化的数据 hooks（`useSessionDetail`、`useSessionTurns` 等）——它们调用 BFF，从不直接访问 ingest。
5. 对于新的 shadcn 组件，重新运行 `pnpm dlx shadcn@latest add <name>`；不要从其他项目复制（样式会不匹配）。

关于前端各层的更详细介绍，请参见 [`services/frontend.md`](services/frontend.md)。

### 4.4 添加共享类型

所有横跨 ingest 和前端的内容都放在 `types/` 下。添加到这里，而不是 `ingest/types.ts`（它是 ingest 内部的类型：`ServiceContext`、`HealthStatus` 等）。根目录 `tsconfig.json` 包含了 `ingest/**/*`，因此 `@/types/trace` 在两个项目中都能正确解析。

---

## 5. 开发期间操作数据库

```bash
# Quick inspect
sqlite3 data/ingest.db '.schema sessions'
sqlite3 data/ingest.db 'SELECT id, source, project, name, message_count FROM sessions ORDER BY started_at DESC LIMIT 10;'

# Reset (safe, ingest must be stopped first)
rm data/ingest.db data/ingest.db-wal data/ingest.db-shm
pnpm dev:ingest   # recreates schema and migrates from scratch

# Force a re-parse without deleting
curl -X POST http://localhost:3000/api/agent-tools/claude-code/sync \
  -H 'content-type: application/json' \
  -d '{"force":true}'
```

跳过缓存的 key 是带版本号的：`parser-v11-qoder-token-calibrated-cost:<source>:<sha256>`。如果你修改了解析器的输出结构，请将 `ingest/sync/index.ts` 顶部的 `PARSER_CACHE_VERSION` 递增——下一次同步时，因为每个 `file_hash` 都会与新前缀不匹配，所有内容都会被重新解析。

关于 schema 详情和迁移历史，请参见 [`db-schema.md`](db-schema.md)。

---

## 6. 调试

### Ingest

- 设置 `INGEST_DEBUG=true` 可在 HTTP 响应中显示真实的错误信息和堆栈跟踪（否则全局错误处理器会返回 `{"error":"Internal server error"}`）。**分享日志前请关闭此选项**——响应体可能包含文件路径。
- 设置 `AGENT_TRAIL_LOG_LEVEL=debug`（或 `INGEST_LOG_LEVEL=debug`）可查看详细的生命周期日志。打包后的 npm/Docker 运行默认只显示关键输出，并在子进程失败时打印最近日志缓冲。
- 监视器在每次同步失败时都会记录 `[watcher] Sync error for <source>: <err>`；在默认打包运行中这些日志会进入失败诊断缓冲。

### 前端

- ingest 健康状态浮层（`components/hud/ingest-health-overlay.tsx`）会轮询 `/api/ingest/health`，当 ingest 不可达时会显示全屏状态。如果开发期间它遮挡了页面，说明问题出在 ingest。
- 浏览器 DevTools 中的 BFF 错误通常显示为 `Ingest service unreachable (502)`——这些是经过脱敏处理的。请查看 `[INGEST]` 控制台输出以了解真实原因。
- React 服务端组件缓存对 ingest 请求已绕过：BFF 使用 `cache: 'no-store'`。同步和 SSE 失效应立即生效。

### SSE

- 打开 DevTools → Network → 过滤 `events`。连接应保持打开，内容类型为 `text/event-stream`。
- 如果看到频繁重连，说明 ingest 重启太频繁——检查 `tsx watch` 输出中的语法错误。

---

## 7. 分支、提交与快速任务

本仓库使用 `.planning/` 中存储的 GSD（`get-shit-done`）工作流。不要手动编辑 STATE.md 或 ROADMAP.md。

- 简单修改：`/gsd-fast`（无需规划开销）。
- 小型独立任务：`/gsd-quick`（仍然保证原子提交和状态追踪）。
- 开发阶段：使用 discuss → plan → execute 流水线（`/gsd-discuss-phase` 等）。
- 阶段进度存储在 `.planning/STATE.md`；快速任务在 `.planning/quick/`。

约定式提交消息：`<type>(<scope>): <short summary>`。`git log` 中的示例：`feat(replay):`、`chore:`、`fix(parser):`、`docs(quick):`。实际使用的 scope：`replay`、`260509-pk2`、`quick`、`parser`、`ingest`。

关于具备历史感知能力的 AI 辅助，`CLAUDE.md` 和 `AGENTS.md` 描述了本项目对 AI 编程代理的预期行为规范。

---

## 8. 常见陷阱

以下问题已经发生过多次，值得专门列出。完整列表见 `../ERRORS_LEARNED.md`——在编写新组件之前先阅读它。

- **Tailwind v4 不会加载 `tailwind.config.js`。** 添加一个配置文件会导致静默无操作。主题配置放在 `app/globals.css` 中。
- **Next 16 更改了默认行为。** 在假定某个行为之前，请查阅 `node_modules/next/dist/docs/`（或官方更新日志）。
- **不要在 `pnpm dev:next` 中从 `--webpack` 切换到 Turbopack。** 当前的依赖图会导致编译风暴。
- **`(tool-shell)` 是一个路由组。** URL 是 `/openclaw/dashboard`，而不是 `/(tool-shell)/openclaw/dashboard`。同理 `[tool]` 是动态段，不是字面量。
- **`source=` 由 BFF 控制。** 不要从前端传递它；适配器会将其剥离。
- **`assertSourceToolId('all')` 会抛出异常。** 对包含聚合范围的路由使用 `assertAgentToolId`。
- **`better-sqlite3` 是同步的。** 所有 ingest 写操作都在一个 `database.transaction()` 中执行，以保证原子性。
- **如果使用旧版文件扫描路由** `/api/sessions/messages`，Next 开发服务器必须设置 `WORKSPACE_PATH`。而 `/api/agent-tools/[tool]/...` 下的新流程不需要（ingest 会自己读取它）。
