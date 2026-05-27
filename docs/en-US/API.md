# API reference

agent-trail exposes two HTTP surfaces:

1. **Ingest service** on `http://localhost:8078` (Hono) — the canonical REST + SSE API.
2. **Next.js BFF** on `http://localhost:3000/api/...` — proxies and aggregators that the browser uses. The frontend never calls ingest directly (D-07).

Source-scoped frontend reads should always go through `/api/agent-tools/[tool]/...`. The ingest API is documented here for tooling, debugging, and parity reference.

> All examples assume defaults from [`CONFIGURATION.md`](CONFIGURATION.md). `[tool]` is usually one of `openclaw | claude-code | codex | opencode | qoder`; a few read-only aggregate BFF endpoints such as `/health` and `/sessions/search` also accept `all`.

---

## 1. Ingest service (`:8078`)

### 1.1 Health & version

#### `GET /health`

```json
{
  "status": "ok",
  "ready": true,
  "version": "0.1.1",
  "uptime": 12.345,
  "database": "connected",
  "sync": {
    "phase": "idle",
    "startupComplete": true,
    "foregroundLimit": 50,
    "backgroundSyncEnabled": true,
    "currentSource": null,
    "lastSyncAt": "2026-05-09T19:14:33.000Z",
    "lastError": null
  }
}
```

- `status` is `"ok"` once `openDatabase()` succeeded; `"error"` otherwise.
- `ready` is `true` only after the bounded warmup sync finishes.
- `database` is `"connected"` when `getDatabase()` returns a live handle.
- `sync.phase` walks through `starting → discovering → warming → indexing → idle` (or `error`).

The route bypasses `/version` and `/health` from rate limiting in `rateLimiter`.

#### `GET /version`

```json
{
  "version": "0.1.1",
  "name": "agent-trail-ingest",
  "sources": ["openclaw", "claude-code", "codex", "opencode"]
}
```

---

### 1.2 Sources

#### `GET /api/v1/sources`

List all discovered sources across all three types.

```json
{
  "sources": [
    {
      "type": "openclaw",
      "path": "/Users/me/.openclaw/agents/blue/sessions",
      "sessionCount": 42,
      "lastSyncAt": null,
      "error": null,
      "healthStatus": "configured",
      "watcherStatus": "watching",
      "filesWatched": 142
    }
  ],
  "total": 1
}
```

- `healthStatus` is derived: `error` if `error != null`, else `configured` if `sessionCount > 0`, else `empty`.
- `watcherStatus` and `filesWatched` come from the chokidar watcher (`watching` / `stopped`).
- Discovery errors (e.g. ENOENT) become `error` on the entry, not on the response.

#### `GET /api/v1/sources/:type`

Same shape as above, scoped to one source type.

- **400** `Unsupported source type` when `type` is not `openclaw | claude-code | codex | opencode`.

#### `POST /api/v1/sources/:type/sync`

Trigger an immediate sync for one source type.

| Param | Where | Default | Notes |
| --- | --- | --- | --- |
| `force` | query (`?force=true`) or JSON body (`{"force":true}`) | `false` | Bypasses the `file_hash` skip cache; reparses every file. |

```json
{
  "type": "claude-code",
  "syncResult": {
    "sessionsInserted": 12,
    "sessionsUpdated": 3,
    "messagesInserted": 1184,
    "toolCallsInserted": 226,
    "toolResultEventsInserted": 226,
    "errors": []
  },
  "status": "completed"
}
```

- **400** unsupported source type.
- **500** `{ error: "Sync failed", message: "<details>" }` on parser/IO failure (or `Internal server error` if `INGEST_DEBUG=false`).

#### `GET /api/v1/sources/:type/status`

Lightweight watcher status — no source enumeration.

```json
{ "type": "openclaw", "watcherStatus": "watching", "filesWatched": 142, "lastSyncAt": null, "lastError": null }
```

- **400** unsupported source type.

---

### 1.3 Sessions

#### `GET /api/v1/sessions`

Paginated session list with filtering and sort.

| Query | Type | Default | Validation |
| --- | --- | --- | --- |
| `source` | `openclaw \| claude-code \| codex \| opencode` | _(any)_ | Whitelist; **400** otherwise via downstream filter |
| `project` | string | _(any)_ | Pass-through `=` filter |
| `status` | `active \| idle \| aborted \| error \| unknown` | _(any)_ | Pass-through |
| `sort` | `updated_at \| started_at \| ended_at` | `updated_at` | **400** Invalid sort parameter otherwise |
| `order` | `asc \| desc` | `desc` | **400** otherwise |
| `includeChildren` | `true` (only this value enables it) | `false` | When false, only `relationship_type IS NULL OR 'root'` returned |
| `limit` | non-negative int | `50` | Cap at 1000; **400** if negative |
| `offset` | non-negative int | `0` | **400** if negative |

