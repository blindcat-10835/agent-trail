# Phase 18: Qoder Source Integration — Pattern Map

**Mapped:** 2026-05-18
**Worktree:** `phase/18-qoder-source-integration`
**All paths are relative to worktree root.**

**Files analyzed:** 38 (8 new, 30 modified)
**Analogs found:** 35 / 38 (2 are mechanical duplications, 1 is "no analog — fixture builder from scratch")

> **Phase 17 status note.** At the time of this mapping, Phase 17 (opencode source) has **not** landed in this worktree — `lib/agent-tools/opencode/`, `ingest/parser/opencode.ts`, etc. do not exist. Therefore every analog in this document points at the **existing 3-source code** (openclaw / claude-code / codex). The Phase 17 PLAN files (`17-01-PLAN.md` … `17-04-PLAN.md`) are reference templates only — when Phase 17 lands, it will already have widened the CHECK constraints to 4 sources and Phase 18 only needs to extend that work to 5. Until then, the planner/executor should treat the constraint widening as `3 → 4` (not `4 → 5`); the migration step shape is identical either way.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **Type system widening** | | | | |
| `types/trace.ts` | type-defs | n/a | self (line 22) | exact-mechanical |
| `lib/agent-tools/types.ts` | type-defs | n/a | self (line 18) | exact-mechanical |
| `ingest/sync/index.ts` (`SyncSourceType`) | type-defs | n/a | self (line 63) | exact-mechanical |
| `lib/agent-tools/registry.ts` | registry | n/a | self (lines 31, 48) | exact-mechanical |
| **Validation arrays** | | | | |
| `ingest/api/sources.ts` | validator | request-response | self (line 22) | exact-mechanical |
| `ingest/api/sessions.ts` | validator | request-response | self (line 17) | exact-mechanical |
| `ingest/api/overview.ts` | validator | request-response | self (line 27) | exact-mechanical |
| `ingest/api/agents.ts` | validator | request-response | self | exact-mechanical |
| `ingest/index.ts` | bootstrap | startup | self (lines 76, 267) | exact-mechanical |
| `app/api/sync/route.ts` | BFF route | request-response | self (line 4) | exact-mechanical |
| **SQLite schema migration** | | | | |
| `ingest/db/schema.sql` | schema | n/a | self (lines 14, 172, 258) | exact-mechanical |
| `ingest/db/index.ts` (new migration step) | migration | DDL | `runMigrations()` lines 140–405 (existing v1→v13 chain) | exact |
| **Discovery / config** | | | | |
| `ingest/config/tool-dirs.ts` | config | n/a | `TOOL_DIR_REGISTRY` codex entry | exact |
| `ingest/config/capabilities.ts` | config | n/a | `SOURCE_CAPABILITIES.codex` | role-match |
| `ingest/sync/sources.ts` (`discoverQoderSources`) | discovery | file-I/O | `discoverCodexSources` lines 245–276 | role-match (file-walk → DB-probe) |
| **Parser (NEW)** | | | | |
| `ingest/parser/qoder.ts` | parser | batch / DB-read | `ingest/parser/codex.ts` lines 305–951 (`parseCodexSession`) + `ingest/parser/claude.ts:1300` (`inferClaudeToolCategory`) | role-match (JSONL → SQLite) |
| **Sync engine** | | | | |
| `ingest/sync/index.ts` (`syncQoderSource` + dispatch) | sync | event-driven | `syncOpenClawSource` lines 2186–2244 + `syncCodexSource` lines 2289–2430 | exact |
| `ingest/sync/index.ts` (`writeSessionToDatabase` extension) | persistence | CRUD | self lines 920–976 (already source-agnostic) | exact (no change required beyond CHECK widening) |
| **BFF adapter (NEW)** | | | | |
| `lib/agent-tools/qoder/definition.ts` | definition | n/a | `lib/agent-tools/codex/definition.ts` (full file, 60 lines) | exact |
| `lib/agent-tools/qoder/server-adapter.ts` | adapter | request-response | `lib/agent-tools/codex/server-adapter.ts` (full file, 82 lines) | exact |
| **Frontend registry** | | | | |
| `components/shell/source-switcher.tsx` | component | n/a | self (already dynamic — auto-picks up `qoderDef`) | exact (no change required) |
| `components/overview/kpi-hero.tsx` | component | n/a | self lines 45–50 (`SOURCE_LABELS`) | exact-mechanical |
| `components/sessions/session-filter-dropdown.tsx` | component | n/a | self lines 27–31 (`SOURCE_LABELS`) | exact-mechanical |
| `components/overview/starred-sessions.tsx` | component | n/a | self lines 13–17 + 37–44 (`SOURCE_COLORS` + `sourceLabel`) | exact-mechanical |
| **BFF route handlers (mechanical adapter add)** | | | | |
| 23 files under `app/api/agent-tools/[tool]/**/route.ts` | BFF route | request-response | `app/api/agent-tools/[tool]/sessions/route.ts` lines 13–29 | exact-mechanical |
| **Tests** | | | | |
| `tests/fixtures/qoder/build-fixture.ts` (NEW) | fixture | file-I/O | **NO ANALOG** — design from scratch using `better-sqlite3` raw DDL | n/a |
| `tests/fixtures/qoder/MANIFEST.json` (NEW) | fixture-meta | n/a | `tests/fixtures/codex/MANIFEST.json` (if present) — else design from scratch | partial |
| `tests/unit/ingest/db-migration.test.ts` | test | n/a | self line 33 (existing CHECK literal) | exact-mechanical |
| `lib/agent-tools/types.test.ts` | test | n/a | self lines 20, 29, 33, 192, 199 | exact-mechanical |
| `tests/unit/ingest/parser/qoder.test.ts` (NEW) | test | n/a | `tests/unit/ingest/parser/codex.test.ts` (if exists) — else `tests/unit/ingest/parser/openclaw.test.ts` | partial |
| **Documentation** | | | | |
| `docs/CONFIGURATION.md` | docs | n/a | self (codex section) | exact |
| `docs/API.md` | docs | n/a | self (codex section) | exact |
| `docs/services/ingest.md` | docs | n/a | self (codex section) | exact |
| `ERRORS_LEARNED.md` | docs | n/a | self (append-only) | exact |
| `docs/skip-cache-naming-debt.md` (NEW per D-05) | docs | n/a | NO ANALOG — small ADR-style note | n/a |

