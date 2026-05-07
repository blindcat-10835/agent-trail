---
status: partial
trigger: "UAT发现5个bug: 1) session labels全显示default 2) session project全显示default 3) 左上角标题随子页面变化 4) 布局错误-sessions应在right rail 5) 应参考agentsview布局实现"
created: "2026-05-07"
updated: "2026-05-07"
---

# Debug: UAT Bugs - Labels, Layout & Navigation

## Symptoms

### Bug 1: Session labels show "default"
- **Expected**: Session label should show the session name or user's first message
- **Actual**: All sessions display "default" as their label

### Bug 2: Session project shows "default"
- **Expected**: Session project should show the working directory of the session
- **Actual**: All sessions display "default" as their project

### Bug 3: Top-left title changes with sub-pages
- **Expected**: Top-left corner should always display "AGENTS TRACING" and not change with navigation
- **Actual**: Title changes when navigating to sub-pages

### Bug 4: Layout is wrong - sessions position
- **Expected**: Sessions should display in the right rail. Middle child area should show overview by default. Clicking a session in the right rail opens session details in the child area.
- **Actual**: Sessions are not positioned in the right rail

### Bug 5: Reference agentsview layout
- **Expected**: Similar to agentsview implementation - sessions list in a sidebar, details open in the main area
- **Actual**: Current layout doesn't match the expected pattern

## Current Focus

**hypothesis**: CONFIRMED — The original bug 1/2 fix was incomplete: it changed the table path, but Codex/Claude ingest metadata, stale DB hashes, BFF caching, and detail/replay title fallbacks still served old or wrong values.
**next_action**: Bugs 1/2 re-fixed and verified for Codex/Claude API paths. Bugs 4/5 remain layout work.

## Evidence

- timestamp: 2026-05-07T00:00:00Z
  source: code inspection
  detail: >
    Two parallel route group architectures coexist:
    - `app/(shell)/` — old OVAO-era layout using `components/hud/shell-header.tsx`, `components/dashboard/sidebar-nav.tsx`, `components/dashboard/dashboard-right-rail.tsx`
    - `app/(tool-shell)/[tool]/` — new multi-source layout using `components/shell/shell-header.tsx`, `components/shell/sidebar-nav.tsx`, `components/shell/right-rail.tsx`
    The `(tool-shell)` routes are the active ones (Phase 4+). The `(shell)` routes are legacy.

- timestamp: 2026-05-07T00:01:00Z
  source: code inspection — Bug 1 & 2 (label/project = "default")
  detail: >
    The `SessionInfo` type from `gateway/adapter-types.ts` has `label?: string` and no `project` field.
    The `TraceSession` type from `types/trace.ts` has `project: string` but no `label` field.
    In the OLD route `app/(shell)/sessions/page.tsx`, the `SessionsTable` component uses `session.label || session.key` (from SessionInfo).
    In the NEW route `app/(tool-shell)/[tool]/sessions/page.tsx`, `SessionExplorerTable` uses `renderCellValue()` which tries `dynamicSession.label || session.project || session.id`.
    The `renderCellValue` function in `session-explorer-table.tsx` line 90 does `dynamicSession.label` first — but `TraceSession` has no `label` field. It falls through to `session.project`.
    The `project` field on `TraceSession` is populated by the ingest service. If the ingest returns "default" for project, that is what shows.
    ROOT CAUSE: The label accessor in session columns expects a `label` field that doesn't exist on `TraceSession`. The fallback to `project` shows whatever the ingest returns — likely "default" because the ingest service doesn't map working directory from session data.

- timestamp: 2026-05-07T00:02:00Z
  source: code inspection — Bug 3 (title changes)
  detail: >
    In the NEW shell header (`components/shell/shell-header.tsx` line 22):
    `{brand.name.toUpperCase()}`
    The `brand` comes from `definition.ui.brand` which is tool-specific.
    For OpenClaw: `brand.name = 'OpenClaw'` → displays "OPENCLAW"
    For Claude Code: likely different
    For All Sources: `brand.name = 'All Sources'` → displays "ALL SOURCES"
    The user expects the title to always show "AGENTS TRACING" regardless of which tool is selected.
    The OLD header (`components/hud/shell-header.tsx` line 26) hardcodes "OVAO".
    ROOT CAUSE: `brand.name` is per-tool and changes with navigation. It should be a fixed application-level brand name, not the tool-specific brand name.

