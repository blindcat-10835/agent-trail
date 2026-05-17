# opencode 数据源接入计划

**日期:** 2026-05-17  
**状态:** Draft / investigation complete  
**目标:** 将 opencode 的 session、message、tool activity、token usage、cost 数据作为第四个正式数据源纳入 agent-tracing-dashboard。

---

## 1. 结论摘要

opencode 接入应按正式 source 扩展，而不是作为 Codex 或 Claude Code 的变体处理。原因是它的本地存储不是 JSONL，而是当前版本的 SQLite 主库：

- 本机 opencode 版本：`1.15.3`
- CLI 路径：`/Users/ebbi/.nvm/versions/node/v24.14.0/bin/opencode`
- 数据库路径：`/Users/ebbi/.local/share/opencode/opencode.db`
- 数据根目录：`/Users/ebbi/.local/share/opencode`
- 需要避免读取：`auth.json`，其中可能包含 provider auth/token

Context7 官方文档确认 opencode 在 macOS/Linux 默认使用 `~/.local/share/opencode/`。但本机 `1.15.3` 实测显示 session/message 的主数据已经迁移到 `opencode.db`，而不是只依赖旧文档提到的 `project/<slug>/storage/` 文件布局。因此实现应以只读 SQLite reader 为主，文件目录只作为辅助发现和 watcher 触发来源。

推荐第一版能力范围：

- 支持 `/opencode/dashboard`、`/opencode/sessions`、`/opencode/sessions/:id`、`/opencode/activity`
- 支持 session list/detail、turn replay、tool activity、reasoning block、token channel、opencode reported cost
- 不读取 `auth.json`
- 暂不展示 raw snapshot Git object，不把 `storage/session_diff/*.json` 作为 transcript 主来源

---

## 2. 本机 opencode 存储调查

### 2.1 目录结构

本机 `~/.local/share/opencode` 关键内容：

| 路径 | 作用 | 接入策略 |
| --- | --- | --- |
| `opencode.db` | SQLite 主库，包含 project/session/message/part/token/cost | 第一版主数据源 |
| `opencode.db-wal`, `opencode.db-shm` | SQLite WAL 文件 | watcher 可监听，但不直接解析 |
| `storage/session_diff/*.json` | 每个 session 的 diff 摘要数组 | 可用于 session diff summary，非 transcript 主来源 |
| `snapshot/` | Git object/snapshot 存储 | 第一版忽略 |
| `log/` | opencode 日志 | 第一版忽略 |
| `auth.json` | provider auth/secret | 禁止读取 |

本机数据量：

| 项 | 数值 |
| --- | ---: |
| opencode 数据目录大小 | 144 MB |
| `opencode.db` 大小 | 96 MB |
| `storage/` 大小 | 31 MB |
| `session_diff/*.json` | 190 |
| session 时间范围 | 2026-05-05 20:03:51 到 2026-05-17 13:03:24 |

### 2.2 SQLite 表与行数

本机 `opencode.db` 表：

```text
__drizzle_migrations  event_sequence  session_message
account               message         session_share
account_state         part            todo
control_account       permission      workspace
data_migration        project
event                 session
```

关键行数：

| 表 | 行数 |
| --- | ---: |
| `project` | 6 |
| `session` | 190 |
| `message` | 4,655 |
| `part` | 22,910 |
| `session_message` | 57 |
| `event` | 0 |
| `todo` | 120 |

### 2.3 session 表关键字段

`session` 表已经提供 session 级 token/cost 汇总：

| 字段 | 含义 | 映射建议 |
| --- | --- | --- |
| `id` | opencode session id，如 `ses_...` | 存为 `source_session_id`，canonical `sessions.id` 建议加 `opencode:` 前缀 |
| `project_id` | 关联 `project.id` | join project |
| `parent_id` | 父 session | 映射 `parentSessionId`，同样加 source 前缀 |
| `slug` | 短 slug | fallback display name |
| `directory` / `path` | 工作目录/路径 | 映射 `cwd`/`project` |
| `title` | session title | 映射 `name` |
| `version` | opencode version | 映射 `sourceVersion` |
| `agent` | agent/mode，如 `build` | 映射 `agentName` |
| `model` | JSON model object | 解析为 `providerID/modelID` display |
| `cost` | opencode reported cost | 新增 cost 存储字段或 source cost path |
| `tokens_input` | 输入 token | `metrics.inputTokens` |
| `tokens_output` | 输出 token | `metrics.outputTokens` |
| `tokens_reasoning` | reasoning token | `metrics.reasoningTokens` |
| `tokens_cache_read` | cache read token | `metrics.cacheReadTokens` |
| `tokens_cache_write` | cache write token | `metrics.cacheWriteTokens` |
| `time_created` / `time_updated` | epoch ms | 转 ISO |
| `time_archived` | archived marker | 可映射 status/termination |

