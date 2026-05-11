---
phase: 11-hud-shell-foundation
plan: 01
subsystem: ui
tags: [oklch, css-variables, status-palette, ingest-health, tailwind-v4, hud-shell]

# Dependency graph
requires:
  - phase: 10-bff-proxy
    provides: useIngestStatus hook, BFF health endpoint, AgentToolProvider context
provides:
  - Status palette CSS variables (--status-success, --status-warning, --status-parser-warning) in both light/dark themes
  - Real-time ingest health display in status bar (ONLINE/OFFLINE/RECONN)
  - Verified OKLCH design token alignment with design-notes spec
affects: [ui-components, status-bar, shell-chrome]

# Tech tracking
tech-stack:
  added: []
  patterns: [status-palette-css-custom-properties, tabular-nums-for-dynamic-values]

key-files:
  created: []
  modified:
    - app/globals.css
    - components/shell/shell-status-bar.tsx

key-decisions:
  - "Status palette uses plain CSS custom properties (not Tailwind @theme tokens) per design-notes: used inline in components"
  - "Dark theme status colors use higher lightness (0.82 vs 0.76) for visibility on dark backgrounds"
  - "Error status continues using --destructive directly, no separate token"

patterns-established:
  - "Status palette: CSS custom properties in :root/[data-theme=dark] used via var(--status-*) in components"
  - "Ingest health: useIngestStatus hook with 4-state model (connected/disconnected/reconnecting/loading)"

requirements-completed: [UI-101, UI-102, UI-103]

# Metrics
duration: 2min
completed: 2026-05-12
---

# Phase 11 Plan 01: Design Tokens & Status Bar Summary

**Status palette CSS variables (OKLCH) in both themes + real ingest health wired into status bar**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-11T18:45:45Z
- **Completed:** 2026-05-11T18:47:57Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added status palette CSS custom properties to both light and dark themes matching design-notes exactly
- Verified all existing OKLCH tokens (accent, accent-dim, accent-ghost, grid backdrop, scanline, HUD clips, radius) already match design-notes spec
- Wired useIngestStatus hook into status bar showing real connection state (ONLINE/OFFLINE/RECONN)
- Removed fake hardcoded metrics (MEM 42.1MB, FPS 60) that had no real data source
- Applied tabular-nums to all dynamic values to prevent layout jitter

## Task Commits

Each task was committed atomically:

1. **Task 1: Add status palette CSS variables and verify design tokens** - `0e1ecf4` (feat)
2. **Task 2: Wire real ingest health into status bar** - `f9269df` (feat)

## Files Created/Modified
- `app/globals.css` - Added --status-success, --status-warning, --status-parser-warning to both :root and [data-theme=dark]
- `components/shell/shell-status-bar.tsx` - Replaced hardcoded CONN/MEM/FPS with real useIngestStatus data, added tabular-nums

## Decisions Made
- Status palette uses plain CSS custom properties (not Tailwind @theme tokens) — design-notes specifies "used inline in components, not exposed as semantic tokens"
- Dark theme status colors use 0.82 lightness vs 0.76 in light theme for better visibility
- Error status continues using --destructive directly (no separate --status-error token)
- Replaced MEM and FPS indicators (which had no real data source) with SES scope indicator

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Design token system fully verified and extended — all OKLCH tokens match design-notes
- Status bar now shows real ingest health via useIngestStatus hook
- Ready for subsequent plans: sidebar nav capability filtering, right-rail scope tabs, source-color spines

---
*Phase: 11-hud-shell-foundation*
*Completed: 2026-05-12*

## Self-Check: PASSED
- app/globals.css: FOUND
- components/shell/shell-status-bar.tsx: FOUND
- 11-01-SUMMARY.md: FOUND
- Commit 0e1ecf4: FOUND
- Commit f9269df: FOUND
- status-success in globals.css: 2 occurrences (both themes)
- useIngestStatus in status bar: 2 occurrences (import + usage)
- Hardcoded conn_8f2e: 0 (removed)
- Hardcoded MEM 42.1MB: 0 (removed)
