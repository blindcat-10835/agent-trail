# 领域陷阱：本地 Agent Session Tracing Dashboard

**项目:** agent-tracing-dashboard  
**研究日期:** 2026-05-06  
**范围:** OpenClaw、Claude Code、Codex 本地会话回放；工具调用、skills、subagents、生成产物渲染  
**总体信心:** HIGH。本文件基于当前 API 路由、已有数据获取研究，以及 agentsview 参考实现的 parser、SQLite schema、watcher、SSE 和虚拟列表代码。

## 结论摘要

这个项目最容易失败的地方不是 UI，而是把三种 agent 的本地日志误当成“普通聊天记录”。当前 `app/api/sessions/messages/route.ts` 只读 OpenClaw 文件、只取最后 30 行、只保留 `type: "message"` 的第一段文本或工具名，并把内容截到 300 字。这可以做临时预览，但不能支撑 v1 的 session replay。

v1 应先做“可重放的规范化 trace 模型”，再做展示。Claude Code 有 uuid/parentUuid DAG、fork、queued command、compact summary、sidechain、流式重复 assistant 行和截断尾行；Codex 有 `response_item`、`function_call`、`function_call_output`、`event_msg`、`spawn_agent`、`wait`、subagent notification；OpenClaw 有 session header、metadata、message、独立 `toolResult` role 和 agent 子目录命名。它们不能共用一个 ad-hoc JSON 扫描器。

阶段上应按依赖排序：先 fixture + canonical model，再 source-specific parser，再持久化和增量同步，再 API/SSE，再虚拟化 replay UI，最后做隐私、性能和回归硬化。

## 建议阶段映射

| 阶段 | 名称 | 主要防范 |
|------|------|----------|
| Phase 1 | Trace Contract + Fixture Corpus | 固定 canonical schema、样例日志、黄金输出，避免后续 UI 绑定错误数据结构 |
| Phase 2 | Source Parsers | 分别实现 OpenClaw、Claude Code、Codex adapter，避免把不同 JSONL 协议混成一种 |
| Phase 3 | Local Index + Incremental Sync | SQLite/本地索引、文件元数据、水位、debounce、watch fallback，避免每次请求全量读文件 |
| Phase 4 | Replay API + SSE | 分页、范围查询、session watch、数据变更事件和 heartbeat，避免 UI stale 或一次性拉爆 |
| Phase 5 | Replay UI + Artifact Rendering | 虚拟列表、工具卡片、subagent 链接、system/skill/artifact 过滤，避免长会话不可用 |
| Phase 6 | Hardening + Privacy + Regression | 路径约束、敏感内容处理、跨版本 fixture 回归、性能基准，避免本地数据泄露和格式漂移 |

## Critical Pitfalls

### Pitfall 1: 把 JSONL 当成最近 30 条聊天消息

**What goes wrong:**  
当前路由只取最后 30 行、只解析 `type === "message"`、只返回 `role/content/timestamp`。这会丢掉早期上下文、tool input/output、subagent 事件、queued command、system boundary、token usage、termination 状态和完整 artifact。长会话回放会变成“看起来能打开，但事实错误”的 UI。

**Warning signs:**
- 会话详情页和源文件明显不一致，尤其是工具调用、patch、subagent 结果缺失。
- 用户滚动到会话开头时没有历史，或只能看到最后几轮。
- UI 只能显示“🔧 tool”，无法展开参数、结果、状态、关联 subagent。
- 解析函数返回的是通用 `content: string`，没有 `tool_calls`、`tool_results`、`source_type`、`ordinal`。

**Prevention strategy:**
- Phase 1 定义 canonical trace model：`session`、`message`、`tool_call`、`tool_result_event`、`artifact`、`source_metadata` 分层。
- Phase 1 建立 fixture corpus：每种 agent 至少包含普通对话、工具调用、失败工具、subagent、长文本、截断尾行、格式异常、旧版本日志。
- Phase 2 禁止 UI/API 直接扫描 JSONL；所有读取必须通过 parser adapter 输出 canonical model。
- Phase 3 持久化 parser 输出，API 只做索引查询和分页，不在请求路径上临时全量解析。

