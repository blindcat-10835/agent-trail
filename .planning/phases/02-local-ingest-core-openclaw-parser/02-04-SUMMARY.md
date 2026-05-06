---
phase: 02-local-ingest-core-openclaw-parser
plan: 04
subsystem: dev-workflow
tags: [concurrently, tsx, next.js, typescript, postcss, tailwind]

# Dependency graph
requires:
  - phase: 02-01
    provides: "Ingest service core (index.ts, Hono server, health/version endpoints)"
  - phase: 02-02
    provides: "OpenClaw parser and session ingestion pipeline"
  - phase: 02-03
    provides: "Sessions and turns REST API endpoints"
provides:
  - "Single pnpm dev command starting Next.js + ingest concurrently"
  - "Colored log prefixes ([NEXT] blue, [INGEST] green)"
  - "Individual service control (dev:next, dev:ingest)"
  - "Ingest TypeScript compilation (build:ingest, typecheck:ingest)"
  - "PostCSS config enabling Tailwind v4 with Next.js Turbopack"
affects: [03-claude-codex-parsers, 04-multi-source-ui-shell, 05-turn-replay-ui]

# Tech tracking
tech-stack:
  added: [concurrently@9.2.1, tsx@4.21.0, ts-node@10.9.2, @types/better-sqlite3@7.6.13]
  patterns:
    - "Concurrent dev server pattern: pnpm dev starts both services"
    - "TypeScript project references: root → ingest"
    - "PostCSS config pattern: @tailwindcss/postcss for Tailwind v4"

key-files:
  created:
    - ingest/tsconfig.json: Ingest-specific TypeScript compilation config
    - postcss.config.mjs: PostCSS config for Tailwind v4 + Next.js
  modified:
    - package.json: Updated scripts with concurrently, tsx, build/typecheck targets
    - tsconfig.json: Added ingest/dist to exclude, references for project refs
    - README.md: Comprehensive development docs, API endpoints, troubleshooting
    - ingest/db/index.ts: Type safety fixes (unknown → Error casts)
    - ingest/turns/assembler.ts: Null coalescing for strict null checks

key-decisions:
  - "Use concurrently with npm:dev:* wildcard for dual-service startup"
  - "Use tsx watch instead of ts-node-dev for faster ingest restart"
  - "Set rootDir: .. in ingest/tsconfig.json to access shared types/trace.ts"
  - "PostCSS config using @tailwindcss/postcss for Tailwind v4 compatibility"

requirements-completed: [DATA-01]

# Metrics
duration: 17min
completed: 2026-05-06
---

# Phase 2 Plan 4: Development Workflow Summary

**Single `pnpm dev` command starts Next.js (Turbopack, port 3000) and ingest service (tsx watch, port 8078) concurrently with colored log prefixes**

## Performance

- **Duration:** 17 min
- **Started:** 2026-05-06T09:02:14Z
- **Completed:** 2026-05-06T09:19:44Z
- **Tasks:** 5 (4 auto + 1 checkpoint)
- **Files modified:** 8

## Accomplishments

- `pnpm dev` starts both Next.js frontend and ingest service with a single command
- Colored log prefixes: `[NEXT]` in blue, `[INGEST]` in green
- Individual service control via `pnpm run dev:next` and `pnpm run dev:ingest`
- TypeScript compilation for ingest code (`build:ingest`, `typecheck:ingest`)
- Comprehensive README with development setup, API endpoints, and troubleshooting
- PostCSS config fixed enabling Tailwind v4 with Next.js Turbopack

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps and update scripts** — `7d99c02` (feat)
2. **Task 2: Create ingest tsconfig** — `f7ff81a` (feat), `1cbf923` (fix)
3. **Task 3: Update root tsconfig** — `239e36d` (feat)
4. **Task 4: Update README** — `a906f37` (docs)
5. **Task 5: Checkpoint:human-verify** — approved

**Deviation commits:** `79511b9` (fix), `48a3d1b` (fix)

## Files Created/Modified

