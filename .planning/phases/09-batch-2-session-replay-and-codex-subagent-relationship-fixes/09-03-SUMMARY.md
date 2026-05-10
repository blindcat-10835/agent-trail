---
phase: 09-batch-2-session-replay-and-codex-subagent-relationship-fixes
plan: 03
subsystem: replay-ui
tags: [react-markdown, search-highlighting, tool-formatter, diff-display, tdd]

requires:
  - phase: 05-turn-replay-ui
    provides: MarkdownContent component and ToolBlock component
  - phase: 09-batch-2-session-replay-and-codex-subagent-relationship-fixes
    provides: research and patterns for react-markdown component overrides and edit formatter

provides:
  - ReactMarkdown-safe search highlighting through component overrides
  - Pure edit/patch tool display formatter
  - ToolBlock integration showing formatted diffs and file paths
  - Regression test coverage for markdown highlighting and tool formatting

affects: [replay-ui, turn-card, tool-display]

tech-stack:
  added: []
  patterns: [react-markdown-components-override, pure-tool-display-formatter, discriminated-union-display-model]

key-files:
  created:
    - components/replay/tool-formatters.ts
    - tests/unit/bff/tool-formatters.test.ts
  modified:
    - components/replay/markdown-content.tsx
    - components/replay/tool-block.tsx
    - tests/unit/bff/markdown-content.test.tsx

key-decisions:
  - "Use ReactMarkdown components overrides (p, li, strong, em, a) for search highlighting instead of cloneElement"
  - "Format tool display through pure function returning discriminated union ToolDisplay type"
  - "Show filePath in collapsed ToolBlock header for edit-like tools"

patterns-established:
  - "ReactMarkdown component overrides: highlight through p/li/strong/em/a overrides keeping children as string"
  - "Pure tool formatter: formatToolDisplay returns discriminated union with kind, content, filePath, copyText"

requirements-completed: [TURN-03, TURN-04, REPLAY-01, REPLAY-03, REPLAY-06]

duration: 7min
completed: 2026-05-10
---

# Phase 09 Plan 03: Replay Markdown safety and edit tool display Summary

**ReactMarkdown-safe search highlighting via component overrides plus pure edit/patch tool formatter with diff previews**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-10T10:55:35Z
- **Completed:** 2026-05-10T11:03:21Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Fixed ReactMarkdown crash when search highlighting passed React nodes instead of string children
- Search highlighting now uses component overrides (p, li, strong, em, a) preserving Markdown rendering
- Created pure tool formatter supporting Edit, MultiEdit, Write, apply_patch with readable diff/patch previews
- ToolBlock now shows formatted content with file paths in collapsed header and diff-style input display

## Task Commits

Each task was committed atomically:

1. **Task 1: Make Markdown search highlighting ReactMarkdown-safe** - `65da7a1` (fix)
2. **Task 2: Add edit and patch tool formatter** - `3455c51` (feat)

_Note: Both tasks followed TDD flow — tests existed before implementation_

## Files Created/Modified
- `components/replay/markdown-content.tsx` - Replaced cloneElement approach with ReactMarkdown components overrides
- `components/replay/tool-formatters.ts` - Pure edit/patch display formatter (new)
- `components/replay/tool-block.tsx` - Integrated formatToolDisplay for formatted rendering and copyText
- `tests/unit/bff/markdown-content.test.tsx` - Added jest-dom import; 4 crash/regression tests
- `tests/unit/bff/tool-formatters.test.ts` - 8 formatter regression tests (new)

## Decisions Made
- Used ReactMarkdown `components` prop overrides instead of remark/rehype AST plugin (smaller scope, directly documented)
- Created `ToolDisplay` discriminated union type with kind-specific fields (`filePath` only on edit/multiedit/write)
- Format diff hunks as simple `-old/+new` lines without external diff library
- `apply_patch` detection checks both parsed JSON and raw input string for patch markers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @testing-library/jest-dom/vitest import for toHaveAttribute**
- **Found during:** Task 1 (MarkdownContent search highlighting)
- **Issue:** Test used `toHaveAttribute` matcher which requires explicit jest-dom/vitest import
- **Fix:** Added `import '@testing-library/jest-dom/vitest'` to test file
- **Files modified:** tests/unit/bff/markdown-content.test.tsx
- **Verification:** All 4 markdown tests pass
- **Committed in:** 65da7a1 (Task 1 commit)

**2. [Rule 3 - Blocking] Added type narrowing guards in formatter tests**
- **Found during:** Task 2 (tool formatter)
- **Issue:** TypeScript discriminated union required type narrowing before accessing `filePath`
- **Fix:** Added `if (display.kind !== 'claude-edit') return` guards after kind assertions
- **Files modified:** tests/unit/bff/tool-formatters.test.ts
- **Verification:** typecheck passes for plan files
- **Committed in:** 3455c51 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both necessary for test correctness and type safety. No scope creep.

## Issues Encountered
- Pre-existing `tests/types.test.ts` GatewayStatus type error (out of scope, deferred)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Replay search highlighting is crash-free and Markdown-safe
- Edit/MultiEdit/Write/apply_patch blocks show readable diff/patch content
- ToolBlock copy outputs include formatted content and results
- Ready for remaining phase 09 plans (Codex subagent relationships, parser category inference)

## Self-Check: PASSED

All 5 source files and 2 commit hashes verified present.

---
*Phase: 09-batch-2-session-replay-and-codex-subagent-relationship-fixes*
*Completed: 2026-05-10*