---

## Pattern Assignments

### Group 1 — Type System Widening (mechanical edits)

For all of the files below the change is identical: **add `'qoder'` to the literal union or array, alphabetised after `'codex'`.** No new logic — just keep the string literal in lock-step everywhere.

#### `types/trace.ts:22`
```typescript
// BEFORE
export type TraceSource = 'openclaw' | 'claude-code' | 'codex';
// AFTER
export type TraceSource = 'openclaw' | 'claude-code' | 'codex' | 'qoder';
```
**Adaptation:** also widens `TraceSubagentLink.subagentSource` (line 301-310) automatically because it is typed as `TraceSource`. ✅ honors SPEC §1 / D-06.

#### `lib/agent-tools/types.ts:18`
```typescript
// BEFORE
export type SourceToolId = 'openclaw' | 'claude-code' | 'codex'
// AFTER
export type SourceToolId = 'openclaw' | 'claude-code' | 'codex' | 'qoder'
```
**Adaptation:** `AgentToolId = 'all' | SourceToolId` propagates automatically. Update doc-comment on line 214 to read "openclaw, claude-code, codex, qoder".

#### `lib/agent-tools/registry.ts:31`
```typescript
// BEFORE
export const TOOL_IDS: SourceToolId[] = ['openclaw', 'claude-code', 'codex']
// AFTER
import { qoderDef } from './qoder/definition'
// ...
export const TOOL_IDS: SourceToolId[] = ['openclaw', 'claude-code', 'codex', 'qoder']
// and add qoderDef to AGENT_TOOL_DEFINITIONS array
```
**Adaptation:** Mirror `import { codexDef } from './codex/definition'` exactly. Order matches `TOOL_IDS`.

#### `ingest/sync/index.ts:63`
```typescript
// BEFORE
export type SyncSourceType = 'openclaw' | 'claude-code' | 'codex';
// AFTER
export type SyncSourceType = 'openclaw' | 'claude-code' | 'codex' | 'qoder';
```
**Adaptation:** also update doc on line 1706.

#### `ingest/api/sources.ts:22`, `ingest/api/sessions.ts:17`, `ingest/api/overview.ts:27`, `ingest/api/agents.ts`, `ingest/index.ts:76,267`, `app/api/sync/route.ts:4`
```typescript
// pattern in all six
const VALID_SOURCES = ['openclaw', 'claude-code', 'codex'] as const;     // BEFORE
const VALID_SOURCES = ['openclaw', 'claude-code', 'codex', 'qoder'] as const;  // AFTER
```
**Adaptation:** purely mechanical. Each file already has type-narrowing helpers (`isValidSource`) that pick up the new literal automatically. No new logic.

---

### Group 2 — SQLite Schema Migration

#### `ingest/db/schema.sql` (lines 14, 172, 258)
**Role:** schema source-of-truth. **Match quality:** exact-mechanical.

```sql
-- BEFORE (line 14, 172, 258)
source TEXT NOT NULL CHECK(source IN ('openclaw', 'claude-code', 'codex')),
subagent_source TEXT NOT NULL CHECK(subagent_source IN ('openclaw', 'claude-code', 'codex')),
source_type TEXT NOT NULL CHECK(source_type IN ('openclaw', 'claude-code', 'codex')),

-- AFTER
source TEXT NOT NULL CHECK(source IN ('openclaw', 'claude-code', 'codex', 'qoder')),
subagent_source TEXT NOT NULL CHECK(subagent_source IN ('openclaw', 'claude-code', 'codex', 'qoder')),
source_type TEXT NOT NULL CHECK(source_type IN ('openclaw', 'claude-code', 'codex', 'qoder')),
```
**Adaptation:** also widen the matching literals in `ingest/db/index.ts:250` and `:311` (these are the `CREATE TABLE` strings emitted by migrations; they must match `schema.sql`).

#### `ingest/db/index.ts` — new migration step (closest analog: `runMigrations()` lines 140–405)
**Role:** migration step. **Data flow:** DDL.

The existing `runMigrations()` template at `ingest/db/index.ts:140-405`:
```typescript
export function runMigrations(): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number;
  const targetVersion = 13;                                          // ← bump to 14
  if (currentVersion >= targetVersion) { return; }
  console.log(`Running migrations: v${currentVersion} → v${targetVersion}`);

  const migrationSteps: Array<{ sql: string; desc: string }> = [
    // ... v1..v13 steps already here ...
  ];

  for (const step of migrationSteps) {
    if (currentVersion < <stepVersion>) {
      try { db.exec(step.sql); }
      catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('duplicate column') || msg.includes('already exists')) {
          // tolerated — migration already partially applied
        } else { throw err; }
      }
    }
  }

  db.pragma(`user_version = ${targetVersion}`);
}
```