- `package.json` — Updated scripts: dev uses concurrently, new dev:next/dev:ingest/build:ingest/typecheck:ingest
- `ingest/tsconfig.json` — Ingest TypeScript config extending root, outDir ./dist, rootDir ..
- `tsconfig.json` — Added ingest/dist to exclude, references array for project refs
- `README.md` — Development section with dual-service docs, API endpoints, troubleshooting
- `postcss.config.mjs` — PostCSS config enabling Tailwind v4 with Next.js
- `ingest/db/index.ts` — Type safety: err.message → (err as Error).message
- `ingest/turns/assembler.ts` — Null coalescing: undefined → null for strict checks
- `pnpm-lock.yaml` — Updated lockfile for new dependencies

## Decisions Made

- **concurrently wildcard pattern**: `npm:dev:*` picks up all `dev:*` scripts, auto-discovers new services
- **tsx watch over ts-node-dev**: Faster startup, better ESM/CJS interop, handles native modules
- **rootDir: ".." in ingest config**: Allows shared `types/trace.ts` imports while keeping output under `ingest/dist/ingest/`
- **PostCSS config**: Explicit `postcss.config.mjs` with `@tailwindcss/postcss` plugin resolves Tailwind v4 + Next.js integration

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] dev:next pointed to nonexistent server/index.mjs**
- **Found during:** Task 5 (checkpoint verification)
- **Issue:** Plan's `dev:next` script used `node server/index.mjs` which didn't exist
- **Fix:** Changed to `next dev` (standard Next.js development server)
- **Files modified:** `package.json`
- **Committed in:** `79511b9`

**2. [Rule 3 - Blocking] Missing PostCSS config prevented Next.js startup**
- **Found during:** Task 5 (checkpoint verification)
- **Issue:** Next.js failed with `Can't resolve 'tailwindcss'` — PostCSS config missing
- **Fix:** Created `postcss.config.mjs` with `@tailwindcss/postcss` plugin
- **Files modified:** `postcss.config.mjs` (created)
- **Committed in:** `48a3d1b`

**3. [Rule 3 - Blocking] Pre-existing TypeScript errors blocked build:ingest**
- **Found during:** Task 2 (ingest tsconfig creation)
- **Issue:** `err.message` on `unknown` type, `string|undefined` in `Partial<T>` strict checks
- **Fix:** Installed `@types/better-sqlite3`, added `(err as Error).message` casts, `?? null` coalescing
- **Files modified:** `ingest/db/index.ts`, `ingest/turns/assembler.ts`, `package.json`
- **Committed in:** `1cbf923`

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All fixes necessary for dev workflow functionality. No scope creep.

## Issues Encountered

- **TypeScript project references incompatibility**: Root `noEmit: true` prevented ingest from using `composite: true` + `references` — resolved by removing composite from ingest and using `rootDir: ".."` for shared type access
- **Verification script bug**: Plan's verification used `xargs test 1 -ge` with reversed argument order (checking `1 >= count` instead of `count >= 1`) — verified manually instead

## User Setup Required

None — no external service configuration required. The dev workflow is local-only.

## Next Phase Readiness

- Dev workflow complete: both services start concurrently with `pnpm dev`
- Ingest service independently runnable with `pnpm run dev:ingest`
- Ready for Phase 3: Claude/Codex Parsers + Turn Assembly
- TypeScript infrastructure in place for both packages

---

*Phase: 02-local-ingest-core-openclaw-parser*
*Completed: 2026-05-06*

## Self-Check: PASSED

- [x] `ingest/tsconfig.json` exists
- [x] `postcss.config.mjs` exists
- [x] `ingest/dist/ingest/index.js` exists (build output)
- [x] `.planning/phases/02-local-ingest-core-openclaw-parser/02-04-SUMMARY.md` exists
- [x] 8 commits for plan 02-04 in git log
- [x] `pnpm typecheck:ingest` passes with no errors
- [x] `pnpm run build:ingest` compiles successfully
- [x] `pnpm dev` starts both Next.js and ingest concurrently