**Phase mapping:** Phase 1 阻断数据结构错误；Phase 2 替换 ad-hoc parser；Phase 3 把结果落库；Phase 5 才基于稳定模型做 replay。

### Pitfall 2: 三种 agent 日志格式被错误统一

**What goes wrong:**  
OpenClaw、Claude Code、Codex 的 JSONL 顶层类型、时间戳位置、工具结构、系统消息、session id 规则都不同。强行写一个“通用 JSON path 扫描器”会造成静默丢数据：Claude 的 `attachment`/`progress`/`queue-operation` 被忽略，Codex 的 `response_item.function_call` 被当成普通文本，OpenClaw 的 `toolResult` 被漏掉。

**Warning signs:**
- parser 里大量 `if (block.type === "text")`，但没有 source-specific 分支。
- session id 没有 `openclaw:`、`claude/codex:` 或 agent 子目录前缀，出现跨 agent 碰撞。
- 同一 UI 字段需要猜测 `toolUseID`、`tool_use_id`、`call_id`、`toolCallId`。
- 添加第二种 agent 后第一种 agent 的解析测试开始回归。

**Prevention strategy:**
- Phase 2 用 adapter pattern：`parseOpenClawSession`、`parseClaudeSession`、`parseCodexSession` 分开维护，只共享 canonical output types。
- 每个 adapter 保留 source metadata：`source_type`、`source_subtype`、`source_uuid`、`source_parent_uuid`、`source_version`、`cwd`、`git_branch`、`file_path/size/mtime`。
- 输入字段差异只在 adapter 内部处理；UI 永远消费 canonical `TraceMessage`/`TraceToolCall`。
- fixture 断言不仅比消息数量，还要比 ordinal、tool call id、result event、subagent session id、system subtype。

**Phase mapping:** Phase 1 设计 canonical contract；Phase 2 实现 source adapters；Phase 6 用跨 agent fixture 做回归。

### Pitfall 3: 工具调用和工具结果配对错误

**What goes wrong:**  
工具调用/结果不是简单相邻行。OpenClaw 的 `toolResult` 是单独 role；Claude 的 tool use/result 在 content blocks 中，还会有 subagent 映射；Codex 的 function call/output 通过 `call_id` 关联，`wait` 输出还可能包含多个 agent 的状态。错误配对会让 replay 的工具卡片显示错结果、重复结果，或把结果当成用户消息。

**Warning signs:**
- 工具结果按照“下一条 user 消息”配对，而不是按 id。
- UI 里出现空白 user message，内容其实是 tool result。
- 多个工具并发时结果归到错误工具卡片。
- `apply_patch`、`exec_command`、`spawn_agent` 没有专门摘要，全部显示原始 JSON。

**Prevention strategy:**
- Phase 1 在 canonical model 中独立建 `tool_calls` 和 `tool_result_events`，不要把工具结果塞进纯文本 message。
- Phase 2 按 source id 配对：OpenClaw 用 `toolCallId`，Claude 用 `tool_use_id`，Codex 用 `call_id`。
- Codex parser 需要维护 `callNames`、`callRefs`、`agentSpawnCalls`、`agentWaitCalls` 和 pending subagent events；不能只做单行转换。
- Phase 5 的 UI 工具卡片按 category 渲染：Bash/Edit/Read/Grep/Task/Agent/Other，并支持 input/result 折叠。

**Phase mapping:** Phase 1 定义关系表；Phase 2 保证配对准确；Phase 3 存储 result events；Phase 5 渲染工具卡片。

### Pitfall 4: Claude Code DAG/fork 被线性化

**What goes wrong:**  
Claude Code JSONL 有 `uuid`/`parentUuid` 树。重试、fork、继续会话、compact summary、queued command 都会破坏“文件行顺序等于会话顺序”的假设。线性渲染会把多个分支混在一起，或者丢掉真实主分支。