本机 session 级汇总：

| 指标 | 数值 |
| --- | ---: |
| sessions | 190 |
| reported cost | 50.447837112 |
| input tokens | 12,065,650 |
| output tokens | 2,100,584 |
| reasoning tokens | 653,561 |
| cache read tokens | 322,410,880 |
| cache write tokens | 0 |

注意：部分 provider/model 的 `cost = 0` 但 tokens 非零，例如 `zhipuai-coding-plan/glm-5.1`。这应标记为 opencode reported zero，而不是前端随意估算为免费。

### 2.4 message / part 表结构

`message` 表：

```sql
CREATE TABLE `message` (
  `id` text PRIMARY KEY,
  `session_id` text NOT NULL,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL,
  `data` text NOT NULL
);
```

`message.data` JSON keys：

```text
agent, cost, error, finish, mode, model, modelID, parentID, path,
providerID, role, summary, time, tokens, tools, variant
```

`part` 表：

```sql
CREATE TABLE `part` (
  `id` text PRIMARY KEY,
  `message_id` text NOT NULL,
  `session_id` text NOT NULL,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL,
  `data` text NOT NULL
);
```

`part.data` type 分布：

| part type | 行数 | 用途 |
| --- | ---: | --- |
| `tool` | 7,203 | tool call + input/output/status |
| `step-start` | 4,282 | assistant step start/snapshot |
| `step-finish` | 4,264 | step token/cost/finish reason |
| `text` | 2,978 | user/assistant text content |
| `reasoning` | 2,883 | reasoning/thinking block |
| `patch` | 1,142 | changed files/patch hash |
| `file` | 154 | attached file |
| `subtask` | 4 | subtask metadata |

`step-finish` 每行都有 `tokens` 和 `cost`。但第一版应以 `message.data.tokens` 或 `session` 表汇总为准，避免同时加总 `step-finish` 导致重复计数。

### 2.5 官方 export schema

本机 `opencode export --sanitize <sessionID>` 可输出 sanitized JSON，结构为：

- `info`: session metadata，包括 `agent`、`model`、`summary`、`cost`、`tokens`、`time`
- `messages[]`: 每个 message 包含 `info` 和 `parts[]`
- `parts[]`: `text`、`file`、`reasoning`、`tool`、`step-start`、`step-finish`、`patch`

用途：

- 适合作为 parser fixture 的安全来源
- 不建议在生产 ingest 中每次 shell out 调 `opencode export`
- 可用 `--sanitize` 生成测试夹具，避免提交真实 transcript

---

## 3. 接入设计

### 3.1 Source identity

新增正式 source id：

```ts
type TraceSource = 'openclaw' | 'claude-code' | 'codex' | 'opencode'
type SourceToolId = 'openclaw' | 'claude-code' | 'codex' | 'opencode'
```

URL scope：

```text
/opencode/dashboard
/opencode/sessions
/opencode/sessions/:sessionId
/opencode/activity
```

canonical DB id 建议：

```text
opencode:<raw-opencode-session-id>
```

理由：

- 当前 `sessions.id` 是全局 primary key，不是 `(source, id)` 复合键
- opencode 原始 id 仍保存在 `source_session_id`
- lookup/API 已允许 `:`，不会破坏现有 session id 校验

### 3.2 数据源发现

新增配置：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `OPENCODE_DB_PATH` | `~/.local/share/opencode/opencode.db` | 指向主 SQLite DB |
| `opencode_db_paths` | 同上 | `~/.agents-tracing/config.json` 中的数组配置 |

也可考虑 `OPENCODE_DATA_DIR`，但第一版只需要 DB path。发现逻辑：

1. 展开 env/config/default DB path
2. 检查文件存在且可读
3. 只读打开 SQLite
4. 校验存在 `session`、`message`、`part`、`project`
5. `SELECT COUNT(*) FROM session` 作为 `sessionCount`

