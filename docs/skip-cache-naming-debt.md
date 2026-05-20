# Skip-Cache Naming Debt

**Status:** Acknowledged debt; deferred rename
**Date:** 2026-05-18
**Owners:** ingest 服务（`ingest/db/`、`ingest/sync/`）

---

## Background

`sessions.file_hash` 列在 v1.0 引入时只服务于 JSONL 类源（OpenClaw / Claude Code / Codex），其语义就是字面意思——会话所在 JSONL 文件的内容哈希，用于 sync 阶段做 skip-fast-path 比较：

```sql
SELECT file_hash FROM sessions WHERE id = ?;
```

随后 Phase 17（OpenCode）和 Phase 18（Qoder）引入了**两个 SQLite 后端**的源。SQLite 主库不是按"会话一文件"存储的，整库哈希会因任何一次写入而失效，对增量同步毫无意义。这两个 phase 选择把每个会话的"指纹"（一段 source-specific 的字符串的 SHA-256）写入同一个 `sessions.file_hash` 列，复用现有的 skip 比较代码路径。

结果：列名 `file_hash` 已经不再准确描述其语义。它实际承担的是 **source skip key**——一个由各源自定义算法生成、用于判断"该会话距离上次同步是否变化"的不透明指纹。

---

## Per-Source Fingerprint Algorithms

| Source        | Algorithm                                                                                                | Input fields                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `openclaw`    | `sha256(<file content bytes>)`                                                                           | 会话 JSONL 文件的全部字节                                                                 |
| `claude-code` | `sha256(<file content bytes>)`                                                                           | 会话 JSONL 文件的全部字节                                                                 |
| `codex`       | `sha256(<file content bytes>)`                                                                           | 会话 JSONL 文件的全部字节                                                                 |
| `opencode`    | `sha256("opencode:" + session_id + ":" + time_updated + ":" + message_count + ":" + part_count)`         | OpenCode SQLite 中该会话的更新时间、消息数、分片数（Phase 17 D-02）                       |
| `qoder`       | `sha256("qoder-session-v1:" + session_id + ":" + gmt_modified + ":" + message_count + ":" + max_message_gmt)` | Qoder SQLite `chat_session` + `chat_message` 聚合（Phase 18 D-03）                        |

**重要约束（Qoder）：** 严禁对 Qoder `local.db` 整库做 `sha256(file content)`——任何 IDE 写入（含 WAL 同步、其他会话更新）都会让全部已索引会话的指纹失效，导致 sync 全量重扫，破坏增量语义。本表给出的 `qoder-session-v1:` 前缀算法是**唯一**被授权的 Qoder 指纹形式；前缀本身充当算法版本号，未来若需变更必须递增（`v2:` 等），并新增一个 NULL-flush 迁移步骤。

---

## Why Reuse the Column (D-03)

1. **路径同构。** 五个源的 sync 主循环全部走同一行代码：
   ```ts
   const cached = db.prepare('SELECT file_hash FROM sessions WHERE id = ?').get(sessionId);
   if (cached?.file_hash === computedFingerprint) return /* skip */;
   ```
   不同源的"指纹"语义虽不同，但比较语义都是"等值则跳过"。复用列即复用这条路径，减少分支。

2. **避免一次列名级别的 schema 大改。** 真正改名涉及 `*_new` 替换表 + INSERT SELECT + DROP/RENAME + 索引/视图重建（参考 v14 迁移）。在两个 phase 同时使用该列时执行重命名会引入并发合并风险；推迟更划算。

3. **Phase 17 已立先例。** Phase 18 沿用同一模式以保证语义一致——一个 phase 复用，两个 phase 复用，文档在场即可视为"被默认承认的扩展语义"。

---

## Own-Source NULL-Flush Invariant

每次扩展 CHECK 约束接受新 source 时（如 v14 之于 `'qoder'`），迁移**必须**追加一条 own-source-only 的 NULL-flush 语句：

```sql
UPDATE sessions SET file_hash = NULL WHERE source = 'qoder';
```

只清空**本次新增源**自己的旧指纹（如果先前测试或 dev 数据已写入），**绝不**触动其他四个源。该不变量由 Phase 17 D-02 / Phase 18 D-04 锁定，违反将导致已存在的 OpenClaw / Claude Code / Codex / OpenCode 会话被全量重新解析。

---

## Future Rename Path

将列重命名为 `sessions.source_skip_key` 是该债务的最终偿付动作，被有意 **deferred**（无 phase 锁定，归 FUT 跟踪）。重命名步骤（标准 SQLite "12-step ALTER TABLE" recipe）：

1. `PRAGMA foreign_keys = OFF`（防 CASCADE 副作用——v14 已确认 better-sqlite3 默认 FK=ON）。
2. `CREATE TABLE sessions_new (...)`，新列名 `source_skip_key TEXT`，其余列保持。
3. `INSERT INTO sessions_new SELECT id, source, ..., file_hash AS source_skip_key, ... FROM sessions`。
4. `DROP TABLE sessions; ALTER TABLE sessions_new RENAME TO sessions;`
5. 重建所有索引、FTS5 trigger、被 FK 引用的子表（`subagent_links`、`ingest_file_cursors`）。
6. 同步更新 `ingest/db/schema.sql`、所有 `SELECT file_hash` / `UPDATE ... SET file_hash = ?` 引用、相关 TS 类型字段。
7. `PRAGMA foreign_keys = ON`，递增 `targetVersion`。
8. 在 `tests/unit/ingest/db-migration.test.ts` 增加列名重命名的 preservation 测试。

执行触发条件（满足任一即可发起）：
- 又有第六/第七个 SQLite 源加入，进一步稀释 `file_hash` 的"文件哈希"语义。
- 文档查询频率：维护者反复在文档/代码里追问"为什么 Qoder 的 file_hash 不是文件哈希？"——证明命名已成为认知负担。

---

## Cross-References

- 列起源与现状：[`docs/db-schema.md`](db-schema.md)（`sessions.file_hash` 表项）
- skip-cache 触发点：[`docs/services/ingest.md`](services/ingest.md)（sync 主循环 skip 比较段落）
- 同模式来源（pattern origin）：`.planning/phases/17-opencode-source-integration/17-CONTEXT.md` D-02
- 本期来源（this phase rationale）：`.planning/phases/18-qoder-source-integration/18-CONTEXT.md` D-03 / D-04 / D-05
- 列扩展迁移参考：`.planning/phases/17-opencode-source-integration/17-01-PLAN.md` T-02、`.planning/phases/18-qoder-source-integration/18-01-PLAN.md` Task 1