`updated_at` is computed as `MAX(COALESCE(ended_at, ''), COALESCE(started_at, ''), COALESCE(file_mtime, ''))` — that's why `sort=updated_at` works without a stored column.

```json
{
  "sessions": [ { "id": "...", "source": "claude-code", "project": "/Users/...", "name": "...", "status": "idle", "metrics": {"messageCount": 88, ...}, "turns": [] }, ... ],
  "pagination": { "total": 412, "limit": 50, "offset": 0, "hasMore": true }
}
```

`turns` is always `[]` here — fetch turns separately via `/sessions/:id/turns`.

> `q` / `search` only matches session metadata (`name`, `project`, `id`). It does **not** search message bodies. For body-level reverse lookup, use `GET /api/v1/sessions/search` below.

#### `GET /api/v1/sessions/search`

Cross-session message-body search. Returns **session-level** deduplicated hits, with each session appearing at most once plus one matching `snippet` so an agent can keep drilling in.

| Query | Type | Default | Notes |
| --- | --- | --- | --- |
| `q` | string | _(required)_ | Message-body keywords; empty returns **400** |
| `source` | `openclaw \| claude-code \| codex \| opencode \| qoder` | _(all)_ | Optional source filter |
| `limit` | non-negative int | `20` | Capped at 100; **400** if negative |
| `includeChildren` | `true` (only this value enables it) | `false` | Roots only by default; set to true to include child/subagent sessions |

Implementation prefers SQLite FTS5 and falls back to `LIKE` if the FTS query cannot run. Results are primarily ordered by `updatedAt DESC`, with `matchCount` as a secondary ranking signal.

```json
{
  "query": "gree",
  "results": [
    {
      "id": "codex:session-123",
      "sessionId": "codex:session-123",
      "source": "codex",
      "sourceSessionId": "abc-123",
      "project": "/Users/me/research",
      "name": "GREE valuation follow-up",
      "displayTitle": "GREE valuation follow-up",
      "updatedAt": "2026-05-27T09:15:00.000Z",
      "summary": "Find my recent GREE / 3632 valuation session.",
      "snippet": "...recent >>>GREE<<< / 3632 valuation session...",
      "matchCount": 3
    }
  ],
  "pagination": { "limit": 20, "returned": 1, "hasMore": false }
}
```

Responsibility boundary:

- `GET /api/v1/sessions?q=...`: list search over session metadata.
- `GET /api/v1/sessions/search?q=...`: reverse-lookup candidate sessions from message bodies.
- `GET /api/v1/sessions/:id/search?q=...`: search message hits within one known session.

#### `GET /api/v1/sessions/lookup`

Look up a session by `(source, key)` — used by OpenClaw Gateway-to-ingest drilldown.

| Query | Required | Notes |
| --- | --- | --- |
| `source` | yes | Whitelist `openclaw \| claude-code \| codex \| opencode`; **400** otherwise |
| `key` | yes | Regex `^[a-zA-Z0-9:\-_.]{1,256}$`; **400** otherwise |

The lookup tries `id = ?` first, then `source_session_id = ?`, both filtered by `source`.

- **400** missing/invalid params.
- **404** `Session not found for key`.

#### `GET /api/v1/sessions/:id`

Single session detail.

- **400** `Invalid session ID format` if `id` doesn't match `^[a-zA-Z0-9:\-_.]{1,256}$`.
- **404** `Session not found` if no row matches.
- **200** the canonical `TraceSession` (with `turns: []`).

#### `GET /api/v1/sessions/:id/messages`

Flat ordered message list.

| Query | Default | Notes |
| --- | --- | --- |
| `role` | _(all)_ | Whitelist `user \| assistant \| system \| tool_result`; **400** otherwise |
| `limit` | `100` | Cap at 1000; **400** if negative |
| `offset` | `0` | **400** if negative |

```json
{
  "sessionId": "...",
  "messages": [ { "id": "...", "ordinal": 0, "role": "user", "content": "...", "timestamp": "...", "model": null, "tokenUsage": null, "sourceMetadata": {"sourceType": "openclaw", "sourceFile": "...", "sourceLine": 1} }, ... ],
  "pagination": { "total": 88, "limit": 100, "offset": 0, "hasMore": false }
}
```