**Adaptation for v14 — qoder source widening (replacement-table pattern):**
```typescript
// Inside migrationSteps, append v14 entries that:
// 1. CREATE TABLE sessions_v14 with widened CHECK including 'qoder'
// 2. INSERT INTO sessions_v14 SELECT * FROM sessions
// 3. DROP TABLE sessions; ALTER TABLE sessions_v14 RENAME TO sessions
// 4. Recreate indexes + FTS5 triggers + foreign keys
// 5. Repeat for subagent_links (subagent_source CHECK) and ingest_file_cursors (source_type CHECK)
// 6. UPDATE sessions SET file_hash = NULL WHERE source = 'qoder' AND ...  -- D-03 cache invalidation
//    (per CONTEXT D-03 + 17-02-PLAN — invalidate any rows that pre-date the new fingerprint scheme)
```
**Adaptation Notes:**
- SQLite cannot `ALTER TABLE` a CHECK constraint — must use replacement-table copy/swap (this is the *exact* analog called out in `17-01-PLAN.md` T-02 if/when Phase 17 lands first; here we apply it to 3→4 sources directly).
- Indexes and FTS5 virtual tables must be recreated after the rename — the existing migration steps for sessions in earlier versions show the pattern.
- Foreign-key references from `messages.session_id`, `tool_calls.session_id`, etc. survive the rename because SQLite stores FKs by table name, not by ROWID.
- Use the existing try/catch tolerance (`'duplicate column' || 'already exists'`) so reruns are safe.

---

### Group 3 — Discovery / Config

#### `ingest/config/tool-dirs.ts` (closest analog: existing codex entry in `TOOL_DIR_REGISTRY`)
**Role:** config registry. **Match quality:** exact.

```typescript
// existing pattern (codex)
{
  type: 'codex',
  displayName: 'Codex',
  envVar: 'CODEX_SESSIONS_DIR',
  configKey: 'codex_sessions_dirs',
  defaultDirs: ['.codex/sessions'],   // joined with `home` at line 89
},

// NEW — append qoder entry (alphabetised after codex)
{
  type: 'qoder',
  displayName: 'Qoder',
  envVar: 'QODER_DB_PATH',
  configKey: 'qoder_db_paths',
  defaultDirs: ['Library/Application Support/Qoder/SharedClientCache/cache/db/local.db'],
},
```
**Adaptation:** Qoder's "dir" is actually a **single file path** (the SQLite DB). `TOOL_DIR_REGISTRY` semantics tolerate this because the value is just a list of strings; the discovery function (`discoverQoderSources`) interprets each string as a DB path, not a directory. Make sure the consumer side of `tool-dirs.ts` (the `home`-prefix loop at line 89) does not append a trailing slash — verify by reading line 89 before editing.

#### `ingest/config/capabilities.ts` (analog: `SOURCE_CAPABILITIES.codex`)
**Role:** capability map. **Match quality:** role-match.

```typescript
// existing pattern (codex — no agents/automations/cost)
codex: { agents: false, automations: false, cost: false, activity: true, sessions: true, replay: true },

// NEW — append qoder entry per SPEC §6
qoder: { agents: false, automations: false, cost: false, activity: true, sessions: true, replay: true },
```
**Adaptation:** Per **SPEC §6**, Qoder shows: sessions ✅, replay ✅, activity ✅, **subagents ✅**, agents ❌, automations ❌, cost ❌, approvals ❌. Note that `subagents` is NOT a key in the existing `SOURCE_CAPABILITIES` shape — it is exposed via `lib/agent-tools/qoder/definition.ts` instead. So in `capabilities.ts` the entry is identical to codex; the subagent affordance is communicated through the AgentToolDefinition.

#### `ingest/sync/sources.ts` — new `discoverQoderSources()` (analog: `discoverCodexSources` lines 245–276)
**Role:** discovery. **Data flow:** file-I/O → DB-probe.

**Excerpt — `discoverCodexSources` (analog skeleton):**
```typescript
// lines 245–276
export async function discoverCodexSources(dirs?: string[]): Promise<DiscoveredSource[]> {
  const searchDirs = dirs ?? defaultCodexDirs();
  const results: DiscoveredSource[] = [];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = await glob('**/*.jsonl', { cwd: dir, absolute: true });
    if (files.length === 0) continue;
    results.push({ type: 'codex', path: dir, sessionCount: files.length });
  }
  return results;
}
```

**Adaptation for `discoverQoderSources`:**
```typescript
export async function discoverQoderSources(dbPaths?: string[]): Promise<DiscoveredSource[]> {
  const paths = dbPaths ?? defaultQoderDbPaths();   // resolves QODER_DB_PATH + tool-dirs default
  const results: DiscoveredSource[] = [];
  for (const dbPath of paths) {
    if (!fs.existsSync(dbPath)) continue;
    let db: Database.Database | null = null;
    try {
      db = new Database(dbPath, { readonly: true, fileMustExist: true });   // SPEC §4
      // Validate expected tables exist (chat_session, chat_message, tool_result)
      const tables = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('chat_session','chat_message','tool_result')`
      ).all() as Array<{ name: string }>;
      if (tables.length < 3) continue;             // not a Qoder DB
      const row = db.prepare('SELECT COUNT(*) AS n FROM chat_session').get() as { n: number };
      results.push({ type: 'qoder', path: dbPath, sessionCount: row.n });
    } catch { /* skip unreadable / locked DBs — D-10 graceful degradation */ }
    finally { db?.close(); }
  }
  return results;
}
```
**Adaptation Notes:**
- Open with `{ readonly: true, fileMustExist: true }` per **SPEC §4** (privacy hardline — never write).
- Validate the three expected table names before claiming the DB; otherwise we'd surface a false positive when `QODER_DB_PATH` points to an unrelated SQLite file.
- Wrap in try/catch — Qoder may hold a write lock when the IDE is running; we silently skip rather than aborting the sync (per **D-10**).
- Update `getSourceConfig()` dispatch (lines 277–295) to add the `qoder` branch.

---

### Group 4 — Parser (NEW: `ingest/parser/qoder.ts`)

**Closest analog A — control flow:** `ingest/parser/codex.ts` lines 305–951 (`parseCodexSession`).
**Closest analog B — tool-category mapping:** `ingest/parser/claude.ts:1300-1309` (`inferClaudeToolCategory` — currently *not* exported).

**Excerpt — `parseCodexSession` skeleton (codex.ts:305–325):**
```typescript
export async function parseCodexSession(
  filePath: string,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const sessionMessages: TraceMessage[] = [];
  const toolCalls: TraceToolCall[] = [];
  const subagentLinks: TraceSubagentLink[] = [];
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];

  const toolCallOrdinalMap = new Map<string, number>();    // line 370 — call_id → ordinal
  let messageOrdinal = 0;
  // ... read file line-by-line, dispatch by record type ...
