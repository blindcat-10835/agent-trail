# agent-tracing-dashboard Roadmap

**Project**: agent-tracing-dashboard
**Last Updated**: 2026-05-15

## Milestones

- **v1.0 MVP** — Phases 1-9, shipped 2026-05-12
- **v1.1 Data-Rich HUD Redesign** — Phases 10-17, active

## Phases

<details>
<summary>v1.0 MVP (Phases 1-9) — SHIPPED 2026-05-12</summary>

- [x] Phase 1: Trace Contract & Brownfield Reset (4/4 plans) — completed 2026-05-06
- [x] Phase 1b: Scaffolding & Toolchain (1/1 plan) — completed 2026-05-05
- [x] Phase 2: Local Ingest Core + OpenClaw Parser (6/6 plans) — completed 2026-05-06
- [x] Phase 3: Claude/Codex Parsers + Turn Assembly (5/5 plans) — completed 2026-05-07
- [x] Phase 4: Multi-source Frontend Shell + Session Explorer (5/5 plans) — completed 2026-05-07
- [x] Phase 5: Turn Replay UI (4/4 plans) — completed 2026-05-08
- [x] Phase 6: Sync, OpenClaw Drilldown & Hardening (5/5 plans) — completed 2026-05-08
- [x] Phase 7: M1 Residual Dashboard Bug Fixes (1/1 plan) — completed 2026-05-09
- [x] Phase 8: Real-data Parser, Tool Persistence & Sync Refresh (5/5 plans) — completed 2026-05-10
- [x] Phase 9: Batch 2 Session Replay & Codex Subagent Fixes (5/5 plans) — completed 2026-05-10

</details>

### v1.1 Data-Rich HUD Redesign (Active)

**Milestone goal:** 扩展 ingest 取得新版设计需要的数据，并按 `.planning/designs/design-notes.md` 与 `.planning/designs/draft-design/` 改造前端。

| # | Phase | Goal | Requirements |
|---|-------|------|--------------|
| 10 | Rich Ingest Metrics & Data Contracts | 扩展 schema、聚合查询、BFF contract 和 migration，为 Overview/Session Detail 提供真实数据。 | DATA-101..106, TURN-101..105, OPEN-101..103, TEST-101, TEST-104 |
| 11 | HUD Shell & Design System Foundation | 建立 production HUD shell、status bar、right rail scope tabs、source-aware shared chrome 和视觉 token。 | UI-101..104 |
| 12 | 5/5 | Complete   | 2026-05-15 |
| 13 | Sessions Table & Trace Detail v2 | 改造 Sessions indexed table 和 Session Detail trace thread，同时保留 v1.0 replay 能力。 | SES-101..105 |
| 14 | Visual QA & Integration Hardening | 完成 light/dark、source switching、a11y、长 session、回归测试和视觉验证。 | SES-106, TEST-102, TEST-103 |
| 15 | Ingest Sync Performance Hardening | 修复 ingest watcher/background/periodic sync 重叠导致的高内存、高 CPU、大 JSONL 重复解析问题。 | PERF-101..106, TEST-103, OPEN-103 |
| 16 | Ingest Incremental JSONL and Sync Observability Hardening | 完成 Phase 15 剩余 P2/P3：append-only JSONL 增量解析、cursor 安全回退、append/upsert 写入、sync run 历史与生产级 debug 指标。 | PERF-107..112 |
| 17 | OpenCode Source Integration | 将 opencode CLI 的 SQLite session 数据作为第四个正式 source 纳入 dashboard，支持 session browsing、turn replay、tool activity、token usage、cost display。 | OPN-101..110 |

#### Phase 10: Rich Ingest Metrics & Data Contracts

**Goal:** Ingest and BFF expose the aggregate and enriched session data required by the v1.1 prototype without bypassing the existing trust boundary.