健康状态：

- DB 不存在：`empty` 或 `error`，按现有 source API 语义返回
- DB 存在但 schema 不匹配：`parser-warning` 或 `error`
- DB 存在且 session > 0：`configured`

### 3.3 Parser/reader

新增 `ingest/parser/opencode.ts`，但实现形态不是 JSONL parser，而是 SQLite row reader：

```text
opencode.db
  session + project
  message ordered by time_created, id
  part ordered by time_created, id
    -> ParseResult
    -> writeSessionToDatabase
```

建议拆分：

- `readOpencodeSessionRows(dbPath, since?)`
- `parseOpencodeSession(sessionRow, messageRows, partRows, projectRow): ParseResult`
- `mapOpencodePartToActivity(...)`
- `normalizeOpencodeTokens(...)`
- `normalizeOpencodeModel(...)`

读取模式：

- `new Database(dbPath, { readonly: true, fileMustExist: true })`
- 不开启 WAL，不写入 opencode DB
- 捕获 `SQLITE_BUSY` 并重试或跳过本轮 sync

### 3.4 Canonical mapping

#### Session

| canonical | opencode 来源 |
| --- | --- |
| `id` | `opencode:${session.id}` |
| `source` | `opencode` |
| `sourceSessionId` | `session.id` |
| `project` | `project.worktree` fallback `session.directory` |
| `name` | `session.title` fallback `session.slug` |
| `startedAt` | `new Date(time_created).toISOString()` |
| `endedAt` | `new Date(time_updated).toISOString()` |
| `updatedAt` | `time_updated` |
| `status` | active if latest tool state running, archived if `time_archived`, else idle |
| `parentSessionId` | `opencode:${parent_id}` |
| `relationshipType` | parent exists => `fork` or `subagent` after evidence; otherwise `root` |
| `cwd` | message path cwd / session directory |
| `sourceVersion` | `session.version` |
| `agentName` | `session.agent` |
| `metrics.*Tokens` | session token columns |
| `metrics.hasToolCalls` | any `part.type = tool` |

#### Message

| canonical | opencode 来源 |
| --- | --- |
| `id` | `opencode:${message.id}` |
| `ordinal` | chronological index |
| `role` | `message.data.role` |
| `content` | concatenate non-synthetic `text` parts; file parts become compact placeholders |
| `timestamp` | `message.time_created` |
| `model` | `${providerID}/${modelID}` or parsed `model` JSON |
| `tokenUsage` | `message.data.tokens` normalized |
| `turnIndex` | user message starts a turn; assistant messages attach until next real user |
| `isRealUserInput` | `role === "user"` and not synthetic-only |

#### Activities

| opencode part | canonical activity |
| --- | --- |
| `tool` | `TraceToolCall` + `TraceToolResultEvent` |
| `reasoning` | `TraceThinkingBlock` |
| `patch` | `TraceSystemEvent` or synthetic tool `patch` |
| `subtask` | `TraceSubagentLink` only if it references a session; otherwise `TraceSystemEvent` |
| `step-start` | optional system event; likely omit first version |
| `step-finish` | token/cost checkpoint; use for diagnostics, not primary content |
| `file` | message attachment placeholder |

Tool category mapping:

| opencode tool | category |
| --- | --- |
| `bash` | `Bash` |
| `read` | `Read` |
| `grep`, `glob` | `Grep` |
| `edit`, `write`, `patch` | `Edit` |
| `task`, `subtask` | `Task` |
| others | `Other` |

### 3.5 Cost handling

Current ingest schema stores token totals but not source-reported cost. opencode has session/message/step-level reported cost. To avoid losing this data, add a schema migration:

```sql
ALTER TABLE sessions ADD COLUMN source_cost_usd REAL;
ALTER TABLE sessions ADD COLUMN cost_source TEXT;
ALTER TABLE sessions ADD COLUMN cost_pricing_status TEXT;
```

Proposed semantics:

- `source_cost_usd`: opencode `session.cost` when present
- `cost_source`: `opencode-reported` or `pricing-registry`
- `cost_pricing_status`: `reported`, `reported_zero`, `estimated`, `unknown`, `partial`

Overview API should prefer `source_cost_usd` when `source = 'opencode'` and value is not null; fallback to pricing registry only if explicitly desired. This avoids replacing opencode's own provider/accounting result with local estimates.

