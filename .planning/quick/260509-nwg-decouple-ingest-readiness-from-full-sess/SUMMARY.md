---
quick_id: 260509-nwg
slug: decouple-ingest-readiness-from-full-sess
status: complete
completed: 2026-05-09
---

# Summary

Implemented non-blocking ingest startup with bounded warmup indexing.

## Changes

- Ingest now listens on its HTTP port immediately after config, DB open, and schema initialization.
- Health responses include `ready` and `sync` state, so the frontend can distinguish warmup from unreachable service.
- Startup indexing first processes only the newest `INGEST_STARTUP_SYNC_LIMIT` files per source, then marks ready.
- Full historical indexing continues in the background when `INGEST_BACKGROUND_SYNC_ENABLED=true`.
- `syncSource()` supports `limit` and newest-first ordering for bounded warmup.
- Codex limited warmup avoids the expensive full relationship scan.
- `pnpm dev` starts ingest and Next concurrently instead of blocking Next on `wait-on`.
- The ingest health overlay waits for `ready !== false` before dismissing.

## Verification

- `pnpm test:run tests/unit/ingest/sync.test.ts` passed.
- `pnpm test:run tests/unit/ingest/sync.test.ts tests/unit/bff/replay-key-utils.test.ts` passed.
- `pnpm typecheck:ingest` passed.
- `pnpm typecheck` passed.
- `git diff --check` passed.
- Smoke-tested ingest startup on `INGEST_PORT=18079` with a temporary DB and confirmed `/health` returned `status: ok` and `ready: true`.