> Note: `sourceMetadata.sourceType` is currently hard-coded to `"openclaw"` in the message-row mapper — see the `// TODO` in `ingest/api/turns.ts`. Don't rely on that field for source identification; use the parent session's `source`.

- **400** invalid session ID format / role / limit / offset.
- **404** session not found.

#### `GET /api/v1/sessions/:id/search`

Search message bodies within **one known session**, returning message-level hits.

| Query | Type | Default | Notes |
| --- | --- | --- | --- |
| `q` | string | _(required)_ | Message-body keywords; empty returns **400** |

```json
{
  "sessionId": "codex:session-123",
  "query": "valuation",
  "results": [
    {
      "id": "msg-42",
      "ordinal": 8,
      "role": "assistant",
      "turnIndex": 3,
      "snippet": "...base-case >>>valuation<<< still assumes..."
    }
  ]
}
```

- **400** invalid session ID format or empty query.
- **200** returns an empty array when nothing matches.

#### `GET /api/v1/sessions/:id/turns`

Run the turn assembler for a session.

| Query | Default | Notes |
| --- | --- | --- |
| `limit` | `50` | Cap at 1000 |
| `offset` | `0` | Applied after assembly (assembler reads all messages, slice happens in memory) |

```json
{
  "sessionId": "...",
  "turns": [
    {
      "id": "session-turn-0", "sessionId": "...", "index": 0,
      "userMessage": { "id": "...", "ordinal": 0, "role": "user", "content": "...", "sourceMetadata": {...} },
      "assistantMessages": [ { "id": "...", "ordinal": 1, "role": "assistant", "content": "...", ... } ],
      "activities": [ { "type": "tool_call", "name": "Bash", "category": "Bash", "inputJson": "...", "status": "success", "resultEvents": [{"content": "...", "isPartial": false}], ... } ],
      "startedAt": "...", "endedAt": "...", "durationMs": 12345,
      "tokenUsage": { ... },
      "isTruncated": false
    }
  ],
  "pagination": { "total": 12, "limit": 50, "offset": 0, "hasMore": false }
}
```

- **400** invalid session ID / limit / offset.
- **404** session not found.

#### `GET /api/v1/sessions/:id/turns/:index`

Single-turn fetch. Same validation as above.

- **400** non-numeric / negative `:index`.
- **404** turn or session not found.

#### `GET /api/v1/qoder/usage`

Returns Qoder-specific request-level estimated usage rows. The endpoint opens the configured Qoder SQLite DB read-only, treats each root `chat_record` as one row, recursively includes subagent assistant `token_info` within that request window, then converts tokens to credits / USD with `qoder-token-calibrated-estimate`.

| Query param | Default | Notes |
| --- | --- | --- |
| `limit` | `20` | Newest estimated usage rows; capped at 100. |

The response includes `entries[]`, `totalCredits`, `totalCostUsd`, `costSource`, and `calibration`. This is an estimate, not raw output from Qoder's official per-row billing API.

---

### 1.4 SSE event streams

Both endpoints set:

