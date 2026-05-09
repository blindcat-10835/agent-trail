# Development

This is the working developer's reference: how to run, hot-reload, debug, and contribute to both services in this repo. Architecture context lives in [`ARCHITECTURE.md`](ARCHITECTURE.md); first-run setup is in [`GETTING-STARTED.md`](GETTING-STARTED.md).

---

## 1. Day-to-day commands

```bash
# Run both services (default)
pnpm dev

# Run one at a time
pnpm dev:next             # Next.js with --webpack (NOT turbopack)
pnpm dev:ingest           # tsx watch on ingest/index.ts

# Type-check
pnpm typecheck            # entire workspace, project + ingest references
pnpm typecheck:ingest     # ingest project only

# Lint
pnpm lint                 # eslint-config-next flat config

# Build
pnpm build                # Next.js production build
pnpm build:ingest         # tsc -p ingest/tsconfig.json → ingest/dist/

# Production start (requires the corresponding build)
pnpm start                # node server/index.mjs (Next standalone server)
pnpm start:ingest         # node ingest/dist/ingest/index.js

# Tests — see TESTING.md for fixtures and golden flow
pnpm test                 # vitest watch
pnpm test:run             # vitest run (single pass)
pnpm test:real-sessions   # tests/local/real-session-corpus.test.ts (uses your local sessions; gitignored)
```

`pnpm dev` uses `concurrently -k --names "INGEST,NEXT" --prefix-colors "green,blue"`. `Ctrl+C` once kills both.

---

## 2. Hot reload model

| Service | What triggers reload |
| --- | --- |
| Next (`dev:next`) | Edits under `app/`, `components/`, `lib/`, `stores/`, `types/`, `app/globals.css`. Runs Webpack — **do not** switch to Turbopack (see `../../ERRORS_LEARNED.md`). |
| Ingest (`dev:ingest`) | Edits under `ingest/**/*.ts`. `tsx watch` restarts the process; chokidar watcher and the SSE manager are torn down and reopened. |

**Database stays put.** The schema file is read on every restart, but `data/ingest.db` persists across restarts. If you change `schema.sql` in a way that requires a migration, add a step to `runMigrations()` in `ingest/db/index.ts` and bump `targetVersion`.

**SSE streams reconnect.** When ingest restarts, the BFF SSE proxy `/api/agent-tools/[tool]/events` will see the upstream `fetch` close and pass that through. The browser's `EventSource` retries automatically; the dashboard's status bar flickers `RECONNECTING → ONLINE`.

---

## 3. Project conventions

These are non-obvious enough to call out:

### Language

- **AI-facing artifacts** (specs, plans, decisions in `.planning/`, AI prompts) are in **Chinese**.
- **Code, comments, commit messages, PRs** are in **English**.
- This repo follows that split. Don't switch one without the other.

### Visual tokens

- All colors come from semantic tokens defined in `app/globals.css`'s `@theme inline { ... }` block: `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`, `bg-card`, `accent`, `destructive`, etc.
- **Do not** hard-code colors. Add a new token to `@theme inline` if you need one.
- Both light and dark themes must pass WCAG AA contrast. The theme bootstrap in `app/layout.tsx` runs synchronously before paint to avoid FOUC.

### Tailwind v4

- **There is no `tailwind.config.js`.** Don't add one — it would be ignored.
- Plugins go in `postcss.config.mjs` (currently just `@tailwindcss/postcss`).
- Theme tokens, custom utilities, and component classes all live in `app/globals.css`.

### shadcn

- Add components with `pnpm dlx shadcn@latest add <name>`. Don't hand-create them in `components/ui/`.
- Style is `radix-nova` (`components.json`). If a component installs with a different style (e.g. `default`), its theme tokens won't match — re-run with the correct style.
- Icon library is `lucide`. Don't import from `lucide-react` directly in component file headers when shadcn already wires it up — use the same import pattern as existing files.

### Path alias

`@/*` → `./*`. Use `@/lib/utils`, `@/components/ui/button`, `@/types/trace`, etc. — relative imports across feature directories are discouraged.

### Code style

- **Comments only when WHY is non-obvious.** Don't paraphrase the code or document the obvious.
- Don't write multi-paragraph docstrings on routine functions; name them well instead.
- The codebase deliberately avoids backwards-compatibility shims and "removed in version X" comments — when something is unused, delete it.

