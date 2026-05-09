# Ingest service deep-dive

The ingest service is a long-running Node.js process that watches local AI-tool session files, parses them into the canonical trace contract, and serves the result over a Hono REST + SSE API. This document is the operator's and contributor's guide to that service.

For the system context, see [`../ARCHITECTURE.md`](../ARCHITECTURE.md). For the database it writes to, see [`../db-schema.md`](../db-schema.md). For the public HTTP shape, see [`../API.md`](../API.md).

---

## 1. Module map

```text
ingest/
├── index.ts                 # Bootstrap: config → DB → HTTP → discovery → watcher → warmup → background sync
├── types.ts                 # Internal types: ServiceContext, HealthStatus, StartupSyncState, VersionInfo
├── tsconfig.json            # Project reference; emits to ingest/dist/
├── config/
│   ├── index.ts             # loadConfig() / getConfig() — INGEST_* env parsing + validation
│   └── tool-dirs.ts         # TOOL_DIR_REGISTRY + resolveToolDirs() — tool directory registry
├── db/
│   ├── schema.sql           # Canonical SQLite DDL (see db-schema.md)
│   └── index.ts             # openDatabase / initSchema / runMigrations / getDatabase / closeDatabase
├── parser/
│   ├── types.ts             # ParseResult, ParseError, parser interface
│   ├── claude.ts            # Claude Code JSONL parser (UUID dedup, DAG, compact detection)
│   ├── openclaw.ts          # OpenClaw parser (content blocks, gateway prefix stripping)
│   └── codex.ts             # Codex parser (turn_context, function_call, custom-tool)
├── sync/
│   ├── sources.ts           # discover{OpenClaw,Claude,Codex}Sources + isWithinRoot
│   └── index.ts             # writeSessionToDatabase + syncSource(orchestrator) + skip cache
├── turns/
│   └── assembler.ts         # Read-time TraceTurn[] assembly (D-08, D-10, D-11)
├── api/
│   ├── sources.ts           # /api/v1/sources, /sources/:type, /sources/:type/sync, /sources/:type/status
│   ├── sessions.ts          # /api/v1/sessions, /sessions/lookup, /sessions/:id
│   ├── turns.ts             # /sessions/:id/turns, /sessions/:id/turns/:index, /sessions/:id/messages
│   ├── routes/
│   │   └── events.ts        # /api/v1/events, /api/v1/sessions/:id/events (SSE)
│   └── middleware/
│       └── rate-limit.ts    # Sliding-window per-IP rate limiter
└── src/
    ├── watcher.ts           # chokidar wrapper: debounce, periodic resync, temp-file filtering
    └── sse.ts               # SSEManager singleton for invalidation broadcasts
```

`ingest/dist/` is the `tsc` output — gitignored. `ingest/.tsbuildinfo` is the incremental build cache.

---

## 2. Boot sequence (`index.ts`)

```text
start()
  loadConfig()                                         // throws on bad env
  if config.rateLimitEnabled: app.use('*', rateLimiter)
  openDatabase({ path: config.dbPath })                // WAL on, parent dir mkdir
  initSchema()                                         // executes schema.sql + runMigrations()
  syncState = { phase: 'starting', startupComplete: limit===0, ... }
  serve({ fetch: app.fetch, port: config.port })       // TCP listening NOW (so /health can answer)
  context = { config, db, server, sseManager, watcher: null, syncState }
  void initializeSourcesAndSync()                      // returns immediately; runs in background

initializeSourcesAndSync()                             // background
  syncState.phase = 'discovering'
  discoverOpenClawSources / discoverClaudeSources / discoverCodexSources
  syncState.phase = 'starting watcher'
  createWatcher({ sourceDirs, debounceMs, resyncIntervalMs, fileExtensions: ['.jsonl', '.json', '.md'], onSyncTrigger })
  watcher.start()
  if startupSyncLimit > 0:
    syncState.phase = 'warming'
    for sourceType in ['openclaw', 'claude-code', 'codex']:
      syncSource(sourceType, { limit, sortByMtimeDesc: true })   // newest N files only
  syncState.startupComplete = true                     // /health flips ready=true
  if backgroundSyncEnabled:
    syncState.phase = 'indexing'
    for sourceType in [...]: syncSource(sourceType)    // full historical scan, no limit
  syncState.phase = 'idle'
```

