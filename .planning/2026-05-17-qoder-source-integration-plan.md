# Qoder 数据源接入计划

**日期:** 2026-05-17  
**状态:** Draft / 本机存储调查完成  
**目标:** 将 Qoder 的 session、message、tool activity、subagent relationship、token usage 纳入 agent-tracing-dashboard，成为 OpenClaw、Claude Code、Codex 之后的正式数据源。

---

## 1. 结论摘要

Qoder 不应按 Codex/Claude 的 JSONL 变体处理，而应作为第四个正式 source 接入。原因是本机调查显示：

- Qoder 的轻量 conversation-history JSONL 只包含 `role` 和 `message.content[].text`，没有 token、模型、工具调用、父子 session 等关键字段。
- 可用于 dashboard 的完整数据在 Qoder 自己的 SQLite 主库里：`~/Library/Application Support/Qoder/SharedClientCache/cache/db/local.db`。
- 该 SQLite 主库包含 `chat_session`、`chat_record`、`chat_message`、`chat_snapshot` 等表；其中 `chat_message.token_info`、`chat_message.model_info`、`chat_record.extra.modelConfig`、`chat_message.tool_result` 是 token / 模型 / 工具活动的主来源。
- `~/.qoder/cache/projects/.../conversation-history/*.jsonl` 可以作为文本回退或 sanity check，但第一版不应以它作为主数据源。

推荐第一版能力范围：

- 支持 `/qoder/dashboard`、`/qoder/sessions`、`/qoder/sessions/:id`、`/qoder/activity`
- 支持 session list/detail、turn replay、tool activity、subagent links、token totals
- 显示 Qoder 记录到的 model key，如 `ultimate`、`experts-ultimate`
- cost 暂标记为 unknown，不要把 `ultimate` 推断成某个底层 provider/model 后估价
- 只读 Qoder SQLite；不读取 `machine_token.json`、`secret://...`、auth/token 类存储

---

## 2. 本机 Qoder 存储调查

### 2.1 关键路径

本机发现的 Qoder 相关路径：

| 路径 | 内容 | 接入策略 |
| --- | --- | --- |
| `/Users/ebbi/.qoder` | Qoder 用户目录，包含 cache、extensions、memories、canvas | 只作为辅助调查来源 |
| `/Users/ebbi/.qoder/cache/projects/agents-tracing-dashboard-2b2c660a/conversation-history/*/*.jsonl` | 每个会话的轻量 JSONL | 可作为文本回退；不是主数据源 |
| `/Users/ebbi/.qoder/cache/experts/<session-id>/metadata.json` | experts session metadata | 可作为 experts 辅助 metadata；本机 `members[].model` 为空 |
| `/Users/ebbi/Library/Application Support/Qoder` | VS Code/Electron 风格 app data | 主配置和状态目录 |
| `/Users/ebbi/Library/Application Support/Qoder/SharedClientCache/cache/db/local.db` | Qoder 主 SQLite DB | 第一版主数据源 |
| `/Users/ebbi/Library/Application Support/Qoder/User/workspaceStorage/*/chatEditingSessions/*/state.json` | 编辑会话 timeline/checkpoint 状态 | 第一版不作为 transcript 主来源 |
| `/Users/ebbi/Library/Application Support/Qoder/User/globalStorage/state.vscdb` | VS Code state DB，包含 model selector key | 可辅助映射默认模型 key |
| `/Users/ebbi/Library/Application Support/Qoder/logs/**` | app/extension 日志 | 第一版忽略 |
| `/Users/ebbi/Library/Application Support/Qoder/SharedClientCache/cache/machine_token.json` | token/credential 类数据 | 禁止读取 |

### 2.2 conversation-history JSONL

本机项目相关 JSONL：

| 文件 | 行数 | 大小 | 字段结构 |
| --- | ---: | ---: | --- |
| `~/.qoder/cache/projects/agents-tracing-dashboard-2b2c660a/conversation-history/c2520969/c2520969.jsonl` | 4 | 8 KB | `role`, `message.content[].type`, `message.content[].text` |
| `~/.qoder/cache/projects/agents-tracing-dashboard-2b2c660a/conversation-history/d75614d7/d75614d7.jsonl` | 3 | 12 KB | 同上 |

结论：