```

**Excerpt — subagent linking pattern (codex.ts:842–852):**
```typescript
// the ordinal is captured when the parent's tool_call is emitted, then
// looked up when spawn_agent / Agent fires
const messageOrdinal = ev.call_id
  ? toolCallOrdinalMap.get(ev.call_id)
  : undefined;
const subagentLink: TraceSubagentLink = {
  parentSessionId: sessionId,
  parentMessageOrdinal: messageOrdinal ?? 0,
  subagentSessionId: spawned.session_id,
  subagentSource: 'codex',                                 // ← qoder uses 'qoder'
  spawnedAt: timestamp,
};
subagentLinks.push(subagentLink);
```

**Excerpt — `inferClaudeToolCategory` (claude.ts:1300):**
```typescript
function inferClaudeToolCategory(name: string): ToolCategory {
  if (name === 'Read' || name === 'Glob' || name === 'LS') return 'read_file' satisfies ToolCategory;
  if (name === 'Grep') return 'search_file' satisfies ToolCategory;
  if (name === 'Bash') return 'run_in_terminal' satisfies ToolCategory;
  if (name === 'Edit' || name === 'Write' || name === 'MultiEdit') return 'edit_file' satisfies ToolCategory;
  if (name === 'Task') return 'subagent' satisfies ToolCategory;
  // ... more mappings ...
  return 'other' satisfies ToolCategory;
}
```

**Adaptation for `ingest/parser/qoder.ts`:**

The Qoder parser **inverts the I/O direction** from JSONL streaming to SQLite row-iteration, but the **session-building shape, token accounting, subagent-linking pattern, and ParseResult contract are identical** to codex.

```typescript
// Skeleton (mirror codex.ts:305–325)
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import type { TraceSession, TraceMessage, TraceToolCall, TraceSubagentLink,
              ParseResult, ParseOptions } from '../../types/trace';