```text
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

Connections live for as long as the client keeps them open. The route handler attaches an `abort` listener so client disconnects clean up the subscriber.

#### `GET /api/v1/events`

Global stream. Emits:

| Event | Data |
| --- | --- |
| `connected` | `{}` (sent immediately on subscribe) |
| `session_created` | `{ sessionId, source }` |
| `session_updated` | `{ sessionId, source }` |
| `session_removed` | `{ sessionId }` (currently unused — ingest does not delete rows; here for forward compat) |
| `sync_complete` | `{ source, sessionsInserted, sessionsUpdated, errors }` |

#### `GET /api/v1/sessions/:id/events`

Per-session stream. Validates `:id` format and verifies the session exists before subscribing (per threat model T-06-02-01).

| Event | Data |
| --- | --- |
| `connected` | `{}` |
| `session_created` | `{ sessionId, ... }` (only if it's this session) |
| `session_updated` | `{ sessionId, ... }` |
| `turn_added` | reserved — emitted by the SSE manager interface but not currently fired by the writer |

- **400** invalid session ID format.
- **404** session not found.

---

### 1.5 Errors & rate limiting

- The global error handler (`app.onError`) returns `{ "error": "Internal server error" }` with status 500 by default. When `INGEST_DEBUG=true`, it returns `{ error, stack }` instead — never enable in shared environments.
- `rateLimiter` middleware (when `INGEST_RATE_LIMIT_ENABLED=true`, default) caps requests at `INGEST_RATE_LIMIT_RPM` per IP per minute. Excess returns `429 { error: "Too many requests", retryAfter: <seconds> }`. `/health` and `/version` are exempt.
- IP is taken from the first `x-forwarded-for` entry; falls back to `127.0.0.1`.

---

## 2. Next.js BFF (`:3000/api`)

All BFF routes use `Content-Type: application/json` for both requests (when applicable) and responses. Errors are sanitized — see `sanitizeError` in `lib/agent-tools/server-adapter.ts`.

### 2.1 Tool-scoped proxies

Every per-tool endpoint follows the same pattern (except read-only aggregate endpoints such as `/health` and `/sessions/search`, which also allow `all`):

1. `assertSourceToolId(tool)` — rejects unknown tools with **400**.
2. Look up the right adapter (`openclaw | claude-code | codex | opencode`).
3. Call the adapter; injecting `source=<tool>` for list queries.
4. Validate `sessionId` if present (`validateSessionId` regex). **400** on bad format.
5. Catch and `sanitizeError` — **502** with generic `Ingest service unreachable` for unrecognised errors.

#### `GET /api/agent-tools/[tool]/health`

Pass-through to ingest `/health`. Returns whatever ingest returns (no shape transform).

#### `GET /api/agent-tools/[tool]/sessions`

Same query params as ingest `GET /api/v1/sessions`, **except** `source` is ignored (the BFF injects it from `[tool]`) and `limit` is capped at **100** before being forwarded.

> `q` on this endpoint is still metadata-only session search. For cross-session message-body search, use `GET /api/agent-tools/[tool]/sessions/search`.

#### `GET /api/agent-tools/[tool]/sessions/search`

Wraps ingest `GET /api/v1/sessions/search`.

- When `tool=all`, the BFF does not inject `source`, so the search spans all indexed sources.
- When `tool=<source>`, the BFF injects that `source` and ignores any caller-provided `source`.
- `q` is required; `limit` is capped to **100** at the BFF; `includeChildren` passes through unchanged.

#### `GET /api/agent-tools/qoder/qoder-usage`

Qoder-only BFF proxy to ingest `GET /api/v1/qoder/usage`. Other `[tool]` values return **404**.

#### `GET /api/agent-tools/[tool]/sessions/lookup`

Wraps ingest `GET /api/v1/sessions/lookup`.

- Only `openclaw` is allowed — other tools return **400** `Gateway lookup is only available for OpenClaw`.
- **400** when `key` is missing.
- **404** `No matching indexed session found` when ingest returns 404.

#### `GET /api/agent-tools/[tool]/sessions/[sessionId]`

Validates `sessionId`, then calls `getSourceScopedSession(sessionId, source)`. If the session exists in ingest but its `source` doesn't match `[tool]`, the BFF returns **404** (cross-source isolation).

#### `GET /api/agent-tools/[tool]/sessions/[sessionId]/messages`

Calls `requireSourceScopedSession` first, then proxies to ingest `/api/v1/sessions/:id/messages`. No further query handling at the BFF — pass-through.

#### `GET /api/agent-tools/[tool]/sessions/[sessionId]/turns`

| Query | Default | Notes |
| --- | --- | --- |
| `offset` | `undefined` (passed through to adapter, which defaults to 0) | **400** negative |
| `limit` | `undefined` (adapter default 50) | **400** negative; capped at 100 before forwarding |

Calls `requireSourceScopedSession`, then `adapter.getSessionTurns()`.

#### `POST /api/agent-tools/[tool]/sync`

Per-source sync trigger. Accepts `force` from query (`?force=true`) or JSON body (`{"force":true}`).

- **400** `Invalid source tool ID` when `tool` is invalid (including `all`).
- **502** `Ingest service unreachable` on ingest failure.

#### `GET /api/agent-tools/[tool]/events`

SSE pass-through. `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.

| Query | Behaviour |
| --- | --- |
| _(none)_ | Subscribes to the global `/api/v1/events` stream. |
| `sessionId=<id>` | Subscribes to `/api/v1/sessions/:id/events`. |

The browser-side `EventSource` should set the `Last-Event-ID` header automatically on reconnect. The stream forwards the ingest body verbatim; **502** with `{ "error": "Ingest SSE unavailable" }` if the upstream fetch fails.

---

### 2.2 Aggregate / utility routes

#### `GET /api/ingest/health`

Frontend-facing health check. Wraps ingest `/health` and returns 502 on unreachable.