Two design choices to call out:

1. **HTTP up before warmup.** Quick task `260509-nwg` decoupled "ingest is reachable" from "ingest has indexed everything". Health reports `ready: false` during warmup; the frontend's health overlay treats that as "still loading" instead of failure.
2. **Bounded warmup → background full sync.** The frontend gets useful data after ~50 newest files per source (`INGEST_STARTUP_SYNC_LIMIT`); the rest streams in via background sync + SSE.

`stop()` reverses the boot: stops the watcher, closes the HTTP server, closes the DB.

---

## 3. Configuration

All knobs come from env vars parsed in `config/index.ts`. Every variable, default, and validation rule is in [`../CONFIGURATION.md`](../CONFIGURATION.md). Highlights:

| Var | Default | Why it matters here |
| --- | --- | --- |
| `INGEST_PORT` | `8078` | Hono `serve()` port |
| `INGEST_DB_PATH` | `./data/ingest.db` | resolved with `path.resolve()`; rejects `..` |
| `INGEST_STARTUP_SYNC_LIMIT` | `50` | Newest-files-per-source warmup; `0` skips warmup |
| `INGEST_BACKGROUND_SYNC_ENABLED` | `true` | Whether the post-warmup full sync runs |
| `INGEST_DEBOUNCE_MS` | `500` | chokidar event coalescing window |
| `INGEST_RESYNC_INTERVAL_MS` | `300000` | Periodic full resync fallback |
| `INGEST_RATE_LIMIT_RPM` | `100` | Per-IP per-minute cap |
| `INGEST_DEBUG` | `false` | When true, error responses include stack traces |

Validation throws on startup — if Hono never reaches `serve()`, look at the printed `Error: Invalid INGEST_*` line.

---

## 4. Source discovery

### 4.1 Tool directory registry (`config/tool-dirs.ts`)

Scan directories are centralised by the tool directory registry in `ingest/config/tool-dirs.ts`. The registry defines per-source:

| Source | Env var | Config file key | Default directory |
| --- | --- | --- | --- |
| OpenClaw | `OPENCLAW_DIR` | `openclaw_dirs` | `~/.openclaw/agents` |
| Claude Code | `CLAUDE_PROJECTS_DIR` | `claude_project_dirs` | `~/.claude/projects` |
| Codex | `CODEX_SESSIONS_DIR` | `codex_sessions_dirs` | `~/.codex/sessions` |

`resolveToolDirs()` resolves directories with priority: environment variable > config file (`AGENTS_TRACING_CONFIG` or default `~/.agents-tracing/config.json`) > built-in defaults. The config file can specify multiple directories (as an array); environment variables support a single directory only. The resolved result is stored in `IngestConfig.toolDirs` (`Map<SourceToolId, string[]>`).

### 4.2 Discoverers (`sync/sources.ts`)

`sync/sources.ts` exports three discoverers:

- `discoverOpenClawSources(dirs?: string[])`
  - By default reads the OpenClaw directory list from `IngestConfig.toolDirs`.
  - For each directory, walks `*/sessions/` subdirectories, returns one `DiscoveredSource` per agent's sessions dir with `sessionCount` from `*.jsonl` files.
  - If no agents found, returns one entry with `sessionCount: 0` and an `error` describing the absence.
  - Filters out anything outside the resolved `agentsDir` via `isWithinRoot`.
- `discoverClaudeSources(dirs?: string[])`
  - By default reads the Claude Code directory list from `IngestConfig.toolDirs`.
  - Recursive: any directory under the root containing `.jsonl` becomes a `DiscoveredSource`.
- `discoverCodexSources(dirs?: string[])`
  - By default reads the Codex directory list from `IngestConfig.toolDirs`.
  - Same recursive shape as Claude.

`isWithinRoot(candidate, allowed)` resolves both paths and checks `candidate.startsWith(root + sep) || candidate === root`. This blocks symlinks that would otherwise let the watcher escape the configured root.

---

## 5. Parsers

Each parser implements the same contract:

```ts
async function parseSession(filePath: string, project: string): Promise<ParseResult>

interface ParseResult {
  session: TraceSession      // metadata: id, source, project, name, timestamps, status, metrics
  messages: TraceMessage[]   // flat ordered messages
  activities: TraceActivity[] // tool_call | skill_use | subagent_link | thinking | system
  errors: ParseError[]       // malformed line records
  warnings: string[]
}
```