export async function parseQoderSession(
  dbPath: string,
  sessionId: string,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });   // SPEC §4
  try {
    // 1. Load session row (chat_session WHERE id = ?) — see plan §2.4
    // 2. Load all messages ordered by gmt_create (chat_message WHERE session_id = ?) — §2.6
    // 3. For each message:
    //    a. Extract role, content, token usage from JSON columns
    //    b. If role === 'assistant' and tool_calls present:
    //         emit TraceToolCall, store ordinal in toolCallOrdinalMap (mirror codex.ts:658)
    //    c. If parent_tool_call_id present:
    //         look up ordinal → emit TraceSubagentLink with subagentSource: 'qoder' (mirror codex.ts:842–852)
    // 4. Load tool_result rows joined to messages — §2.8
    //    Map tool_name → TraceToolCallEvent.toolCategory via inferQoderToolCategory()
    //    (re-implement or extract inferClaudeToolCategory; SPEC §1 / CONTEXT code_context uses Claude semantics:
    //     read_file / search_file / run_in_terminal / edit_file / subagent)
    // 5. Build TraceSession with id = `qoder:${sessionId}` (canonical prefix)
    // 6. Compute totalTokens = prompt_tokens + completion_tokens (SPEC §8 — NO cached_tokens)
    // 7. Emit `cost: null` (SPEC §9 — Qoder excluded from cost rollups)
    return { session, messages, toolCalls, subagentLinks, errors, warnings };
  } finally {
    db.close();
  }
}
```

**Adaptation Notes:**
1. **Read-only DB access** is a **non-negotiable** privacy invariant (SPEC §10 / D-10).
2. **Canonical id prefix:** `qoder:<raw-session-id>` (per CONTEXT). All FK references in `messages`, `tool_calls`, and `subagent_links` use this prefixed form.
3. **Subagent ordinal lookup** mirrors codex.ts:842 exactly — populate `toolCallOrdinalMap` keyed on `parent_tool_call_id`, look up when emitting the child link. This satisfies SPEC §1 (subagent_links widened with `qoder` source).
4. **Token rule:** `totalTokens = prompt_tokens + completion_tokens` ONLY. Do **not** add `cached_tokens` (SPEC §8 — Qoder reports cached separately and the field is non-additive).
5. **Cost:** emit `cost: null` per session and let overview.ts exclude `qoder` from cost rollups (SPEC §9).
6. **Tool category mapping:** Either (a) export `inferClaudeToolCategory` from `claude.ts` and reuse, or (b) duplicate the mapping in qoder.ts under a new name. The CONTEXT `<code_context>` calls out option (a). If extracting, move the function to a shared module like `ingest/parser/util/tool-category.ts` and update both `claude.ts:1253` and the new `qoder.ts` import sites.
7. **Empty-session handling** — see `ingest/parser/openclaw.ts:38–130` for the pattern of returning `{ session, messages: [], errors: [...], warnings: [...] }` rather than throwing.

---

### Group 5 — Sync Engine

#### `ingest/sync/index.ts` — new `syncQoderSource()` (analog: `syncCodexSource` lines 2289–2430, `syncOpenClawSource` lines 2186–2244)

**Excerpt — `syncCodexSource` skeleton (lines 2289–2295):**
```typescript
async function syncCodexSource(opts: SyncSourceOptions): Promise<SyncResult> {
  const { discoverCodexSources } = await import('./sources');
  const toolDirs = await loadToolDirs();
  const sources = await discoverCodexSources(toolDirs.get('codex'));
  // ... iterate sources → iterate files → parseCodexSession → writeSessionToDatabase ...
}
```

**Excerpt — fingerprint helpers (lines 476–501):**
```typescript
export function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function buildParserCacheHash(source: string, fileHash: string): string {
  return `${PARSER_CACHE_VERSION}:${source}:${fileHash}`;
}
// also: cache-version compatibility check at line 501
```

**Excerpt — `syncSource()` dispatch (lines 1710–1727):**
```typescript
export async function syncSource(opts: SyncSourceOptions): Promise<SyncResult> {
  const { sourceType } = opts;
  let result: SyncResult;
  if (sourceType === 'openclaw') {
    result = await syncOpenClawSource(opts);
  } else if (sourceType === 'claude-code') {
    result = await syncClaudeCodeSource(opts);
  } else if (sourceType === 'codex') {
    result = await syncCodexSource(opts);
  // ADD: } else if (sourceType === 'qoder') {
  //         result = await syncQoderSource(opts);
  } else {
    throw new Error(`Unknown source type: ${sourceType}`);
  }
  return result;
}
```

**Excerpt — `parseFullCandidate()` dispatch (line 1844):** same shape, add a `qoder` branch that calls `parseQoderSession(dbPath, sessionId, opts)`.

**Adaptation for `syncQoderSource`:**

The codex/openclaw sync iterates **files**; the Qoder sync iterates **DB rows**. The skip-cache, cursor, and `writeSessionToDatabase` calls are all unchanged.

```typescript
async function syncQoderSource(opts: SyncSourceOptions): Promise<SyncResult> {
  const { discoverQoderSources } = await import('./sources');
  const toolDirs = await loadToolDirs();
  const sources = await discoverQoderSources(toolDirs.get('qoder'));

  for (const source of sources) {
    const db = new Database(source.path, { readonly: true, fileMustExist: true });
    try {
      // 1. Enumerate session ids from chat_session — investigation plan §2.4
      const rows = db.prepare(
        `SELECT id, gmt_modified,
                (SELECT COUNT(*) FROM chat_message WHERE session_id = chat_session.id) AS msg_count,
                (SELECT MAX(gmt_create) FROM chat_message WHERE session_id = chat_session.id) AS max_msg_gmt
         FROM chat_session ORDER BY gmt_modified DESC`
      ).all();

      for (const row of rows) {
        // 2. Build per-session fingerprint (D-03 / 17-02-PLAN analog)
        const fingerprint = createHash('sha256')
          .update(`qoder-session-v1:${row.id}:${row.gmt_modified}:${row.msg_count}:${row.max_msg_gmt}`)
          .digest('hex');
        const cacheFileHash = buildParserCacheHash('qoder', fingerprint);

        // 3. Skip if existing.file_hash matches (REUSES sessions.file_hash column per D-03)
        const existing = readSessionRow(`qoder:${row.id}`);
        if (existing?.file_hash === cacheFileHash) { skipped++; continue; }

        // 4. Parse + write
        const parsed = await parseQoderSession(source.path, row.id, opts);
        writeSessionToDatabase(parsed, { source: 'qoder', file_hash: cacheFileHash });
        synced++;
      }
    } finally { db.close(); }
  }
  return { synced, skipped, errors };
}
```

**Adaptation Notes:**
- **Reuse `sessions.file_hash`** column per **D-03** — do NOT introduce a new column. The `buildParserCacheHash('qoder', ...)` prefix makes the value unambiguous when read back.
- **Per-session fingerprint** (not per-file SHA256 of the DB) per **D-03** — the DB file changes constantly because the IDE writes to it; a file-level hash would force re-parse on every sync. The composite `(session_id, gmt_modified, msg_count, max_msg_gmt)` fingerprint changes only when *that* session actually changes.
- **`PARSER_CACHE_VERSION`** is already `'parser-v9-token-channel-accounting'` (line 20). Bump it (e.g. to `'parser-v10-qoder-source'`) **only if** the Qoder parser introduces a token-attribution change that retroactively affects the other 3 sources; otherwise leave it. Per SPEC §8 the rule is `prompt + completion` only, which matches the v9 contract.
- **`writeSessionToDatabase()` (lines 920–976)** is already source-agnostic — it accepts `source` as a column value. No change needed beyond the schema CHECK widening landing first.
- **No file cursor needed** — Qoder is keyed by session id, not by file offset. `ingest_file_cursors` rows for `source_type='qoder'` may simply be unused, OR repurposed to store the last-seen `MAX(gmt_modified)` for an early-bailout. Recommend the latter for parity with the other sources.
- **Documentation debt:** the column is named `sessions.file_hash` but Qoder fingerprints are not file hashes. Per **D-05**, add a doc note `docs/skip-cache-naming-debt.md` explaining the historical name.

---

### Group 6 — BFF Adapter (NEW)

#### `lib/agent-tools/qoder/definition.ts` — analog: `lib/agent-tools/codex/definition.ts` (full file, 60 lines)

**Excerpt — `codex/definition.ts` (full):**
```typescript
import type { AgentToolDefinition } from '../types'

export const codexDef: AgentToolDefinition = {
  id: 'codex',
  displayName: 'Codex',
  shortName: 'CDX',
  brandColor: 'var(--accent)',
  capabilities: {
    sessions: true,
    replay: true,
    activity: true,
    office: false,
    workspace: false,
    subagents: false,        // ← qoder sets TRUE per SPEC §6
    cost: false,
    approvals: false,
  },
  ingest: {
    sourceType: 'codex',
    discoveryEnv: 'CODEX_SESSIONS_DIR',
  },
}
```

**Adaptation for `qoder/definition.ts`:**
```typescript
import type { AgentToolDefinition } from '../types'