**Warning signs:**
- Claude replay 中出现前后矛盾的用户问题和 assistant 回复。
- `parentUuid` 不等于上一条 `uuid`，但 parser 没有任何 fork 处理。
- 同一 `message.id` 的 assistant 流式快照被重复显示多次。
- queued command 不显示，或显示在错误时间点。

**Prevention strategy:**
- Phase 2 实现 DAG-aware Claude parser：构建 parent -> children adjacency，按 fork threshold 区分小 gap retry 和大 gap fork。
- 对不完整 DAG fallback 到 linear parse，但必须记录 parser warning。
- 合并同一 `message.id` 的连续 assistant streaming duplicates，只保留最终内容和 token usage。
- `attachment.type=queued_command` 按 timestamp 插回主 timeline，并重新编号 ordinal。
- compact summary 作为 system boundary 保留，供 UI 显示“上下文被压缩”。

**Phase mapping:** Phase 2 是硬依赖；Phase 3 存 `parent_session_id`/`relationship_type`；Phase 5 需要能显示 fork/compact boundary。

### Pitfall 5: Codex subagent 生命周期只解析一半

**What goes wrong:**  
Codex 的 subagent 不只是 `spawn_agent` 一行。`spawn_agent` 输出返回 agent id，`wait` 参数声明等待哪些 agent，`wait` 输出给出每个 agent 的 terminal status，`<subagent_notification>` 还可能先于 wait 出现。增量解析遇到这些事件时可能必须回退全量解析。

**Warning signs:**
- subagent 完成通知显示成普通用户消息。
- `wait` 卡片没有关联 agent 状态，或状态顺序不稳定。
- 增量同步后 subagent 信息缺失，但手动刷新后出现。
- parser 没有 pending event buffer，也没有 “incremental needs full parse” 分支。

**Prevention strategy:**
- Phase 2 Codex adapter 必须建 subagent correlation 状态机，而不是逐行无状态解析。
- Phase 3 增量同步遇到 `wait`、subagent function output、subagent notification 时触发 full reparse。
- Phase 5 对 subagent 显示成可跳转的子会话或内嵌 result timeline，不混入普通 user turn。

**Phase mapping:** Phase 2 实现状态机；Phase 3 实现 full-parse fallback；Phase 5 实现 subagent 链接和事件渲染。

### Pitfall 6: 文件监听和增量同步不处理真实文件系统行为

**What goes wrong:**  
本地 session 文件是 append-only 为主，但会出现部分写入、无换行尾行、rename、remove、archive suffix、目录新增、watcher 资源不足、同步风暴。只在 API 请求时读文件，或只 watch 当前目录，都容易漏事件、重复解析或解析半行。

**Warning signs:**
- 活跃会话最后一条消息偶尔 JSON parse 失败后永久丢失。
- 新建 agent/session 目录不被发现。
- 大量 session 时 watcher 报 `EMFILE`/`ENOSPC` 或 UI 长时间无更新。
- 文件 rename/delete 后数据库仍显示旧 active session。

**Prevention strategy:**
- Phase 3 使用文件元数据水位：`file_path`、`file_size`、`file_mtime`、可选 inode/device/hash。
- 读取 JSONL 时支持大行上限、跳过完整 malformed line，并识别“无换行 + 非法 JSON”的截断尾行。
- watcher 做 recursive + shallow/poll fallback；对 `Write/Create/Remove/Rename` 做 debounce。
- OpenClaw 需要识别 `.jsonl` 以及 `.jsonl.deleted.*`、`.jsonl.reset.*`、`.jsonl.full.bak` 等归档形态。
- 保留 skipped/excluded file 缓存，避免失败文件在每次启动时重复拖慢同步。

**Phase mapping:** Phase 3 主责；Phase 4 通过 SSE 暴露 sync 状态；Phase 6 加压力测试和 watcher 降级测试。

### Pitfall 7: 没有本地索引，导致性能和一致性同时失败

**What goes wrong:**  
长会话可能有数千行，单行可能很大。每次打开详情页都扫描 JSONL，会在本地机器上造成卡顿；同时没有稳定 ordinal、分页、索引、删除状态、star/pin 状态，也无法做跨 session 检索和统计。

