# Phase 2: Local Ingest Core + OpenClaw Parser - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 02-local-ingest-core-openclaw-parser
**Areas discussed:** Ingest service architecture, SQLite schema & data layer, API design & turn boundary, Development workflow

---

## Ingest Service Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Hono | Lightweight, TypeScript-native, modern routing API | |
| Express | Largest ecosystem, but types need extra config | |
| Node:http bare | Zero dependency, maximum control | |
| You decide | Let planner/researcher decide | ✓ |

**User's choice:** You decide (Claude's discretion)
**Notes:** User deferred framework selection to Claude. Hono is the likely recommendation given lightweight/typed nature.

| Option | Description | Selected |
|--------|-------------|----------|
| Modular subdirectories | config/db/parser/api/sync structure, extensible for Phase 3 | ✓ |
| Flat structure | All code in ingest/src/, simpler but won't scale | |
| You decide | Let planner decide | |

**User's choice:** Modular subdirectories
**Notes:** Explicit choice. Phase 3 will add Claude/Codex parsers into the modular structure.

| Option | Description | Selected |
|--------|-------------|----------|
| pnpm workspace member | Shared types/trace.ts via workspace, but adds complexity | |
| Independent package | Own package.json, relative path import for types | |
| You decide | Let planner decide | ✓ |

**User's choice:** You decide (Claude's discretion)
**Notes:** Key constraint is shared access to types/trace.ts.

---

## SQLite Schema & Data Layer

| Option | Description | Selected |
|--------|-------------|----------|
| Adapt agentsview schema | Reuse proven schema + add turns table, camelCase naming | ✓ |
| Fresh design | New schema from trace.ts types, more work to validate | |
| You decide | Let researcher compare | |

**User's choice:** Adapt agentsview schema
**Notes:** agentsview schema has been validated with production-scale data.

| Option | Description | Selected |
|--------|-------------|----------|
| better-sqlite3 | Synchronous, best performance, zero config | ✓ |
| Drizzle ORM | Type-safe query builder, adds abstraction layer | |
| You decide | Let planner decide | |

**User's choice:** better-sqlite3
**Notes:** Query patterns are simple (session list + detail + turns). Synchronous API fits local single-threaded model.

| Option | Description | Selected |
|--------|-------------|----------|
| SQL files + version tracking | Numbered migration files | |
| Skip for now | Single init schema, migration infra in Phase 6 | ✓ |
| You decide | Let planner decide | |

**User's choice:** Skip for now
**Notes:** Phase 2 only needs initial schema creation. Migration tooling deferred to Phase 6 hardening.

---

## API Design & Turn Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| agentsview compatible + turns | Same endpoints + /turns extension, easy to compare | ✓ |
| Fresh turn-first API | Completely new design, loses agentsview API comparison | |
| You decide | Let researcher analyze | |

**User's choice:** agentsview compatible + turns extension
**Notes:** Keeps ability to compare behavior with reference implementation.

| Option | Description | Selected |
|--------|-------------|----------|
| Basic turn grouping | User message boundaries only, edge cases in Phase 3 | ✓ |
| Full turn logic | Complete handling of compact/queued/system in Phase 2 | |
| You decide | Let planner define boundary | |

**User's choice:** Basic turn grouping
**Notes:** SC-5 requires turn-first DTOs, but full turn assembly is Phase 3 scope. Basic grouping validates the model.

| Option | Description | Selected |
|--------|-------------|----------|
| SSE skeleton (recommended) | Endpoint exists, connectable, no real push | ✓ |
| Full SSE + watcher | Complete real-time in Phase 2 | |
| You decide | Let planner decide | |

**User's choice:** SSE skeleton (after explanation)
**Notes:** User asked for detailed explanation of SSE and watcher roles before deciding. After understanding the flow (agent writes file → watcher detects → parser re-indexes → SSE pushes → frontend refreshes), user agreed skeleton is appropriate for Phase 2.

---

## Development Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| concurrently single terminal | One command runs both processes, mixed logs | ✓ |
| Separate terminals | Manual start, flexible but easy to forget | |
| You decide | Let planner decide | |

**User's choice:** concurrently single terminal

| Option | Description | Selected |
|--------|-------------|----------|
| localhost:3001 (recommended) | Adjacent to Next.js 3000 | |
| You decide | Let planner assign | |

**User's choice:** localhost:8078 (user-specified)
**Notes:** User explicitly chose port 8078 instead of the recommended 3001.

---

## Claude's Discretion

- HTTP framework selection (Hono / Express / bare Node:http)
- ingest/ workspace relationship with main project
- Source discovery strategy details
- DB file location
- Session ID generation format
- Parse error reporting and logging verbosity

## Deferred Ideas

None — discussion stayed within phase scope.
