# Requirements: agent-tracing-dashboard v1.1

**Defined:** 2026-05-12
**Milestone:** v1.1 Data-Rich HUD Redesign
**Core Value:** Developers can quickly find local agent sessions and accurately review each turn of user input, agent response, tool/skill/subagent activity, and failure reasons.

## v1.1 Requirements

### Ingest Overview Data

- [x] **DATA-101**: User can fetch overview aggregates scoped to `all`, `openclaw`, `claude-code`, or `codex`, including session count, turn count, project count, token totals, and cost totals for today, 7 days, and 30 days.
- [x] **DATA-102**: User can fetch top model rankings scoped by source and time window, sortable by token usage or estimated cost, with token total and share percentage per model.
- [x] **DATA-103**: User can fetch top project rankings scoped by source and time window, including session count, turn count, token totals, estimated cost, and relative rank weight.
- [x] **DATA-104**: User can fetch recent starred sessions scoped by source or `all`, including title, project, model, status, recency, and starred timestamp.
- [x] **DATA-105**: User can fetch a mixed activity timeline scoped by source or `all`, covering session start/resume/finish/failure, parser or sync errors, and automation events where local source data exists.
- [x] **DATA-106**: User can fetch source capability metadata that tells the frontend which overview modules are available for each tool, including agents, automations, costs, activity, sessions, and replay.

### Session And Turn Enrichment

- [x] **TURN-101**: User can open a session whose detail payload includes display title, source, project, model, branch, cwd, status, started time, updated time, duration, total turns, input tokens, output tokens, and estimated cost.
- [x] **TURN-102**: User can inspect each turn with stable turn index, started time, duration, input/output token usage, failure status, truncated status, parser warning status, and activity counts.
- [x] **TURN-103**: User can inspect activity rows normalized across tools, skills, subagents, thinking, and system events with kind label, display name, path or target, status, duration, error body, and expandable details.
- [x] **TURN-104**: User can search within a session across user messages, assistant messages, and activity content while preserving stable turn indices for next/previous navigation and the turn spine.
- [x] **TURN-105**: User can browse long sessions through the existing pagination or virtualization contract without losing the data needed for the HUD header, turn spine, activity glyph counts, and inspector.

### OpenClaw And Automation Signals

- [x] **OPEN-101**: User can view OpenClaw agent summaries with name, avatar or initials, live/idle/error status, session count, tool count, and latest activity time.
- [x] **OPEN-102**: User can view automation summaries for tools that expose local automation data, including job name, schedule expression, last run status, last run duration, and next or recent run marker.
- [x] **OPEN-103**: User can distinguish ingest status, file watcher status, and OpenClaw Gateway live status in shell/status-bar surfaces without conflating historical indexing with live control-plane connectivity.

### Frontend Shell And Design System

- [x] **UI-101**: User sees the production app using the Terminal × HUD visual system from `.planning/designs/design-notes.md`: OKLCH semantic tokens, chartreuse accent, grid and scanline backdrop, clipped HUD corners, mono data typography, terse technical copy, and no emoji.
- [x] **UI-102**: User can switch between `all`, `openclaw`, `claude-code`, and `codex` from a shared header while preserving the existing `/(tool-shell)/[tool]` route model.
- [x] **UI-103**: User sees source-aware sidebar navigation, sync control, theme toggle, right-rail toggle, and always-visible status bar that match the draft shell prototype.
- [ ] **UI-104**: User can use the right rail to switch between recent, starred, and live session scopes with status counts, source-color spines, and click-through into session detail.

### Overview Redesign

- [ ] **OVR-101**: User sees Overview v2 populated from real BFF-backed data, including KPI hero, usage/cost rows, top models, starred sessions, activity timeline, top projects, and source-specific modules.
- [ ] **OVR-102**: User can scope Overview rankings, starred sessions, and activity timeline to the selected source or `all`.
- [ ] **OVR-103**: User can switch ranking emphasis between token usage and cost where the design exposes that mode.
- [ ] **OVR-104**: User sees OpenClaw-only agent modules and automation modules only when source capability metadata says the selected source supports them.
- [ ] **OVR-105**: User sees loading, empty, partial-data, and error states that keep the HUD layout stable and use terse system-style copy.

### Sessions And Trace Detail

