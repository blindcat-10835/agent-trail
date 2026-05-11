# Phase 2: Local Ingest Core + OpenClaw Parser - Research

**Researched:** 2026-05-06
**Domain:** Independent Node/TypeScript ingest service with SQLite indexing and OpenClaw parser
**Confidence:** HIGH

## Summary

Phase 2 builds the foundational ingest service that transforms request-time JSONL scanning into a proper indexed, queryable data layer. The research confirms that an independent Node/TypeScript service with SQLite storage is the correct architectural approach, validated by agentsview's proven Go implementation. OpenClaw parsing is well-understood with clear behavioral references, and better-sqlite3 provides the synchronous SQLite API needed for a single-threaded local service.

The phase delivers four core capabilities: (1) ingest service foundation with HTTP endpoints, (2) SQLite schema adapted from agentsview, (3) OpenClaw source discovery and parser, and (4) REST API with turn-first DTOs. The SSE skeleton is intentionally minimal—connectable but not pushing real data—leaving full real-time sync for Phase 6.

**Primary recommendation:** Implement ingest/ as a pnpm workspace package with Hono HTTP framework, better-sqlite3 for SQLite, and use concurrently to run both Next.js and ingest services during development.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Source file discovery | API / Backend (ingest service) | — | Requires filesystem access and long-running process lifecycle |
| JSONL parsing | API / Backend (ingest service) | — | CPU-intensive parsing shouldn't block Next.js request handlers |
| SQLite indexing | API / Backend (ingest service) | — | Database writes need transactional consistency independent of web server |
| REST API delivery | API / Backend (ingest service) | — | Dedicated data service endpoint separate from Next.js frontend routes |
| SSE event streaming | API / Backend (ingest service) | — | Server-sent events require persistent connections, not request/response cycles |
| OpenClaw Gateway connection | Browser / Client | — | WebSocket for live agent state, preserved from existing architecture |

## User Constraints (from CONTEXT.md)

### Locked Decisions

### Ingest Service Architecture
- **D-01:** HTTP framework selection is Claude's discretion. Should be lightweight, TypeScript-native, with modern routing API.
- **D-02:** `ingest/` uses modular subdirectories by responsibility: `config/`, `db/`, `parser/`, `api/`, `sync/`, `types/`. Aligns with agentsview Go's `internal/` structure. Extensible for Phase 3 Claude/Codex parsers.
- **D-03:** Workspace relationship (pnpm workspace member vs independent package) is Claude's discretion. Must enable shared access to `types/trace.ts`.

### SQLite Schema & Data Layer
- **D-04:** Adapt agentsview's proven schema directly — `sessions`, `messages`, `tool_calls`, `tool_result_events` tables plus a new `turns` table. Field naming style adjusts to TypeScript conventions (camelCase). Not a full redesign.
- **D-05:** Use `better-sqlite3` as the SQLite driver. Synchronous API, best performance, zero configuration. Matches the local single-threaded service model.
- **D-06:** Skip migration infrastructure for Phase 2. Single init schema from SQL file. Migration tooling added in Phase 6 hardening.

### API Design & Turn Boundary
- **D-07:** REST endpoints follow agentsview-compatible structure with turns extension: `GET /api/v1/sessions`, `GET /api/v1/sessions/:id`, `GET /api/v1/sessions/:id/turns`, `GET /api/v1/sessions/:id/messages`, `GET /api/v1/sessions/:id/tool-calls`, `GET /api/v1/events` (SSE skeleton).
- **D-08:** Phase 2 turn assembly does basic grouping only — user message opens a new turn, subsequent assistant/tool_result messages belong to that turn. Complex boundary handling (compact, queued commands, system messages, multi-turn tool call pairing) deferred to Phase 3. Sufficient to validate turn-first DTO feasibility.
- **D-09:** SSE endpoint exists as skeleton (connectable, returns heartbeat), but does not push real data changes. Watcher + real SSE push implemented in Phase 6.

### Development Workflow
- **D-10:** Use `concurrently` to run Next.js and ingest service in a single terminal via `pnpm dev`. One command to start full development environment.
- **D-11:** Ingest service defaults to `localhost:8078`. Configurable via environment variable.

### Claude's Discretion
- HTTP framework selection (Hono, Express, or bare Node:http)
- ingest/ workspace relationship with main project (pnpm workspace member vs independent package)
- Source discovery implementation details (default path detection, env/config override mechanism)
- SQLite database file location
- Session ID generation format (path hash, content header, prefix strategy)
- Parse error reporting and logging verbosity
- OpenClaw parser internal implementation details (line-by-line streaming vs batch, error recovery strategy)