---

## 4. Implementation Plan

### Phase O-01: Source identity and schema migration

Files:

- `types/trace.ts`
- `lib/agent-tools/types.ts`
- `ingest/db/schema.sql`
- `ingest/db/index.ts`
- `ingest/config/capabilities.ts`
- Any source whitelist in `ingest/api/*`, `ingest/sync/*`, `lib/agent-tools/*`

Tasks:

1. Add `opencode` to `TraceSource`, `SourceToolId`, `SyncSourceType`, source validation arrays, and DB CHECK constraints.
2. Add migrations for `sessions.source` check constraint strategy. SQLite cannot alter CHECK directly; either rebuild affected tables or relax validation in a safe migration path.
3. Add cost fields described above.
4. Add `SOURCE_CAPABILITIES.opencode = { sessions: true, replay: true, activity: true, cost: true, agents: true/false TBD, automations: false }`.
5. Add tests that invalid sources still fail and `opencode` is accepted.

Acceptance:

- Typecheck passes with `opencode` as valid source.
- Existing `openclaw`/`claude-code`/`codex` tests still pass.
- Existing DBs migrate without losing rows.

### Phase O-02: opencode discovery and reader

Files:

- `ingest/config/tool-dirs.ts`
- `ingest/config/index.ts`
- `ingest/sync/sources.ts`
- New `ingest/parser/opencode.ts`
- New `ingest/parser/opencode.test.ts`

Tasks:

1. Add `OPENCODE_DB_PATH` / `opencode_db_paths`.
2. Implement `discoverOpencodeSources`.
3. Implement readonly DB open and schema guard.
4. Build parser from rows to `ParseResult`.
5. Build sanitized fixture from `opencode export --sanitize` plus synthetic SQLite fixture for tests.

Acceptance:

- `/api/v1/sources/opencode` returns the local DB path and session count.
- Parser can ingest a synthetic opencode DB fixture with text, reasoning, tool, patch, and token/cost fields.
- Parser never reads `auth.json`.

### Phase O-03: Sync write path

Files:

- `ingest/sync/index.ts`
- `ingest/src/watcher.ts`
- `ingest/src/scheduler.ts` if source union is duplicated there
- `ingest/api/sources.ts`

Tasks:

1. Extend `syncSource('opencode')` to use SQLite reader, not JSONL directory recursion.
2. Add a session-level skip key based on opencode `session.time_updated`, message count, part count, and token totals.
3. Store `file_path` as DB path plus raw session id, e.g. `/.../opencode.db#ses_...`.
4. Insert canonical messages/tool calls through existing `writeSessionToDatabase`.
5. Emit existing SSE events on upsert.
6. For watcher, first version can rely on periodic sync/manual sync; optional watcher can monitor `opencode.db` and `opencode.db-wal`.

Acceptance:

- `POST /api/v1/sources/opencode/sync` indexes local opencode sessions.
- Re-running sync is idempotent and does not duplicate messages/tool calls.
- Force sync reparses all opencode sessions.
- Busy/locked opencode DB does not crash ingest service.

### Phase O-04: BFF and frontend source profile

Files:

- `lib/agent-tools/opencode/definition.ts`
- `lib/agent-tools/opencode/server-adapter.ts`
- `lib/agent-tools/registry.ts`
- `lib/agent-tools/index.ts`
- Existing route handlers under `app/api/agent-tools/[tool]/...`
- Components that assume exactly three sources

Tasks:

1. Add opencode tool definition.
2. Register it in `AGENT_TOOL_DEFINITIONS`, `TOOL_IDS`, `SHELL_TOOL_IDS`.
3. Add opencode server adapter by following Codex adapter pattern.
4. Mark `cost: true` because opencode reports cost/token data directly.
5. Audit UI layouts for hardcoded 3-source grids/tabs.

Acceptance:

- `/opencode/dashboard`, `/opencode/sessions`, `/opencode/sessions/:id` resolve.
- Source switcher includes opencode and preserves deep links.
- BFF rejects `all` as before and accepts `opencode`.

### Phase O-05: Overview/cost integration

Files:

- `ingest/api/overview.ts`
- `ingest/pricing/model-pricing.ts`
- `types/overview.ts`
- `components/overview/*`
- `components/sessions/*`
- `components/replay/*`

Tasks:

