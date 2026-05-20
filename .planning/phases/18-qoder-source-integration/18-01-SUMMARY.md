---
phase: 18-qoder-source-integration
plan: 01
subsystem: ingest/db (schema + migration), tests, docs
tags: [schema-migration, check-constraint, sqlite, replacement-table, foreign-keys, adr]
provides:
  - "v14 migration: widens 3 source CHECK literals to accept 'qoder'"
  - "Replacement-table rebuild for sessions / subagent_links / ingest_file_cursors"
  - "Own-source NULL-flush of file_hash (qoder rows only)"
  - "5 new unit tests covering positive INSERT, negative-control, preservation, NULL-flush"
  - "docs/skip-cache-naming-debt.md ADR (5-source fingerprint table + future rename path)"
requires:
  - "Phase 17 (opencode) status confirmed: NOT landed in this base — bumps from v13 to v14"
affects:
  - "ingest/db/schema.sql (3 CHECK literals)"
  - "ingest/db/index.ts (targetVersion 13 → 14, 6 new migration steps)"
  - "tests/unit/ingest/db-migration.test.ts (7 tests total — 2 prior version-bump assertions + 5 new)"
  - "docs/skip-cache-naming-debt.md (NEW)"
tech-stack:
  added: []
  patterns:
    - "SQLite 12-step ALTER TABLE recipe (PRAGMA foreign_keys = OFF/ON wrap around table rebuilds)"
    - "Replacement-table CHECK widening (CREATE *_new → INSERT SELECT → DROP → RENAME → re-create indexes)"
    - "Own-source-only NULL-flush of skip cache (D-04 invariant)"
key-files:
  created:
    - "docs/skip-cache-naming-debt.md"
  modified:
    - "ingest/db/schema.sql"
    - "ingest/db/index.ts"
    - "tests/unit/ingest/db-migration.test.ts"
decisions:
  - "Migration version bumped to 14 (not 15) — Phase 17 has NOT landed in this base"
  - "Wrap v14 rebuild block in PRAGMA foreign_keys = OFF/ON to prevent CASCADE wipe of subagent_links during DROP TABLE sessions (better-sqlite3 default is FK=ON, unlike bare SQLite)"
  - "Append 'qoder' only — do NOT defensively pre-include 'opencode' (D-02)"
  - "ADR is standalone file (not appended to db-schema.md) for discoverability per CONTEXT D-05"
metrics:
  duration_minutes: 35
  tasks_completed: 3
  files_changed: 4
  tests_added: 5
  commits: 3
completed: 2026-05-18
---

# Phase 18 Plan 18-01: DB Schema CHECK Widening + Migration + ADR Doc — Summary

One-liner: **v14 迁移把 3 处 source CHECK 字面量扩展为 `('openclaw', 'claude-code', 'codex', 'qoder')`，复用 Phase 17 的 replacement-table 模式 + own-source NULL-flush + 必要的 FK pragma 包裹，并交付 `docs/skip-cache-naming-debt.md` ADR。**

---

## What Changed

### 1. Schema — `ingest/db/schema.sql` (3 sites widened)

| 行   | Column                              | 改动                                                   |
| ---- | ----------------------------------- | ------------------------------------------------------ |
| 14   | `sessions.source`                   | CHECK 列表追加 `'qoder'`                               |
| 172  | `subagent_links.subagent_source`    | CHECK 列表追加 `'qoder'`                               |
| 258  | `ingest_file_cursors.source_type`   | CHECK 列表追加 `'qoder'`                               |

文件首部注释同时更新为 "Supports OpenClaw, Claude Code, Codex, and Qoder sources"。

**`subagent_links.source` 列不存在于本基线**——该列由 Phase 17 引入，本基线尚未合并。本期严格只动当前存在的三个 CHECK，未做防御式预扩展（D-02）。

### 2. Migration — `ingest/db/index.ts`

- `targetVersion`: **13 → 14**
- 新增 6 个迁移步骤（`migrationSteps` 数组末尾）：

| Step | Description                                                                  |
| ---- | ---------------------------------------------------------------------------- |
| v14a | `PRAGMA foreign_keys = OFF` （进入 rebuild 块）                              |
| v14b | Rebuild `sessions` with widened CHECK（替换表 + 5 索引重建）                 |
| v14c | Rebuild `subagent_links` with widened CHECK（替换表 + 3 索引重建）           |
| v14d | Rebuild `ingest_file_cursors` with widened CHECK（替换表 + 1 索引重建）      |
| v14e | NULL-flush own-source skip-cache rows (qoder only) per D-04                  |
| v14f | `PRAGMA foreign_keys = ON` （退出 rebuild 块）                               |