---

## 4. Editing each layer

### 4.1 Adding an API endpoint

**Ingest endpoint** (e.g. a new `/api/v1/something`):

1. Create or extend a file under `ingest/api/` and export a `Hono` router.
2. Register it in `ingest/index.ts`:
   ```ts
   import { somethingRoutes } from './api/something.js';
   app.route('/', somethingRoutes);
   ```
3. Validate every URL/query input. Use the existing patterns:
   - `sessionId` → `/^[a-zA-Z0-9:\-_.]{1,256}$/`
   - `source`    → whitelist `['openclaw', 'claude-code', 'codex']`
   - `limit`/`offset` → non-negative integers, cap `limit` at 1000
4. Return JSON via `c.json()`. Set explicit status codes (400 / 404 / 500) — don't rely on defaults.
5. Add tests under `ingest/api/*.test.ts` or `tests/unit/ingest/`.

**BFF endpoint** (proxy or aggregator under `app/api/`):

1. Create `app/api/<path>/route.ts` exporting `GET` / `POST` / etc.
2. Pull tool from `params` and run `assertSourceToolId(tool)` (or `assertAgentToolId` for shell-only routes).
3. Use `fetchIngest<T>(...)` from `lib/agent-tools/server-adapter.ts` to call ingest. It already handles 5s timeout, AbortController, and JSON serialization.
4. Wrap calls in `try/catch` and return `sanitizeError(err)`.
5. For mutations, accept `force` from both query string and JSON body (matches existing `/api/sync` and `/api/agent-tools/[tool]/sync`).

The BFF must always inject the source — never trust a caller-supplied `?source=`.

### 4.2 Adding a parser

Source-specific parsers live in `ingest/parser/{claude,openclaw,codex}.ts`. To add a new source:

1. Add the source name to `TraceSource` in `types/trace.ts` and the `CHECK` constraint in `ingest/db/schema.sql`.
2. Add a discoverer in `ingest/sync/sources.ts` (`discoverFooSources()`) that returns `DiscoveredSource[]`. Default the path to `~/.foo/sessions` and accept `FOO_SESSIONS_PATH`. Use `isWithinRoot` to filter discovered paths.
3. Implement `parseFooSession(filePath, project): Promise<ParseResult>` matching the contract in `ingest/parser/types.ts`.
4. Add a `syncFooSource()` branch in `ingest/sync/index.ts` (`syncSource()` enumerates types — there is intentionally no generic fallback per D-21).
5. Wire the new source into `ingest/index.ts → initializeSourcesAndSync` and the warmup loop.
6. Add fixtures + golden files under `fixtures/foo/` and a parser test under `tests/unit/ingest/`.
7. Update the BFF: add `lib/agent-tools/foo/{definition.ts, server-adapter.ts}`, register in `lib/agent-tools/registry.ts`, add to `TOOL_IDS`.
8. Update `assertSourceToolId` automatically picks it up via `TOOL_IDS`.

For the canonical contract details and parser rules, see [`services/ingest.md`](services/ingest.md).

### 4.3 Adding a frontend page

1. Create `app/(tool-shell)/[tool]/<page>/page.tsx`. The route group `(tool-shell)` is omitted from URLs.
2. If the page should only appear for some tools, add a `requiredCapability` to the relevant `nav` item in `lib/agent-tools/<tool>/definition.ts`. Pages without a nav item still render — capability gating is for the sidebar.
3. Use `useAgentTool()` to read the current `toolId` and `href(route)` builder.
4. Use the typed data hooks (`useSessionDetail`, `useSessionTurns`, …) — they hit the BFF, never ingest.
5. For new shadcn components, re-run `pnpm dlx shadcn@latest add <name>`; don't copy from another project (style mismatch).

For a deeper tour of the frontend layers, see [`services/frontend.md`](services/frontend.md).

### 4.4 Adding a shared type

Anything spanning ingest + frontend lives in `types/`. Add it there, not in `ingest/types.ts` (which is ingest-internal: `ServiceContext`, `HealthStatus`, etc.). The root `tsconfig.json` includes `ingest/**/*` so `@/types/trace` resolves identically from both projects.

---

## 5. Working with the database during development