**Requirements:** DATA-101, DATA-102, DATA-103, DATA-104, DATA-105, DATA-106, TURN-101, TURN-102, TURN-103, TURN-104, TURN-105, OPEN-101, OPEN-102, OPEN-103, TEST-101, TEST-104

**Plans:** 4 plans

Plans:
- [x] 10-01-PLAN.md — Schema migration v9→v10 + source capabilities (Wave 1)
- [x] 10-02-PLAN.md — Overview aggregate ingest endpoints + tests (Wave 2)
- [x] 10-03-PLAN.md — Session/turn enrichment + FTS5 search (Wave 2)
- [x] 10-04-PLAN.md — BFF proxy routes for all overview + search (Wave 3)

**Success criteria:**
1. Overview aggregate endpoints return source-scoped and `all` data for today, 7 days, and 30 days.
2. Top models, top projects, starred sessions, mixed timeline, agent summaries, and automation summaries are available through BFF routes.
3. Session and turn payloads include the enriched fields needed for HUD header, spine, activity rows, and inspector.
4. SQLite migration is additive and existing local indexes migrate without manual DB deletion.
5. Ingest regression tests cover aggregate math, source filters, fallback values, and migration behavior.

#### Phase 11: HUD Shell & Design System Foundation

**Goal:** Establish the production visual foundation and shared chrome so every route can be rebuilt against the same source-aware HUD layout.

**Requirements:** UI-101, UI-102, UI-103, UI-104

**Plans:** 2/2 plans complete

Plans:
- [x] 11-01-PLAN.md — Design tokens + status bar real data (Wave 1)
- [x] 11-02-PLAN.md — Right rail scope tabs + source-color spines (Wave 1)

**Success criteria:**
1. Global tokens, typography, grid/scanline backdrop, HUD clip utilities, and status palettes match the design notes.
2. Header, source switcher, sidebar, status bar, sync/theme/right-rail controls, and right rail match the draft shell behavior.
3. Source capability metadata drives nav and section availability for `all`, OpenClaw, Claude Code, and Codex.
4. Shell remains routed through `/(tool-shell)/[tool]` and all frontend data access still goes through BFF helpers.

#### Phase 12: Overview v2 Real Data

**Goal:** Replace the current dashboard overview with the prototype-aligned HUD overview powered by live ingest aggregates.

**Requirements:** OVR-101, OVR-102, OVR-103, OVR-104, OVR-105

**Plans:** 5/5 plans complete

Plans:
- [x] 12-01-PLAN.md — Data Layer + KPI Hero + Rankings (Wave 1)
- [x] 12-02-PLAN.md — Starred, Timeline, Agents Modules (Wave 2)
- [x] 12-03-PLAN.md — States Polish + Source Switch + Integration Verify (Wave 3)
- [x] 12-04-PLAN.md — Automation Module (OVR-104 gap closure, Wave 1)
- [x] 12-05-PLAN.md — Token/Cost Toggle (OVR-103 gap closure, Wave 2)

**Success criteria:**
2. Source switching updates every overview panel consistently for `all`, OpenClaw, Claude Code, and Codex.
3. Token-vs-cost ranking mode works where exposed by the UI.
4. OpenClaw agents and automation modules appear only when capability metadata supports them.
5. Loading, empty, error, and partial-data states preserve layout density and HUD copy tone.

#### Phase 13: Sessions Table & Trace Detail v2

**Goal:** Rebuild the sessions browsing and detail experience around the new indexed table and continuous trace-thread prototype.

**Requirements:** SES-101, SES-102, SES-103, SES-104, SES-105

**Success criteria:**
1. Sessions page provides dense filters, sortable columns, aggregate HUD stats, source/status/star filters, and search.
2. Session rows expose source, status, id, branch, title, summary, project, model, turn counts, token counts, cost, duration, recency, and activity glyph counts.
3. Session Detail provides compact HUD header, command row, turn spine, continuous trace thread, inline activity rows, and collapsible inspector.
4. v1.0 replay behaviors remain available: copy actions, safe markdown, subagent lazy navigation, keyboard navigation, and activity visibility controls.
5. Long sessions stay usable through pagination or virtualization without layout collapse.