#### Exact NULL-flush WHERE clause

```sql
UPDATE sessions SET file_hash = NULL WHERE source = 'qoder'
```

**严格 own-source-only**：`grep -E "WHERE source IN \('openclaw', 'claude-code', 'codex'\)" ingest/db/index.ts` 在新增的 v14 步骤中返回 0 命中，证明既有 4 个源的 `file_hash` 不被触动。

### 3. Tests — `tests/unit/ingest/db-migration.test.ts` (7 tests, all passing)

- `version` 断言由 `toBe(13)` 更新为 `toBe(14)`（2 处）
- CHECK 字面量期望（line 33）增加 `'qoder'`
- **5 个新测试**：
  1. positive INSERT：`source = 'qoder'` 在迁移后被接受
  2. negative-control：`source = 'qoder-typo'` 仍被 CHECK 拒绝
  3. preservation：`codex` / `claude-code` / `openclaw` 行 + `subagent_links` 行 + `ingest_file_cursors` 行跨 v14 迁移全部保留
  4. own-source NULL-flush：仅 qoder 行的 `file_hash` 被 NULL'd；preset openclaw witness（带 `agent_name`、`name`、`total_input_tokens=100` 以避开早期所有 NULL-flush 守门）保持 `file_hash` 不变
  5.（既有）positive INSERT qoder accepted 的额外覆盖

测试结果：**7 passed (7)**, 345 ms, tsc 0 errors。

### 4. ADR — `docs/skip-cache-naming-debt.md` (89 lines, NEW)

- Status: Acknowledged debt; deferred rename (2026-05-18)
- 涵盖 **5 个源** 的 fingerprint 算法表
- Qoder 公式逐字记录：`sha256('qoder-session-v1:<session_id>:<gmt_modified>:<message_count>:<max_message_gmt>')`，并显式禁止整库哈希
- Own-source NULL-flush invariant 文本化
- Future rename path（`sessions.file_hash` → `sessions.source_skip_key`，标准 SQLite 12-step ALTER TABLE recipe）
- Cross-refs 到 db-schema.md / services/ingest.md / Phase 17 & 18 PLAN

---

## Phase 17 Status Note (CRITICAL for Plan 18-03)

**Phase 17 (opencode) has NOT been merged into the base of this worktree.**

- Pre-migration `targetVersion` 为 **13**（非 14）。
- 现存 CHECK 字面量为 `('openclaw', 'claude-code', 'codex')`（仅 3 个 source）。
- v14（本期）仅追加 `'qoder'` → `('openclaw', 'claude-code', 'codex', 'qoder')`。
- `subagent_links.source` 列不存在（该列原计划由 Phase 17 引入）。
- **Plan 18-03 必须以"4-source 列表"为基线**——读取/写入 `subagent_links.source` 的代码路径需跳过或防御性 typeof 检查；不要假设 5-source 列表。

如果 Phase 17 后续先于 18 落地：rebase Phase 18 onto Phase-17-merged main 时，CHECK 字面量将自然变成 `('openclaw', 'claude-code', 'codex', 'opencode', 'qoder')`，v14 步骤的替换表 DDL 字符串需手动调整。

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FK CASCADE wipes subagent_links during v14 sessions rebuild**

- **Found during:** Task 2（preservation 测试持续失败：subagent_links 行在 v14 后变 0）
- **Issue:** better-sqlite3 默认 `PRAGMA foreign_keys = ON`（与裸 SQLite 默认 OFF 相反）。当 v14 sessions rebuild 执行 `DROP TABLE sessions` 时，`subagent_links.session_id REFERENCES sessions(id) ON DELETE CASCADE` 触发，连带删除全部 subagent_links 行。
- **Fix:** v14 rebuild 块前后增加两个 pragma step（标准 SQLite "12-step ALTER TABLE" recipe）：
  - v14a: `PRAGMA foreign_keys = OFF`
  - …rebuild steps…
  - v14f: `PRAGMA foreign_keys = ON`
  pragma 是 per-connection 的，下次 `openDatabase()` 时 FK 自动恢复 better-sqlite3 默认（ON）。
- **Files modified:** `ingest/db/index.ts`（+18 行）
- **Diagnosis path:** 临时调试脚本 `tests/unit/ingest/_dbg.mjs`（已删除）打印 `FK pragma BEFORE migrations: 1` 揭示根因。
- **Commit:** `b2ea001`（与 Task 2 测试一同提交，因为修复正是由 Task 2 测试发现）