### Deferred Ideas (OUT OF SCOPE)
- File watcher / chokidar integration — Phase 6 (DATA-04)
- SSE real push and invalidation — Phase 6 (DATA-06)
- Full turn assembly (compact boundary, queued commands, system message handling, multi-turn tool call pairing) — Phase 3 (TURN-01 through TURN-06)
- Migration infrastructure — Phase 6 hardening
- Frontend integration with ingest API — Phase 4 (UI-05)
- API safety constraints (path whitelisting, no arbitrary file reads) — Phase 6 (DATA-07)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | 新增独立 Node/TypeScript ingest 服务，可启动 health/version/sources/events API | Standard stack section details Hono/Express options, better-sqlite3 integration, port 8078 default |
| DATA-02 | ingest service 使用 SQLite WAL/FTS5 存储本地索引 | SQLite Schema section adapts agentsview schema with camelCase, better-sqlite3 synchronous API |
| DATA-03 | ingest service 支持 OpenClaw、Claude Code、Codex 的默认目录发现 | OpenClaw Parser section covers source discovery patterns from agentsview reference |
| DATA-05 | ingest service 暴露 REST API：sources、sessions、session detail、turns、messages、tools、children、search、sync/resync | API Design section documents endpoints matching agentsview structure with turns extension |
| SRC-01 | OpenClaw parser 支持 session header、message、toolResult role、usage 字段归一化、agent 子目录 session id 和 archive suffix 处理 | OpenClaw Parser section details parsing strategy from agentsview Go reference |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **better-sqlite3** | 12.9.0 | SQLite database driver | Synchronous API, best performance for single-threaded local service, zero configuration, proven in production [VERIFIED: npm registry] |
| **Hono** | 4.12.17 | HTTP framework for ingest service | Lightweight, TypeScript-native, modern routing, excellent Edge Runtime compatibility, smaller than Express [VERIFIED: npm registry] |
| **concurrently** | 9.2.1 | Run Next.js + ingest service together | Single terminal development workflow, standard pattern for multi-process dev environments [VERIFIED: npm registry] |
| **zod** | latest | Runtime validation for API DTOs | Type-safe validation, prevents malformed API responses, standard for TypeScript services [ASSUMED] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@types/better-sqlite3** | 7.6.13 | TypeScript types for better-sqlite3 | Type safety for database operations [VERIFIED: npm registry] |
| **readline** | built-in | Line-by-line JSONL streaming | Proven pattern from lib/parseFixture.ts, memory-efficient for large files [VERIFIED: Node.js built-in] |
| **vitest** | 4.1.5 | Test framework | Already configured in project, matches Phase 1 test infrastructure [VERIFIED: package.json] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hono | Express | Hono is lighter (~200KB vs 1MB+), modern API, better TypeScript. Express has larger ecosystem but adds weight for simple REST API |
| better-sqlite3 | node-sqlite3 / sql.js | better-sqlite3 has synchronous API (simpler), best performance. node-sqlite3 is async-only. sql.js is WASM (overkill for local service) |
| pnpm workspace | Lerna / npm workspaces | pnpm already used in project, workspace features are mature. Lerna adds complexity. npm workspaces less efficient |

**Installation:**

```bash
# Core ingest service dependencies
pnpm add better-sqlite3 hono zod
pnpm add -D @types/better-sqlite3 concurrently

# For pnpm workspace member approach (if chosen)
# Add ingest/ to pnpm-workspace.yaml packages array
```

**Version verification:** All versions verified current as of 2026-05-06 via npm view.

## Architecture Patterns