**Current code-backed status:** Complete as of 2026-05-17. Sessions list now uses backend-backed pagination/search/filter/sort, ACTIVITY sort is implemented, rows expose the required enriched fields, and routed Session Detail supports paginated long-session loading with virtualized TraceThread rendering.

#### Phase 14: Visual QA & Integration Hardening

**Goal:** Verify the full redesigned experience across sources, themes, data states, and regression suites before marking v1.1 complete.

**Requirements:** SES-106, TEST-102, TEST-103

**Success criteria:**
1. Playwright or equivalent browser checks cover shell, overview, sessions table, and session detail in light and dark themes.
2. Source switching, right rail, keyboard focus, search, expand/collapse, and long-session scenarios are manually and/or automatically verified.
3. Existing v1.0 parser, API, BFF, replay, sync, and security tests pass.
4. Visual review confirms no text overflow, incoherent overlap, mock data leaks, or hardcoded prototype values remain.

#### Phase 15: Ingest Sync Performance Hardening

**Goal:** Stabilize ingest sync so local indexing no longer amplifies watcher/background/periodic triggers into overlapping full-source parses, and so unchanged large JSONL files are skipped before expensive parser/hash work.

**Requirements:** PERF-101, PERF-102, PERF-103, PERF-104, PERF-105, PERF-106, TEST-103, OPEN-103

**Depends on:** Phase 10

**Plans:** 3/3 plans complete

Plans:
- [x] 15-01-PLAN.md — Sync scheduler, watcher path handoff, periodic no-reentry (P0)
- [x] 15-02-PLAN.md — Pre-parse skip, streaming hash, Codex relationship guardrails (P1)
- [x] 15-03-PLAN.md — Incremental-read readiness, health/debug observability, regression verification (P2/P3 foundation)

**Success criteria:**
1. Startup warmup, background sync, watcher-triggered sync, manual sync, and periodic resync all pass through one scheduler that serializes and coalesces work.
2. A single `.jsonl` append/change from watcher syncs only the changed path/session scope instead of the whole source history.
3. Periodic resync cannot start a second full-source sync while another sync is active.
4. Unchanged historical files are skipped before parser allocation and before any whole-file hash read.
5. Large JSONL files are never hashed with `fs.readFileSync()` on the hot path.
6. Health/debug output reports active sync, queued sync, reason, scope, skipped count, parsed count, last error, and recent duration.
7. Existing parser, API, BFF, replay, sync, and migration tests still pass.

#### Phase 16: Ingest Incremental JSONL and Sync Observability Hardening

**Goal:** Complete the remaining Phase 15 optimization track by making active Claude/Codex JSONL appends incremental, making cursor fallback safe, and expanding sync observability from last-run status to production-debuggable run history.

**Requirements:** PERF-107, PERF-108, PERF-109, PERF-110, PERF-111, PERF-112

**Depends on:** Phase 15

**Plans:** 4/4 plans complete

Plans:
**Wave 1**
- [x] 16-01-PLAN.md — Cursor schema and safety decision layer

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 16-02-PLAN.md — Claude/Codex append parser paths

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 16-03-PLAN.md — Idempotent append/upsert write path

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 16-04-PLAN.md — Sync debug history, structured logs, bounded config, regression gate