**Warning signs:**
- API 请求时间随文件大小线性增长。
- 会话列表和详情页数据来自不同扫描逻辑，数量对不上。
- 无法按 ordinal 范围加载消息，只能一次性返回全部或最近 N 条。
- 删除/排除/收藏/置顶只能存在前端 localStorage。

**Prevention strategy:**
- Phase 3 引入 SQLite 或同等本地索引，至少包含 `sessions`、`messages`、`tool_calls`、`tool_result_events`、`starred_sessions`、`pinned_messages`、`excluded_sessions`。
- `messages` 使用 `(session_id, ordinal)` 唯一约束和索引，API 做 cursor/range 分页。
- `tool_calls` 建 `message_id`、`session_id`、`category`、`skill_name`、`subagent_session_id` 索引，避免删除和展开工具卡片时全表扫描。
- parser 输出替换时使用 transaction，避免 session 更新一半时 UI 读到不一致状态。

**Phase mapping:** Phase 3 是必须项；Phase 4 的 API 建在索引上；Phase 5 的虚拟列表依赖 range pagination。

### Pitfall 8: 实时回放没有事件通道和 heartbeat

**What goes wrong:**  
只靠手动刷新或轮询 session 文件会让活跃会话 replay stale。相反，如果浏览器直接高频轮询全量消息，又会拖慢本地 app。参考实现使用 SSE 推送 `data_changed`、`session_updated`、`session.timing` 和 heartbeat，这是更适合本地 dashboard 的模式。

**Warning signs:**
- 活跃 session 详情页必须刷新才看到新工具输出。
- 多个 tab 同时打开时 CPU 飙升。
- SSE/stream 连接没有 heartbeat，代理或浏览器静默断开后 UI 还显示 connected。
- 订阅未知 session id 时连接一直挂着。

**Prevention strategy:**
- Phase 4 做两类 SSE：全局 `data_changed` 和单 session `session_updated`。
- 连接建立时先验证 session id，未知 id 直接 404，不开启无限 heartbeat。
- 单 session stream 初始推送 timing snapshot，后续只推送 invalidation 或轻量 timing，消息正文仍走分页 API。
- heartbeat 使用 UTC/RFC3339 时间，前端检测超时并自动重连。

**Phase mapping:** Phase 4 主责；Phase 5 消费事件刷新当前窗口；Phase 6 做断线/重连 UAT。

### Pitfall 9: 长会话 UI 不做虚拟化和测量缓存

**What goes wrong:**  
工具输出、patch、thinking、artifact preview 高度不固定。如果一次渲染全部 DOM，或虚拟列表测量缓存不随 session/filter/sort 重置，会出现滚动跳动、跳转定位失败、内存高、 pinned message 导航错位。

**Warning signs:**
- 打开长会话页面明显卡顿。
- 展开/折叠工具结果后滚动位置乱跳。
- 按 pinned message 跳转时停在错误位置。
- 切换 session 后虚拟列表沿用上一会话的 item height。

**Prevention strategy:**
- Phase 5 使用虚拟列表，item key 使用 `session_id + ordinal + render_variant`。
- filter/sort/session 改变时更新 `measureCacheKey` 并重置测量缓存。
- 不要在 scrollToIndex reconcile 过程中强行覆盖 scroll offset；否则会中断虚拟列表内部定位循环。
- 工具输出默认折叠，长文本按需加载或按块渲染。

**Phase mapping:** Phase 5 主责；Phase 4 提供 ordinal range API；Phase 6 加 1k/10k message UI 性能基准。

### Pitfall 10: 系统消息、skills 和生成产物被误删或污染普通对话

**What goes wrong:**  
Claude/Codex 会把 AGENTS 指令、environment context、skill envelope、command XML、compact summary、stop hook、task notification、local command caveat 写入日志。全部显示会污染 replay；全部过滤又会丢掉关键边界和用户真实意图。