### System Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                         Development Workflow                     │
│                                                                   │
│  $ pnpm dev                                                       │
│     │                                                            │
│     ├──> concurrently Process 1: Next.js (port 3000)            │
│     │      ├─ Frontend UI: Shell/Dashboard/Sessions             │
│     │      ├─ OpenClaw Gateway WebSocket (ws://localhost:18789) │
│     │      └─ API Routes (legacy proxy during transition)       │
│     │                                                            │
│     └──> concurrently Process 2: Ingest Service (port 8078)     │
│            ├─ HTTP Server: Hono REST API                        │
│            ├─ SQLite Database: better-sqlite3                    │
│            ├─ OpenClaw Parser: JSONL → TraceSession             │
│            └─ SSE Skeleton: /events heartbeat endpoint           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Ingest Service Architecture                  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                   HTTP Layer (Hono)                     │     │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │     │
│  │  │ /health  │ │ /sources │ │/sessions │ │ /events  │ │     │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │     │
│  └───────────────────────┬──────────────────────────────┘     │
│                          │                                      │
│  ┌───────────────────────▼──────────────────────────────┐     │
│  │                  API Handlers                         │     │
│  │  SessionsRequestHandler → TurnsRequestHandler         │     │
│  └───────────────────────┬──────────────────────────────┘     │
│                          │                                      │
│  ┌───────────────────────▼──────────────────────────────┐     │
│  │              Parser Layer (OpenClaw)                  │     │
│  │  ┌──────────────────────────────────────────────┐   │     │
│  │  │ 1. Source Discovery: ~/.openclaw/agents/*   │   │     │
│  │  │ 2. File Reading: readline JSONL streaming   │   │     │
│  │  │ 3. Parse Lines: session header, messages   │   │     │
│  │  │ 4. Tool Pairing: toolResult ↔ tool calls   │   │     │
│  │  │ 5. Turn Assembly: user → assistant grouping│   │     │
│  │  └──────────────────────────────────────────────┘   │     │
│  └───────────────────────┬──────────────────────────────┘     │
│                          │                                      │
│  ┌───────────────────────▼──────────────────────────────┐     │
│  │           Data Layer (better-sqlite3)                 │     │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│     │
│  │  │ sessions │ │ messages │ │tool_calls│ │  turns  ││     │
│  │  └──────────┘ └──────────┘ └──────────┘ └─────────┘│     │
│  │           SQLite WAL mode, FTS5 full-text search     │     │
│  └──────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```text
ingest/
├── package.json              # Workspace member or standalone
├── tsconfig.json             # Extends root tsconfig.json
├── src/
│   ├── main.ts               # Entry point: HTTP server startup
│   ├── config/
│   │   ├── paths.ts          # Default paths, env override
│   │   └── sources.ts        # Source registry (openclaw only)
│   ├── db/
│   │   ├── connection.ts     # better-sqlite3 singleton
│   │   ├── schema.sql        # Initial schema from agentsview
│   │   ├── sessions.ts       # Session CRUD operations
│   │   ├── turns.ts          # Turn assembly queries
│   │   └── migrations.ts     # Placeholder for Phase 6
│   ├── parser/
│   │   ├── types.ts          # Parser input/output types
│   │   ├── openclaw.ts       # OpenClaw JSONL parser
│   │   └── turn-assembler.ts # Basic user → assistant grouping
│   ├── api/
│   │   ├── server.ts         # Hono app setup, middleware
│   │   ├── routes.ts         # Route handlers: health, sources, sessions
│   │   ├── handlers/
│   │   │   ├── sessions.ts   # GET /api/v1/sessions, /sessions/:id
│   │   │   ├── turns.ts      # GET /api/v1/sessions/:id/turns
│   │   │   └── events.ts     # SSE skeleton /api/v1/events
│   │   └── dto.ts            # API response DTOs (TurnDTO, SessionDTO)
│   ├── sync/
│   │   ├── engine.ts         # Sync orchestration (Phase 6)
│   │   └── watcher.ts        # File watching placeholder (Phase 6)
│   └── types/
│       └── api.ts            # Request/response types
├── tests/
│   ├── integration/
│   │   ├── api.test.ts       # API endpoint tests
│   │   └── parser.test.ts    # Parser tests with fixtures
│   └── fixtures/
│       └── openclaw/         # JSONL fixtures from Phase 1
│
# Root project changes
package.json                   # Add concurrently to devDependencies
pnpm-workspace.yaml           # Add "ingest" to packages array (if workspace)
.pnpmfile.cjs                 # If using workspace, shared config
```

### Pattern 1: Hono HTTP Service

**What:** Lightweight HTTP framework with modern routing, TypeScript-first design, and excellent Edge Runtime compatibility.

**When to use:** Building the ingest service REST API. Hono provides router, middleware, and context with minimal overhead (~200KB vs Express 1MB+).

**Example:**

```typescript
// ingest/src/api/server.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', version: '0.1.0' });
});

// API routes
app.route('/api/v1', routes);

export default app;
```

**Source:** [Hono documentation](https://hono.dev/docs) - Getting started, routing, middleware patterns

### Pattern 2: better-sqlite3 Synchronous Database

**What:** Synchronous SQLite driver with prepared statements, transactions, and WAL mode support.

**When to use:** All database operations in the ingest service. Synchronous API simplifies code compared to async database drivers, and single-threaded local service doesn't benefit from async I/O.

**Example:**

```typescript
// ingest/src/db/connection.ts
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

const DB_PATH = process.env.INGEST_DB_PATH || join(process.cwd(), 'ingest.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    // Initialize schema
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    db.exec(schema);
  }
  return db;
}
```

**Source:** [better-sqlite3 docs](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md) - Database opening, WAL mode, prepared statements

### Pattern 3: OpenClaw JSONL Line-by-Line Parsing

**What:** Streaming JSONL parser using readline interface for memory-efficient processing of large session files.

**When to use:** Parsing OpenClaw session files. Pattern already proven in lib/parseFixture.ts from Phase 1.

**Example:**

```typescript
// ingest/src/parser/openclaw.ts
import { createInterface } from 'readline';
import { createReadStream } from 'fs';

interface ParseResult {
  sessionId: string;
  messages: ParsedMessage[];
  malformedLines: number;
}

export async function parseOpenClawSession(filePath: string): Promise<ParseResult> {
  const messages: ParsedMessage[] = [];
  let malformedLines = 0;
  let sessionId = '';

  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      // Extract session header
      if (entry.type === 'session' && !sessionId) {
        sessionId = entry.id;
        continue;
      }

      // Parse message entries
      if (entry.type === 'message' && entry.message) {
        messages.push({
          role: entry.message.role,
          content: entry.message.content,
          timestamp: entry.timestamp || entry.message.timestamp,
          ordinal: messages.length
        });
      }
    } catch (err) {
      malformedLines++;
      console.warn(`[OpenClawParser] Malformed line: ${err}`);
    }
  }

  return { sessionId, messages, malformedLines };
}
```

**Source:** [Verified: lib/parseFixture.ts] - Existing streaming pattern from Phase 1

### Pattern 4: Turn-First DTO Assembly

**What:** Group messages into turns where each user message opens a new turn, collecting subsequent assistant/tool_result messages.

**When to use:** Building turn-first API responses. This is Phase 2's basic grouping; Phase 3 will add complex boundary handling.

**Example:**

```typescript
// ingest/src/parser/turn-assembler.ts
import { TraceTurn, TraceMessage } from '@/types/trace';

export function assembleBasicTurns(messages: TraceMessage[]): TraceTurn[] {
  const turns: TraceTurn[] = [];
  let currentTurn: TraceTurn | null = null;

  for (const message of messages) {
    if (message.role === 'user') {
      // Close previous turn
      if (currentTurn) {
        turns.push(currentTurn);
      }

      // Start new turn
      currentTurn = {
        id: `turn-${message.ordinal}`,
        index: turns.length,
        user: message,
        assistant: null,
        activities: [],
        startedAt: message.timestamp,
        endedAt: null
      };
    } else if (currentTurn && (message.role === 'assistant' || message.role === 'tool_result')) {
      // Add to current turn
      if (message.role === 'assistant') {
        currentTurn.assistant = message;
      }
      currentTurn.activities.push({
        type: message.role,
        content: message.content,
        timestamp: message.timestamp
      });
      currentTurn.endedAt = message.timestamp;
    }
  }

  // Don't forget the last turn
  if (currentTurn) {
    turns.push(currentTurn);
  }

  return turns;
}
```

**Source:** [Verified: CONTEXT.md D-08] - Phase 2 turn assembly specification

### Anti-Patterns to Avoid

- **Request-time file scanning:** Don't implement session parsing inside API route handlers. Parse once, store in SQLite, serve from index.
- **Async database in sync service:** Don't use async database drivers (node-sqlite3) in single-threaded ingest service. Use better-sqlite3 synchronous API.
- **Monolithic parser file:** Don't put all source parsers in one 500-line file. Use modular structure: `parser/openclaw.ts`, `parser/claude.ts`, `parser/codex.ts` for Phase 3 extensibility.
- **Hardcoded paths:** Don't hardcode `/Users/xxx/.openclaw/agents`. Support env override (OPENCLAW_DIR) and default path detection.
- **Returning raw database rows:** Don't return SQLite rows directly from API. Transform to DTOs first for API stability.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP routing framework | Custom request router with switch statements | Hono / Express | Routing, middleware, error handling, CORS already solved |
| JSON parsing | Hand-rolled JSON parser with error recovery | Built-in JSON.parse + try/catch | Standard library is battle-tested, faster |
| Database queries | String concatenation for SQL | Prepared statements in better-sqlite3 | SQL injection prevention, automatic escaping |
| Line-by-line file reading | Chunked buffer reading with manual newline detection | Node.js readline + createReadStream | Memory-efficient, handles large files, proven pattern |
| Turn assembly logic | Complex state machines for message grouping | Linear scan with role-based grouping | Phase 2 basic grouping is simple, Phase 3 will add complexity |
| Test framework | Custom test runner | Vitest (already in project) | Faster, Jest-compatible, watch mode, TypeScript support |

**Key insight:** The ingest service is a data pipeline problem with well-solved subproblems. Focus architectural energy on parser correctness and data model integrity, not reinventing HTTP servers or database drivers.

## Runtime State Inventory

> This section is omitted for Phase 2 (greenfield implementation). No rename/refactor/migration scope requiring runtime state audit.

## Common Pitfalls

### Pitfall 1: Confusing Ingest Service with Next.js API Routes

**What goes wrong:** Implementing ingest logic inside `app/api/ingest/*/route.ts` instead of an independent service. This couples data indexing to web server lifecycle, breaking on HMR and restart.

**Why it happens:** Familiarity with Next.js API Routes, desire to avoid "yet another process."

**How to avoid:**
- ingest/ must be a separate Node process with its own package.json or workspace entry.
- Use concurrently to run both: `"dev": "concurrently \"next dev\" \"node ingest/src/main.ts\""`
- Ingest service listens on different port (default 8078), not proxied through Next.js.

**Warning signs:** Finding yourself writing `export async function GET()` for session parsing logic. Database opening code in `app/api/`.

### Pitfall 2: Async Database Operations in Single-Threaded Service

**What goes wrong:** Using async database drivers (node-sqlite3, sequelize, TypeORM) adds complexity without benefit. Event loop overhead without actual concurrency gains.

**Why it happens:** JavaScript async/await is default habit, most database tutorials use async drivers.

**How to avoid:**
- Use better-sqlite3 with synchronous API: `db.prepare(sql).get(id)` not `await db.query(sql, [id])`.
- All database operations should be sync: parsing, writing, querying.
- Only HTTP server remains async (Hono handles this).

**Warning signs:** Database functions returning Promise, `.then()` chains in data layer, `await` in parser code.

### Pitfall 3: OpenClaw toolResult Role Not Paired with Tool Calls

**What goes wrong:** Treating `role: "toolResult"` as a standalone message instead of pairing it with the corresponding tool call. This breaks tool call replay UI.

**Why it happens:** OpenClaw's JSONL format has toolResult as a separate message entry with toolCallId reference. Lazy parsing might miss this linkage.

**How to avoid:**
- Parse toolResult entries separately, extract toolCallId, match to previous tool_use_id.
- Store tool results in tool_result_events table, not as messages.
- Reference implementation: `../references/agentsview/internal/parser/openclaw.go` lines 150-200.

**Warning signs:** Tool calls in UI showing "no result", toolResult messages appearing as user text, mismatched tool results.

### Pitfall 4: Loading Entire JSONL File into Memory

**What goes wrong:** Using `fs.readFileSync(file, 'utf-8').split('\n')` to read session files. Large sessions (1000+ messages) cause memory spikes and slow parsing.

**Why it happens:** Simple implementation, works for small test fixtures.

**How to avoid:**
- Use readline + createReadStream for streaming line-by-line parsing.
- Process one line, emit/insert, discard. Never hold entire file in memory.
- Pattern already proven in lib/parseFixture.ts.

**Warning signs:** Memory usage growing linearly with session file size, long GC pauses during parsing.

### Pitfall 5: Hardcoded Session ID Format

**What goes wrong:** Assuming session IDs are always UUIDs or always follow a specific pattern. OpenClaw uses `agent:{agentName}:{uuid}`, Claude uses plain UUIDs, Codex uses `codex:{uuid}`.

**Why it happens:** Testing only with OpenClaw fixtures, not considering multi-source architecture.

**How to avoid:**
- Use source-specific ID prefixes: `openclaw:`, `claude-code:`, `codex:`.
- Don't parse or validate UUID format unless extracting UUID from prefixed ID.
- Store source_session_id separately from canonical id.

**Warning signs:** Session ID validation regex, UUID parsing errors, cross-source ID collisions.

### Pitfall 6: Missing Malformed Line Counting

**What goes wrong:** Parser throws on first malformed JSON line, failing entire session import. Or silently skips errors without tracking, making debugging impossible.

**Why it happens:** Treating JSONL as strictly valid, or using try/catch without logging/counting.

**How to avoid:**
- Wrap JSON.parse in try/catch, increment malformedLines counter, continue parsing.
- Log malformed line content for debugging.
- Store parser_malformed_lines in sessions table for visibility.

**Warning signs:** Parser crashes on trailing commas, test fixtures with intentional bad JSON passing without error tracking.

## Code Examples

### Basic Turn Assembly (Phase 2 Simplified)

```typescript
// ingest/src/parser/turn-assembler.ts
import { TraceTurn, TraceMessage } from '@/types/trace';

/**
 * Basic turn assembly for Phase 2
 * Groups messages into turns: user message opens turn, collects subsequent assistant/tool_result messages
 *
 * Phase 3 will handle: compact boundaries, queued commands, system messages, multi-turn tool pairing
 *
 * @param messages - Chronologically ordered messages from parser
 * @returns Array of turns with user/assistant/activities
 */
export function assembleBasicTurns(messages: TraceMessage[]): TraceTurn[] {
  const turns: TraceTurn[] = [];
  let currentTurn: Partial<TraceTurn> | null = null;

  for (const message of messages) {
    if (message.role === 'user') {
      // Finalize previous turn
      if (currentTurn?.user && currentTurn.index !== undefined) {
        turns.push(currentTurn as TraceTurn);
      }

      // Start new turn
      currentTurn = {
        id: `turn-${message.ordinal}`,
        index: turns.length,
        user: message,
        assistant: null,
        activities: [],
        startedAt: message.timestamp,
        endedAt: null
      };
    } else if (currentTurn && message.role === 'assistant') {
      // First assistant response ends turn start time
      currentTurn.assistant = message;
      if (!currentTurn.startedAt) {
        currentTurn.startedAt = message.timestamp;
      }
      currentTurn.endedAt = message.timestamp;
    } else if (currentTurn && (message.role === 'tool' || message.role === 'tool_result')) {
      // Tool activities belong to current turn
      currentTurn.activities?.push({
        type: 'tool_call',
        content: message.content,
        timestamp: message.timestamp
      });
      currentTurn.endedAt = message.timestamp;
    }
  }

  // Don't forget the last turn
  if (currentTurn?.user && currentTurn.index !== undefined) {
    turns.push(currentTurn as TraceTurn);
  }

  return turns;
}
```

**Source:** [Verified: CONTEXT.md D-08] - Phase 2 turn assembly specification

### OpenClaw Parser Entry Point

```typescript
// ingest/src/parser/openclaw.ts
import { createInterface } from 'readline';
import { createReadStream } from 'fs';
import { TraceSession, TraceMessage, TraceSource } from '@/types/trace';

interface ParseOptions {
  filePath: string;
  agentName?: string;  // e.g., "blue", "claude"
  project?: string;
}

export async function parseOpenClawSession(options: ParseOptions): Promise<TraceSession> {
  const { filePath, agentName = 'unknown', project = 'default' } = options;

  const messages: TraceMessage[] = [];
  let malformedLines = 0;
  let sessionId = '';
  let sessionStartedAt: string | null = null;
  let sessionEndedAt: string | null = null;

  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      // Session header
      if (entry.type === 'session') {
        sessionId = entry.id || sessionId;
        sessionStartedAt = entry.started_at || sessionStartedAt;
        continue;
      }

      // Message entry
      if (entry.type === 'message' && entry.message) {
        const msg = entry.message;
        messages.push({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          timestamp: entry.timestamp || msg.timestamp,
          ordinal: messages.length,
          source: 'openclaw' as TraceSource
        });

        // Track session bounds
        const ts = entry.timestamp || msg.timestamp;
        if (ts) {
          if (!sessionStartedAt) sessionStartedAt = ts;
          sessionEndedAt = ts;
        }
      }

      // Metadata entries (compact, model_change, etc.) - skip for Phase 2

    } catch (err) {
      malformedLines++;
      console.warn(`[OpenClawParser] Malformed JSON at line ${messages.length + malformedLines}: ${err}`);
    }
  }

  // Generate session ID with agent prefix
  const canonicalId = sessionId ? `openclaw:${agentName}:${sessionId}` : `openclaw:${agentName}:${Date.now()}`;

  return {
    id: canonicalId,
    source: 'openclaw' as TraceSource,
    project,
    startedAt: sessionStartedAt,
    endedAt: sessionEndedAt,
    status: sessionEndedAt ? 'completed' : 'running',
    metrics: {
      messageCount: messages.length,
      userMessageCount: messages.filter(m => m.role === 'user').length,
      hasToolCalls: messages.some(m => m.role === 'tool'),
      terminationStatus: 'unknown',
      parserMalformedLines: malformedLines,
      isTruncated: false
    },
    turns: []  // Turn assembly happens in separate layer
  };
}
```

**Source:** [Verified: lib/parseFixture.ts] - Streaming pattern; [CITED: ../references/agentsview/internal/parser/openclaw.go] - OpenClaw parsing logic

### REST API Handler Example

```typescript
// ingest/src/api/handlers/sessions.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../db/connection';