**2. [Rule 3 - Blocking issue] Existing test version assertions out-of-date**

- **Found during:** Task 1（pre-existing test 写死 `expect(version).toBe(13)`，targetVersion 升到 14 后断言失败）
- **Fix:** 把 2 处 `toBe(13)` 更新为 `toBe(14)`
- **Commit:** Task 1（`4a5e035`）

### Plan-level deviations

**3. [Rule 3] Worktree environment setup**

- node_modules 缺失 → `pnpm install --prefer-offline`（53.3s）
- better-sqlite3 native binding 未编译（pnpm 默认 ignore-build-scripts） → 从主仓库 node_modules 复制 `build/` 目录
- 这两步未改动版本控制文件，不计入文件清单

### Architectural changes

无（Rule 4 未触发）。

---

## Verification Evidence

```
=== Task 1 + plan-level acceptance ===
qoder count in schema.sql:                         3
un-widened CHECK leftover:                         0
targetVersion:                                     14
NULL-flush count (qoder only):                     1
WHERE source IN ('openclaw','claude-code','codex'): 0  (no other-source flush in v14)

=== Task 2 ===
'qoder' grep in tests:                             10  (≥ 4 required)
test results:                                      7 passed (7), 345 ms

=== Task 3 ===
docs/skip-cache-naming-debt.md exists:             yes
qoder-session-v1: count:                           2  (≥ 1 required)
5-source coverage (openclaw|claude-code|codex|opencode|qoder): 11  (≥ 5 required)
rename mentions:                                   4  (≥ 1 required)
line count:                                        89  (between 25-120 required)

=== Plan-level ===
pnpm exec tsc --noEmit:                            0 errors
pnpm test:run tests/unit/ingest/db-migration.test.ts:  7 passed (7)
grep -RE "'qoder'" ingest/db/:                     12 hits  (schema.sql + index.ts)
```

---

## Commits

| Task | Commit    | Subject                                                                              |
| ---- | --------- | ------------------------------------------------------------------------------------ |
| 1    | `4a5e035` | feat(18-01): widen source CHECK constraints to accept qoder + migration v14          |
| 2    | `b2ea001` | test(18-01): cover qoder source CHECK + own-source NULL flush in migration tests     |
| 3    | `52ae9b0` | docs(18-01): add skip-cache naming debt ADR                                          |

---

## Hand-off Notes for Plans 18-02 / 18-03 / 18-04 / 18-05

- **18-02 (Types & whitelists):** TS union 与 runtime 白名单需要在 4-source 基线上追加 `'qoder'`（不是 5-source）。同样不要预添加 `'opencode'`。
- **18-03 (Qoder parser):** 可以放心 `INSERT INTO sessions (source) VALUES ('qoder', ...)` —— CHECK 已经接受。`subagent_links` 写入用 `subagent_source = 'qoder'`。**注意 `subagent_links.source` 列不存在**（Phase 17 未落地），写入语句不要包含该列。
- **18-04 (Agent-tools registry):** 路由白名单同步加入 `qoder`，模式与 Phase 17 一致。
- **18-05 (UI integration):** `SourceSwitcher` 自动从 `getAllDefinitions()` 读取——无需改动 UI 代码。
- **Skip-cache fingerprint：** Qoder 同步路径必须写入 `sha256('qoder-session-v1:<id>:<gmt_modified>:<msg_count>:<max_msg_gmt>')` 到 `sessions.file_hash`（不是 raw 文件哈希）。详见 `docs/skip-cache-naming-debt.md`。

## Self-Check: PASSED

- ✅ `ingest/db/schema.sql` 包含 `'qoder'`（3 处 CHECK + 1 处注释）
- ✅ `ingest/db/index.ts` `targetVersion = 14`，包含 v14 块（5 个 SQL step + 2 个 pragma 边界）
- ✅ `tests/unit/ingest/db-migration.test.ts` 7 测试通过
- ✅ `docs/skip-cache-naming-debt.md` 存在（89 行）
- ✅ Commits `4a5e035`、`b2ea001`、`52ae9b0` 均存在于 `phase/18-qoder-source-integration` 分支
- ✅ `pnpm exec tsc --noEmit` exit 0
- ✅ `pnpm test:run tests/unit/ingest/db-migration.test.ts` exit 0（7 passed）
- ✅ Plan-level `<verification>` 全部通过
- ✅ All 6 `<success_criteria>` met