**Warning signs:**
- UI 顶部显示大段 `# AGENTS.md` 或 `<environment_context>`，用户以为这是自己输入的 prompt。
- `/skill-name args` 显示成原始 XML。
- compact summary 不可见，用户无法解释为什么中间上下文断了。
- system message 被计入 user turn count，统计失真。

**Prevention strategy:**
- Phase 1 canonical model 区分 `role` 和 `is_system/source_subtype`，不要只靠 role 判断。
- Phase 2 Claude parser 将 command XML 规范化为 `/command args`，将 continuation/resume/interrupted/task_notification/stop_hook 标成 system subtype。
- Phase 2 Codex parser 过滤或分类 `# AGENTS.md`、`<environment_context>`、`<INSTRUCTIONS>`、`<skill>`、`<turn_aborted>`。
- Phase 5 UI 提供“显示系统事件”过滤，默认隐藏噪声但保留 compact boundary、interruption、stop hook 等关键 marker。

**Phase mapping:** Phase 1 建字段；Phase 2 分类；Phase 5 做过滤和 marker；Phase 6 用 fixture 防止误删。

### Pitfall 11: Session identity、路径和权限边界不严

**What goes wrong:**  
本地 dashboard 会读取用户机器上的 agent 日志，里面可能包含代码、密钥、命令输出和补丁。如果 session id/path 映射不严格，API 可能越权读取任意文件；如果 session id 不带 agent/source 前缀，不同来源或 OpenClaw 不同 agent 的 UUID 可能碰撞。

**Warning signs:**
- API 接收任意 `id` 后递归搜索目录。
- `sessionId.replace(...)` 后继续用于文件匹配，而不是通过索引表查受控 `file_path`。
- OpenClaw session id 没有包含 agent 子目录。
- 前端可传入相对路径、绝对路径或包含 `..` 的参数。

**Prevention strategy:**
- Phase 3 只允许 parser/indexer 写入受信任 roots 下的 `file_path`；API 根据 session id 查索引，不接受客户端传 path。
- session id 统一带 source 前缀：例如 `openclaw:{agent}:{session}`、`codex:{session}`，Claude fork 派生 id 保留 parent 关系。
- Phase 4 API 做 root containment 校验、404 unknown id、错误信息不泄露任意路径。
- Phase 6 加隐私 hardening：本地-only 默认、可配置 redaction、导出前提醒敏感内容。

**Phase mapping:** Phase 1 定义 id 规范；Phase 3 写索引和 root policy；Phase 4 收紧 API；Phase 6 做安全回归。

### Pitfall 12: 活跃/结束状态和截断文件误判

**What goes wrong:**  
活跃会话经常以半条 JSON 或 pending tool call 结束。若把 parse error 当永久损坏，会丢最后一轮；若把 pending tool call 当 clean end，UI 会错误显示“已完成”。Codex 有 `task_started/task_complete/turn_aborted`，Claude 要结合 stop_reason、lastLineFailed 和 orphan tool use，OpenClaw 也要看文件是否仍在写。

**Warning signs:**
- 正在运行的 agent 在 UI 中显示 completed。
- 刷新几秒后同一 session 的最后消息突然改变，但没有状态说明。
- malformed line count 没有记录，用户无法判断是日志损坏还是正在写入。
- 所有 session 都只有 `ended_at`，没有 `termination_status`。

**Prevention strategy:**
- Phase 1 canonical session 加 `termination_status`、`parser_malformed_lines`、`is_truncated`、`ended_with_role`。
- Phase 2 parser 区分完整 malformed line 和无换行截断尾行。
- Codex 使用 task lifecycle 分类：`task_complete` -> awaiting user，`task_started/turn_aborted` -> pending/interrupted。
- Phase 5 UI 明确显示“运行中/等待用户/工具 pending/日志截断/解析异常”。

**Phase mapping:** Phase 1 字段；Phase 2 分类；Phase 3 持久化；Phase 5 呈现状态。

## Moderate Pitfalls

### Pitfall 13: Token usage 和成本字段跨来源归一化错误