const sessionsRouter = new Hono();

// GET /api/v1/sessions
sessionsRouter.get('/', async (c) => {
  const db = getDb();

  // Query params with validation
  const schema = z.object({
    source: z.enum(['openclaw', 'claude-code', 'codex']).optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0)
  });

  const params = schema.parse(c.req.query());

  // Build query
  let query = 'SELECT * FROM sessions';
  const conditions: string[] = [];
  const queryParams: any[] = {};

  if (params.source) {
    conditions.push('source = :source');
    queryParams.source = params.source;
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY started_at DESC LIMIT :limit OFFSET :offset';
  queryParams.limit = params.limit;
  queryParams.offset = params.offset;

  const sessions = db.prepare(query).all(queryParams);

  return c.json({
    sessions,
    pagination: {
      limit: params.limit,
      offset: params.offset,
      total: sessions.length
    }
  });
});

// GET /api/v1/sessions/:id
sessionsRouter.get('/:id', async (c) => {
  const db = getDb();
  const sessionId = c.req.param('id');

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  return c.json(session);
});

export default sessionsRouter;
```

**Source:** [CITED: Hono docs] - Router pattern; [VERIFIED: agentsview reference] - Session query structure

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Request-time JSONL scanning | Indexed SQLite database | Phase 2 | Parse once, query many. Enables search, filtering, pagination. |
| Message-only API responses | Turn-first DTOs | Phase 2 | UI displays user → assistant → tools as single unit, not disconnected messages. |
| Single-process Next.js | Hybrid Next.js + ingest service | Phase 2 | Decouples data indexing from web server, independent scaling/lifecycle. |
| Async database drivers | better-sqlite3 synchronous | Phase 2 | Simpler code, better performance for single-threaded local service. |
| No SSE skeleton | Connectable SSE endpoint | Phase 2 | Frontend can establish EventSource, real push deferred to Phase 6. |

**Deprecated/outdated:**
- **`app/api/sessions/messages/route.ts`** - Legacy OpenClaw file scanner. Should be deprecated or proxied to ingest API in Phase 2.
- **In-memory message caching** - No longer needed with SQLite indexing.
- **JSONL parsing on every request** - Replaced by parse-once, store-forever pattern.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Hono framework is suitable for ingest service REST API | Standard Stack | Hono may lack middleware ecosystem. If wrong, switch to Express (cost: ~2 days rewrite). |
| A2 | better-sqlite3 synchronous API won't block event loop | Standard Stack | If parsing is CPU-bound, may need async driver. Test with large sessions in Phase 2. |
| A3 | pnpm workspace member approach is feasible for ingest/ | Architecture Patterns | Workspace config may be complex. If wrong, use standalone package with shared types (cost: ~1 day restructure). |
| A4 | OpenClaw session files always have `type: "session"` header | OpenClaw Parser | If old files lack headers, need fallback ID generation. Validate against fixtures. |
| A5 | Basic turn assembly (user → assistant grouping) is sufficient for Phase 2 | Code Examples | If UI needs complex boundaries earlier, may need to port Phase 3 logic. Monitor frontend feedback. |
| A6 | SQLite default location (project root ingest.db) is acceptable | Don't Hand-Roll | Users may want configurable location. Add INGEST_DB_PATH env var support. |
| A7 | Port 8078 won't conflict with common services | Development Workflow | If conflict occurs, make configurable via INGEST_PORT env var. |
| A8 | SSE skeleton with heartbeat is enough for Phase 2 | Common Pitfalls | If frontend expects real events, document clearly that push is Phase 6. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **Workspace relationship final decision**
   - What we know: D-03 leaves workspace vs standalone package to discretion. pnpm workspace enables shared types but adds config complexity.
   - What's unclear: Whether `ingest/` should import `@/types/trace` directly or copy types.
   - Recommendation: Start with workspace member for shared types. If workspace config proves problematic, fall back to type copying (estimated cost: 1 day migration).

2. **OpenClaw source discovery priority**
   - What we know: Current `app/api/sessions/messages/route.ts` derives paths from WORKSPACE_PATH env var. agentsview uses `~/.openclaw/agents` with env override.
   - What's unclear: Should ingest service support multiple OpenClaw installations, or single default path?
   - Recommendation: Phase 2 implements single default path (`~/.openclaw/agents`) with `OPENCLAW_DIR` override. Multi-source support deferred to Phase 6.

3. **Session ID generation for malformed files**
   - What we know: OpenClaw files should have session header with UUID. But fixtures may be incomplete.
   - What's unclear: What's the fallback ID generation strategy?
   - Recommendation: Use `openclaw:{agentName}:{fileHash}` or `openclaw:{agentName}:{timestamp}`. Decide during implementation based on fixture testing.

4. **SSE skeleton implementation detail**
   - What we know: D-09 requires connectable SSE endpoint returning heartbeat. Real push deferred to Phase 6.
   - What's unclear: Should SSE return any structured metadata (e.g., current sync state) or just empty heartbeat?
   - Recommendation: Return minimal heartbeat: `{ type: 'heartbeat', timestamp: ISO }`. Frontend uses connection success as ingest health check.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Ingest service runtime | ✓ | v24.14.0 | — |
| pnpm | Package manager | ✓ | 10.33.0 | — |
| better-sqlite3 | SQLite driver | ✓ | 12.9.0 available | — |
| @types/better-sqlite3 | TypeScript types | ✓ | 7.6.13 available | — |
| Hono | HTTP framework | ✓ | 4.12.17 available | — |
| concurrently | Dev workflow | ✓ | 9.2.1 available | — |
| SQLite3 CLI | Manual database inspection | ✓ | 3.50.2 | Not required for runtime |
| OpenClaw Gateway | Live overview (preserved) | ✓ | ws://localhost:18789 | Not required for ingest |
| Fixtures | Parser testing | ✓ | fixtures/openclaw/*.jsonl | — |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:** None

**Notes:**
- All core dependencies verified available via npm registry as of 2026-05-06
- Existing test infrastructure (Vitest) from Phase 1 is reusable
- OpenClaw fixtures (conversation.jsonl, tool-call.jsonl) exist from Phase 1
- SQLite3 CLI available for manual database debugging during development

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test -- tests/integration/api.test.ts` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Ingest service starts, serves health/version/sources endpoints | integration/smoke | `pytest tests/integration/api.test.ts::test_health_endpoint -x` | ❌ Wave 0 |
| DATA-01 | Ingest service runs independently from Next.js | integration | `pytest tests/integration/concurrent.test.ts::test_concurrent_startup -x` | ❌ Wave 0 |
| DATA-02 | SQLite schema initializes with all required tables | unit | `pytest tests/unit/db.test.ts::test_schema_init -x` | ❌ Wave 0 |
| DATA-02 | Sessions/messages/tool_calls/turns CRUD operations work | unit | `pytest tests/unit/db.test.ts::test_session_crud -x` | ❌ Wave 0 |
| DATA-03 | OpenClaw source discovery finds agent directories | integration | `pytest tests/integration/sources.test.ts::test_openclaw_discovery -x` | ❌ Wave 0 |
| DATA-05 | REST API returns session list with pagination | integration | `pytest tests/integration/api.test.ts::test_sessions_list -x` | ❌ Wave 0 |
| DATA-05 | REST API returns turn-first DTOs for session | integration | `pytest tests/integration/api.test.ts::test_session_turns -x` | ❌ Wave 0 |
| SRC-01 | OpenClaw parser extracts session header and messages | unit | `pytest tests/unit/parser.test.ts::test_openclaw_session_header -x` | ❌ Wave 0 |
| SRC-01 | OpenClaw parser pairs toolResult with tool calls | unit | `pytest tests/unit/parser.test.ts::test_tool_result_pairing -x` | ❌ Wave 0 |
| SRC-01 | OpenClaw parser handles malformed lines gracefully | unit | `pytest tests/unit/parser.test.ts::test_malformed_lines -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test -- tests/integration/api.test.ts` (subset: health + sessions list)
- **Per wave merge:** `pnpm test:run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/integration/api.test.ts` — covers DATA-01, DATA-05 endpoint testing
- [ ] `tests/integration/sources.test.ts` — covers DATA-03 source discovery
- [ ] `tests/unit/db.test.ts` — covers DATA-02 SQLite operations
- [ ] `tests/unit/parser.test.ts` — covers SRC-01 parser behavior
- [ ] `tests/integration/concurrent.test.ts` — verifies concurrently runs both services
- [ ] Ingest service main.ts stub for testing — Hono app entry point
- [ ] Test fixtures setup — sample OpenClaw JSONL files

