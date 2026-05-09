# 配置

agent-tracing-dashboard 完全通过环境变量配置。没有运行时的中央配置文件 — 两个服务都在启动时解析 `process.env`。本文档列出了代码实际读取的每个变量、读取位置、默认值以及对其进行的校验。

> **约定。** 以 `NEXT_PUBLIC_` 为前缀的变量由 Next.js 暴露给浏览器打包文件 — 切勿将密钥放在其中。以 `INGEST_` 为前缀的变量仅由摄取服务读取。没有前缀的变量（例如 `WORKSPACE_PATH`）由两个服务共同读取。

---

## 1. 值的存放位置

| 文件 | 加载方式 | 是否提交？ |
| --- | --- | --- |
| `.env.local` | Next.js 自动加载；摄取服务通过 `pnpm dev:ingest` 启动时继承父 shell 环境 | 否（gitignore 中 — 参见 `.gitignore`） |
| Shell 导出 / 启动脚本 | 两个服务直接启动时 | 不适用 |
| `.ovao-config.json` | `lib/gateway-config.ts`（Gateway URL/Token 持久化） | 否（gitignore 中）— 运行时管理，请勿手动编辑 |

仓库中**没有**签入 `.env.example`。最小的本地设置参见 [`GETTING-STARTED.md`](GETTING-STARTED.md)。

---

## 2. 数据源发现（两个服务共用）

摄取服务（用于解析）和遗留的 `app/api/sessions/messages` 路由（用于 OpenClaw 文件扫描回退）都会读取这些变量。

### `WORKSPACE_PATH`

- **默认值：** `~/.openclaw`（去除尾部的 `/workspace` 之后）。
- **读取位置：** `ingest/sync/sources.ts → discoverOpenClawSources` 和 `app/api/sessions/messages/route.ts → getOpenclawBase`。
- **解析为：** `<WORKSPACE_PATH>/agents/<agent-name>/sessions/*.jsonl`。
- **行为：** 摄取服务在追加 `/agents` 之前会去除尾部的 `/workspace` 段，因此 `/Users/me/.openclaw` 和 `/Users/me/.openclaw/workspace` 均可用。
- **路径限制：** 发现的路径会通过 `isWithinRoot` 对照解析后的 `agentsDir` 进行校验。任何在根目录之外的路径会被丢弃，并在摄取日志中输出 `[sources] Rejected path outside root: ...`。

### `CLAUDE_SESSIONS_PATH`

- **默认值：** `~/.claude/projects`。
- **读取位置：** `ingest/sync/sources.ts → discoverClaudeSources`。
- **解析为：** 根目录下任何包含 `.jsonl` 文件的目录（递归发现）。
- **项目提取：** Claude 通过在目录名中将 `/` 替换为 `-` 来编码原始 `cwd`（例如 `-Users-ebbi-work-foo`）。同步层会将其解码回 `project` 列。

### `CODEX_SESSIONS_PATH`

- **默认值：** `~/.codex/sessions`。
- **读取位置：** `ingest/sync/sources.ts → discoverCodexSources`。
- **解析为：** 根目录下任何包含 `.jsonl` 文件的目录（递归）。Codex 的父子关系在同步期间根据 `event_msg.collab_agent_spawn_end` 事件重建。

---

## 3. 摄取服务 (`ingest/config/index.ts`)

`loadConfig()` 在启动时运行，**遇到无效值会抛出异常**（服务退出）。以下默认值与 `IngestConfig` 匹配。关于每个配置项在运行时实际改变了什么，请参见 [`services/ingest.md`](services/ingest.md)。