- JSONL 能看出基础对话文本。
- JSONL 没有发现 `model`、`usage`、`token_info`、`tool_result`、父子 session 关系等字段。
- 只用 JSONL 会丢失 dashboard 最关心的 token、tool activity、subagent 数据。

### 2.3 SQLite 主库

主库路径：

```text
/Users/ebbi/Library/Application Support/Qoder/SharedClientCache/cache/db/local.db
```

关键表：

```text
chat_session
chat_record
chat_message
chat_snapshot
chat_working_space_file
chat_working_space_file_reference
task_tree
...
```

本机关键行数：

| 表 | 行数 |
| --- | ---: |
| `chat_session` | 4 |
| `chat_record` | 4 |
| `chat_message` | 107 |
| `chat_snapshot` | 0 |

session 时间范围：

```text
2026-05-17 12:04:59 UTC → 2026-05-17 13:17:48 UTC
```

### 2.4 `chat_session` schema 摘要

关键列：

| 列 | 含义 | 映射建议 |
| --- | --- | --- |
| `session_id` | Qoder session UUID | canonical id 用 `qoder:<session_id>`；原始值存 `source_session_id` |
| `session_title` | session title | `sessions.name` / `displayTitle` |
| `project_id` | Qoder project id | source metadata |
| `project_uri` | 工作区 URI | 解析为 `cwd` / `project` |
| `project_name` | 项目名 | `project` fallback |
| `gmt_create` / `gmt_modified` | epoch ms | `startedAt` / `updatedAt` / `endedAt` |
| `session_type` | 如 `assistant`, `agent_sub_search`, `agent_sub_research` | `agentName` 或 source metadata |
| `mode` | 如 `agent`, `experts`, `agent_sub` | session mode metadata |
| `version` | 本机为 `3` | `sourceVersion` |
| `preferred_model_info` | 本机为空 | 模型 fallback，若未来版本填充则读取 |
| `stop_reason` | 停止原因 | `terminationStatus` |
| `extra` | 大 JSON，可能含 first-turn prompt/context | 谨慎读取，不进入 transcript |
| `parent_session_id` | 父 session | `parentSessionId` |
| `parent_tool_call_id` | 父 tool call id | subagent anchor |

本机 session 类型分布：

| session_type | mode | version | 行数 |
| --- | --- | --- | ---: |
| `assistant` | `agent` | `3` | 1 |
| `assistant` | `experts` | `3` | 1 |
| `agent_sub_search` | `agent_sub` | `3` | 1 |
| `agent_sub_research` | `agent_sub` | `3` | 1 |

### 2.5 `chat_record` schema 摘要

`chat_record` 是自然 turn/request 边界：

| 列 | 含义 | 映射建议 |
| --- | --- | --- |
| `request_id` | 单次用户请求 id | `TraceTurn.id` 的来源之一 |
| `session_id` | 所属 session | join key |
| `question` | 用户输入 | 若 `chat_message` 缺少 user 行，可作为合成 user message fallback |
| `answer` | assistant answer | 若 `chat_message` 缺少 assistant 行，可作为 fallback |
| `reasoning_content` | reasoning 文本 | 可映射 `TraceThinkingBlock` |
| `chat_prompt` | prompt 类内容 | 默认不进 transcript |
| `summary` | 摘要 | 可用于 title fallback |
| `extra` | JSON metadata | 模型、subagent、上下文引用的主来源 |
| `parent_session_id` / `parent_tool_call_id` | 父关系 | 关系修补 fallback |

本机 `chat_record.extra` 结构包含：

```json
{
  "modelConfig": { "key": "ultimate" },
  "ideModelConfigOverride": {
    "max_input_tokens": 200000,
    "reasoning_effort": "high"
  },
  "key_sub_agent_name": "Alex",
  "key_sub_agent_role": "researcher",
  "key_sub_agent_type": "Research"
}
```

注意：`chat_record.extra.contextReference` 可能列出 rule/memory/wiki 引用；`chat_session.extra.firstTurnRulesPrompt` 可能包含完整项目指令和目录树。第一版应只解析明确需要的 model/subagent/context counts，不要把大 prompt 注入 canonical message。

### 2.6 `chat_message` schema 摘要

关键列：

