# Phase 6: Sync, OpenClaw Drilldown & Hardening - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning
**Mode:** Smart Discuss (autonomous — all recommended answers accepted)

<domain>
## Phase Boundary

Make the dashboard reliable as a local daily-use tool by adding incremental sync, SSE refresh, OpenClaw live-to-history drilldown, security boundaries and regression/performance checks.

**Deliverables:**
- Chokidar file watcher with debounce (500ms) + periodic resync fallback (5-min interval) in ingest service
- SSE endpoints for global session list changes and per-session turn updates
- Frontend SSE subscriber hook auto-refreshing active session data without full reload
- OpenClaw Gateway live session → replay drilldown (link from Gateway session to indexed replay)
- API path security hardening: session IDs validated, source roots enforced
- Parser fixture regression test suite covering edge cases
- Performance smoke tests for long sessions (1k+ messages)
- Privacy defaults documented in UI empty states and error messages
- Dev startup flow verified: concurrently starts both services, UI shows ingest connection status

**Not in this phase:**
- New agent source support (v2)
- AI-powered session analysis (v2)
- Export/share features (v2)
- Launcher/desktop packaging (v2)

</domain>

<decisions>
## Implementation Decisions

### File Watcher & Sync Architecture
- Use chokidar for cross-platform file watching on source directories. Watch `add`, `change`, `unlink` events on session files (`.jsonl`, `.json`, `.md`).
- Debounce 500ms before triggering sync (batch rapid changes). Track pending paths in a Set.
- Periodic resync fallback every 5 minutes (configurable via env var). Resync compares file mtimes against last-synced timestamps.
- Expose sync status via ingest API: `GET /api/v1/sources/:source/status` returns `lastSyncAt`, `watcherStatus`, `lastError`, `filesWatched`.
- Skip cache: if file hash matches last-known hash, skip re-parse. Hash stored in SQLite sessions table.

### SSE Architecture
- SSE endpoints on ingest service:
  - `GET /api/v1/events` — global stream: `session_created`, `session_updated`, `session_removed`, `sync_complete`
  - `GET /api/v1/sessions/:id/events` — per-session: `turn_added`, `session_updated`
- SSE format: standard `text/event-stream`, event types as `event:` field, JSON data.
- Frontend SSE client: `useSSE(toolId, sessionId?)` hook using `EventSource`. Auto-reconnects with 3s backoff.
- BFF proxy passthrough: Next.js API routes proxy SSE streams to ingest (`/api/agent-tools/[tool]/events`).
- Active session auto-refresh: when SSE event received for the currently viewed session, auto-refetch turns without page reload.

### OpenClaw Drilldown
- Gateway live sessions (from `useGatewayStore`) show a "View Replay" link when the session has an ingest-indexed counterpart.
- Matching logic: Gateway session's `id` or `sessionKey` → ingest API `GET /api/v1/sessions/lookup?source=openclaw&key={key}`. Best-effort link.
- OpenClaw overview activity/agents/sessions widgets add drilldown anchors linking to `/openclaw/sessions/[sessionId]`.
- GatewayBootstrap stays in OpenClaw layout scope only (per Phase 4). No Gateway integration for Claude/Codex.

### Security Boundaries
- API path validation: ingest service validates session IDs against indexed SQLite records only. Invalid IDs return 404 with generic message (no path disclosure).
- Source root enforcement: parsers only scan configured source directories. Chokidar only watches whitelisted paths.
- Error sanitization: all API errors strip stack traces and internal paths in production. Debug mode behind `INGEST_DEBUG=true` env var.
- Path traversal prevention: session lookup by ID only, no `GET /api/v1/files/:path` or equivalent.
- Rate limiting: simple in-memory rate limiter (100 req/min per endpoint) to prevent DoS.

