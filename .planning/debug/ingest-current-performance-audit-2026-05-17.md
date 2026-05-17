# Ingest 当前性能占用复查报告

日期：2026-05-17  
范围：`ingest` 服务当前运行态、watcher、sync scheduler、OpenClaw/Codex/Claude 同步路径、SQLite cache/cursor 状态  
背景：前次性能修正方针记录在 `.planning/debug/ingest-memory-performance-fix-policy.md`。Phase 15/16 已实现 scheduler、path-scoped watcher、pre-parse skip、streaming hash、Codex/Claude append cursor 和 debug endpoint。当前检测显示占用仍偏高，因此重新复查。

## 结论

这次现场不像 2026-05-13 的旧故障复发。当前监听 8078 的 ingest 子进程处于 `ready=true`、scheduler idle，RSS 约 50-70MB，没有看到同一大型 Codex JSONL 被几十次并发打开。

但仍有新的性能风险和一个明确的资源占用问题：

1. idle ingest 仍持有 865 个 `.jsonl` 文件描述符，主要由 chokidar watcher 对每个历史 session 文件建 watch 引起。  
2. OpenClaw 大部分 session 没有当前 parser cache hash，原因是 OpenClaw parser 把 `toolResult` 原样写入 `messages.role`，违反 SQLite `CHECK(role IN (..., 'tool_result'))`，导致写事务失败；这些文件会在后续 full sync 中反复 parse。  
3. debug/status 指标存在失真：watcher API 报 `filesWatched=0`，但实际 FD 为 865；scheduler run history 对 `filesConsidered/filesParsed` 有双倍计数。  
4. 仍有若干中等风险热路径：启动/手动 full sync 仍会递归发现所有 source dir；增量 JSONL parser 对 append range 一次性分配 Buffer；Codex relationship backfill 在每次 Codex sync 后扫描全量 stored links。

所以当前问题的性质是：旧的“并发全量重入”已基本关闭，但“idle watcher FD 压力 + OpenClaw 重复失败解析 + 观测误导”会继续造成高占用、EMFILE 风险和错误判断。

## 现场证据

### 运行态

- 监听端口：`lsof -nP -iTCP:8078 -sTCP:LISTEN` 显示只有 PID 16762 监听 8078。
- 当前 health：`/health` 返回 `ready=true`、`phase=idle`、scheduler `active=false`、`queued=false`。
- 当前 RSS：PID 16762 约 49-70MB，未复现前次 1.5GB+ RSS。
- 当前仍有多个残留开发包装进程：`pnpm dev:ingest` / `tsx watch ingest/index.ts` 有旧进程存在，但只有 PID 16762 的 child 真正监听 8078。

### idle 文件描述符

对 PID 16762 执行 `lsof -p 16762`：

```text
idle .jsonl FD count: 865
openclaw: 93
claude:   416
codex:    356
```

这些 FD 不是 parser stream 未关闭造成的。对照实验中，单独启动一个短生命周期 chokidar watcher，只 watch Claude+Codex 的 200 个叶子目录，也会打开 774 个 `.jsonl` FD。结论：当前 `ingest/src/watcher.ts` 的 chokidar 配置会在 idle 状态持有历史 JSONL 文件句柄。

当前 watcher API 却返回：

```json
{
  "watcherStatus": "watching",
  "filesWatched": 0
}
```

这说明现有 watcher observability 没有反映真实 FD/watch 压力。

### 数据规模与 cache/cursor

当前本机数据：

```text
~/.openclaw/agents    56 plain *.jsonl, plus reset/deleted backup JSONL-like files
~/.claude/projects   417 *.jsonl, 约 165MB
~/.codex/sessions    356 *.jsonl, 约 1.8GB
data/ingest.db       约 1.4GB
```

SQLite 状态：

```text
sessions:
claude-code 423 rows, 413 current parser cache hash
codex       356 rows, 356 current parser cache hash
openclaw    136 rows,  12 current parser cache hash

ingest_file_cursors:
claude-code 417 rows
codex       356 rows
openclaw      6 rows
```

这意味着 Codex/Claude 的 Phase 16 cursor/cache 基本生效，但 OpenClaw full sync 仍会频繁进入 parser，因为绝大多数 OpenClaw rows 无法通过 `shouldSkipBeforeParse()`。

### OpenClaw 写入失败

OpenClaw 原始日志角色统计：

```text
assistant   1105
toolResult   978
user         305
```

`ingest/parser/openclaw.ts` 当前直接使用：

```ts
role: msg.role as MessageRole
```

而数据库约束只允许：

```sql
role IN ('user', 'assistant', 'system', 'tool_result')
```

因此 `toolResult` 会触发：

```text
CHECK constraint failed: role IN ('user', 'assistant', 'system', 'tool_result')
```

最近 debug history 已出现该错误。写事务失败后 `sessions.file_hash` 不更新，于是后续 sync 继续重复解析这些 OpenClaw 文件。