| 变量 | 默认值 | 校验规则 | 效果 |
| --- | --- | --- | --- |
| `INGEST_PORT` | `8078` | 整数，范围 `[1024, 65535]` | Hono 服务器的 TCP 端口。 |
| `INGEST_DB_PATH` | `./data/ingest.db` | 非空；不能包含 `..`（阻止路径穿越） | 解析为绝对路径。父目录在打开时创建。 |
| `INGEST_LOG_LEVEL` | `info` | 取值为 `debug \| info \| warn \| error` 之一 | 预留给日志器；目前用于在测试中控制详细输出。 |
| `INGEST_RESYNC_INTERVAL_MS` | `300000`（5 分钟） | 整数，≥ 5000 | 文件监视器的定期全量重新同步间隔。 |
| `INGEST_DEBOUNCE_MS` | `500` | 整数，≥ 100 | 文件系统事件与同步触发之间的防抖时间窗口。 |
| `INGEST_STARTUP_SYNC_LIMIT` | `50` | 整数，≥ 0 | 在 `/health` 报告 `ready: true` 之前的预热阶段中，每个数据源解析的最新文件数。设为 `0` 则完全跳过预热。 |
| `INGEST_BACKGROUND_SYNC_ENABLED` | `true` | 真值：`true \| 1 \| yes`（不区分大小写） | 为 true 时，预热后服务为每个数据源运行全量历史同步。 |
| `INGEST_RATE_LIMIT_RPM` | `100` | 不可解析时回退到 `100` | 每个 IP 每分钟的请求数。 |
| `INGEST_RATE_LIMIT_ENABLED` | `true` | 真值：`true \| 1 \| yes` | 切换 `rateLimiter` 中间件。`/health` 和 `/version` 始终免限。 |
| `INGEST_DEBUG` | `false` | 真值：`true \| 1 \| yes` | 为 true 时，全局错误处理器向客户端返回实际的 `err.message` 和堆栈。**切勿在共享环境中启用** — 分享日志前关闭此选项。 |

`getConfig()` 缓存结果；`loadConfig()` 重新加载（供测试使用）。

### 无效值行为

错误值会产生致命启动错误，例如：

```text
Error: Invalid INGEST_PORT: 99 must be between 1024 and 65535
Error: Invalid INGEST_RESYNC_INTERVAL_MS: "1000" must be at least 5000ms
Error: INGEST_DB_PATH cannot contain ".." (path traversal)
```

请在 `.env.local` 中或通过启动 shell 设置它们；如果值错误，服务会在绑定端口之前退出（`pnpm dev` 此时将只显示 `[NEXT]` 前缀继续运行）。

---

## 4. 前端 (`app/` 和 `lib/`)

| 变量 | 默认值 | 读取位置 | 用途 |
| --- | --- | --- | --- |
| `INGEST_URL` | `http://localhost:8078` | `lib/agent-tools/server-adapter.ts` (`fetchIngest`)；`app/api/agent-tools/[tool]/events/route.ts` | BFF 用于与摄取服务通信的基础 URL。仅服务端使用。 |
| `NEXT_PUBLIC_API_BASE` | _(无 — 使用时必须设置)_ | 仅在 `.env.local` 中；**源代码中当前无导入**。`CLAUDE.md` 中记录为旧版 OpenClaw 消费者所期望的 HTTP API 端点。 | 当前未被仓库内的代码路径使用；保留以与 OVAO 时代保持向后兼容。 |
| `NEXT_PUBLIC_GATEWAY_WS` | _(无 — 使用时必须设置)_ | 仅在 `.env.local` 中；**源代码中当前无导入**。`CLAUDE.md` 中记录为 OpenClaw Gateway WebSocket URL。 | 当前未被仓库源代码使用。GatewayBootstrap / WS 客户端未在当前多源前端中连接；该内容保留在 `.planning/` 历史记录中。<!-- VERIFY: 确认 NEXT_PUBLIC_GATEWAY_WS 是否被文档之外的任何部署界面需要 --> |
| `PORT` | _(Next 默认值 — 通常为 `3000`)_ | Next.js 本身 | 标准 Next 覆盖（例如 `PORT=3001 pnpm dev:next`）。 |

本地设置期间生成的空 `.env.local` 通常包含以下内容：

```bash
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_GATEWAY_WS=ws://localhost:18789
WORKSPACE_PATH=/Users/<you>/.openclaw/workspace
```

在多源管道中，目前只有 `WORKSPACE_PATH` 具有实际作用。保留其他变量以与旧版 OpenClaw 工具保持兼容，除非你确定本地技术栈中没有任何内容读取它们。

---

## 5. 构建时配置