**Success criteria:**
1. Appending to a large Claude/Codex JSONL reads and parses only new complete lines when cursor metadata proves append-only growth.
2. Cursor safety detects truncate, rewrite, inode/device change, partial line, and parser version change, then falls back to full reparse without corrupting existing rows.
3. Append-only sync writes new messages, tool calls, result events, turns, and activity rows through idempotent append/upsert logic instead of deleting and reinserting the whole session.
4. Sync debug output exposes current file, current file size, current offset, recent run history, write counts, largest file, max RSS sample, duration, queue/coalesce behavior, and errors.
5. Each sync run emits one structured log summary with reason, scope, files considered/skipped/parsed, rows written, duration, and error count.
6. Any parse concurrency or SQLite batching introduced in this phase is bounded by explicit config and cannot reintroduce unbounded parallel work.
7. Existing parser, API, BFF, replay, sync, migration, and Phase 15 performance regression tests still pass.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Trace Contract | v1.0 | 4/4 | Complete | 2026-05-06 |
| 1b. Scaffolding | v1.0 | 1/1 | Complete | 2026-05-05 |
| 2. Ingest Core | v1.0 | 6/6 | Complete | 2026-05-06 |
| 3. Claude/Codex Parsers | v1.0 | 5/5 | Complete | 2026-05-07 |
| 4. Multi-source Frontend | v1.0 | 5/5 | Complete | 2026-05-07 |
| 5. Turn Replay UI | v1.0 | 4/4 | Complete | 2026-05-08 |
| 6. Sync & Hardening | v1.0 | 5/5 | Complete | 2026-05-08 |
| 7. Bug Fixes | v1.0 | 1/1 | Complete | 2026-05-09 |
| 8. Real-data Repair | v1.0 | 5/5 | Complete | 2026-05-10 |
| 9. Batch 2 Fixes | v1.0 | 5/5 | Complete | 2026-05-10 |
| 10. Rich Ingest Metrics | v1.1 | 4/4 | Complete | 2026-05-12 |
| 11. HUD Shell Foundation | v1.1 | 2/2 | Complete | 2026-05-12 |
| 12. Overview v2 | v1.1 | 5/5 | Complete | 2026-05-15 |
| 13. Sessions & Trace Detail v2 | v1.1 | 5/5 requirements | Complete | 2026-05-17 |
| 14. Visual QA & Hardening | v1.1 | 0/TBD | Planned | — |
| 15. Ingest Sync Performance | v1.1 | 3/3 | Complete | 2026-05-14 |
| 16. Incremental Sync Observability | v1.1 | 4/4 | Complete | 2026-05-15 |
| 17. OpenCode Source Integration | v1.1 | 0/TBD | Planned | — |

#### Phase 17: OpenCode Source Integration

**Goal:** Add OpenCode (opencode CLI v1.15+) as a fourth formal data source, enabling full-stack session browsing, turn replay, tool activity, reasoning blocks, token usage, cost display, and source switching.

**Requirements:** OPN-101, OPN-102, OPN-103, OPN-104, OPN-105, OPN-106, OPN-107, OPN-108, OPN-109, OPN-110

**Canonical refs:** `.planning/2026-05-17-opencode-source-integration-plan.md`, `.planning/phases/17-opencode-source-integration/17-SPEC.md`

**Success criteria:**
1. OpenCode sessions appear in `/opencode/sessions`, `/opencode/dashboard`, `/opencode/activity` with correct data.
2. Source switcher includes opencode as fourth option.
3. Turn replay renders user text, assistant text, reasoning blocks, tool calls, and step events.
4. Overview aggregates include opencode data in both scoped and `all` queries.
5. OpenCode source-reported cost displays correctly with `~` prefix convention for estimates.
6. SQLite schema migrates cleanly, existing three sources unaffected.
7. Parser handles WAL lock (SQLITE_BUSY) without crashing.
8. Existing parser, API, BFF, replay, sync, and migration tests still pass.

## Future Enhancements

- Import Claude.ai / ChatGPT exports
- Session comparison and diff views
- Richer health/outcome/failure signal scoring
- Markdown/JSON/CSV export with redaction profiles
- Single-command launcher or desktop shell
- Optional OpenTelemetry/OpenInference exporter
- User-configurable overview modules

---

**EOF**
