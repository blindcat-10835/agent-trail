# Ingest 内存与性能占用修正方针

日期：2026-05-13 初稿；2026-05-14 补充可视化执行路径  
范围：`ingest` 服务的文件监听、同步调度、JSONL 解析、SQLite 写入路径  
状态：Phase 15 已实施 P0/P1/P3 范围；剩余 append-only cursor/upsert 属于后续可选优化

## 结论

当前高内存和高 CPU 不是单纯“每 5 分钟扫描一次”造成的。5 分钟周期扫描只是其中一个触发器；更核心的问题是：启动后台全量同步、文件 watcher 事件、周期 resync 都会进入同一个 `syncSource(sourceType)` 全量同步路径，并且当前没有全局或按 source 的同步互斥/合并机制。

稳定 idle 状态下不应该长期维持 1.5GB+ RSS。PID 20043 的现场特征更像是多个全量同步/解析任务重叠运行，重复打开和解析同一批大型 JSONL 文件，进而放大 V8 字符串、正则和 GC 压力。

## 现场证据

- 进程：`tsx watch ingest/index.ts` 子进程 PID 20043。
- RSS：约 1.5-1.6GB；`sample` 中 physical footprint 约 3.3GB，peak 约 3.7GB。
- CPU：曾到 100%+，采样热点集中在 V8 `RegExpPrototypeExec`、字符串 flatten、大对象分配和 GC。
- 文件描述符：当时进程持有约 967 个 JSONL FD；同一个约 518MB 的 Codex JSONL 被打开约 80 次。
- 数据规模：`data/ingest.db` 约 720MB；sessions 约 860，messages 约 85,736，tool_calls 约 48,264；Codex 源文件总量约 1.7GB。

这些现象共同说明：问题不是 SQLite 单点写入，也不是单个小文件扫描，而是大型 JSONL 在多个同步入口下被重复发现、重复打开、重复解析、重复字符串处理。

## 当前程序实际在做什么（可视化路径）

下面这些路径描述的是当前代码的真实行为，而不是理想行为。重点看 `[问题点]` 标记：性能问题不是发生在某一个单独函数里，而是多个入口都汇入“全量 source sync”，并且没有同步调度层控制重入。

### 路径 A：ingest 启动后做的事

```text
启动 ingest 服务
  -> HTTP server listen 8078
  -> initializeSourcesAndSync()
     -> discoverOpenClawSources()
     -> discoverClaudeSources()
     -> discoverCodexSources()
     -> createWatcher(...)
     -> watcher.start()
        [问题点 A1] watcher 此时已经开始接收文件变更
     -> startup warmup sync
        -> syncSource(openclaw, latest N)
        -> syncSource(claude-code, latest N)
        -> syncSource(codex, latest N)
     -> background full sync
        -> syncSource(openclaw)
        -> syncSource(claude-code)
        -> syncSource(codex)
```

关键点：watcher 是在 warmup 和 background full sync 之前启动的。也就是说，后台全量同步还没跑完，watcher 事件和 5 分钟 periodic resync 已经可以插进来。当前没有 scheduler/mutex，所以这些入口可以同时把工作推向同一批大 JSONL。

### 路径 B：任意一个文件变化后发生的事

```text
某个文件变化：xxx.jsonl / xxx.json / xxx.md
  -> watcher 捕获变更
  -> registerPath(sourceType, changedFilePath)
     -> pendingPaths[sourceType].add(changedFilePath)
  -> debounce 结束
  -> for each sourceType in pendingPaths
     -> config.onSyncTrigger(sourceType)
        [问题点 B1] 这里没有把 changedFilePath 传给同步层
     -> syncSource(sourceType)
        [问题点 B2] 单文件变化被放大成整个 source 全量同步
```

这条路径是最关键的性能放大器。`pendingPaths` 明明保存了具体变更文件，但 flush 时只传 `sourceType`。结果是：一个 Codex JSONL 追加一行，也会触发 `syncSource('codex')`，扫描和解析整个 Codex source。

### 路径 C：每 5 分钟 periodic resync 做的事

```text
setInterval(runPeriodicResync, 5min)
  -> for each sourceType in sourceDirs
     -> config.onSyncTrigger(sourceType)
        -> syncSource(sourceType)
     -> Promise 只挂 catch，不 await
        [问题点 C1] 本轮没等完成，下一轮或 watcher 仍可继续触发
        [问题点 C2] 没有 activeSync / queuedSync / coalescing
```

这解释了“是不是每 5 分钟才占大量内存”：不是只有每 5 分钟才会占内存，但每 5 分钟会制造一次全量同步机会。如果一次 full sync 超过 5 分钟，下一轮可能继续叠加。再加上 watcher 事件，重叠概率会很高。