| 列 | 含义 | 映射建议 |
| --- | --- | --- |
| `id` | message id | `TraceMessage.id` |
| `session_id` | 所属 session | join key |
| `request_id` | 所属 turn/request | turn grouping |
| `role` | `user` / `assistant` / `tool` | `tool` 映射 canonical `tool_result` |
| `content` | message content | `TraceMessage.content` |
| `summary` | message summary | 可作为折叠显示 |
| `tool_result` | tool call/result JSON | `TraceToolCall` + `TraceToolResultEvent` |
| `token_info` | token JSON | `TokenUsage` |
| `model_info` | model JSON | message-level model fallback |
| `extra` | metadata | 谨慎读取 |
| `gmt_create` | epoch ms | `timestamp` |

本机 role/token/model/tool 分布：

| role | rows | token rows | model rows | tool rows |
| --- | ---: | ---: | ---: | ---: |
| `assistant` | 27 | 27 | 6 | 0 |
| `tool` | 75 | 0 | 0 | 75 |
| `user` | 5 | 0 | 0 | 0 |

本机 `token_info` 示例结构：

```json
{
  "prompt_tokens": 40190,
  "completion_tokens": 1731,
  "cached_tokens": 29899,
  "max_input_tokens": 200000
}
```

字段映射建议：

| Qoder token 字段 | Canonical token 字段 |
| --- | --- |
| `prompt_tokens` | `inputTokens` |
| `completion_tokens` | `outputTokens` |
| `cached_tokens` | `cacheReadTokens` |
| `max_input_tokens` | source metadata，不参与 total |

本机 token 合计：

| 指标 | 数值 |
| --- | ---: |
| prompt tokens | 1,568,454 |
| completion tokens | 34,200 |
| cached tokens | 1,326,314 |

注意：Qoder 的 `prompt_tokens` 是否已经包含 `cached_tokens` 需要验证。第一版建议按当前项目的 pricing 约定处理为：

```text
inputTokens = prompt_tokens
outputTokens = completion_tokens
cacheReadTokens = cached_tokens
totalTokens = prompt_tokens + completion_tokens
```

不要把 `cached_tokens` 再加进 total，避免 double count。cost 估算层如果以后支持 Qoder，需要明确 Qoder 的 cache 计费语义后再接。

### 2.7 模型信息调查

本机能看到的模型信息：

| 来源 | 内容 | 覆盖情况 |
| --- | --- | --- |
| `chat_message.model_info` | `{"model_key":"ultimate"}` / `{"model_key":"experts-ultimate"}` | 只有 6 个 assistant rows 有值 |
| `chat_record.extra.modelConfig.key` | `ultimate` / `experts-ultimate` | 4 个 request 全部有值 |
| `User/globalStorage/state.vscdb` | `chat.modelConfig.assistant=ultimate`, `chat.modelConfig.experts=experts-ultimate` | 默认 model selector |
| `User/workspaceStorage/.../state.vscdb` | `chat.modelConfig.session.<session_id>=...` | 当前工作区 session model key |
| `User/dynamic-text-cache.json` | `ultimate` / `experts-ultimate` display label 均为 `Ultimate` / `极致` | 只有展示名和描述 |

结论：

- Qoder UI 不显示具体底层模型时，本地记录也未必能恢复到底层 provider/model。
- 本机 DB 能稳定恢复的是 Qoder 的 model key：`ultimate`、`experts-ultimate`。
- `ultimate` 和 `experts-ultimate` 是产品层模型档位，不等同于 Claude/OpenAI/Gemini 的具体模型名。
- dashboard 第一版应显示 `ultimate` / `experts-ultimate`，cost pricing status 为 `unknown`。
- 若未来要做 cost，需要找到 Qoder 官方账单、credit usage API、或本地可验证的底层 provider/model 映射；不能凭 UI 文案推断。

### 2.8 工具调用调查

本机 `chat_message.tool_result` 为 JSON object，关键字段：

```text
sessionId
requestId
projectPath
toolCallId
toolCallStatus
parameters
results
toolCallName
extraParameters
errorCode
errorMsg
```

工具分布：

| toolCallName | 行数 |
| --- | ---: |
| `read_file` | 39 |
| `search_file` | 12 |
| `grep_code` | 12 |
| `search_codebase` | 7 |
| `list_dir` | 2 |
| `Agent` | 2 |
| `run_in_terminal` | 1 |

状态分布：

| toolCallStatus | 行数 |
| --- | ---: |
| `FINISHED` | 71 |
| `ERROR` | 4 |

