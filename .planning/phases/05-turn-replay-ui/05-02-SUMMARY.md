---
phase: 05-turn-replay-ui
plan: 02
subsystem: Replay Page Shell — Route + Header + Right Rail + Navigation Wiring
tags: [replay-page, breadcrumb, right-rail, navigation, session-status]
requires: [05-01]
provides:
  - replay-page-route
  - replay-header
  - replay-right-rail
  - session-row-navigation
  - view-session-button
affects:
  - app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx
  - app/(tool-shell)/[tool]/sessions/page.tsx
  - components/sessions/sessions-detail-rail.tsx
  - components/replay/replay-header.tsx
  - components/replay/replay-right-rail.tsx
tech-stack:
  added: []
  patterns:
    - "Next.js 16 async params with use()"
    - "Local useState for replay right rail (not shared useUIStore)"
    - "SessionStatusBar derived from TraceSession metrics"
    - "UI-SPEC copywriting contract for all user-facing text"
    - "4-column KPI grid matching sessions-detail-rail pattern"
key-files:
  created:
    - app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx
    - components/replay/replay-header.tsx
    - components/replay/replay-right-rail.tsx
  modified:
    - app/(tool-shell)/[tool]/sessions/page.tsx
    - components/sessions/sessions-detail-rail.tsx
decisions:
  - "Replay right rail uses local useState, not useUIStore.rightRailOpen (which is for sessions list right rail)"
  - "Session row click both sets selectedSessionId (for right-rail highlight) and navigates to replay"
  - "View Session button uses window.location.href in detail rail (no Next.js router in child component)"
  - "Replay page renders inside existing ShellFrame layout via [tool] route group"
  - "Status display priority: error > aborted > truncated > parser-warning > active > idle"
metrics:
  duration: ~3m
  completed_date: 2026-05-07
  task_count: 2
  file_count: 5
  commits: 2
---

# Phase 5 Plan 2: Replay Page Shell + Header + Right Rail + Navigation Wiring

Creates the replay page route at `/openclaw/sessions/[sessionId]`, the ReplayHeader with breadcrumb and session name, the collapsible ReplayRightRail with session metadata KPI grid and turn index, and wires two navigation entry points (session row click in Session Explorer and "View Session" button in session detail rail).

## Completed Tasks

### Task 1: Replay page route + shell layout

| Aspect       | Implementation |
|-------------|----------------|
| **Route**   | `app/(tool-shell)/[tool]/sessions/[sessionId]/page.tsx` — `'use client'` with `use(params)` for Next.js 16 async params |
| **Data hooks** | `useAgentTool`, `useSessionDetail`, `useSessionTurns` wired to BFF proxy |
| **Error states** | NOT FOUND (Session data is not available. BACK TO SESSIONS), ERR (Could not load session turns. RETRY LOAD) per UI-SPEC |
| **Loading state** | 3 `Skeleton` placeholder turn cards on initial load, no text |
| **Empty state** | NO TURNS with explanation text per UI-SPEC |
| **Session status** | `SessionStatusBar` with 8 status configs (LIVE, IDLE, ABORTED, ERROR, RUNNING, AWAITING USER, TRUNCATED, PARSE WARNINGS) |
| **Right rail** | Local `useState(false)` for `replayRightRailOpen` — NOT using shared `useUIStore.rightRailOpen` |
| **Navigation wiring** | Session row click in `sessions/page.tsx` now calls `setSelectedSessionId(id)` + `router.push(href('/sessions/' + id))` |
| **View Session button** | Added to `sessions-detail-rail.tsx` after KPI strip, uses `window.location.href` for child-component navigation |

### Task 2: ReplayHeader + ReplayRightRail components

| Aspect       | Implementation |
|-------------|----------------|
| **ReplayHeader** | Breadcrumb with clickable "Sessions" link (accent color), ">" separator, truncated session name; 20px semibold session name heading |
| **ReplayRightRail** | 320px panel with SESSION INFO header + close button; 4-column KPI grid (TOKENS, COST, KIND, CREATED); metadata fields (SESSION ID monospace, PROJECT, MODEL, STARTED, ENDED, MESSAGES); TURNS section with 5-column numbered turn index buttons that scroll-to-turn |
| **Typography** | 11px semibold micro labels with `tracking-[0.2em]`, 9px KPI labels, 10px font-mono session ID, 12px body values |
| **Colors** | `bg-card` background, `text-muted-foreground` labels, `text-foreground` values, `border-border` borders, `hover:bg-accent/10` turn buttons |

## Deviations from Plan

None — plan executed exactly as written. All code follows the plan's provided templates with exact UI-SPEC copywriting, colors, spacing, and typography.

## Known Stubs

The plan intentionally defers the TurnTimeline component to Plan 03. The content area currently shows:
- 3 skeleton cards during loading
- "N turns loaded — TurnTimeline pending (Plan 03)" when turns data is available
- "NO TURNS" empty state when no turns are parsed

The model field in ReplayRightRail uses `(session as any).model` — when ingest provides model data in a future phase, this will auto-populate. Currently shows `-` as fallback.

## Threat Flags

None. Both threat model dispositions (T-05-03 accept, T-05-04 mitigate via BFF validation) are handled as specified. No new endpoints, auth paths, or file access patterns introduced.

## Verification Results

- `pnpm typecheck` — **PASS** (0 errors)
- All 5 files created/modified verified on disk
- Both commits verified in git history
- All Task 1 acceptance criteria met (13/13 grep criteria)
- All Task 2 acceptance criteria met (11/11 grep criteria, except "Sessions >" literal which is composed of separate elements)

## Self-Check: PASSED

- All 5 key files found on disk
- Commits `a2ae078` (Task 1) and `5e17eab` (Task 2) verified in git log
- `pnpm typecheck` returns no errors