Only the source-specific shape leaves the parser boundary. Everything downstream (sync, assembler, API) sees `ParseResult` only.

### 5.1 Claude parser (`parser/claude.ts`)

- Reads `~/.claude/projects/<encoded-cwd>/<uuid>.jsonl` line-by-line.
- Each line carries `uuid`, `parentUuid`, `type`, `message`, `timestamp`, optional `usage`.
- Performs **UUID dedup** — duplicate `uuid` rows in the same file are skipped (a real failure mode in long sessions).
- Builds the **DAG**: `parentUuid` defines parent / sibling / branch relationships. The parser preserves the linear order from the file but uses the DAG to identify subagent/fork structure.
- Detects **compact boundaries** — `[compact]` markers in system events become `TraceSystemEvent { subtype: 'compact' }` activities; the assembler later marks the surrounding turn `isTruncated`.
- Extracts the project from the filename's encoded cwd: `-Users-ebbi-work` → `/Users/ebbi/work`. The sync layer then patches `session.project` if the parsed value is empty/`default`.

### 5.2 OpenClaw parser (`parser/openclaw.ts`)

- Reads `<workspace>/agents/<name>/sessions/<key>.jsonl`.
- Each line is a content-block message; tool calls are nested.
- Strips the gateway-injected metadata header before extracting display content. Gateway-injected date prefixes like `[Wed 2026-04-29 00:58 GMT+8]` are removed when deriving the display name.
- Session ID format: `agent:<name>:<uuid>`.

### 5.3 Codex parser (`parser/codex.ts`)

- Reads `~/.codex/sessions/**/*.jsonl`.
- Codex has a native `turn_context` boundary — the parser uses it directly and emits stable `turnId` / `turnIndex` on each message.
- Function calls (`function_call`, `function_call_output`) and custom-tool invocations both become `TraceToolCall` activities.
- Subagent relationships come from `event_msg` lines with `payload.type === 'collab_agent_spawn_end'`. `collectCodexRelationships()` in `sync/index.ts` pre-scans all Codex files to build a child→parent map, which is then applied during the per-file sync.

---

## 6. Sync layer

`sync/index.ts` is the orchestrator. The two public entry points:

### `syncSource(sourceType, options)`

```ts
export async function syncSource(
  sourceType: 'openclaw' | 'claude-code' | 'codex',
  options?: SyncSourceOptions | string  // string = legacy basePath shorthand
): Promise<SyncResult>
```

- Discovers sources for `sourceType`.
- Collects candidate `.jsonl` files (with mtime sort if `limit` or `sortByMtimeDesc` is set).
- For each file: invoke the source-specific parser, patch `session.name` (from first user message) and `session.project` (from message `cwd` if file-derived was empty), then call `writeSessionToDatabase(parseResult, undefined, filePath, { force })`.
- Aggregates per-file `SyncResult` into a per-source `SyncResult`.
- Calls `upsertSyncStatus(sourceType, result)` to record `last_full_sync_at`, `files_watched`, `last_error` in the `sync_status` table.
- Emits `sync_complete` SSE with totals.

There is **no generic source fallback** (D-21). Adding a new source requires extending the enum + adding a new branch in `syncSource`.

### `writeSessionToDatabase(parseResult, db?, sourceFile?, options?)`

The actual DB write. Steps:

1. If `sourceFile` provided, compute `sha256(file)` → `cacheFileHash = "<PARSER_CACHE_VERSION>:<source>:<sha>"`.
2. Look up existing `sessions WHERE id = ?`.
3. **Skip cache:** if existing row's `file_hash === cacheFileHash` and `force !== true`, only patch `file_size`, `file_mtime`, `last_sync_at`, and missing `name`/`project` fields. Return zero counts.
4. Otherwise open `database.transaction(...)`:
   - If existing: delete `tool_result_events → tool_calls → turns → messages` for this `session_id` (in dependency order). Then `UPDATE sessions SET ...`.
   - If new: `INSERT INTO sessions ...`.
   - Insert all messages (one prepared statement, looped). `messages.id` falls back to `${sessionId}:${ordinal}` if the parser didn't set one.
   - Insert all `tool_call` activities with their `tool_result_events`.