### 路径 D：一次 Codex full sync 内部做的事

```text
syncSource('codex')
  -> syncCodexSource()
     -> discoverCodexSources()
     -> collectCodexRelationships(all codex files)
        [问题点 D1] 主解析前额外做一轮 Codex 全量关系扫描
     -> collectSessionFileCandidates(all codex files)
     -> for each candidate file
        -> parseCodexSession(filePath)
           [问题点 D2] 先完整 parse，构建 messages / tool calls / strings
        -> extractSessionName(parseResult)
           [问题点 D3] 对 message content 做 trim / regex / split 等字符串处理
        -> writeSessionToDatabase(parseResult, sourceFile)
           -> computeFileHash(sourceFile)
              -> fs.readFileSync(sourceFile)
                 [问题点 D4] hash 前一次性读完整文件，500MB 文件会制造巨大 Buffer
           -> compare file_hash skip cache
              [问题点 D5] skip 判断太晚；文件没变也已经 parse 完了
           -> delete old derived rows
           -> insert messages / tool_calls / tool_result_events
```

这条路径说明为什么“大文件重复打开”和 “V8 string/RegExp/GC 热点”会同时出现：每个重叠的 full sync 都会重复执行 `collectCodexRelationships()`、`parseCodexSession()`、`extractSessionName()` 和 `readFileSync()` hash。对 518MB JSONL，这不是线性小成本，而是会快速叠加成 GB 级内存压力。

### 总体问题路径

```text
启动 background full sync
        |
        v
syncSource(codex) 正在解析大 JSONL
        |
        +------------------------------+
        |                              |
        v                              v
watcher 捕获文件变化              5 分钟 periodic resync
        |                              |
        v                              v
syncSource(codex) 再来一次       syncSource(codex) 再来一次
        |                              |
        +--------------+---------------+
                       v
       同一批 Codex JSONL 被重复打开 / 重复 parse / 重复 hash
                       |
                       v
       RSS 上升、CPU 打满、RegExp/string flatten/GC 成为热点
```

如果只看单次 `syncSource('codex')`，它已经偏重；真正导致 PID 20043 到 1.5GB+ RSS 的，是这些 full sync 可以重叠运行，并且每次都从“source 全量”开始。

## 当前触发链路

### 1. watcher 会丢弃具体变更路径，改为全量 source sync

`ingest/src/watcher.ts` 中 `pendingPaths` 保存了具体变更文件，但 debounce flush 时只调用：

```ts
await config.onSyncTrigger(sourceType);
```

`ingest/index.ts` 中对应回调是：

```ts
await syncSource(sourceType);
```

因此任意一个 `.jsonl`、`.json`、`.md` 变动，都会触发该 source 的全量同步，而不是只处理变更文件。

### 2. 周期 resync 每 5 分钟触发全量 source sync，且不等待完成

`ingest/src/watcher.ts` 的 periodic fallback 默认 5 分钟。`runPeriodicResync()` 会遍历所有 source，并调用 `config.onSyncTrigger(sourceType)`。如果返回 Promise，只挂 `.catch()`，没有 await，也没有检查当前是否已有同步在运行。

结果是：如果一次全量同步超过 5 分钟，下一轮会继续启动新的全量同步；如果 watcher 同时收到文件变更，还会叠加更多同步。

### 3. watcher 在启动 warmup/background sync 之前就开始运行

`ingest/index.ts` 中 `initializeSourcesAndSync()` 的顺序是：

1. discover source dirs
2. `createWatcher(...)`
3. `await watcher.start()`
4. startup warmup sync
5. background full sync

这意味着启动后的 background full sync 还没跑完时，watcher 事件和 periodic resync 已经可以插入。当前没有调度层把这些任务串行化或合并。

### 4. skip cache 发生在 parse 之后，无法避免大文件解析成本

`ingest/sync/index.ts` 中 Codex/Claude 同步路径先执行 parser：

```ts
const parseResult = await parseCodexSession(filePath, candidate.project);
```

然后才调用：

```ts
writeSessionToDatabase(parseResult, undefined, filePath, { force: opts.force });
```

`writeSessionToDatabase()` 内部再计算 hash 并判断 skip cache。这意味着即使文件完全没变，程序也已经付出了完整 JSONL parse、message/tool/result 对象构建、session name 提取等成本。

### 5. hash 计算一次性读完整文件

`computeFileHash()` 当前实现：

```ts
const content = fs.readFileSync(filePath);
return crypto.createHash('sha256').update(content).digest('hex');
```

对 500MB 级别 JSONL，这会直接制造巨大的 Buffer 和后续 GC 压力；如果多个同步重叠，这个成本会被成倍放大。