字段映射建议：

| Qoder 字段 | Canonical 字段 |
| --- | --- |
| `toolCallId` | `TraceToolCall.id` / `tool_id` |
| `toolCallName` | `TraceToolCall.name` |
| `parameters` | `inputJson` |
| `results[]` | `TraceToolResultEvent[]` |
| `toolCallStatus=FINISHED` | `status='success'` |
| `toolCallStatus=ERROR` | `status='error'`, `error=errorMsg` |
| `projectPath` | source metadata / cwd fallback |

工具分类建议：

| Qoder tool | Canonical category |
| --- | --- |
| `read_file` | `Read` |
| `search_file`, `grep_code`, `search_codebase` | `Grep` |
| `list_dir` | `Read` |
| `run_in_terminal` | `Bash` |
| `Agent` | `Agent` |
| 其他 | `Other` |

### 2.9 subagent relationship 调查

本机 `chat_session.parent_session_id` / `parent_tool_call_id` 能关联回父 session 的 `Agent` tool call：

| child session | parent session | parent tool | toolCallName |
| --- | --- | --- | --- |
| `f6ce55be-b8a9-4d18-a180-2500a780994d` | `d75614d7-64b9-40e6-9aaf-668182f8bfcc` | `toolu_bdrk_01GwLQhKXq9QrH7cWG52GpSa` | `Agent` |
| `565b27ad-4e5c-46b7-bcd2-a93945cb3f19` | `c2520969-df7c-49b4-a94a-f67abdf5e20d` | `toolu_bdrk_01KisGbensAF4ekuY33Jdsab` | `Agent` |

映射建议：

- parent/root session 均加 `qoder:` canonical 前缀。
- `chat_session.parent_session_id` 非空时：
  - `relationshipType = 'subagent'`
  - `parentSessionId = qoder:<parent_session_id>`
  - `rootSessionId = qoder:<root ancestor>`，第一版可先设为 parent，后续递归修补
- 额外生成 `TraceSubagentLink`：
  - `sessionId = qoder:<parent_session_id>`
  - `subagentSessionId = qoder:<child_session_id>`
  - `subagentSource = 'qoder'`
  - `relationship = 'spawned'`
  - `messageOrdinal` 通过 parent session 中匹配 `toolCallId` 的 tool message 推导

---

## 3. 接入设计

### 3.1 Source identity

新增正式 source id：

```ts
type TraceSource = 'openclaw' | 'claude-code' | 'codex' | 'qoder'
type SourceToolId = 'openclaw' | 'claude-code' | 'codex' | 'qoder'
```

URL scope：

```text
/qoder/dashboard
/qoder/sessions
/qoder/sessions/:sessionId
/qoder/activity
```

canonical session id：

```text
qoder:<raw-qoder-session-id>
```

理由：

- 当前 `sessions.id` 是全局 primary key，不是 `(source, id)` 复合键。
- raw Qoder UUID 有潜在跨 source 冲突风险。
- 现有 BFF session id 校验允许 `:`。

### 3.2 配置和发现

新增配置：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `QODER_DB_PATH` | `~/Library/Application Support/Qoder/SharedClientCache/cache/db/local.db` | 单库路径，环境变量优先 |
| `qoder_db_paths` | 同上 | `~/.agents-tracing/config.json` 多路径数组 |

实现选项：

1. 保持现有 `TOOL_DIR_REGISTRY` 语义为“路径列表”，但允许 Qoder 的默认项指向 DB 文件。
2. 在 `discoverQoderSources()` 中识别 file path，而不是递归 `.jsonl` 目录。
3. 返回 `DiscoveredSource { type: 'qoder', path: dbPath, sessionCount }`。

发现逻辑：

1. 展开 env/config/default DB path。
2. 检查文件存在且可读。
3. 只读打开 SQLite。
4. 校验存在 `chat_session`、`chat_record`、`chat_message`。
5. `SELECT COUNT(*) FROM chat_session` 作为 `sessionCount`。

健康状态：

- DB 不存在：返回 `sessionCount: 0` 和 `error`，不让 ingest 崩溃。
- DB 存在但 schema 不匹配：返回 `parser-warning` 或 `error`。
- DB 可读且 session > 0：`configured`。

### 3.3 Parser/reader

新增 `ingest/parser/qoder.ts`。它不是 JSONL parser，而是 SQLite row reader + canonical mapper：

