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