### scheduler 指标双倍计数

当前 debug history 中多个 Codex path sync 显示：

```text
scope = paths:codex:1
filesConsidered = 2
filesParsed = 2
```

但 `scope` 明确只有 1 个 path。代码原因在 `ingest/src/sync-scheduler.ts`：

- `updateFromProgress()` 已把 `status.filesConsidered` 设置为 observer progress 的累计值。
- `runItem()` 完成后又调用 `mergeMetrics(status, result)`，把同一 run 的 result metrics 加了一遍。

这不会直接造成高占用，但会让 debug endpoint 夸大 parse 数量，误导后续性能判断。

## Findings

### F-01：chokidar watcher idle 持有所有历史 JSONL FD

严重度：high  
位置：`ingest/src/watcher.ts`

当前 `createWatcher()` 对每个 source leaf directory 创建 `chokidar.watch(dir, { depth: 0 })`。`fileExtensions` 只在事件回调 `registerPath()` 中过滤，并不会阻止 chokidar 为已有 JSONL 文件建立底层 watch/FD。

影响：

- idle 状态也持有 865 个 `.jsonl` FD。
- 数据继续增长后，FD、内核 watcher、chokidar bookkeeping 会线性增长。
- Phase 16 broad suite 中 `EMFILE: too many open files, watch` 与该问题一致。
- watcher status 还显示 `filesWatched=0`，导致问题不容易从 API 发现。

建议：

- 用目录级 `fs.watch` 或更轻量的目录事件 watcher 替代对历史 JSONL 的 chokidar per-file watch。
- 或只 watch 活跃 source/current leaf dirs，历史目录依赖低频 periodic consistency scan。
- 为 watcher 增加真实 `openFdCount/jsonlFdCount/watchedDirectoryCount` debug 指标。
- 增加回归测试：watch N 个目录时，不应持有 O(session files) 个 `.jsonl` FD。

### F-02：OpenClaw `toolResult` role 未归一化，导致重复 parse

严重度：high  
位置：`ingest/parser/openclaw.ts`、`ingest/sync/index.ts`

OpenClaw parser 将 `msg.role` 直接写入 canonical message。真实 OpenClaw 日志包含 `toolResult`，但 schema 只接受 `tool_result`。写入失败会阻止 `file_hash` 更新，所以 OpenClaw full sync 会持续重试这些文件。

影响：

- OpenClaw 124/136 rows 缺少当前 parser cache hash。
- full/background/manual sync 会反复解析同一批 OpenClaw 历史文件。
- 错误被记录到 scheduler history，但不会自动修复缓存状态。

建议：

- 在 OpenClaw parser 中将 `toolResult` 映射为 canonical `tool_result`，未知 role 映射为 `system` 或记录 parser error 后跳过，不能直接写入 DB。
- OpenClaw full sync 复用 `parseAndWriteCandidate()` 或至少在成功 full parse 后维护 cursor/cache 行为一致性。
- 对 `.jsonl.deleted.*`、`.jsonl.reset.*`、`.jsonl.full.bak` 明确分层：默认热路径跳过，只有显式 archive/backfill 模式处理。
- 增加真实 OpenClaw fixture，覆盖 `toolResult` role 和备份文件命名。

### F-03：observability 失真，当前指标不能可靠解释性能

严重度：medium  
位置：`ingest/src/sync-scheduler.ts`、`ingest/src/watcher.ts`、`ingest/api/sources.ts`

问题：

- watcher 实际持有 865 个 JSONL FD，但 API `filesWatched=0`。
- scheduler progress 已累计 metrics，完成时再次 merge result metrics，导致 run history 中 `filesConsidered/filesParsed` 翻倍。
- `/api/v1/sources/:type/status` 对每个 source 返回同一个全局 watcher `filesWatched`，没有 per-source watch/FD 信息。

影响：

- 用户看到“paths:codex:1 但 parsed=2”，容易误判 path sync 被放大。
- 用户看不到 idle FD 压力，只能通过 `lsof` 发现。

建议：

- scheduler history 使用 result metrics 作为最终值，或在 merge 前 reset progress counters。
- watcher status 避免依赖 chokidar 私有 `_watched`，改为维护自己的 watched directories、last event count、pending path count，并补充可选 FD 采样。
- debug endpoint 区分 estimated watcher entries 与 actual open FD sample。

### F-04：full discovery 仍是全树递归，启动和 API 查询会重复扫描 source roots

严重度：medium  
位置：`ingest/sync/sources.ts`、`ingest/api/sources.ts`、`ingest/index.ts`

`discoverClaudeSources()` / `discoverCodexSources()` 通过 `collectJsonlDirectories()` 递归扫描 root。该逻辑在启动、full sync、`GET /api/v1/sources` 中都会执行。