```bash
# Quick inspect
sqlite3 data/ingest.db '.schema sessions'
sqlite3 data/ingest.db 'SELECT id, source, project, name, message_count FROM sessions ORDER BY started_at DESC LIMIT 10;'

# Reset (safe, ingest must be stopped first)
rm data/ingest.db data/ingest.db-wal data/ingest.db-shm
pnpm dev:ingest   # recreates schema and migrates from scratch

# Force a re-parse without deleting
curl -X POST http://localhost:3000/api/agent-tools/claude-code/sync \
  -H 'content-type: application/json' \
  -d '{"force":true}'
```

The skip cache key is versioned: `parser-v7-turn-activity-placement:<source>:<sha256>`. If you change parser output shape, bump `PARSER_CACHE_VERSION` at the top of `ingest/sync/index.ts` — the next sync will re-parse everything because every `file_hash` will mismatch the new prefix.

For schema details and migration history, see [`db-schema.md`](db-schema.md).

---

## 6. Debugging

### Ingest

- Set `INGEST_DEBUG=true` to surface real error messages and stack traces in HTTP responses (otherwise the global handler returns `{"error":"Internal server error"}`). **Disable before sharing logs** — bodies may include file paths.
- Set `INGEST_LOG_LEVEL=debug` for verbose lifecycle logs (currently used mostly in tests).
- The watcher prints `[watcher] Sync failed for <source>: <err>` on every sync failure — search the `[INGEST]` lines.

### Frontend

- The ingest health overlay (`components/hud/ingest-health-overlay.tsx`) polls `/api/ingest/health` and shows a full-screen state when ingest is unreachable. If it covers the page during development, ingest is the place to look.
- BFF errors in browser DevTools usually say `Ingest service unreachable (502)` — these are sanitized. Look at the `[INGEST]` console output for the real cause.
- React Server Component cache is bypassed for ingest fetches: the BFF uses `cache: 'no-store'`. Sync and SSE invalidations should appear immediately.

### SSE

- Open DevTools → Network → filter by `events`. The connection should stay open with a `text/event-stream` content type.
- If you see frequent reconnects, ingest is restarting too often — check `tsx watch` output for syntax errors.

---

## 7. Branching, commits, and quick tasks

The repo uses the GSD (`get-shit-done`) workflow stored in `.planning/`. Don't hand-edit STATE.md or ROADMAP.md.

- For trivial changes: `/gsd-fast` (no planning overhead).
- For small isolated tasks: `/gsd-quick` (still atomic-commit + state-tracked).
- For phases: the discuss → plan → execute pipeline (`/gsd-discuss-phase` etc.).
- Phase progress lives in `.planning/STATE.md`; quick tasks in `.planning/quick/`.

Conventional commit messages: `<type>(<scope>): <short summary>`. Examples in `git log`: `feat(replay):`, `chore:`, `fix(parser):`, `docs(quick):`. Scopes seen in the wild: `replay`, `260509-pk2`, `quick`, `parser`, `ingest`.

For history-aware AI assistance, `CLAUDE.md` and `AGENTS.md` describe the project's expectations for AI coding agents.

---

## 8. Common gotchas

These have bitten enough times to deserve a callout. Full list in `../../ERRORS_LEARNED.md` — read it before writing a new component.

- **Tailwind v4 does not load `tailwind.config.js`.** Adding one creates a silent no-op. Theme goes in `app/globals.css`.
- **Next 16 changed defaults.** Check `node_modules/next/dist/docs/` (or the official changelog) before assuming behavior.
- **Don't switch from `--webpack` to Turbopack** in `pnpm dev:next`. The current dependency graph causes a compile storm.
- **`(tool-shell)` is a route group.** URLs are `/openclaw/dashboard`, NOT `/(tool-shell)/openclaw/dashboard`. Same for `[tool]` — that's a dynamic segment, not literal.
- **`source=` is owned by the BFF.** Don't pass it from the frontend; the adapter strips it.
- **`assertSourceToolId('all')` throws.** Use `assertAgentToolId` for routes that include the aggregate scope.
- **`better-sqlite3` is synchronous.** All ingest writes happen inside one `database.transaction()` for atomicity.
- **The Next dev server must run with WORKSPACE_PATH set if you use the legacy file-scan route** `/api/sessions/messages`. The newer flow under `/api/agent-tools/[tool]/...` does not need it (ingest reads it instead).