```text
Qoder local.db
  chat_session
  chat_record
  chat_message
    -> QoderSessionBundle
    -> ParseResult
    -> writeSessionToDatabase
```

建议拆分：

- `readQoderSessionBundles(dbPath, options)`
- `parseQoderSession(bundle): ParseResult`
- `normalizeQoderModel(messageRow, recordRow, sessionRow)`
- `normalizeQoderTokenUsage(tokenInfo)`
- `mapQoderToolResult(toolResult): TraceToolCall`
- `buildQoderSubagentLinks(sessionRows, messageRows)`

读取顺序：

```sql
SELECT * FROM chat_session ORDER BY gmt_modified DESC
SELECT * FROM chat_record WHERE session_id = ? ORDER BY gmt_create, request_id
SELECT * FROM chat_message WHERE session_id = ? ORDER BY gmt_create, id
```

turn 组装策略：

- 优先按 `chat_record.request_id` 分组。
- 同一 `request_id` 下：
  - `role='user'` → user message
  - `role='assistant'` → assistant messages
  - `role='tool'` → tool result message + tool activity
- 若某个 record 缺少 user/assistant message，则用 `chat_record.question` / `chat_record.answer` 合成 fallback message，并在 `sourceMetadata` 标记 `syntheticFrom='chat_record'`。

token 聚合策略：

- 只加总 assistant row 的 `token_info`。
- `inputTokens = prompt_tokens`
- `outputTokens = completion_tokens`
- `cacheReadTokens = cached_tokens`
- `totalTokens = prompt_tokens + completion_tokens`
- `cacheWriteTokens = 0`
- `reasoningTokens = 0`，除非未来发现 Qoder 独立字段

模型选择优先级：

1. `chat_message.model_info.model_key`
2. `chat_record.extra.modelConfig.key`
3. `chat_session.preferred_model_info`
4. workspace/global `chat.modelConfig.session.<id>` / `chat.modelConfig.assistant` / `chat.modelConfig.experts`
5. `unknown`

### 3.4 Sync 层

当前 `syncSource()` 假设候选对象是文件。Qoder 是 SQLite DB，因此建议做最小扩展：

- `SyncSourceType` 加 `'qoder'`
- 新增 `syncQoderSource(opts)`，不走 `collectSessionFileCandidates()`
- 对每个 Qoder DB：
  - 打开只读 DB
  - 读取 session bundles
  - 每个 session 转 `ParseResult`
  - 调 `writeSessionToDatabase(parseResult, undefined, dbPath, { force })`

skip cache：

- 不能用整个 `local.db` 的 file hash 作为每个 session 的 skip cache；任意新消息都会改变整库 hash，导致全部 Qoder sessions 重写。
- 第一版建议为每个 Qoder session 生成 source-specific hash：

```text
qoder-session-v1:<session_id>:<chat_session.gmt_modified>:<message_count>:<max_message_gmt_modified>
```

实现上可给 `writeSessionToDatabase` 增加可选 `sourceFingerprint`，或 Qoder sync 自己在调用前决定是否跳过。

watcher：

- 监听 `local.db`、`local.db-wal`、`local.db-shm` 所在目录。
- 事件触发后 sync 整个 Qoder source，但通过 session fingerprint 跳过未变化 session。
- Qoder DB 是 WAL 模式，`-wal` 变化可能比主 DB 更频繁；需要 debounce。

SQLite 读取方式：

- 使用只读连接。
- 避免对 Qoder DB 执行任何 PRAGMA 写入。
- 若 live DB locked，捕获错误并保留旧索引，不清空本项目数据。
- 如遇 WAL consistency 问题，后续可以实现“复制 `local.db` + `local.db-wal` + `local.db-shm` 到临时目录后读取”的 snapshot reader。

### 3.5 DB schema / migrations

需要扩展所有 source CHECK constraint：

```sql
source IN ('openclaw', 'claude-code', 'codex', 'qoder')
source_type IN ('openclaw', 'claude-code', 'codex', 'qoder')
subagent_source IN ('openclaw', 'claude-code', 'codex', 'qoder')
```

SQLite 不能直接修改 CHECK constraint。迁移策略：

1. 新建带新 CHECK 的 replacement table。
2. 拷贝旧数据。
3. drop old table。
4. rename replacement。
5. 重建 indexes/triggers/foreign keys。

