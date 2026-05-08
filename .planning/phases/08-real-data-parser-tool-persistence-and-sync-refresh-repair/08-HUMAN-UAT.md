---
status: partial
phase: 08-real-data-parser-tool-persistence-and-sync-refresh-repair
source:
  - 08-VERIFICATION.md
started: 2026-05-09T05:40:00Z
updated: 2026-05-09T05:40:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Named session 606dac00 — key=null eliminated and structured tool blocks in replay

expected: Browser console shows no `key=null` / `unique "key" prop` warning when rendering session list or replay for this session; tool blocks in replay show structured inputs and results.

Steps:
- Ensure dev servers running (`pnpm dev`)
- Add `606dac00-4f36-40e2-89c8-da91416b6b39` to `.local/real-session-corpus.json` tagged `claude-key-null-risk`
- Run `RUN_REAL_SESSION_TESTS=1 pnpm test:real-sessions` — should pass `count(*) = count(id)` assertion
- Open session in browser, navigate to replay, open DevTools console — no `key=null` warning

result: [pending]

---

### 2. Named session effac644 — discoverable after force sync

expected: Session appears in claude-code session list after clicking the right-rail refresh button (which now triggers ingest sync before refetch).

Steps:
- Ensure dev servers running (`pnpm dev`)
- Add `effac644-0eb7-4fc8-9e60-6c8127d51eae` to `.local/real-session-corpus.json` tagged `claude-discoverability`
- Run `RUN_REAL_SESSION_TESTS=1 pnpm test:real-sessions`
- Or: navigate to claude-code session list → click refresh → confirm session appears

result: [pending]

---

### 3. Right-rail refresh button spins during sync

expected: Clicking refresh in the right rail for any source shows a spinner, disables the button, calls ingest sync, then reloads the session list. Error state is visible (not silently swallowed) if sync fails.

Steps:
- Open any source session list
- Click the refresh button
- Verify button shows "Syncing..." tooltip and is disabled while running
- Verify session list updates after sync completes

result: [pending]

---

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
