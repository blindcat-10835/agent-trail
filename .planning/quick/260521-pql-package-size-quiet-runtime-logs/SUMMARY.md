---
quick_id: 260521-pql
status: complete
completed: 2026-05-21
commit: faf5ad6
---

# Summary: Package size and quiet runtime logs

## Outcome

- Moved `shadcn` from runtime dependencies to dev dependencies so npm consumers no longer install the shadcn CLI as part of the app runtime.
- Slimmed Docker runtime dependency copying: the image now uses Next.js standalone output plus only the external native ingest dependency path needed for `better-sqlite3`.
- Routed Docker startup through `bin/agents-tracing.js` so npm and Docker share the same process management and logging behavior.
- Added `ingest/logger.ts` with `silent`, `error`, `warn`, `info`, and `debug` levels.
- Made packaged npm/Docker runs quiet by default: the launcher prints the dashboard URL, buffers child logs, and flushes recent logs only if a child process fails. `AGENTS_TRACING_LOG_LEVEL=debug` streams detailed logs live.
- Documented the runtime logging override in README and configuration/development docs.

## Verification

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm typecheck:ingest`
- `node --check bin/agents-tracing.js`
- `git diff --check`
- `node scripts/prepare-npm-package.mjs`
- `pnpm pack --json` from `npm-package/`

## Measurements

- Generated npm staging directory: `5.0M`.
- Generated npm tarball: `1.1M`.
- Generated package dependencies exclude `shadcn`.
- Local full `node_modules` is `724M`; Next standalone `node_modules` is `46M`; `better-sqlite3` runtime package path is about `27M`. Docker now copies the small external native dependency path instead of the full production dependency tree.

## Limitations

- Local Docker verification was not run because Docker CLI is not installed in this environment.
- `pnpm build:ingest` could not complete under the Codex.app bundled Node runtime because Rollup's native optional package fails macOS code-signature loading in that host process. Type checks passed, and the prior GitHub release workflow is the reliable build environment for this path.