涉及表：

- `sessions`
- `subagent_links`
- `ingest_file_cursors`
- `sync_status` 如果 schema 中有 source enum 约束则同步检查

注意：迁移要保留现有 FTS5 external content trigger、indexes、foreign key 行为。

### 3.6 前端/BFF

新增：

```text
lib/agent-tools/qoder/definition.ts
lib/agent-tools/qoder/server-adapter.ts
```

注册：

- `lib/agent-tools/types.ts`: `SourceToolId` 加 `qoder`
- `lib/agent-tools/registry.ts`: import/register `qoderDef`，`TOOL_IDS` 加 `qoder`
- BFF route adapter map 加 `qoderAdapter`
- `SourceSwitcher` / overview source color map / label formatter 加 Qoder

建议 Qoder capability：

| capability | 第一版 |
| --- | --- |
| sessions | true |
| replay | true |
| activity | true |
| office | false |
| workspace | false |
| subagents | true |
| cost | false |
| approvals | false |

session columns：

- `SESSION`
- `STATUS`
- `MODEL`
- `PROJECT`
- `TOKENS`
- `UPDATED`

模型展示：

- 显示 `ultimate` / `experts-ultimate`，tooltip 可显示 Qoder 文案 `Ultimate`。
- 不显示为 Claude/OpenAI/Gemini 具体模型。

### 3.7 Cost/pricing

第一版不估价：

- `estimateModelCost('ultimate', usage)` 应返回 `unknown`。
- Qoder 没有在本机 DB 里给出可验证的美元 cost 字段。
- `ultimate` / `experts-ultimate` 是产品档位，不是 provider model。

后续可能路径：

1. 如果 Qoder 本地或 API 提供 credit usage，可新增 `reportedCost` 字段。
2. 如果能稳定发现底层 provider/model，可加 model alias 映射。
3. 否则继续以 token-only 展示，pricingStatus 为 `unknown`。

---

## 4. 实施计划

### 阶段 A：最小只读接入

目标：Qoder sessions 能出现在 `/qoder/sessions` 和 `/all/sessions`。

任务：

1. 扩展 `TraceSource` / `SourceToolId` / registry / source switcher。
2. 增加 DB enum CHECK 迁移。
3. 增加 `QODER_DB_PATH` / `qoder_db_paths` 配置。
4. 实现 `discoverQoderSources()`。
5. 实现 `syncQoderSource()` 的只读 SQLite session/message/token parse。
6. 新增 `qoder` BFF adapter 和 UI definition。
7. 增加 fixtures 和单元测试。

验收：

- `/api/v1/sources/qoder` 返回本机 DB path 和 sessionCount。
- `POST /api/v1/sources/qoder/sync` 写入 4 个本机 session。
- `/qoder/sessions` 能列出 session，模型显示 `ultimate` / `experts-ultimate`。
- `/all/sessions` 能混合展示 Qoder。

### 阶段 B：turn replay + tools

目标：Qoder session detail 能看到用户输入、assistant 回复、工具调用和工具结果。

任务：

1. 按 `request_id` 建 turn。
2. `role='tool'` 映射 `TraceToolCall`。
3. `tool_result.results[]` 映射 `TraceToolResultEvent`。
4. `toolCallStatus=ERROR` 映射失败状态。
5. `Agent` 工具调用映射为 subagent link anchor。
6. 增加 replay fixture 覆盖 read/search/grep/Agent/error。

验收：

- `/qoder/sessions/:id` 能按 turn 展示。
- 工具调用数量与本机 DB query 一致。
- error tool 状态在 activity/replay 中显示为 error。
- child session detail 能回链 parent session。

### 阶段 C：增量和 watcher

目标：Qoder live 使用时不会导致每次整库重写。

任务：

1. 为 Qoder 增加 session fingerprint skip。
2. watcher 监听 Qoder DB 目录，识别 `.db` / `.db-wal` / `.db-shm`。
3. sync debug history 标记 Qoder parsed/skipped sessions。
4. 加 locked DB / WAL fallback 测试。

验收：

- Qoder DB 未变化时 sync 基本跳过。
- 只新增一个 Qoder message 时只重写对应 session。
- Qoder app 正在运行时 ingest 不崩溃。

### 阶段 D：文档和 polish

任务：