5. After commit, emit SSE: `session_created` or `session_updated`, plus a per-session event.

The transaction wrapping is critical: `better-sqlite3` is synchronous, so a thrown exception mid-write rolls everything back automatically. Partial writes are not possible.

### Skip cache versioning

The cache key prefix `parser-v7-turn-activity-placement` is at the top of `sync/index.ts` as `PARSER_CACHE_VERSION`. **Bump it whenever parser output shape changes** — every existing `sessions.file_hash` will mismatch the new prefix and the next sync will re-parse everything. This is the safe alternative to manually invalidating cache rows in a migration.

Migrations in `db/index.ts` use a milder form of the same pattern: setting `file_hash = NULL` for rows whose metadata-extraction logic changed.

---

## 7. File watcher (`src/watcher.ts`)

Wraps `chokidar` with the project's specific needs.

- Watches all directories returned by source discovery (one chokidar watcher per directory; aggregated into a single `WatcherInstance`).
- File extensions watched: `['.jsonl', '.json', '.md']` (Markdown for OpenClaw note files).
- **Temp file filter** — strips `~`, `.swp`, `.swo`, `.tmp`, `.temp`, `.bak`, `.DS_Store`, `Thumbs.db`, `.gitkeep`.
- **Debounce** — coalesces multiple events on the same source into a single `onSyncTrigger(sourceType)` call after `INGEST_DEBOUNCE_MS` of quiet (default 500ms).
- **Periodic resync** — every `INGEST_RESYNC_INTERVAL_MS` (default 5 min) it calls `onSyncTrigger` for every source, regardless of file events. This is the safety net for "watcher missed an event" scenarios.

`getStatus()` returns the running flag, files-watched count, last sync time, last error, and source count — surfaced via `/api/v1/sources/:type/status`.

When ingest hot-reloads (`tsx watch`), the watcher is torn down and recreated. There is no cross-restart event coalescing — the next sync after restart will catch any missed changes via the resync interval.

---

## 8. Turn assembler (`turns/assembler.ts`)

Reads `messages` and `tool_calls` rows and produces `TraceTurn[]`. Runs at query time, not at sync time.

```ts
export async function assembleTurns(sessionId: string, db?: Database.Database): Promise<TraceTurn[]>
```

Algorithm:

1. `SELECT messages WHERE session_id ORDER BY ordinal`.
2. If any message has a non-null `turn_index`, use **stored turn boundaries** (Codex case) — group by `turn_index`. Otherwise compute boundaries on the fly.
3. Walk messages:
   - `user` → close the previous turn if it had assistant messages; open a new turn.
   - Consecutive `user` messages (or `[QUEUED]` prefix) → merged into the current turn (D-05).
   - `assistant` / `tool_result` → append to current turn's `assistantMessages`.
   - `system` → add as `TraceSystemEvent` activity. If content includes `[compact]`, also set `isTruncated: true` on the current turn (D-10).
4. `pairToolCalls(turns, sessionId, db)` — JOIN `tool_calls + tool_result_events` and attach to the turn whose `assistantMessages` contains the matching `messageOrdinal`.
5. `linkSubagents(turns, sessionId, db)` — `SELECT sessions WHERE parent_session_id = ?` and add `subagent_link` activities to the first turn (per D-11).

`getTurnCount(sessionId, db)` is a cheap count without full assembly — used by the API for pagination headers without forcing a complete assemble pass when the caller only needs the total.

---

## 9. SSE manager (`src/sse.ts`)

Module-level singleton (`sseManager`). Two subscriber kinds:

- **Global subscribers** (`sessionId === null`) receive `session_created`, `session_updated`, `session_removed`, `sync_complete`.
- **Per-session subscribers** receive only events for their `sessionId`, plus `turn_added` (reserved — not currently emitted).

Each subscriber gets a `ReadableStream<Uint8Array>` with an immediate `event: connected\ndata: {}\n\n` ack. `cancel()` on the stream removes the subscriber from the map; the route handler also wires `c.req.raw.signal?.addEventListener('abort', close)` so client disconnects clean up too.

`emit(event, data)` and `emitSessionEvent(sessionId, event, data)` are best-effort: a `controller.enqueue` failure (closed stream) silently deletes the subscriber. There is no retry, no buffering, no replay log — events are advisory invalidation signals (D-12), not a durable change feed.