**What goes wrong:**  
OpenClaw usage 字段是 `input/output/cacheRead/cacheWrite`，Codex 的 `input_tokens` 包含 cached 部分，Claude 是 Anthropic-style usage。直接相加会重复计费或低估 context pressure。

**Warning signs:**
- 同一模型在不同 agent 来源下成本差异异常。
- Codex cached tokens 同时按 full input 和 cache read 计费。
- OpenClaw 有 model 但没有 canonical token usage。

**Prevention strategy:**
- Phase 2 在 adapter 内归一化为 `input_tokens/output_tokens/cache_creation_input_tokens/cache_read_input_tokens`。
- Phase 3 存 `has_context_tokens/has_output_tokens`，区分“0”和“未知”。
- Phase 6 若做成本功能，使用独立 pricing table，不直接信任上游 request cost。

**Phase mapping:** Phase 2/3；若 v1 不做成本，仍保留原始/归一化 usage 字段以免后续迁移。

### Pitfall 14: 过早做复杂分析，拖慢 replay 主线

**What goes wrong:**  
agentsview schema 包含 health、outcome、churn、pricing、git cache、insights 等分析字段。它们有价值，但 agent-tracing-dashboard v1 的核心是可靠本地 replay。过早复制全部分析会扩大范围，让 parser 和 UI 的基础能力延期。

**Warning signs:**
- Phase 1 就计划做 health score、AI insight、成本榜单，但还没有完整工具回放。
- schema 字段很多，fixture 却只覆盖普通聊天。
- UI 有 dashboard 指标，session replay 仍然缺工具详情。

**Prevention strategy:**
- Phase 1/2 只保留 replay 所需字段和将来兼容字段。
- Phase 3 schema 可以预留 usage/status 字段，但不把 analytics 作为 v1 验收条件。
- 将 health/outcome/cost/insight 放入后续 milestone，依赖 parser 稳定后再做。

**Phase mapping:** Phase 1 scope control；Phase 3 最小可扩展 schema；Phase 6 再评估 analytics。

### Pitfall 15: 生成产物没有统一表示

**What goes wrong:**  
工具可能生成 patch、图片、PDF、PPT、文件路径、浏览器截图、测试输出。若只把它们渲染为一段文本，用户很难追踪“agent 做了什么”；若 UI 直接打开任意路径，又有隐私和权限风险。

**Warning signs:**
- `apply_patch` 只能看到完整 diff 文本，不能看到文件列表摘要。
- 截图/图片路径显示为普通字符串，不能预览也不能确认存在。
- 生成文件没有 source tool call 关联。

**Prevention strategy:**
- Phase 1 在 canonical model 中给 artifact 预留类型：`patch`、`file`、`image`、`screenshot`、`command_output`、`unknown`。
- Phase 2 从工具参数和结果中提取 artifact candidate，但保留原始 JSON。
- Phase 5 UI 先做安全摘要和受控预览：文件名、相对路径、大小、是否存在、生成工具。
- Phase 6 做 root containment 和 redaction，避免任意本地文件预览。

**Phase mapping:** Phase 1 预留结构；Phase 2 提取；Phase 5 渲染；Phase 6 权限硬化。

## Minor Pitfalls

### Pitfall 16: 时间戳和排序边界处理粗糙

**What goes wrong:**  
不同来源的 timestamp 可能在顶层、message 内、snapshot 内，甚至为空。只按文件行或字符串排序会影响 queued command、subagent event、session bounds。

**Warning signs:**
- started_at/ended_at 与源文件事件范围不一致。
- queued command 插入位置错误。
- 同 ordinal 或空 timestamp 时排序不稳定。

**Prevention strategy:**
- Phase 2 每个 adapter 明确 timestamp fallback 顺序。
- Phase 3 同时存 ordinal 和 timestamp，UI 主排序用 ordinal，时间只做显示和辅助。
- Phase 6 fixture 覆盖空 timestamp、相同 timestamp、snapshot timestamp。

**Phase mapping:** Phase 2/3/6。

### Pitfall 17: 解析错误不可观测