### 6. Codex 还有额外全量关系扫描

`syncCodexSource()` 在无限制全量同步时会先执行：

```ts
await collectCodexRelationships(sources);
```

这会在主解析之前额外扫描 Codex 文件来建立 parent/child relationship。对于大 Codex 历史目录，这是额外的一轮全量读取压力。

### 7. 字符串处理对大消息内容不够节制

Codex parser 和 `extractSessionName()` / `deriveDisplayNameFromUserMessage()` 会对 message content 做 trim、正则、split、lowercase 等操作。现场 `sample` 的热点与此吻合。大文件重复解析时，这些字符串操作会显著放大 CPU 和内存压力。

## agentsview 参考实现要点

参考目录：`../references/agentsview`

agentsview 的关键设计不是“更大的 heap”，而是把同步范围和并发边界控制住：

- `cmd/agentsview/main.go`：初始 sync/resync 完成后才启动 watcher；periodic sync 默认 15 分钟。
- watcher：`onChange(paths []string)` 传递具体变更路径，debounce 后调用 `engine.SyncPaths(paths)`。
- `internal/sync/engine.go`：`Engine` 有 `syncMu`，`SyncPaths`、`SyncAll`、`ResyncAll` 等入口都串行化。
- `SyncPaths(paths)`：只分类和处理传入路径，不因为单文件变化扫描整个 source。
- `shouldSkipByPath()`：在 parser 之前用 DB 中的 `file_size`、`file_mtime`、data version 判断是否跳过。
- `tryIncrementalJSONL()` + parser `readJSONLFrom(path, offset, fn)`：对 append-only JSONL 从上次 offset 后增量读取；只有文件截断、inode/device 变化、parser 版本变化等情况才 fallback full parse。
- hash 计算使用 streaming read，不一次性把大文件读入内存。
- worker pool 有上限，写库按 batch 聚合，避免无限制并发和过细事务。

## 修正原则

1. 所有同步入口必须进入统一 scheduler。  
   startup、watcher、periodic、手动 API 都不能直接调用裸 `syncSource()`。scheduler 负责串行化、去重、合并、记录状态。

2. watcher 默认只同步变更路径。  
   watcher 应把 debounce 后的 `paths` 传给同步层。同步层提供 `syncPaths(paths)`，按路径分类到 OpenClaw / Claude / Codex，并忽略非 session 文件。

3. periodic resync 是低优先级兜底，不应制造重入。  
   周期任务如果发现已有 sync 在运行，应跳过或合并为 pending full scan；不能直接并发启动新全量同步。周期可从 5 分钟提高到 15 分钟，或改成 `syncAllSince(lastSyncStartedAt - safetyMargin)`。

4. skip 判断必须前置到 parser 之前。  
   对已有 session，优先用 `file_path`、`file_size`、`file_mtime`、`parser_cache_version` 判断是否跳过。hash 可作为二级校验，但不能成为每次同步的必经全文件读取。

5. 大文件 hash 必须 streaming。  
   如果保留 hash，应改为 `fs.createReadStream()` + `crypto.createHash()` 流式计算；禁止在热路径对 JSONL 使用 `readFileSync()` 一次性读完整文件。

6. JSONL 应走 append-only 增量解析。  
   对 Codex / Claude 这类追加型日志，在 DB 中记录 `last_indexed_offset`、`last_indexed_ordinal`、`file_inode`、`file_device`、`parser_version`。文件只追加时仅解析新增完整行；文件缩小、替换、parser version 改变时才全量重建该 session。

7. 减少 full content 字符串参与 dedup 和展示名提取。  
   dedup key 优先使用 event id、message id、call id、source line ordinal；必要时使用短 hash，不直接拼接完整 content。session name 只检查前 N 条 user message 或前几 KB 内容。

8. 观测状态要能暴露真实同步负载。  
   `/health` 或新的 debug endpoint 应显示 `activeSync`、`queuedSync`、`syncReason`、`currentFile`、`filesSkippedBeforeParse`、`filesParsed`、`largestFileBytes`、`syncDurationMs`，避免出现“phase idle 但进程仍在重解析”的误导。

## 建议落地顺序

### P0：先止血

目标：消除并发全量同步和单文件变更触发全量 source sync。

- 新增 `SyncScheduler`，提供 `enqueueFullSource(sourceType, reason)`、`enqueuePaths(paths, reason)`、`runExclusive()`。
- scheduler 至少保证同一时刻只有一个 ingest sync 在运行；如果运行期间又收到同类任务，合并为 pending，不并发执行。
- watcher callback 从 `sourceType` 改为 `{ sourceType, paths }` 或直接 `paths[]`。
- watcher debounce 后调用 `scheduler.enqueuePaths(paths, 'watcher')`。
- periodic resync 调用 scheduler；若已有任务运行则合并或跳过本轮。
- startup warmup/background sync 也进入 scheduler，或至少在 watcher 允许触发之前完成。
- `syncState` 增加 scheduler 状态，保证 health 能看到真实活动。