**Framework status:** Vitest 4.1.5 already configured. No additional install needed.

## Security Domain

> Note: Phase 2 focuses on local ingest foundation. API safety constraints (path whitelisting, input validation) are deferred to Phase 6 (DATA-07). Basic security practices still apply.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local service, no auth in Phase 2 |
| V3 Session Management | no | No user sessions |
| V4 Access Control | no | Single-user local service |
| V5 Input Validation | yes | Zod schema validation on API inputs, session ID sanitization |
| V6 Cryptography | no | No encryption requirements for local SQLite |

### Known Threats for Local Ingest Service

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via session ID | Tampering | Validate session IDs format, reject paths with `..`, database lookup only (no direct file access from API) |
| SQL injection in queries | Tampering | Use prepared statements in better-sqlite3, never string concatenation for WHERE clauses |
| Malformed JSON causing DoS | Denial of Service | Line-by-line streaming parser, limit max line size, timeout on long-running parses |
| Arbitrary file read via source path | Tampering | Source discovery restricted to configured base paths, env var validation, reject absolute paths from API input |
| Memory exhaustion from large files | Denial of Service | Streaming readline (not fs.readFile), optional file size limits |

**Phase 6 hardening** will add:
- DATA-07: API path whitelisting, no arbitrary file reads
- HARD-03: Path safety constraints, sanitization
- HARD-04: Privacy defaults (no upload, no public sharing)