| 文件 | 控制内容 |
| --- | --- |
| `next.config.ts` | 空 `NextConfig` — Next 16 默认值。代码中未设置 Turbopack 标志；`pnpm dev:next` 使用 `--webpack` 运行，因为 Turbopack 在本代码库中触发编译风暴（参见 `../ERRORS_LEARNED.md` 和 20260506-001 快速修复）。 |
| `postcss.config.mjs` | 加载 `@tailwindcss/postcss` — Tailwind v4 配合 Next 所必需。 |
| `app/globals.css` | 通过 `@theme inline { ... }` 定义主题令牌。**没有 `tailwind.config.js`** — 在这里更改颜色 / 字体 / 断点。 |
| `tsconfig.json` | `target: ES2017`，`moduleResolution: bundler`，严格模式；包含 `ingest/**/*`，以便 `@/types/trace` 等类型可在两个项目中解析。 |
| `ingest/tsconfig.json` | 摄取服务的项目引用；`tsc -p ingest/tsconfig.json` 构建到 `ingest/dist/`。 |
| `eslint.config.mjs` | 基于 `eslint-config-next` 的扁平配置；忽略 `.next/`、`out/`、`build/`、`next-env.d.ts`。 |
| `vitest.config.ts` | 包含 `tests/**/*.test.{ts,tsx}`、`lib/**/*.test.{ts,tsx}`、`ingest/**/*.test.ts`。环境默认为 `node`；组件测试显式引入 jsdom。 |
| `components.json` | shadcn 配置：`style: "radix-nova"`，`baseColor: "neutral"`，`iconLibrary: "lucide"`，组件别名 `@/components/ui`。 |
| `.gitignore` | `.env*`、`data/`、`ingest/dist/`、`.ovao-config.json`、`.local/real-session-corpus.json`、`.next/` 等。 |

---

## 6. 运行时 / 运维设置（非代码内）

以下内容未出现在源代码中，但出现在运维实践中：

- **`pnpm dev` 的颜色前缀。** `concurrently -k --names "INGEST,NEXT" --prefix-colors "green,blue"` 包装两个服务。如果终端无法渲染这些颜色，可使用 `--prefix-colors` 覆盖。
- **进程守护。** 在 `pnpm dev` 之外，生产启动方式为 `pnpm start`（Next）和 `pnpm start:ingest`（Hono）。两者均为普通 `node` 进程 — 可用 `pm2`、`systemd` 或你选择的启动器包装；两者均未内部守护化。
- **数据库持久性。** SQLite 以 WAL 模式打开（`PRAGMA journal_mode = WAL`，`synchronous = NORMAL`）。`data/ingest.db-wal` 和 `data/ingest.db-shm` 文件是正常的 — 请勿在服务运行时删除它们。先停止摄取服务。
- **重启 vs. 重置。** 删除 `data/ingest.db` 是安全的全量重置路径：服务下次启动时从头重建模式并迁移。没有迁移回滚 — 回退意味着摧毁数据库。

---

## 7. 配置故障排除

| 症状 | 可能原因 | 修复方法 |
| --- | --- | --- |
| 摄取服务在 `pnpm dev:ingest` 时立即退出 | 错误的 `INGEST_*` 值（例如不可解析的端口） | 阅读打印的 `Error:` 行；值必须满足上述校验表 |
| `/api/v1/sources` 对某个数据源显示 `error: "ENOENT: ..."` | 数据源根目录不存在 | 设置对应的 `*_SESSIONS_PATH` / `WORKSPACE_PATH` 环境变量，或创建该目录 |
| OpenClaw 数据源显示 `sessionCount: 0, error: "No agent sessions found"` | `~/.openclaw/agents/<agent>/sessions/` 为空 | 运行一个 OpenClaw 会话来创建一些内容，或将 `WORKSPACE_PATH` 指向已有会话的工作区 |
| `[sources] Rejected path outside root: ...` 警告 | 符号链接离开了配置的根目录，或发现了奇怪的绝对路径 | 修复符号链接；`isWithinRoot` 是刻意的限制且不可配置 |
| BFF 返回 502 `Ingest service unreachable` | 摄取服务崩溃或 `INGEST_URL` 错误 | 检查 `pnpm dev` 日志；`curl http://localhost:8078/health`；重新设置 `INGEST_URL` |
| BFF 返回 400 `Invalid source tool ID` | URL `[tool]` 段错误 | 使用 `openclaw`、`claude-code` 或 `codex`（注意连字符）。`all` 仅在 shell 层工作，BFF 层不行。 |
| 健康覆盖层永远停留在 "检查中" | 摄取服务已启动但 `INGEST_STARTUP_SYNC_LIMIT` 很大，预热尚未完成 | 降低限制值或设为 `0` 跳过预热；全量同步仍在后台运行 |

关于"我修改了解析器但数据库显示过时数据"的问题，请参阅 [`services/ingest.md`](services/ingest.md) 中的跳过缓存章节：升级 `PARSER_CACHE_VERSION` 或使用 `{"force": true}` 调用 `POST /api/v1/sources/:type/sync`。
