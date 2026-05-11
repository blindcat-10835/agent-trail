# Retrospective: agent-tracing-dashboard

## Milestone: v1.0 — MVP

**Shipped:** 2026-05-12
**Phases:** 10 | **Plans:** ~41 | **Commits:** 315

### What Was Built

- Standalone ingest service (Hono + SQLite WAL/FTS5) with 3 source-specific JSONL parsers
- Multi-source frontend with AgentTool registry, source switcher, BFF proxy, shared components
- Turn-first replay UI with virtualized timeline, tool/skill/subagent blocks, search, filters
- Real-time sync (chokidar watcher + SSE) with security hardening (rate limiting, path traversal protection)
- 400+ regression tests covering parsers, API, sync, replay, and real-data edge cases

### What Worked

- **Canonical trace contract first** — Defining types before implementation prevented interface churn across phases
- **Fixture-driven parser development** — Golden fixtures caught regressions and validated edge cases
- **BFF proxy architecture** — Clean trust boundary between frontend and ingest, easy to mock in tests
- **Phase insertion (7-9)** — Bug-fix phases slotted in naturally without disrupting planned sequence
- **Source-specific parsers** — Separate parsers per source handled format complexity cleanly
- **Single `pnpm dev` command** — concurrently dual-service workflow was seamless

### What Was Inefficient

- **Missing SUMMARY.md files** — Phases 5 (plan 3), 6 (plans 1, 5), and 7 (all) never got summaries written
- **REQUIREMENTS.md checkboxes never updated** — Requirements were delivered but tracking was stale
- **Real-data discovery late** — Parsers worked on synthetic fixtures but broke on real JSONL; should have validated against real data earlier (Phase 8)
- **Phase 7 had no execution record** — Only plan/context/discussion files, no summary or verification
- **Two Phase 1 directories** — `01-scaffolding-toolchain` and `01-trace-contract-brownfield-reset` created confusion

### Patterns Established

- **Ingest test pattern**: Arrange fixtures → run sync → query SQLite → assert results (used across 200+ tests)
- **BFF route pattern**: Server component fetches from ingest via adapter, client component uses data hooks
- **Parser pattern**: Line-by-line JSONL reader → source-specific type discrimination → canonical output with warnings
- **Phase workflow**: discuss → research → plan → execute → verify (skipped in later phases due to time pressure)

### Key Lessons

1. **Validate parsers against real data early** — Synthetic fixtures don't cover real JSONL quirks
2. **Write SUMMARY.md immediately after execution** — Deferred summaries get forgotten
3. **Update REQUIREMENTS.md checkboxes as you go** — End-of-milestone catch-up is wasteful
4. **Keep phase directory names unique** — Two `01-*` directories caused tooling confusion
5. **Bug-fix phases are inevitable** — Plan for 20-30% of milestone to be stabilization

### Cost Observations

- Model mix: predominantly Claude Sonnet/Opus for implementation, lighter models for research/planning
- Sessions: ~15-20 active development sessions across 7 days
- Notable: Parser phases (2-3) were most token-intensive due to complex logic and extensive testing