Phase 2 scope validates inputs but doesn't implement full security hardening.

## Sources

### Primary (HIGH confidence)

- **[VERIFIED: npm registry]** better-sqlite3 version 12.9.0 - Confirmed current package version
- **[VERIFIED: npm registry]** Hono version 4.12.17 - Confirmed current package version
- **[VERIFIED: npm registry]** concurrently version 9.2.1 - Confirmed current package version
- **[VERIFIED: npm registry]** @types/better-sqlite3 version 7.6.13 - Confirmed TypeScript types available
- **[VERIFIED: lib/parseFixture.ts]** Existing Phase 1 streaming JSONL parser pattern - Line-by-line readline implementation
- **[CITED: types/trace.ts]** Canonical trace contract - TraceSession, TraceTurn, TraceMessage definitions
- **[CITED: ../references/agentsview/internal/db/schema.sql]** Proven SQLite schema - Sessions, messages, tool_calls, tool_result_events table structure
- **[CITED: ../references/agentsview/internal/parser/openclaw.go]** OpenClaw parser reference implementation - Session header parsing, toolResult handling, usage normalization

### Secondary (MEDIUM confidence)

- **[CITED: .planning/research/STACK.md]** Tech stack research - Independent Node/TypeScript ingest recommendation
- **[CITED: .planning/research/PITFALLS.md]** Domain pitfalls - Request-time scanning risks, parser error handling
- **[CITED: .planning/research/AGENTSVIEW-DATA-SCHEME.md]** agentsview analysis - Data pipeline architecture, parser registry patterns
- **[CITED: .planning/phases/02-design-tokens-theme/02-CONTEXT.md]** Phase 2 decisions - Locked decisions D-01 through D-11
- **[CITED: app/api/sessions/messages/route.ts]** Current OpenClaw scanner - Source discovery pattern from WORKSPACE_PATH