**What goes wrong:**  
如果 parser 静默跳过 malformed lines、未知 event type 或无法配对的 tool result，用户只会看到缺数据，开发也难定位。

**Warning signs:**
- 代码里大量 `catch {}` 或 `continue`，没有计数和 debug metadata。
- UI 不显示“解析有警告”。
- 测试只断言 API status 200，不断言 warning。

**Prevention strategy:**
- Phase 2 parser 输出 warnings：malformed line count、unknown content block、orphan tool result、full-parse fallback。
- Phase 3 存 session-level parser flags。
- Phase 5 在详情页提供轻量 warning badge。

**Phase mapping:** Phase 2/3/5。

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Trace Contract | 模型只像聊天，不像 replay | 先建 `messages + tool_calls + tool_result_events + artifacts + source metadata` |
| Fixture Corpus | 样例太干净 | 每个 source 覆盖工具、subagent、长会话、截断、系统消息、旧格式 |
| OpenClaw Parser | 漏掉 `toolResult` 和 agent 子目录 | 用 `toolCallId` 配对；session id 包含 `openclaw:{agent}:...` |
| Claude Parser | DAG/fork/queued command 错乱 | DAG parse、streaming duplicate collapse、queued command splice |
| Codex Parser | subagent notification 归类错误 | 状态机 + pending buffer + incremental full-parse fallback |
| Persistence | schema 过窄或无索引 | SQLite transaction、ordinal range、tool/result indexes |
| Watcher | 部分写入和资源耗尽 | debounce、truncated tail 检测、recursive budget、poll fallback |
| API | 直接按 query path 读文件 | API 只查索引；root containment；分页；404 unknown id |
| SSE | stale 或过度轮询 | data_changed/session_updated + heartbeat + 初始 timing snapshot |
| UI Replay | 长会话卡顿和滚动错位 | virtualizer、measure cache key、折叠长工具输出 |
| Security | 本地敏感内容泄露 | local-only、受控 roots、redaction、导出/预览权限边界 |

## UAT / Verification Recommendations

- 用同一套 fixture 跑 parser golden tests：输出 session count、message ordinals、tool call/result 关联、subagent session id、system subtype、termination status。
- 用 1k、10k message synthetic session 验证 API 分页、SQLite 查询、虚拟列表滚动和 pinned jump。
- 用活跃写入中的 JSONL 验证：半行不崩、下一次 flush 后补齐、SSE 推送更新。
- 用 Claude fork fixture 验证主分支和 fork session 分离，且 parent_session_id 正确。
- 用 Codex subagent fixture 验证 notification 先到、wait 后到时仍能归到正确 tool call。
- 用 OpenClaw 多 agent 同 UUID fixture 验证 session id 不碰撞。
- 用恶意 `id=../../...` 和未知 session id 验证 API 不读受控 root 外文件、不泄露路径。

## Sources

- `app/api/sessions/messages/route.ts`：当前 OpenClaw 临时读取路径和 last-30 ad-hoc parser。
- `.planning/research/DATA-FETCHING.md`：现有 OVAO WebSocket/RPC/SSE 数据获取背景。
- `references/agentsview/internal/parser/claude.go`：Claude Code DAG、queued command、system subtype、compact summary、token usage、incremental parse。
- `references/agentsview/internal/parser/codex.go`：Codex response item、function call/output、subagent correlation、token normalization、incremental fallback。
- `references/agentsview/internal/parser/openclaw.go`：OpenClaw session/message/toolResult、usage normalization、agent-scoped session id。
- `references/agentsview/internal/db/schema.sql`：sessions/messages/tool_calls/tool_result_events/indexes/skipped/excluded/pinned/starred schema。
- `references/agentsview/internal/sync/watcher.go`：recursive watcher、debounce、exclude、budget/resource exhaustion fallback hooks。
- `references/agentsview/internal/server/events.go`：global/session SSE、heartbeat、initial timing snapshot、sync progress streaming。
- `references/agentsview/frontend/src/lib/virtual/createVirtualizer.svelte.ts`：TanStack virtualizer wrapper、measure cache reset、scroll reconciliation pitfall。
