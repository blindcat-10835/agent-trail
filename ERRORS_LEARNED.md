# Errors Learned

历史错误教训索引。写新组件前查阅，避免重复踩坑。

---

## EL-001: `<button>` 嵌套 `<button>` → React Hydration Mismatch

**日期**: 2026-05-09
**文件**: `components/replay/tool-block.tsx`
**现象**: 控制台报 hydration error：`<button> cannot be a descendant of <button>`

### 根因

`ToolBlock` 的折叠头部是 `<button>`，内部 copy 按钮也是 `<button>`。HTML 规范禁止 interactive content 嵌套，React SSR/CSR 渲染结果不一致触发 hydration mismatch。

### 规则

> **任何可点击行（header bar、collapsible row）内如果还需要放独立操作按钮（copy、link、delete），外层必须用 `<div role="button">` 而非 `<button>`。**

### Fix Pattern

```tsx
// ❌ 错误 — button 嵌套 button
<button onClick={toggle}>
  <span>Title</span>
  <button onClick={handleCopy}>Copy</button>  {/* hydration error! */}
</button>

// ✅ 正确 — 外层用 div[role=button]
<div
  role="button"
  tabIndex={0}
  onClick={toggle}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
  className="cursor-pointer ..."
>
  <span>Title</span>
  <button onClick={handleCopy}>Copy</button>  {/* OK — 不嵌套 */}
</div>
```

### 项目内已用此模式的组件

- `components/replay/turn-card.tsx` — TurnCard header（copy + chevron）
- `components/replay/tool-block.tsx` — ToolBlock header（copy + chevron）
- `components/sessions/sessions-right-rail.tsx` — SessionRailRow（rr-item 行内嵌 star toggle button）

### 检查清单

写 collapsible/expandable row 时问自己：
1. 行内是否有独立操作按钮（copy、external link、delete）？
2. 如果有 → 外层用 `<div role="button">`
3. 如果没有 → `<button>` 即可

---

## EL-002: `CREATE INDEX` 引用迁移新增列 → 老 SQLite DB 启动失败

**日期**: 2026-05-09
**文件**: `ingest/db/schema.sql`, `ingest/db/index.ts`
**现象**: ingest 启动时报错：`SqliteError: no such column: turn_index`

### 根因

`initSchema()` 的执行顺序是先执行 `schema.sql`，再调用 `runMigrations()`。对已有数据库而言，`CREATE TABLE IF NOT EXISTS messages (...)` 不会修改旧表结构，也不会自动补上新列。

这次 `schema.sql` 里新增了：

```sql
CREATE INDEX IF NOT EXISTS idx_messages_session_turn_index
ON messages(session_id, turn_index);
```

但旧 `messages` 表还没有 `turn_index` 列。结果是索引创建在迁移加列之前执行，SQLite 直接失败，服务无法启动。

### 规则

> **任何引用迁移新增列的索引、视图、触发器、查询缓存，都不能只放在 `schema.sql` 顶层执行路径中；必须由同一个 migration step 在加列之后创建。**

### Fix Pattern

```ts
// ❌ 错误 — schema.sql 顶层先执行，老 DB 还没有 turn_index
// CREATE INDEX IF NOT EXISTS idx_messages_session_turn_index
// ON messages(session_id, turn_index);

// ✅ 正确 — migration 中先加列，再建依赖该列的索引
const migrationSteps = [
  { desc: 'Add turn_index column', sql: 'ALTER TABLE messages ADD COLUMN turn_index INTEGER' },
  {
    desc: 'Add messages turn index lookup',
    sql: 'CREATE INDEX IF NOT EXISTS idx_messages_session_turn_index ON messages(session_id, turn_index)',
  },
];
```

### 测试模式

必须加一个“旧 DB 形态”回归测试，而不是只用最新 `schema.sql` 初始化内存库。

```ts
// 1. 手写/构造 vN 老表结构，刻意缺少新列
// 2. PRAGMA user_version = N
// 3. openDatabase({ path })
// 4. initSchema()
// 5. 断言新列、新索引、user_version 都存在
```

项目内对应测试：`tests/unit/ingest/db-migration.test.ts`

### 检查清单

改 SQLite schema/migration 时问自己：
1. 新增列是否会被 `schema.sql` 中的索引、视图、trigger、查询立即引用？
2. 旧 DB 执行 `schema.sql` 时，`CREATE TABLE IF NOT EXISTS` 是否无法补列？
3. 依赖新列的 DDL 是否在 migration 中位于 `ALTER TABLE ADD COLUMN` 之后？
4. 是否有从上一版 `user_version` 迁移到新版的真实文件 DB 回归测试？