### Tertiary (LOW confidence)

- **[ASSUMED]** Hono framework suitability - Based on feature set and community adoption, not production-tested in this codebase yet
- **[ASSUMED]** pnpm workspace feasibility - Config complexity unknown, may need fallback to standalone package
- **[ASSUMED]** Port 8078 availability - No known conflicts documented, but not verified across user environments

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH - All package versions verified via npm registry. better-sqlite3 and Hono are mature, production-tested libraries.
- **Architecture:** HIGH - Based on agentsview proven implementation. Clear separation of concerns (HTTP → Parser → DB) validated by reference code.
- **Pitfalls:** HIGH - Risks well-documented in PITFALLS.md and existing codebase. Anti-patterns identified from current legacy implementation.
- **OpenClaw parsing:** HIGH - Reference implementation available in agentsview Go code. Fixture format understood from Phase 1.
- **SSE skeleton:** MEDIUM - Connectable endpoint requirement clear, but exact heartbeat structure not specified. Low risk, easily adjusted.
- **Workspace relationship:** MEDIUM - pnpm workspace recommended but technical feasibility not yet proven. Fallback to standalone package documented.

**Research date:** 2026-05-06
**Valid until:** 2026-06-05 (30 days - package versions and API patterns stable)

**Next steps for planner:**
1. Decide ingest/ workspace relationship using Assumptions Log #A1
2. Plan Hono route structure matching REST API endpoints
3. Design parser module structure for Phase 3 extensibility
4. Plan SQLite schema migration from agentsview Go to TypeScript conventions