- [ ] **SES-101**: User can browse sessions in a dense indexed table with source, status, starred, and search filters plus sortable title, project, turns, tokens, and cost columns.
- [ ] **SES-102**: User can read each session row with status, source, id, branch, title, summary, project, model, turns, input/output tokens, cost, duration, recency, and activity glyph counts.
- [ ] **SES-103**: User can open Session Detail v2 with compact HUD header, command row, search box, turn previous/next controls, expand/collapse controls, turn spine, continuous trace thread, inline expandable activity rows, and collapsible inspector.
- [ ] **SES-104**: User retains all v1.0 replay capabilities after the redesign: markdown-safe rendering, copy message/tool/turn, block filters or equivalent activity visibility controls, subagent lazy navigation, and keyboard shortcuts.
- [ ] **SES-105**: User can use Session Detail v2 on long sessions without layout collapse, text overflow, or major performance regression.
- [ ] **SES-106**: User can use the redesigned shell, overview, sessions table, and detail page in light and dark themes with keyboard focus, accessible labels, and desktop-responsive widths.

### Verification And Migration

- [x] **TEST-101**: Developer can run ingest regression tests covering overview aggregate queries, time-window math, source filters, cost/token fallbacks, top rankings, starred sessions, and timeline events.
- [ ] **TEST-102**: Developer can run frontend tests or Playwright checks for shell chrome, overview, sessions table, and session detail in both light and dark themes.
- [ ] **TEST-103**: Developer can run the existing v1.0 parser, API, BFF, replay, sync, and security tests without regressions.
- [x] **TEST-104**: Developer can migrate an existing local SQLite index through additive schema/index changes and cache invalidation without manually deleting the database.

## Future Requirements

### Data And Insights

- **FUT-101**: User can configure custom dashboard modules or reorder overview panels.
- **FUT-102**: User can import additional agents from the agentsview registry beyond OpenClaw, Claude Code, and Codex.
- **FUT-103**: User can export overview and session analytics to Markdown, JSON, or CSV with redaction profiles.
- **FUT-104**: User can compare two sessions or models side by side.

### Product Surface

- **FUT-201**: User can use a mobile-optimized layout.
- **FUT-202**: User can use a desktop shell or packaged launcher.
- **FUT-203**: User can publish sanitized share links.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud observability backend | v1.1 remains local-first and single-user. |
| Public share links | Local sessions can contain sensitive code, paths, command output, and secrets. |
| Tool rerun or prompt replay execution | The dashboard remains observe-only and read-only. |
| Generic OpenTelemetry collector | The milestone focuses on local agent session data, not arbitrary telemetry ingestion. |
| Exact billing reconciliation | Cost is an estimated local analytic unless a source provides authoritative billing data. |
| Mobile-first rewrite | The target prototype is a dense desktop developer dashboard. |
| Replacing all v1.0 parser contracts | v1.1 extends data surfaces without destabilizing shipped parser behavior. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-101 | Phase 10 | Done (10-02) |
| DATA-102 | Phase 10 | Done (10-02) |
| DATA-103 | Phase 10 | Done (10-02) |
| DATA-104 | Phase 10 | Done (10-02) |
| DATA-105 | Phase 10 | Done (10-02) |
| DATA-106 | Phase 10 | Done (10-01) |
| TURN-101 | Phase 10 | ✓ Complete (10-03) |
| TURN-102 | Phase 10 | ✓ Complete (10-03) |
| TURN-103 | Phase 10 | ✓ Complete (10-03) |
| TURN-104 | Phase 10 | ✓ Complete (10-03) |
| TURN-105 | Phase 10 | ✓ Complete (10-03) |
| OPEN-101 | Phase 10 | Done (10-02) |
| OPEN-102 | Phase 10 | Done (10-02) |
| OPEN-103 | Phase 10 | Done (10-02) |
| UI-101 | Phase 11 | Pending |
| UI-102 | Phase 11 | Pending |
| UI-103 | Phase 11 | Pending |
| UI-104 | Phase 11 | Pending |
| OVR-101 | Phase 12 | Pending |
| OVR-102 | Phase 12 | Pending |
| OVR-103 | Phase 12 | Pending |
| OVR-104 | Phase 12 | Pending |
| OVR-105 | Phase 12 | Pending |
| SES-101 | Phase 13 | Pending |
| SES-102 | Phase 13 | Pending |
| SES-103 | Phase 13 | Pending |
| SES-104 | Phase 13 | Pending |
| SES-105 | Phase 13 | Pending |
| SES-106 | Phase 14 | Pending |
| TEST-101 | Phase 10 | Done (10-02) |
| TEST-102 | Phase 14 | Pending |
| TEST-103 | Phase 14 | Pending |
| TEST-104 | Phase 10 | Done (10-01) |

**Coverage:**
- v1.1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-05-12*
*Last updated: 2026-05-12 after v1.1 milestone definition*