export const qoderDef: AgentToolDefinition = {
  id: 'qoder',
  displayName: 'Qoder',
  shortName: 'QDR',                 // verify with SPEC; pick a stable 3-letter shorthand
  brandColor: 'var(--accent)',      // pick from radix-nova palette; align with starred-sessions SOURCE_COLORS
  capabilities: {
    sessions: true,
    replay: true,
    activity: true,
    office: false,
    workspace: false,
    subagents: true,                // ← Qoder DOES expose subagents per SPEC §6 / D-06
    cost: false,                    // SPEC §9 — Qoder excluded from cost rollups
    approvals: false,
  },
  ingest: {
    sourceType: 'qoder',
    discoveryEnv: 'QODER_DB_PATH',
  },
}
```

#### `lib/agent-tools/qoder/server-adapter.ts` — analog: `lib/agent-tools/codex/server-adapter.ts` (full file, 82 lines)

**Excerpt — `codex/server-adapter.ts` (representative slice, lines 1–35):**
```typescript
import type { AgentToolServerAdapter } from '../types'
import {
  buildSourceScopedSessionParams,
  getSourceScopedSession,
  requireSourceScopedSession,
} from '../server-adapter'

const SOURCE = 'codex'

export const codexAdapter: AgentToolServerAdapter = {
  id: 'codex',
  async listSessions(query) {
    const params = buildSourceScopedSessionParams(SOURCE, query)
    return ingestClient.listSessions(params)
  },
  async getSession(id) {
    return getSourceScopedSession(id, SOURCE)
  },
  async getMessages(sessionId, opts) {
    const session = await requireSourceScopedSession(sessionId, SOURCE)
    return ingestClient.getMessages(session.id, opts)
  },
  // ... turns / search / star / lookup ...
}
```

**Adaptation for `qoder/server-adapter.ts`:** Copy the file verbatim, replacing every literal `'codex'` with `'qoder'` and `codexAdapter` with `qoderAdapter`. The shared helpers (`buildSourceScopedSessionParams`, `getSourceScopedSession`, `requireSourceScopedSession` at `lib/agent-tools/server-adapter.ts:90–138`) are already source-agnostic.

#### 23 BFF route handlers under `app/api/agent-tools/[tool]/**/route.ts`

**Closest analog:** `app/api/agent-tools/[tool]/sessions/route.ts:13–29`:
```typescript
import { openclawAdapter } from '@/lib/agent-tools/openclaw/server-adapter'
import { claudeCodeAdapter } from '@/lib/agent-tools/claude-code/server-adapter'
import { codexAdapter } from '@/lib/agent-tools/codex/server-adapter'
// ADD: import { qoderAdapter } from '@/lib/agent-tools/qoder/server-adapter'

const ADAPTERS = {
  openclaw: openclawAdapter,
  'claude-code': claudeCodeAdapter,
  codex: codexAdapter,
  // ADD: qoder: qoderAdapter,
} as const
```

**Adaptation:** Apply the same two-line patch (one import, one map entry) to all 23 files:
```
app/api/agent-tools/[tool]/agents/[agentName]/avatar/route.ts
app/api/agent-tools/[tool]/agents/route.ts
app/api/agent-tools/[tool]/events/route.ts
app/api/agent-tools/[tool]/health/route.ts
app/api/agent-tools/[tool]/overview/agents/route.ts
app/api/agent-tools/[tool]/overview/aggregates/route.ts
app/api/agent-tools/[tool]/overview/automations/route.ts
app/api/agent-tools/[tool]/overview/capabilities/route.ts
app/api/agent-tools/[tool]/overview/daily-tokens/route.ts
app/api/agent-tools/[tool]/overview/starred/route.ts
app/api/agent-tools/[tool]/overview/status/route.ts
app/api/agent-tools/[tool]/overview/timeline/route.ts
app/api/agent-tools/[tool]/overview/top-models/route.ts
app/api/agent-tools/[tool]/overview/top-projects/route.ts
app/api/agent-tools/[tool]/sessions/[sessionId]/messages/route.ts
app/api/agent-tools/[tool]/sessions/[sessionId]/route.ts
app/api/agent-tools/[tool]/sessions/[sessionId]/search/route.ts
app/api/agent-tools/[tool]/sessions/[sessionId]/star/route.ts
app/api/agent-tools/[tool]/sessions/[sessionId]/turns/route.ts
app/api/agent-tools/[tool]/sessions/lookup/route.ts
app/api/agent-tools/[tool]/sessions/route.ts
app/api/agent-tools/[tool]/sessions/starred/route.ts
app/api/agent-tools/[tool]/sync/route.ts
```
**Note:** `sessions/lookup/route.ts` only imports `openclawAdapter` today (line 14) — verify whether lookup should be source-scoped at all for Qoder; if yes, extend the dispatch map there too.

---

### Group 7 — Frontend Registry / Source Switcher

#### `components/shell/source-switcher.tsx` — **no change required**
**Reason:** the switcher renders dynamically from `getAllDefinitions()`. Once `qoderDef` is added to `lib/agent-tools/registry.ts`, it appears in the UI automatically.

#### `components/overview/kpi-hero.tsx:45-50`
```typescript
// BEFORE
const SOURCE_LABELS: Record<string, string> = {
  openclaw: 'OPENCLAW',
  'claude-code': 'CLAUDE CODE',
  codex: 'CODEX',
}
// AFTER — add line:
  qoder: 'QODER',
```
**Adaptation:** ALL-CAPS label per existing style.

#### `components/sessions/session-filter-dropdown.tsx:27-31`
```typescript
// BEFORE
const SOURCE_LABELS: Record<TraceSource, string> = {
  openclaw: 'Openclaw',
  'claude-code': 'Claude Code',
  codex: 'Codex',
}
// AFTER — add line:
  qoder: 'Qoder',