### Testing & Hardening
- Parser fixture regression: add test fixtures for each parser edge case (malformed lines, truncated files, archive suffix, compact boundaries, queued commands, subagent DAG).
- Performance smoke tests: load test with 1k+ messages / 10k+ tool events, verify render time < 500ms for turn list, memory < 200MB.
- Privacy disclosure: add "Privacy" section to README, privacy notice in empty states. No upload, no share, local-only.
- Dev startup verification: `pnpm dev` launches both Next.js and ingest. UI status indicator shows ingest connection state (connected/disconnected/reconnecting).

### the agent's Discretion
- Exact chokidar event handling implementation (atomic writes, temp file filtering)
- SSE reconnection strategy details (exponential backoff, max retries)
- Gateway-to-ingest session matching heuristic precision
- Rate limiter implementation (token bucket vs sliding window)
- Performance test thresholds and measurement approach
- Exact fixture file organization and test structure

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ingest/` service: existing Hono server, REST API routes, SQLite schema, parser registry. Extend with chokidar watcher and SSE endpoints.
- `ingest/db/schema.sql` — SQLite schema. Add `last_sync_at`, `file_hash`, `watcher_status` columns to sources.
- `ingest/config/` — Source configuration. Add source path validation.
- `app/api/agent-tools/[tool]/` — BFF proxy routes. Add SSE passthrough routes.
- `components/hud/status-indicator.tsx` — Connection status indicator. Reuse for ingest connection state.
- `gateway/` — Gateway WebSocket types and store. Extend with drilldown links.
- `lib/agent-tools/client-hooks.tsx` — BFF data hooks pattern. Add SSE hooks.

### Established Patterns
- Hono framework for ingest service, Zod for validation, better-sqlite3 for SQLite
- BFF proxy pattern: frontend never calls ingest directly
- Zustand stores for UI state
- HUD dark theme design system
- Concurrent dev workflow (Next.js + ingest via concurrently)

### Integration Points
- `ingest/src/watcher.ts` — NEW: chokidar file watcher with debounce
- `ingest/src/sse.ts` — NEW: SSE stream management
- `ingest/src/api/routes/events.ts` — NEW: SSE endpoint handlers
- `app/api/agent-tools/[tool]/events/route.ts` — NEW: SSE BFF proxy
- `app/api/agent-tools/[tool]/sessions/lookup/route.ts` — NEW: session lookup for Gateway drilldown
- `lib/agent-tools/client-hooks.tsx` — Extend with `useSSE` and `useIngestStatus` hooks
- `components/hud/ingest-status.tsx` — NEW: ingest connection status indicator
- `components/dashboard/overview/` — Add drilldown links to existing OpenClaw overview components

</code_context>

<specifics>
## Specific Ideas

- File watcher should be resilient to transient files (editor temp files, `.DS_Store`). Filter by extension: `.jsonl`, `.json`, `.md`.
- SSE connection status should be visible in the shell status bar (bottom of the page), alongside or replacing Gateway status for Claude/Codex tools.
- Gateway-to-ingest session matching should be best-effort — show "Not yet indexed" state when no match found, rather than hiding the link.
- Performance tests should be runnable as part of CI (GitHub Actions) using a standard fixture dataset.
- Privacy notice should be a tooltip or link in the footer, not a consent modal (it's a local tool).
</specifics>

<deferred>
## Deferred Ideas

- Full real-time turn streaming (SSE pushes individual turns as parsed) — v1 does batch sync + SSE invalidation
- Multi-source cross-tool session comparison
- Session analytics dashboard (cost trends, tool usage heatmaps)
- Programmatic API key authentication for ingest (v1 is localhost-only)
- Webhook/callback on sync complete
- Notification toast for new sessions

</deferred>

---

*Phase: 06-Sync, OpenClaw Drilldown & Hardening*
*Context gathered: 2026-05-07 via Smart Discuss (autonomous)*
*Relationship to discuss-phase: Smart Discuss is an autonomous-optimized variant that batches grey area questions. This CONTEXT.md is structurally identical to what discuss-phase produces. (CTRL-03)*
