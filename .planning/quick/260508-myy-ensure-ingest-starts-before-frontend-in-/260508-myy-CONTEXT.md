# Quick Task 260508-myy: Ensure ingest starts before frontend + health check overlay - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Task Boundary

Current `pnpm dev` uses `concurrently` to start Next.js and ingest in parallel. Next.js typically starts faster, resulting in page loads before ingest is ready. Need to:
1. Ensure ingest starts before frontend in dev
2. Show a health check overlay when ingest is unavailable

Applies to both dev and future production setups.
</domain>

<decisions>
## Implementation Decisions

### Dev script ordering
- Use `wait-on` to wait for ingest port 8078 to be ready before starting Next.js
- Ingest starts immediately, Next.js waits for ingested to be listening
- `wait-on` is lightweight, no extra dependencies needed (can use npx)

### Loading UI
- Full-screen overlay with semi-transparent backdrop
- Shows "Connecting to data service..." with a loading animation
- Appears when any API call to ingest fails (not just on initial load)

### Health check polling
- Frontend polls ingest `/health` endpoint every 2 seconds
- 30 second timeout, after which shows error message with retry button
- Ingest already has a `/health` endpoint returning `{ status, version, uptime, database }`

### the agent's Discretion
- Component placement: root layout or session explorer page — executor decides based on existing component structure
- Retry behavior: automatic re-polling after manual retry click
- State management: React context or Zustand store — whichever fits the existing pattern
</decisions>

<specifics>
## Specific Ideas

- Ingest `/health` endpoint already exists at `ingest/index.ts:49`, returns `{ status: 'ok' | 'error', version, uptime, database }`
- Current `package.json` dev script: `concurrently "npm:dev:*" --names "NEXT,INGEST" --prefix-colors "blue,green"`
- Change to: ingest starts via `tsx watch`, then `wait-on tcp:8078` before `next dev`
</specifics>

<canonical_refs>
No external specs — requirements fully captured in decisions above
</canonical_refs>