```
**Adaptation:** Title-case per existing style. Type widens automatically because `TraceSource` now includes `'qoder'` — TypeScript will *require* this entry, surfacing any oversight at compile time. ✅

#### `components/overview/starred-sessions.tsx:13-17, 37-44`
```typescript
// lines 13–17 — colors
const SOURCE_COLORS: Record<string, string> = {
  openclaw: '...',
  'claude-code': '...',
  codex: '...',
  // ADD:
  qoder: 'var(--<radix-nova token>)',   // pick a distinct accent; align with definition.ts brandColor
}

// lines 37–44 — sourceLabel switch
function sourceLabel(source: string): string {
  switch (source) {
    case 'openclaw': return 'Openclaw'
    case 'claude-code': return 'Claude Code'
    case 'codex': return 'Codex'
    // ADD:
    case 'qoder': return 'Qoder'
    default: return source
  }
}
```
**Adaptation:** pick a Tailwind v4 / radix-nova CSS custom-property color that is visually distinct from the existing three; document the choice in `docs/services/ingest.md`.

---

### Group 8 — Tests

#### `tests/unit/ingest/db-migration.test.ts:33` — exact-mechanical
```typescript
// BEFORE
source TEXT NOT NULL CHECK(source IN ('openclaw', 'claude-code', 'codex')),
// AFTER (literal in test fixture must match new schema)
source TEXT NOT NULL CHECK(source IN ('openclaw', 'claude-code', 'codex', 'qoder')),
```
Plus add a positive test asserting that `INSERT INTO sessions (source) VALUES ('qoder')` succeeds, and a negative test asserting that an unknown source value still throws the CHECK error.

#### `lib/agent-tools/types.test.ts:20, 29, 33, 192, 199` — exact-mechanical
```typescript
// every literal array must include 'qoder' in the new alphabetised position
const ids: AgentToolId[] = ['all', 'openclaw', 'claude-code', 'codex', 'qoder']
const toolIds: SourceToolId[] = ['openclaw', 'claude-code', 'codex', 'qoder']
expect(TOOL_IDS).toEqual(['openclaw', 'claude-code', 'codex', 'qoder'])
expect(SHELL_TOOL_IDS).toEqual(['all', 'openclaw', 'claude-code', 'codex', 'qoder'])
```

#### `tests/fixtures/qoder/build-fixture.ts` — **NEW, NO ANALOG**
**Role:** fixture builder. **Match quality:** none — design from scratch per **D-08 / D-09**.

**Design from scratch (not copied):**
```typescript
// tests/fixtures/qoder/build-fixture.ts
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Builds a hand-crafted Qoder SQLite fixture file for parser unit tests.
 *
 * Per D-08/D-09 we do NOT use a snapshot of a real Qoder DB:
 *   - real DBs contain user data (privacy)
 *   - real DBs are large and unstable across IDE versions
 *
 * Instead, this script writes a minimal DB containing exactly the tables
 * and rows required by parseQoderSession() unit tests.
 */
export function buildQoderFixture(outPath: string): void {
  mkdirSync(dirname(outPath), { recursive: true })
  const db = new Database(outPath)

  // 1. CREATE TABLE chat_session, chat_message, tool_result with the columns
  //    enumerated in 2026-05-17-qoder-source-integration-plan.md §2.4 / §2.6 / §2.8
  db.exec(`
    CREATE TABLE chat_session (id TEXT PRIMARY KEY, gmt_create INTEGER, gmt_modified INTEGER, ...);
    CREATE TABLE chat_message (id TEXT PRIMARY KEY, session_id TEXT, role TEXT, content TEXT,
                               tool_calls TEXT, parent_tool_call_id TEXT,
                               prompt_tokens INTEGER, completion_tokens INTEGER, cached_tokens INTEGER,
                               gmt_create INTEGER, ...);
    CREATE TABLE tool_result (id TEXT PRIMARY KEY, message_id TEXT, tool_name TEXT, output TEXT, ...);
  `)

  // 2. INSERT representative rows covering:
  //    - a single-message session
  //    - a multi-turn session with tool calls
  //    - a session with a subagent spawn (parent_tool_call_id chain) — exercises SPEC §1
  //    - a session with cached_tokens > 0 (asserts SPEC §8 token rule)
  //    - an empty session (asserts graceful empty-handling per openclaw.ts:38–130)

  db.close()
}