预期结果：不会再出现同一个 518MB JSONL 被几十次同时打开；RSS 峰值应明显下降，CPU 不再因重叠 full parse 持续打满。

### P1：降低全量同步成本

目标：即使执行全量扫描，也能快速跳过未变化文件。

- 在 `collectSessionFileCandidates()` 后、parser 前增加 `shouldSkipFileBeforeParse(candidate)`。
- 复用 sessions 表已有 `file_path`、`file_size`、`file_mtime`、`file_hash` 字段；如果字段不足，补充 `parser_cache_version`。
- `force=true` 仍可绕过 pre-parse skip。
- `computeFileHash()` 改为 streaming hash；或把 hash 从默认热路径移出，仅在需要强校验时计算。
- Codex relationship 扫描改为按变更路径局部更新；全量关系 backfill 仅在 cold rebuild 或显式维护任务中执行。

预期结果：历史目录越大，收益越明显；无变化文件不会进入 parser。

### P2：实现 JSONL 增量解析

目标：活跃 session 追加一行，只处理新增行，而不是重读整个 session 文件。

- 新增 per-file ingest cursor：`file_path`、`file_size`、`file_mtime`、`last_indexed_offset`、`last_ordinal`、`file_inode`、`file_device`、`parser_version`。
- 为 Codex 和 Claude parser 增加 `parseSessionFromOffset(filePath, offset, context)` 或等价接口。
- DB 写入支持 append/upsert 新 messages、tool_calls、tool_result_events，不默认 delete-and-reinsert 整个 session。
- 检测文件缩小、inode/device 改变、非法半行、parser version 改变时 fallback 到 full reparse。
- 补充大 JSONL fixture，覆盖 append、truncate、rewrite、partial line、parser upgrade。

预期结果：活跃大文件的同步成本接近新增行大小，而不是文件总大小。

### P3：并发、批处理和可观测性硬化

目标：在数据量继续增大时保持可控。

- 如需并行 parse，引入有上限 worker pool；不要让 watcher/periodic 自然形成无界并发。
- SQLite 写入批处理，避免每个文件过细事务，也避免长事务包住全世界。
- 为 sync run 记录结构化 metrics：原因、范围、文件数、跳过数、解析数、写入数、耗时、错误、最大文件、峰值 RSS 采样。
- 增加 debug endpoint 或日志摘要，便于下一次现场排查不用依赖 `lsof/sample`。

## 不建议的“修复”

- 只调大 Node heap。它只能推迟崩溃，不能解决重复 full parse。
- 只关闭 5 分钟 periodic。它会减少一个触发器，但 watcher 事件和 startup background full sync 仍可能重叠。
- 只保留 hash skip 但仍在 parser 之后判断。这样无法避免最昂贵的 parse 和字符串构建。
- 只把 debounce 时间调大。它能减少事件数量，但不能改变“一个事件触发全量 source sync”的错误粒度。

## 验收标准

- 单个 Codex JSONL 追加一条记录时，只同步该文件或该 session，不扫描整个 Codex source。
- 同一时刻最多一个 ingest sync run 处于 active；重复触发会被 coalesce。
- 对未变化历史文件，full sync 能在 parser 前跳过。
- 500MB 级别 JSONL 不再通过 `readFileSync()` 整体读入内存。
- watcher + periodic + background sync 同时存在时，不能出现同一大文件被几十次打开的情况。
- health/debug 输出能说明当前是否在同步、同步原因、队列状态和处理进度。

## 首批建议修改文件

- `ingest/src/watcher.ts`：保留并传递 changed paths；periodic 不直接触发裸 full sync。
- `ingest/index.ts`：引入 scheduler；统一 startup、watcher、background、periodic 的同步入口。
- `ingest/sync/index.ts`：新增 `syncPaths()`、pre-parse skip、streaming hash；降低 Codex relationship 全量扫描频率。
- `ingest/parser/codex.ts` / `ingest/parser/claude.ts`：为 P2 增量 JSONL 解析预留 offset-based API。
- `ingest/db/schema` / migration：如实现 P2，补充 ingest cursor 字段或独立表。
- `ingest/src/watcher.test.ts`、`ingest/sync/*.test.ts`：补充 watcher path sync、scheduler coalescing、pre-parse skip、large-file streaming 行为测试。