当前数据规模下还能接受，但 Codex 已有 1.8GB / 356 files，Claude 有 417 files。随着历史目录增长，启动发现、sources API 和 full sync candidate collection 仍会带来可见 IO/CPU。

建议：

- source directory discovery 加 TTL cache 或启动时 registry cache。
- watcher/path sync 不应触发全 source discovery。
- `/api/v1/sources` 默认读缓存状态；显式 `?refresh=true` 才重新扫描磁盘。

### F-05：增量 parser 对 append range 一次性分配 Buffer

严重度：medium  
位置：`ingest/parser/codex.ts`、`ingest/parser/claude.ts`

`readCompleteJsonlRange()` 使用：

```ts
const length = endOffset - startOffset;
const buffer = Buffer.allocUnsafe(length);
```

这比 full file parse 好，但如果一次 append 很大，例如长工具输出、compact、大段 paste，仍会一次性分配整个新增 range，并转换为完整 UTF-8 string 后 split。

建议：

- 改为 bounded chunk line reader，从 offset 到 safeEndOffset 流式产出完整行。
- 对单次 incremental range 设置软上限，超过后分批处理或降级为 bounded streaming full parse。

### F-06：Codex relationship backfill 每次 Codex sync 后全量扫描 stored links

严重度：low-medium  
位置：`ingest/sync/index.ts`

`syncPaths('codex')` 和 `syncCodexSource()` 结束后都会：

```ts
collectCodexRelationshipsFromStoredLinks(getDatabase(), relationshipsByChild);
backfillCodexRelationships(...)
```

当前 `subagent_links` 只有 29 条，成本不高。但这在 watcher hot path 上是全量 DB work，未来会随 links 数增长。

建议：

- path sync 只 backfill 本次 delta/parseResult 涉及的 child IDs。
- 全量 stored link backfill 移到 periodic maintenance 或 manual repair endpoint。

### F-07：开发进程残留会制造额外 watcher/CPU 噪音

严重度：low  
位置：本地开发环境

当前存在多个旧 `pnpm dev:ingest` / `tsx watch ingest/index.ts` 包装进程。它们不监听 8078，也没有打开 JSONL FD，但仍持有 repo/fsevents watcher 和少量 RSS。

建议：

- 开发启动脚本增加端口占用和旧进程提示。
- 文档中增加排查命令：`lsof -nP -iTCP:8078 -sTCP:LISTEN`、`ps -axo pid,ppid,rss,%cpu,etime,command | rg 'dev:ingest|tsx watch ingest'`。

## 与前次修复的关系

前次文档中 P0/P1/P2/P3 的主要问题已部分关闭：

- scheduler 已串行化/coalesce sync entrypoints。
- watcher 已传 changed paths，不再直接把单文件变化放大成 source full sync。
- Codex/Claude 已有 pre-parse skip 和 append cursor。
- hash 已改为 bounded streaming read。
- Codex full sync 已停止启动前置全量 relationship file scan。

但这次发现的问题属于剩余边界：

- watcher 自身的 watch 实现仍随历史文件数线性持有 FD。
- OpenClaw 没有享受到同等 cache/cursor 稳定性，且 parser role bug 造成重复失败。
- debug endpoint 能显示 scheduler 状态，但 watcher 和 metrics 仍不足以解释真实资源占用。

## 建议落地顺序

### P0：先降低 idle 资源占用和重复失败解析

1. 替换或重写 watcher，使 idle 不再持有 O(JSONL files) 个 FD。  
2. 修复 OpenClaw `toolResult` → `tool_result` role 归一化，重新同步 OpenClaw，确认 `file_hash` current rows 接近 100%。  
3. 默认从 hot sync 排除 `.jsonl.deleted.*`、`.jsonl.reset.*`、`.jsonl.full.bak`，保留显式 archive/backfill 模式。

### P1：修复观测，避免误判

1. 修复 scheduler metrics 双倍计数。  
2. watcher status 增加真实 watched directory count、pending paths、last event、可选 FD sample。  
3. `/api/v1/debug/sync` 或新 endpoint 加上 watcher debug 区块。

### P2：继续降低长期增长风险

1. source discovery 增加 TTL/cache，sources API 默认不递归扫盘。  
2. Codex/Claude append parser 改为 bounded streaming range reader。  
3. Codex relationship backfill 改为 changed-child scoped。

## 验收标准

- ingest idle 时 `.jsonl` FD 数量不随历史 session 文件数线性增长；目标是接近 watched directory 数，而不是 session file 数。
- OpenClaw sync 后 `sessions.source='openclaw'` 的 current parser cache hash 覆盖率接近 100%，且不再出现 `CHECK constraint failed: role ...`。
- `paths:codex:1` 的 debug metrics 显示 `filesConsidered=1`，不再翻倍。
- watcher status 能显示真实 watcher 压力，不能在 865 FD 时仍显示 `filesWatched=0`。
- 单次大 append 不会一次性分配完整 append range 的 Buffer。