// CLI entry: `pnpm tsx tests/fixtures/qoder/build-fixture.ts`
if (require.main === module) {
  buildQoderFixture('tests/fixtures/qoder/sample.db')
}
```
**Adaptation Notes:**
- **No analog file** — the existing fixtures (`tests/fixtures/codex/*`, `tests/fixtures/openclaw/*`) are JSONL files that are checked in directly, not built by a script.
- **Why a builder, not a snapshot:** per **D-09** the SQLite binary format is opaque to code review and prone to bit-rot across `better-sqlite3` versions; a TS builder is reviewable and deterministic.
- **MANIFEST.json** documents which tests use which session id from the fixture, mirroring the existing `tests/fixtures/codex/MANIFEST.json` shape if one exists; otherwise design a minimal `{ "sessions": [{ "id": "...", "purpose": "..." }] }` schema.
- **Output committed to repo:** the built `.db` file IS committed (so CI does not need to run the builder), but the builder script is the source-of-truth and a CI check should re-run it and `diff` against the committed `.db` to detect drift.

#### `tests/unit/ingest/parser/qoder.test.ts` — **NEW, partial analog**
**Closest analog:** `tests/unit/ingest/parser/openclaw.test.ts` (or `codex.test.ts` if present). Copy the test-table shape: load fixture, call parser, assert on `ParseResult` fields.

---

### Group 9 — Documentation

| File | Analog Section | What to Add |
|------|----------------|-------------|
| `docs/CONFIGURATION.md` | existing `### Codex` block | New `### Qoder` block: `QODER_DB_PATH` env var, default macOS path, **read-only** invariant, privacy notes (SPEC §10) |
| `docs/API.md` | existing `agent-tools/codex/*` examples | Add `agent-tools/qoder/*` parallel examples for sessions, replay, subagents |
| `docs/services/ingest.md` | existing source list and discovery flowchart | Append Qoder to source list; document `discoverQoderSources` semantics, fingerprint rule (D-03), cost/agent exclusions (SPEC §9) |
| `ERRORS_LEARNED.md` | append-only journal | Append Phase 18 lessons (e.g., better-sqlite3 lock contention, `cached_tokens` non-additivity, SQLite CHECK replacement-table pattern) |
| **NEW:** `docs/skip-cache-naming-debt.md` | NO ANALOG — short ADR | Document why `sessions.file_hash` stores Qoder per-session fingerprints (not file hashes); commit history reference; rename plan (deferred) per **D-05** |

---

## Shared Patterns

### Pattern A — Source enum widening (10+ sites)
**Source of truth:** `types/trace.ts:22`, `lib/agent-tools/types.ts:18`, `ingest/sync/index.ts:63`.
**Apply to:** every literal array `['openclaw', 'claude-code', 'codex']` discovered by grep — there are 25+ matches; the planner should generate a checklist directly from `rg "openclaw.*claude-code.*codex"`.
**Rule:** alphabetise after `'codex'` so the order is `openclaw, claude-code, codex, qoder` (matches existing convention which does NOT alphabetise — instead, it preserves chronological-introduction order).

### Pattern B — SQLite CHECK replacement-table migration
**Source:** `ingest/db/index.ts:140-405` (`runMigrations()`).
**Apply to:** the v14 step that widens `sessions.source`, `subagent_links.subagent_source`, `ingest_file_cursors.source_type`.
**Steps:** CREATE TABLE \_v14 → INSERT SELECT → DROP → RENAME → recreate indexes → recreate FTS5 triggers → restore FK targets.

### Pattern C — Skip-cache fingerprint (D-03 + 17-02-PLAN analog)
**Source:** `ingest/sync/index.ts:476-501` (`computeFileHash`, `buildParserCacheHash`).
**Apply to:** `syncQoderSource`. Use a **per-session** fingerprint `sha256("qoder-session-v1:<id>:<gmt_modified>:<msg_count>:<max_msg_gmt>")` rather than a file-level hash. Store via `sessions.file_hash` (column reused — D-03).

### Pattern D — Source-scoped BFF dispatch
**Source:** `app/api/agent-tools/[tool]/sessions/route.ts:13-29`.
**Apply to:** all 23 BFF route handlers — same two-line patch (import + map entry).

### Pattern E — AgentToolDefinition + ServerAdapter triplet
**Source:** `lib/agent-tools/codex/{definition,server-adapter}.ts`.
**Apply to:** new `lib/agent-tools/qoder/{definition,server-adapter}.ts`. The shared helpers in `lib/agent-tools/server-adapter.ts:90-138` (`buildSourceScopedSessionParams`, `getSourceScopedSession`, `requireSourceScopedSession`) are source-agnostic — no changes needed there.

### Pattern F — Privacy-first read-only DB access (SPEC §10)
**Source:** new pattern (no existing source uses SQLite as primary storage).
**Apply to:** every place that opens the Qoder DB (`discoverQoderSources`, `parseQoderSession`, `syncQoderSource`).
```typescript
new Database(path, { readonly: true, fileMustExist: true })
```
Wrap in `try { ... } finally { db.close(); }` — never `try { db.exec(...) }`. No `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, or `PRAGMA writable_schema=ON` allowed anywhere in Qoder code paths.

### Pattern G — Token attribution (SPEC §8)
**Source:** existing parser convention (codex.ts uses `prompt + completion`).
**Apply to:** `parseQoderSession`. `totalTokens = prompt_tokens + completion_tokens` only. **Never add `cached_tokens`** — Qoder reports cached separately and double-counting would inflate dashboards.

### Pattern H — Cost rollup exclusion (SPEC §9)
**Source:** `ingest/api/overview.ts` cost aggregation queries (search for `WHERE source IN`).
**Apply to:** every cost rollup query — explicitly exclude `'qoder'` (or use a positive whitelist `('openclaw','claude-code','codex')`). Per-session `cost: null` from the parser is the first line of defence; query-level exclusion is the second.

---

## No Analog Found

| File | Role | Why No Analog |
|------|------|---------------|
| `tests/fixtures/qoder/build-fixture.ts` | fixture builder | Existing fixtures are JSONL snapshots committed directly — no other source uses a TS-script-based DB builder. Design from scratch per D-08/D-09. |
| `tests/fixtures/qoder/MANIFEST.json` | fixture manifest | `tests/fixtures/codex/` may or may not have a MANIFEST.json — if not present, design a minimal `{ sessions: [...] }` schema. |
| `docs/skip-cache-naming-debt.md` | ADR-style note | New file per D-05. No structural analog — write a short markdown note (~30 lines) explaining the column reuse and rename deferral. |

---

## Metadata

**Analog search scope:**
- `types/`
- `lib/agent-tools/` (registry, types, server-adapter, codex/, claude-code/, openclaw/)
- `ingest/` (api, config, db, parser, sync, index.ts)
- `app/api/` (sync, agent-tools)
- `components/` (overview, sessions, shell)
- `tests/unit/ingest/`
- `tests/fixtures/`

**Files scanned:** ~80 (full-read on 18 critical analogs; grep-only on the remainder).
**Pattern extraction date:** 2026-05-18.
**Phase 17 status at mapping time:** **NOT LANDED** — analogs reference the existing 3-source code, not the post-Phase-17 4-source code. If Phase 17 lands first, the planner should re-verify CHECK literals before applying Pattern B.