---

## 10. Rate limiter (`api/middleware/rate-limit.ts`)

Sliding-window per-IP counter:

- Bypasses `/health` and `/version` outright.
- Picks the IP from the first comma-separated value of `x-forwarded-for`, falling back to `127.0.0.1`.
- Stores `{ count, resetAt }` in an in-memory `Record`; cleanup interval runs every `min(windowMs, 60_000)` ms and prunes expired entries (`.unref()` so it doesn't keep the process alive).
- Returns **429** with `{ error: "Too many requests", retryAfter: <seconds> }` when over budget.

The pre-configured singleton `rateLimiter` is `createRateLimitMiddleware(100, 60_000)` — i.e. 100 req/min, matching `INGEST_RATE_LIMIT_RPM`'s default. The constants don't read the env directly; if you need a different cap, override the value in code or rebuild the middleware.

---

## 11. Error handling

- Per-route: explicit `c.json({ error: '...' }, status)` everywhere, with `400` for validation failures and `404` for missing rows. Status codes are intentional, not defaults.
- Global: `app.onError((err, c) => ...)` returns `{ error: 'Internal server error' }` (status 500) by default. With `INGEST_DEBUG=true`, returns `{ error: err.message, stack: err.stack }` for debugging — never enable on shared environments.
- Watcher: failures inside `onSyncTrigger` are caught and logged with `[watcher] Sync failed for <source>: <err>`. The watcher continues running.
- Sync: per-file parser failures are caught and accumulated into `SyncResult.errors`. The sync continues with the next file.

---

## 12. Lifecycle and process supervision

- The service is a plain Node process. `pnpm dev:ingest` runs it under `tsx watch` for hot reload. `pnpm start:ingest` runs the built `ingest/dist/ingest/index.js` under `NODE_ENV=production`.
- `SIGINT` / `SIGTERM` handlers call `stop()` → watcher.stop → server.close → closeDatabase. They are wired up only when invoked via `require.main === module`, i.e. the CLI entry path. Embedding `start()` directly in another process means you wire your own signals.
- There's no built-in supervisor. For production-style longevity wrap with `pm2`, `systemd`, or your launcher of choice.

---

## 13. Where to make common changes

| Want to change... | Touch... |
| --- | --- |
| Add a new ingest endpoint | Create file in `ingest/api/` exporting a `Hono` router; mount in `ingest/index.ts` |
| Add a new source (e.g. Goose, Aider) | `parser/goose.ts` + `sync/sources.ts` discoverer + `sync/index.ts` branch + `types/trace.ts` enum + `db/schema.sql` CHECK constraint + `lib/agent-tools/goose/{definition,server-adapter}.ts` |
| Change parser output shape | Bump `PARSER_CACHE_VERSION` in `sync/index.ts` so existing rows re-parse on next sync |
| Change DB schema | Add a step to `runMigrations()` in `db/index.ts`, bump `targetVersion`, also update `schema.sql` for new installs |
| Tune watcher behaviour | `INGEST_DEBOUNCE_MS` / `INGEST_RESYNC_INTERVAL_MS` env, or `src/watcher.ts` if you need new constants |
| Change rate limiter | `api/middleware/rate-limit.ts` — singleton uses 100/min |
| Add a new SSE event type | Add to `SSEEventType` in `src/sse.ts`; emit from sync layer where needed; document in `API.md` |

---

## 14. Operational notes

- `data/ingest.db` is a normal SQLite file — `sqlite3 data/ingest.db '.schema'` works for ad-hoc inspection. Don't run `VACUUM` while ingest is running (WAL holds locks).
- WAL mode means `data/ingest.db-wal` and `data/ingest.db-shm` files appear next to the DB. They're normal; deleting them while ingest runs corrupts state. To do a clean reset, stop ingest first and remove all three.
- Migrations are forward-only. There's no rollback path — restoring an older state means restoring a backup of `data/ingest.db` or nuking it and re-syncing.
- The `parser_malformed_lines` and `parser-warning` paths surface in the UI (`SessionStatusBar` shows `PARSE WARNINGS`); they are non-fatal — a session with malformed lines still gets indexed for whatever could be parsed.

For the public API contract this service exposes, jump to [`../API.md`](../API.md). For the table-by-table schema it writes, see [`../db-schema.md`](../db-schema.md).