- timestamp: 2026-05-07T00:03:00Z
  source: code inspection — Bug 4 & 5 (layout)
  detail: >
    The current `ShellFrame` layout (`components/shell/shell-frame.tsx`) has:
    `gridTemplateColumns: '56px minmax(0, 1fr) 360px'` (sidebar | main content | right rail)
    The right rail (`components/shell/right-rail.tsx`) shows `SessionsDetailRail` only when a session is selected.
    The user's expected layout is:
    - Sessions list should be IN the right rail (like the agentsview pattern)
    - Middle area shows overview/dashboard by default
    - Clicking a session in the right rail opens details in the middle area
    CURRENT behavior:
    - Sessions are in a full page at `/{tool}/sessions` (the middle area)
    - Right rail shows session detail only when selected (overlay, not a list)
    ROOT CAUSE: The layout architecture places sessions as a full page in the main content area rather than as a persistent list in the right rail. The `DashboardRightRail` in the old layout shows event feed/activity/providers tabs, not sessions. The `RightRail` in the new layout shows session detail only. Neither rail contains a sessions list.
    The agentsview pattern requires: sessions list in the right rail persistently visible, with click-to-select opening details in the main area.

- timestamp: 2026-05-07T17:34:00+08:00
  source: runtime verification — Bug 1 & 2 reopen
  detail: >
    Recent commits fixed the table accessor to use `TraceSession.name`, but runtime still returned wrong data.
    Direct DB/API inspection showed four missed causes:
    1) `ingest/parser/codex.ts` only understood `session_meta` / `response_item` fields, while real Codex logs use `payload`, so Codex rows had zero parsed messages and empty names.
    2) Claude project extraction decoded `~/.claude/projects/-Users-ebbi-Work-ai-dashboard-projects...` by replacing every `-` with `/`, corrupting hyphenated directory names into paths like `//Users/ebbi/Work/ai/dashboard/projects/...`.
    3) DB migration v3 only cleared `file_hash` when `name` was empty; rows with non-empty names but corrupted projects stayed skip-cached.
    4) Next BFF session lists were cached, so reindexed data could still appear stale in the frontend.
    Frontend detail surfaces also still used project as the title fallback: `sessions-detail-rail.tsx` and `replay-header.tsx`.

- timestamp: 2026-05-07T17:35:00+08:00
  source: verification
  detail: >
    Fixed Codex payload parsing, Claude cwd extraction, project/name derivation, v5 stale-cache invalidation, no-store BFF session lists, and detail/replay title fallback.
    Verified `pnpm test:run tests/unit/ingest/codex-parser.test.ts tests/unit/ingest/claude-parser.test.ts tests/unit/ingest/sync.test.ts lib/agent-tools/server-adapter.test.ts` passed 39 tests.
    Verified `pnpm typecheck` and `pnpm typecheck:ingest` passed.
    Verified direct ingest API and BFF now return Codex sessions with non-default project/name and Claude sessions with real cwd paths.

## Eliminated

- Gateway data mapping issue for labels: The old `(shell)` route uses Gateway `SessionInfo` which has a `label` field, but the new `(tool-shell)` route uses ingest `TraceSession` which does not. The "default" strings are not coming from the Gateway — they come from the ingest service's `project` field default.

## Resolution

### root_cause:
Five bugs with three distinct root causes:

**Bugs 1 & 2 (FIXED after reopen):**
The first fix was incomplete. It added `TraceSession.name` and table display support, but real runtime data was still wrong because Codex parser did not handle real `payload` JSONL, Claude project extraction corrupted hyphenated cwd paths, old rows remained skip-cached by `file_hash`, the BFF cached session lists, and detail/replay views still used `project` as session title fallback. Fixed by parsing Codex payload logs, using cwd from parser metadata, adding v5 metadata cache invalidation, disabling BFF session-list caching, and using `session.name || id` for detail/replay titles.

**Bug 3 (FIXED):**
`components/shell/shell-header.tsx` rendered `brand.name.toUpperCase()` which changed per tool. Fixed by hardcoding "AGENTS TRACING". Also removed `brand.versionLabel` per UAT feedback.

**Bugs 4 & 5 (NOT YET FIXED):**
The current `ShellFrame` grid layout has sessions as a separate full page route (`/{tool}/sessions`) in the main content area. The right rail shows only a session detail panel (or is empty). The expected agentsview pattern has a persistent sessions list in the right rail with overview/details in the main area. The `DashboardRightRail` shows feed/activity/providers, and the new `RightRail` shows `SessionsDetailRail` only. Neither contains a sessions list.
