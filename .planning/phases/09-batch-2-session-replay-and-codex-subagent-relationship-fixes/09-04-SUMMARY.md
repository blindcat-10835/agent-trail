---
phase: 09-batch-2-session-replay-and-codex-subagent-relationship-fixes
plan: "04"
title: Codex patch category and subagent event anchoring
subsystem: parser
tags:
  - codex-parser
  - apply-patch
  - subagent-link
  - tool-result-pairing
dependency_graph:
  requires:
    - phase-08-parser-message-ordinal
  provides:
    - codex-patch-edit-category
    - codex-subagent-link-message-ordinal
    - codex-spawn-end-null-child-guard
  affects:
    - ingest/parser/codex.ts
    - tests/unit/ingest/codex-parser.test.ts
tech_stack:
  added: []
  patterns:
    - call_id to messageOrdinal map for parser-side subagent link anchoring
    - explicit edit-like Codex tool classification before generic category fallback
key_files:
  created: []
  modified:
    - ingest/parser/codex.ts
    - tests/unit/ingest/codex-parser.test.ts
decisions:
  - "Codex `apply_patch`, `patch`, and patch/file_edit-like names classify as `Edit` without parsing or executing patch content"
  - "`collab_agent_spawn_end` emits a subagent link only when `new_thread_id` is a non-empty string"
  - "Subagent link anchoring uses existing `TraceSubagentLink.messageOrdinal`; no database schema expansion for nickname/status"
requirements-completed:
  - SRC-03
  - SRC-04
  - TURN-03
  - REPLAY-03
metrics:
  duration: "local"
  completed: "2026-05-10"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
  tests_added: 4
  tests_passing: 30
---

# Phase 09 Plan 04: Codex Patch Category and Subagent Event Anchoring Summary

## One-Liner

Codex patch-like tools now classify as `Edit`, tool result pairing remains intact, and `collab_agent_spawn_end` links can anchor to the spawning tool call ordinal.

## Performance

- **Duration:** local execution during Wave 1
- **Started:** 2026-05-10
- **Completed:** 2026-05-10
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- Added parser regressions for `apply_patch`, `patch`, `file_edit`, valid `collab_agent_spawn_end`, and null child-thread spawn-end events.
- Updated Codex category inference so patch-like tools resolve to `Edit`.
- Added `call_id -> messageOrdinal` tracking so spawn-end subagent links can point back to the spawning tool call when the call id is known.

## Task Commits

1. **Task 1: Add Codex parser regressions for patch tools and spawn-end links** - `df58556` (test)
2. **Task 2: Implement Codex patch category inference and link anchoring** - `d0c6865` (fix)

## Files Created/Modified

- `tests/unit/ingest/codex-parser.test.ts` - Added 09-04 parser regressions.
- `ingest/parser/codex.ts` - Added patch category inference and spawn-end ordinal anchoring.

## Decisions Made

- Kept nickname/status out of the canonical relationship model for this phase.
- Ignored invalid or missing `new_thread_id` values instead of creating broken subagent links.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- RED tests failed as expected before parser changes.

## Verification

- `pnpm test:run tests/unit/ingest/codex-parser.test.ts tests/unit/ingest/turn-activity-regression.test.ts` - passed
- `pnpm typecheck:ingest` - passed

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave 2 Codex relationship backfill can use parser-emitted subagent link activities with valid child thread ids and message ordinals.

## Self-Check: PASSED

- [x] Codex patch-like tools are categorized as `Edit`.
- [x] Tool outputs still pair by `call_id`.
- [x] Valid `collab_agent_spawn_end` creates a usable subagent link.
- [x] Null child thread ids are ignored.

---
*Phase: 09-batch-2-session-replay-and-codex-subagent-relationship-fixes*
*Completed: 2026-05-10*
