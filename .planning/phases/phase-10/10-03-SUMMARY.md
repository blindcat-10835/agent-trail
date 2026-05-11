---
phase: 10-rich-ingest-metrics
plan: 03
subsystem: ingest
tags: [enrichment, fts5, search, types, session, turn]
dependency_graph:
  requires: [10-01]
  provides: [enriched-session-payload, turn-enrichment, fts5-search]
  affects: [types/trace.ts, ingest/api/sessions.ts, ingest/turns/assembler.ts, ingest/api/search.ts, ingest/index.ts]
tech_stack:
  added: []
  patterns: [query-time-enrichment, fts5-external-content, like-fallback]
key_files:
  created:
    - ingest/api/search.ts
    - ingest/api/search.test.ts
  modified:
    - types/trace.ts
    - ingest/api/sessions.ts
    - ingest/turns/assembler.ts
    - ingest/index.ts
decisions:
  - enrichTurn applied as final map step on both code paths in assembleTurns
  - FTS5 search uses snippet() with >>> <<< delimiters for highlighting
  - LIKE fallback triggered by catch on any FTS5 query error
  - estimatedCost set to null placeholder pending model-price mapping
  - displayTitle falls back to "project — date" when session name is absent
metrics:
  duration: 397s
  completed: 2026-05-12T03:17:30Z
  tasks: 2
  files: 5
---

# Phase 10 Plan 03: Session/Turn Enrichment & FTS5 Search Summary

Enriched session and turn payloads with HUD-required fields and added FTS5 in-session search with LIKE fallback.

## What Changed

### Task 1: Extend TraceActivity types and session enrichment
Extended the canonical trace model with optional enrichment fields for Phase 10 HUD display. `TraceToolCall` and `TraceSkillUse` gained `displayName`, `TraceSkillUse` gained `durationMs` and `error`, `TraceSubagentLink` gained `durationMs`. Added `TurnEnrichment` interface with activity counts, failure status, truncated flag, and warning status. Extended `TraceSession` with `displayTitle`, `durationMs`, `totalTurns`, `inputTokens`, `outputTokens`, and `estimatedCost`. Updated all three session SELECT queries and the `parseSessionRow` mapper to populate these fields.

### Task 2: Add turn assembler enrichment and in-session search
Added `enrichTurn()` function in the turn assembler that computes per-turn activity counts, failure status, warning status, and truncated flag at query time. Applied to both stored-boundary and heuristic-boundary code paths. Created FTS5 in-session search endpoint (`/api/v1/sessions/:id/search?q=query`) with snippet highlighting and LIKE fallback. Validates session ID format, sanitizes FTS5 special characters, and handles empty/whitespace queries. 12 tests covering all search behaviors.

## Verification

All 42 tests pass:
- `ingest/api/sessions.test.ts` — 16 passed (existing tests still green)
- `ingest/api/search.test.ts` — 12 passed (new)
- `tests/unit/ingest/turns.test.ts` — 14 passed (existing tests still green)

## Deviations from Plan

None — plan executed exactly as written.

## Key Commits

| Commit | Description |
|--------|-------------|
| `f0651b0` | feat(10-03): extend TraceActivity types and session enrichment |
| `4fe5489` | feat(10-03): add turn assembler enrichment and FTS5 in-session search |