---

## EL-003: SQLite CHECK 约束修改需要 rebuild-table 迁移

**日期**: 2026-05-17
**文件**: `ingest/db/index.ts`
**现象**: 尝试 `ALTER TABLE sessions ADD CHECK(source IN (...))` 失败 — SQLite 不支持 `ALTER TABLE` 修改约束。

### 根因

SQLite 的 `ALTER TABLE` 只支持 `ADD COLUMN` 和 `RENAME COLUMN`。要修改 CHECK 约束，必须：
1. `CREATE TABLE sessions_new (...)` — 包含新的 CHECK
2. `INSERT INTO sessions_new SELECT * FROM sessions`
3. `DROP TABLE sessions`
4. `ALTER TABLE sessions_new RENAME TO sessions`
5. 重建索引和外键

### 规则

> **修改 CHECK 约束（包括扩展 source 白名单）时，必须使用 rebuild-table 迁移模式，不能使用 ALTER TABLE。**

### 检查清单

修改 CHECK 约束时问自己：
1. 是否只是添加新列？→ `ALTER TABLE ADD COLUMN` 即可
2. 是否修改了现有 CHECK 约束？→ 必须使用 rebuild-table 迁移
3. 迁移是否正确处理了索引重建和外键？

---

## EL-004: `SQLITE_BUSY` 处理模式

**日期**: 2026-05-17
**文件**: `ingest/parser/opencode.ts`
**现象**: 读取 opencode.db 时遇到 `SQLITE_BUSY` 错误，导致整个 sync run 失败。

### 根因

opencode.db 是 opencode 进程的活跃 SQLite 数据库。ingest 以只读方式打开时，可能遇到 opencode 正在写入的情况。SQLite 默认的 busy timeout 为 0，即立即返回 BUSY 错误。

### 规则

> **读取外部 SQLite 数据库时，必须设置 `busy_timeout` PRAGMA（建议 300ms），并在 BUSY 错误上实现重试逻辑（最多 3 次，间隔 100ms）。如果仍然失败，跳过该 session 而不是崩溃整个 sync run。**

### Fix Pattern

```ts
// ✅ 正确 — 设置 busy_timeout + 重试
db.pragma('busy_timeout = 300');
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    const rows = db.prepare('SELECT ...').all();
    break;
  } catch (err) {
    if (err.message?.includes('SQLITE_BUSY') && attempt < 2) {
      await sleep(100);
      continue;
    }
    throw err;
  }
}
```

---

## EL-005: Token double-counting 风险

**日期**: 2026-05-17
**文件**: `ingest/parser/opencode.ts`
**现象**: opencode 在 session 级别和 step-finish 事件中都报告 token 使用量。如果两者都累加，会导致 token 计数翻倍。

### 根因

opencode 的 `session` 表有 `total_input_tokens` / `total_output_tokens` 列（session 级别汇总）。同时 `step-finish` 事件也携带 token 使用量。如果解析器同时使用两者，会导致 double-counting。

### 规则

> **当 session 级别的 token 汇总可用时，优先使用 session 级别数据。不要将 step 级别的 token 数据叠加到 session 级别汇总上。**

### 检查清单

处理 token 数据时问自己：
1. 数据源是否提供了 session 级别的 token 汇总？
2. 是否同时存在 step/turn 级别的 token 数据？
3. 如果两者都有，是否只使用了 session 级别汇总？

---

## EL-006: `cost = 0` 歧义 — `reported_zero` vs `unknown`

**日期**: 2026-05-17
**文件**: `ingest/parser/opencode.ts`, `ingest/pricing/model-pricing.ts`
**现象**: opencode 报告 `cost = 0` 但有非零 token 使用量。如果将此视为"未知成本"，会错误地显示为 `—` 而不是 `$0.00`。

### 根因

`cost = 0` 有两种含义：
1. 数据源明确报告成本为零（免费模型、免费额度等）→ 应显示 `$0.00`（精确值）
2. 成本未知 → 应显示 `—`

这两种情况需要区分。opencode 报告 `cost = 0` 且有 tokens → 这是确切的 `$0.00`。

### 规则

> **当数据源报告 `cost = 0` 且存在非零 token 使用量时，设置 `cost_pricing_status = 'reported_zero'`。前端应显示 `$0.00` 而不是 `—` 或 `~$0.00`。这表示"数据源告诉我们成本确实是零"，而不是"我们不知道成本"。**
