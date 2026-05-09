---
quick_id: 260509-nwg
slug: decouple-ingest-readiness-from-full-sess
status: complete
created: 2026-05-09
---

# Quick Task: Decouple Ingest Readiness From Full Session Indexing

## Goal

Make `pnpm dev` start the frontend promptly while ingest indexes local agent session history progressively in the background.

## Decisions

- Start the ingest HTTP server before source discovery and full initial sync.
- Use `/health.ready` to distinguish "service reachable" from "bounded startup warmup complete".
- Run a bounded newest-first warmup sync before `ready: true`.
- Continue full historical indexing in the background after warmup.
- Remove the dev-time `wait-on tcp:8078` gate because the frontend health overlay handles ingest readiness.

## Verification

- `pnpm test:run tests/unit/ingest/sync.test.ts`
- `pnpm test:run tests/unit/ingest/sync.test.ts tests/unit/bff/replay-key-utils.test.ts`
- `pnpm typecheck:ingest`
- `pnpm typecheck`
- `git diff --check`
- Startup smoke test with a temporary DB and port.