```json
{ "status": "ok", "ready": true, "version": "0.1.1", "sync": { ... } }
// or on failure
{ "status": "error", "error": "<sanitized message>" }
```

#### `POST /api/sync`

All-source aggregate sync. Iterates `openclaw → claude-code → codex → opencode` calling each `/api/v1/sources/:type/sync` in turn.

| Param | Where | Default |
| --- | --- | --- |
| `force` | query or JSON body | `false` |

```json
{
  "results": [
    { "type": "openclaw",    "syncResult": {...}, "status": "completed" },
    { "type": "claude-code", "syncResult": {...}, "status": "completed" },
    { "type": "codex",       "error": "Ingest service unreachable", "status": "failed" }
  ],
  "force": false
}
```

#### `GET /api/logs`

Reads activity logs (cron runs and config audits) from the local filesystem via `lib/logs.ts`. Returns up to 200 entries.

```json
{
  "entries": [ { "id": "...", "ts": "...", "level": "info", "summary": "...", "source": "cron", "jobId": "..." } ],
  "summary": { ... }
}
```

- **500** `Failed to load logs` on filesystem error (sanitized via `apiErrorResponse`).

#### `GET /api/sessions/messages`

**Legacy file-scan route** preserved from the OVAO era. Reads the last 30 message lines directly from an OpenClaw session JSONL file.

| Query | Required |
| --- | --- |
| `id` | yes |

- Session ID is sanitized (`[^a-zA-Z0-9\-_:.]` stripped).
- `WORKSPACE_PATH` must be set; otherwise **500** `WORKSPACE_PATH not configured`.
- **400** `Missing session id` if `id` query is absent.
- Returns `[]` (200) when the session file is not found — no 404.

> Don't use this for new code. Prefer `/api/agent-tools/openclaw/sessions/[sessionId]/messages`, which goes through the ingest read model and benefits from index, source scoping, and SSE invalidation.

#### `POST /api/action/restart`

Calls `systemctl restart openclaw`, falls back to `systemctl --user restart openclaw`. Used by OpenClaw operational tooling.

- **200** `{ "success": true }` on success.
- **500** `{ "success": false, "error": "All restart attempts failed" }`.

> Host-level. Will fail (or have surprising effects) outside a Linux/systemd machine where OpenClaw is installed as a service.

#### `POST /api/action/update`

Runs `npm update -g openclaw` with a 120s timeout.

- **200** `{ "success": true, "output": "..." }`.
- **500** `{ "success": false, "error": "<details>" }` on non-zero exit.

> Same caveat as `/api/action/restart` — host-level command.

---

## 3. Status code summary

| Code | When |
| --- | --- |
| **200** | Success. |
| **400** | Bad input — invalid tool, session ID, source, role, sort, limit/offset, or missing required param. |
| **404** | Session / turn / session-not-in-this-source-scope not found. |
| **429** | Ingest rate limit exceeded (`retryAfter` in body). |
| **500** | Internal server error (sanitized in production; full stack only with `INGEST_DEBUG=true`). |
| **502** | BFF cannot reach ingest, or ingest returned a non-2xx the BFF can't classify. |

---

## 4. End-to-end debug recipe

```bash
# 1. Confirm ingest is up and ready
curl http://localhost:8078/health | jq

# 2. Confirm the source you care about is configured
curl 'http://localhost:8078/api/v1/sources/claude-code' | jq

# 2b. Qoder request-level estimated usage rows
curl 'http://localhost:8078/api/v1/qoder/usage?limit=7' | jq

# 3. Force-sync a source (skips cache, reparses)
curl -X POST 'http://localhost:8078/api/v1/sources/claude-code/sync' \
  -H 'content-type: application/json' \
  -d '{"force":true}' | jq

# 4. List newest sessions
curl 'http://localhost:8078/api/v1/sessions?source=claude-code&limit=5' | jq

# 5. Pull a session's turns (replace SID with a real id from above)
curl 'http://localhost:8078/api/v1/sessions/SID/turns' | jq '.turns | length'

# 6. Same as (4) but through the BFF — should match modulo limit cap
curl 'http://localhost:3000/api/agent-tools/claude-code/sessions?limit=5' | jq

# 7. Subscribe to live invalidations (Ctrl+C to stop)
curl -N 'http://localhost:3000/api/agent-tools/claude-code/events'
```

For a deeper guide to what each endpoint actually does internally, see [`services/ingest.md`](services/ingest.md) (parser/sync/SSE) and [`services/frontend.md`](services/frontend.md) (BFF adapters and React hooks).