1. 更新 `docs/CONFIGURATION.md`。
2. 更新 `docs/services/ingest.md`。
3. 更新 `docs/services/frontend.md`。
4. 更新 `docs/API.md` source 列表。
5. 补 `ERRORS_LEARNED.md`：Qoder DB 中 auth/token 文件禁止读取；JSONL 不含 token/model。

---

## 5. 注意点 / 风险

### 5.1 Qoder UI 不显示具体模型时，本地也可能只能看到档位

本机可恢复的是 `ultimate` / `experts-ultimate`，不是底层 `claude-*`、`gpt-*`、`gemini-*`。这会影响：

- top models：可以显示 Qoder model key。
- cost：应为 unknown。
- provider grouping：不要把 `ultimate` 归到 Anthropic/OpenAI。

### 5.2 token 语义需要防 double count

`token_info` 同时有 `prompt_tokens` 和 `cached_tokens`。目前不确定 `prompt_tokens` 是否包含 cached 部分。第一版展示：

- total tokens = prompt + completion
- cached tokens 单独展示
- cost 不估算

等有官方语义或更大样本后再调整。

### 5.3 `chat_session.extra` 可能很大且包含 prompt/context

本机 `chat_session.extra.firstTurnRulesPrompt` 包含项目指令、目录树、环境信息。它不应进入 canonical transcript，也不应在 API 中默认返回。只解析必要 key，并限制 JSON field size。

### 5.4 不要读取 credential/token

明确禁止读取：

- `SharedClientCache/cache/machine_token.json`
- `supabase_token` 表内容
- `User/globalStorage/state.vscdb` 中 `secret://...` key 的 value
- HTTP/cookie/local storage credential 文件

Qoder source 接入只需要 `local.db` 的 `chat_*` 表和非 secret 的 model selector key。

### 5.5 SQLite live DB / WAL

Qoder 正在运行时，`local.db-wal` 会变化。实现要满足：

- 只读打开。
- 读失败时保留旧数据并记录 parser warning。
- 不在 Qoder DB 上执行写 PRAGMA。
- 必要时用临时 snapshot 读取。

### 5.6 现有架构里 source 枚举写死点很多

除了类型和 registry，还要改：

- SQLite schema CHECK constraint
- migrations
- sync source union
- discoverers
- BFF adapter maps
- overview/source label/color maps
- tests/fixtures/golden generation
- docs/API/docs/services

不能只改前端 registry，否则 BFF 和 ingest 会拒绝 `qoder`。

---

## 6. 测试计划

单元测试：

- `ingest/parser/qoder.test.ts`
  - token_info 映射
  - model fallback priority
  - tool_result 映射
  - subagent parent link
  - malformed JSON graceful warning
- `ingest/sync/qoder.test.ts`
  - 只读 SQLite source sync
  - session fingerprint skip
  - locked/unreadable DB handling
- `ingest/sync/sources.test.ts`
  - Qoder DB discovery
  - missing DB behavior
- `lib/agent-tools/types.test.ts`
  - qoder registry / assertSourceToolId
- BFF route tests
  - `/api/agent-tools/qoder/sessions`
  - source scoped session isolation

Fixture 策略：

- 不提交真实 Qoder DB。
- 在测试中用 `better-sqlite3` 临时创建最小 Qoder schema 和 rows。
- 内容使用 synthetic transcript。
- 覆盖一条 root session + 一条 subagent session + 一个 error tool。

手动验证：

```bash
pnpm test:run ingest/parser/qoder.test.ts
pnpm test:run ingest/sync/sources.test.ts
pnpm test:run lib/agent-tools/types.test.ts
pnpm lint
pnpm build
```

本机 smoke：

```bash
pnpm dev
curl http://localhost:8078/api/v1/sources/qoder
curl -X POST http://localhost:8078/api/v1/sources/qoder/sync
open http://localhost:3000/qoder/sessions
```

---

## 7. 推荐优先级

建议把 Qoder 接入排在 Phase 13 residuals 之后，作为一个独立 source 扩展阶段做。理由：

- Qoder 不是 JSONL source，需要扩展 sync 抽象，不是简单 parser addition。
- 当前 v1.1 正在收尾 Sessions Table & Trace Detail v2；Qoder 接入会扩大 source 枚举和 schema migration 的 blast radius。
- 本机调查已经确认可行，后续可以按本计划直接进入 implementation。

