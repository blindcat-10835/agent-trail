---
phase: 02-design-tokens-theme
plan: 01
subsystem: ui
tags: [design-tokens, oklch, theme-switching, fonts, tailwind-v4, next-font, zustand]

# Dependency graph
requires:
  - phase: 01-scaffolding-toolchain
    provides: [Tailwind v4 CSS-first config, shadcn/ui Nova preset, Next.js 16 App Router structure]
provides:
  - HUD OKLCH color token system with light/dark themes
  - JetBrains Mono + Inter font loading via next/font/google
  - data-theme attribute switching mechanism (not .dark class)
  - Zustand theme store with localStorage persistence
  - Theme toggle component with HUD styling
affects: [03-shell-layout, 04-agent-dashboard, 05-office-layout, 06-workspace]

# Tech tracking
tech-stack:
  added: [next/font/google (JetBrains Mono, Inter), Zustand persist middleware]
  patterns: [data-theme attribute switching, FOUC prevention with inline script, CSS variable font injection]

key-files:
  created: [stores/theme-store.ts, components/hud/theme-toggle.tsx]
  modified: [app/globals.css, app/layout.tsx]

key-decisions:
  - "Use data-theme attribute instead of .dark class for multi-theme expansion (v2 accent colors)"
  - "Zustand store over React Context for SSR-safe theme state management"
  - "Inline script in <head> for FOUC prevention (suppressHydrationWarning on <html>)"
  - "System preference detection with localStorage override (default: 'system')"

patterns-established:
  - "Pattern 1: All shadcn/ui tokens overridden with design reference OKLCH values"
  - "Pattern 2: CSS variables for fonts (--font-jetbrains-mono, --font-inter) injected via next/font"
  - "Pattern 3: Theme state stored in localStorage with 'theme-storage' key, partialized to persist only theme value"

requirements-completed: [ENGR-02]

# Metrics
duration: 18min
completed: 2026-04-30
---

# Phase 2 Plan 1: Design Tokens and Theme System Summary

**HUD OKLCH color token system with data-theme switching, JetBrains Mono + Inter font loading, and Zustand-managed theme persistence**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-29T20:07:28Z
- **Completed:** 2026-04-29T20:25:00Z
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments
- Complete HUD OKLCH color token system mapped from design reference (WCAG AA compliant)
- JetBrains Mono + Inter font loading with zero layout shift via next/font/google
- data-theme attribute switching mechanism replacing .dark class pattern
- Zustand theme store with localStorage persistence and system preference detection
- Theme toggle component temporarily positioned for testing (moves to Shell in Phase 3)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement HUD OKLCH color tokens and data-theme selectors** - `39ab4eb` (feat)
2. **Task 2: Configure JetBrains Mono + Inter font loading and FOUC prevention** - `d4257fe` (feat)
3. **Task 3: Create Zustand theme state management with localStorage persistence** - `4c7bebc` (feat)
4. **Task 4: Create theme toggle component with HUD styling** - `47064fe` (feat)

**Plan metadata:** N/A (will be committed separately as docs)

## Files Created/Modified

### Created
- `stores/theme-store.ts` - Zustand store with persist middleware for theme state management
- `components/hud/theme-toggle.tsx` - Client-side theme toggle button with Sun/Moon icons

### Modified
- `app/globals.css` - HUD OKLCH color tokens, data-theme selectors, accent variants
- `app/layout.tsx` - Font loading (JetBrains Mono + Inter), FOUC prevention script, data-theme initialization

## Decisions Made

1. **data-theme over .dark class**: Enables multi-theme expansion (v2 accent colors) and more semantic HTML
2. **Zustand over React Context**: Better SSR safety, smaller bundle, less boilerplate for theme state
3. **Inline script FOUC prevention**: Sets data-theme synchronously before React hydration with suppressHydrationWarning
4. **System preference default**: Initial theme follows `prefers-color-scheme`, manual override stored in localStorage

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all artifacts fully implemented with no placeholder code.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: localStorage_tampering | stores/theme-store.ts | Theme value from localStorage could be corrupted; mitigated by TypeScript enum validation |
| threat_flag: data-theme_injection | app/layout.tsx | Inline script sets data-theme; mitigated by strict enum values in setTheme function |

## Issues Encountered

**grep command flag parsing**: Initial grep commands for CSS variables failed due to `--font-` being interpreted as flags. Fixed by using `grep 'font-jetbrains-mono'` instead of `grep --font-jetbrains-mono`. Did not affect implementation.

## User Setup Required

None - no external service configuration required. Theme system is client-side only with zero API dependencies.

## Next Phase Readiness

**Ready for Phase 3 (Shell Layout and HUD Components):**
- Design tokens fully available via CSS variables (background, foreground, accent, border hierarchies)
- Font system operational with JetBrains Mono (data/code) and Inter (sans scenarios)
- Theme switching mechanism tested and working (light/dark toggle persists across reloads)
- data-theme attribute pattern established for Phase 3 HUD component consumption

**Integration points for Phase 3:**
- Shell layout should consume `--bg`, `--fg`, `--border` tokens from globals.css
- Theme toggle moves from temporary position (fixed top-4 right-4) to formal Shell location
- HUD components (Card, Panel, Header) will reference established color hierarchy

**No blockers or concerns.**

## Self-Check: PASSED

**Files Created:**
- ✅ `.planning/phases/02-design-tokens-theme/02-01-SUMMARY.md` - Plan summary with all required sections
- ✅ `stores/theme-store.ts` - Zustand theme store with persist middleware
- ✅ `components/hud/theme-toggle.tsx` - Theme toggle button component

**Commits Verified:**
- ✅ `39ab4eb` - feat(02-01): implement HUD OKLCH color tokens and data-theme selectors
- ✅ `d4257fe` - feat(02-01): configure JetBrains Mono + Inter font loading and FOUC prevention
- ✅ `4c7bebc` - feat(02-01): create Zustand theme state management with localStorage persistence
- ✅ `47064fe` - feat(02-01): create theme toggle component with HUD styling
- ✅ `f53cd8c` - docs(02-01): complete Phase 2 Plan 1 - design tokens and theme system

**Build Verification:**
- ✅ `pnpm build` succeeds with no errors
- ✅ All acceptance criteria passed
- ✅ No .dark class selectors remain (all replaced with [data-theme="dark"])
- ✅ All OKLCH color values match design reference

**Documentation Updates:**
- ✅ STATE.md updated with Phase 2 completion, decisions, metrics
- ✅ ROADMAP.md updated with Phase 2 marked complete, progress updated

---
*Phase: 02-design-tokens-theme*
*Completed: 2026-04-30*