1. Include opencode in `VALID_SOURCES`.
2. Use `source_cost_usd` for opencode rollups where present.
3. Add `costStatus` handling for reported vs estimated vs unknown.
4. Ensure total token calculations include cache/reasoning channels consistently.
5. Display opencode model as provider/model, not raw JSON string.

Acceptance:

- Overview aggregates show opencode token totals.
- Cost-sort works for opencode without showing false `$0.00` for unknown pricing.
- Sessions table shows model, total tokens, and cost.

### Phase O-06: Docs and verification

Files:

- `docs/CONFIGURATION.md`
- `docs/API.md`
- `docs/services/ingest.md`
- `docs/services/frontend.md`
- `docs/db-schema.md`
- `ERRORS_LEARNED.md` only if new pitfalls are discovered

Tasks:

1. Document `OPENCODE_DB_PATH` / `opencode_db_paths`.
2. Document opencode as a fourth source in API examples.
3. Add troubleshooting for `opencode.db` locked/schema mismatch.
4. Add fixture-generation note using `opencode export --sanitize`.
5. Run targeted tests and typecheck.

Acceptance:

- Docs no longer say only three sources are supported.
- Local setup explains opencode DB discovery and privacy boundaries.

---

## 5. Testing Strategy

### Unit tests

- `parseOpencodeSession` maps a minimal synthetic session to canonical `TraceSession`.
- Token normalization handles input/output/reasoning/cache read/cache write.
- Tool parts map to `TraceToolCall` with status/duration/result events.
- Reasoning parts map to `TraceThinkingBlock`.
- Cost `0` with tokens is marked as `reported_zero`, not discarded.

### Integration tests

- Build a temp SQLite DB with opencode-like schema and sync it.
- Run sync twice and assert no duplicate rows.
- Force sync and assert derived rows are replaced.
- Query `/api/v1/sessions?source=opencode`.
- Query `/api/v1/sessions/:id/turns`.
- Query overview aggregates and top models.

### Manual verification

1. Set `OPENCODE_DB_PATH=/Users/ebbi/.local/share/opencode/opencode.db`.
2. Start ingest + Next with `pnpm dev`.
3. `curl http://localhost:8078/api/v1/sources/opencode`.
4. `curl -X POST http://localhost:8078/api/v1/sources/opencode/sync`.
5. Open `http://localhost:3000/opencode/sessions`.
6. Verify a session replay shows user text, assistant text, reasoning, and tool calls.
7. Verify cost/token fields match opencode DB aggregate queries.

---

## 6. Risks and Decisions Needed

| Risk | Impact | Mitigation |
| --- | --- | --- |
| opencode DB schema changes across versions | Parser breaks after upgrade | Add schema guard, version capture, fixture per supported schema |
| SQLite WAL locked while opencode is running | Sync fails intermittently | Open readonly, short retry, skip current run with warning |
| Token double-counting between message and step-finish | Wrong cost/KPI | Use session totals for session aggregate; message tokens for turn attribution; do not sum both |
| `cost = 0` ambiguity | Misleading UI | Track `reported_zero` separately from `unknown` |
| Sensitive content in local DB | Privacy leakage in tests/docs | Use synthetic fixture or `opencode export --sanitize`; never commit raw local DB/export |
| Current DB CHECK constraints only allow three sources | Migration complexity | Plan explicit schema migration before parser merge |
| UI assumes three source tabs | Layout bugs | Audit source switcher, overview grids, tests |

Open decisions:

1. Should opencode `session.parent_id` be shown as `fork`, `subagent`, or generic `continuation` when no stronger evidence exists?
2. Should `patch` parts appear as activity rows or only as session diff summary?
3. Should opencode `todo` table be surfaced later as activity/automation data?
4. Should opencode authoritative cost be stored generically for all sources now, or initially behind opencode-only columns?

---

## 7. Recommended First PR Scope

Keep the first PR backend-heavy and narrow:

1. Add `opencode` source identity, config, source discovery.
2. Add readonly SQLite parser with synthetic fixture tests.
3. Add sync and sessions/turns API support.
4. Add minimal frontend registry/adapters so `/opencode/sessions` works.
5. Defer rich overview cost polish and `todo`/snapshot/diff visualization to follow-up PRs.

This sequence keeps the critical path focused on correctness: prove that opencode sessions can be indexed into the canonical trace model before expanding UI-specific affordances.
