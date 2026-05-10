---
phase: 09
slug: batch-2-session-replay-and-codex-subagent-relationship-fixes
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-10
---

# Phase 9 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick ingest command | `pnpm test:run tests/unit/ingest/stars-route-order.test.ts tests/unit/ingest/codex-parser.test.ts tests/unit/ingest/codex-relationships.test.ts` |
| Quick frontend command | `pnpm test:run tests/hooks/client-hooks.test.tsx tests/unit/bff/markdown-content.test.tsx tests/unit/bff/tool-formatters.test.ts` |
| Full suite command | `pnpm typecheck && pnpm typecheck:ingest && pnpm test:run` |
| Local real-session command | `RUN_REAL_SESSION_TESTS=1 pnpm test:real-sessions` |
| Estimated targeted runtime | under 60 seconds |

## Sampling Rate

- After every task commit: run the relevant quick ingest or frontend command for touched layer.
- After every plan wave: run `pnpm typecheck` and/or `pnpm typecheck:ingest` for touched TypeScript projects, then the targeted tests for that wave.
- Before `$gsd-verify-work`: run `pnpm typecheck && pnpm typecheck:ingest && pnpm test:run`.
- For Codex relationship closure: run the opt-in real-session command when local Codex logs are available.
- Max feedback latency target: under 60 seconds for targeted tests.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | DATA-05 | T-09-01 route integrity | Static starred route returns persisted ids instead of leaking into session detail lookup | unit | `pnpm test:run tests/unit/ingest/stars-route-order.test.ts` | W0 | pending |
| 09-01-02 | 01 | 1 | DATA-05, REPLAY-06 | T-09-02 BFF boundary | Frontend continues to load/toggle stars only through BFF routes | unit | `pnpm test:run tests/hooks/client-hooks.test.tsx` | yes | pending |
| 09-02-01 | 02 | 1 | REPLAY-01 | T-09-03 render stability | Search text is highlighted without mutating markdown source or crashing ReactMarkdown | unit | `pnpm test:run tests/unit/bff/markdown-content.test.tsx` | W0 | pending |
| 09-02-02 | 02 | 1 | REPLAY-02 | T-09-04 pagination integrity | Aggregate pagination tracks per-source offsets and totals without duplicate sessions | hook | `pnpm test:run tests/hooks/client-hooks.test.tsx` | yes | pending |
| 09-03-01 | 03 | 2 | REPLAY-03, REPLAY-06 | T-09-05 display integrity | Edit previews render readable file/diff content without executing tool data | unit | `pnpm test:run tests/unit/bff/tool-formatters.test.ts` | W0 | pending |
| 09-03-02 | 03 | 2 | SRC-03, SRC-04, TURN-03 | T-09-06 parser integrity | Codex patch tools are categorized as Edit while preserving tool call/result pairing | unit | `pnpm test:run tests/unit/ingest/codex-parser.test.ts tests/unit/ingest/turn-activity-regression.test.ts` | yes | pending |
| 09-04-01 | 04 | 3 | DATA-04, SRC-04, TURN-05 | T-09-07 relationship integrity | Codex subagent rows are backfilled idempotently regardless of parse order | unit | `pnpm test:run tests/unit/ingest/codex-relationships.test.ts tests/unit/ingest/sync.test.ts` | W0 | pending |
| 09-04-02 | 04 | 3 | REPLAY-04 | T-09-08 list correctness | Default session lists hide Codex subagents only via `relationship_type = 'subagent'` | unit | `pnpm test:run tests/unit/ingest/sessions-api.test.ts tests/unit/ingest/codex-relationships.test.ts` | yes/W0 | pending |
| 09-05-01 | 05 | 4 | DATA-04, REPLAY-01, REPLAY-04 | T-09-09 local privacy | Real-session verification inspects local structure without committing user logs | local | `RUN_REAL_SESSION_TESTS=1 pnpm test:real-sessions` | yes | pending |

## Wave 0 Requirements

Existing Vitest, jsdom, parser, sync, hook, and local corpus infrastructure covers the phase. The first implementation tasks should create the missing focused regression files before production code depends on them:

- [ ] `tests/unit/ingest/stars-route-order.test.ts` - starred route collision regression.
- [ ] `tests/unit/bff/markdown-content.test.tsx` - ReactMarkdown search highlight regression.
- [ ] `tests/unit/bff/tool-formatters.test.ts` - edit/diff formatter cases.
- [ ] `tests/unit/ingest/codex-relationships.test.ts` - Codex parent/child backfill and default filtering cases.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Codex parent `019df211-e301-7561-bfa5-9aeba110c584` hides spawned child sessions from default Codex lists | DATA-04, TURN-05, REPLAY-04 | Requires the user's local Codex session corpus and a full/background sync run | Reindex Codex, open `/codex/sessions`, confirm the parent appears and child threads from `collab_agent_spawn_end` do not appear as root rows; expand the parent replay subagent block if available. |
| Edit and patch previews are readable in the replay page | REPLAY-03, REPLAY-06 | Visual scan catches wrapping, spacing, and copy-surface regressions beyond pure formatter output | Open a Claude `Edit`/`MultiEdit` or Codex `apply_patch` turn and verify path labels plus diff/patch content render without raw-only JSON fallback. |
| Aggregate all-source right rail keeps loading after the first page | REPLAY-02 | Browser sentinel behavior depends on viewport and active local data volume | Open `/all/sessions` or the aggregate rail, scroll to the bottom, and verify additional rows append while totals remain indexed totals. |

## Validation Sign-Off

- [x] All planned bug surfaces have automated verification commands or explicit local/manual coverage.
- [x] Sampling continuity: no three consecutive planned tasks lack automated verification.
- [x] Wave 0 identifies every new focused regression file.
- [x] No watch-mode flags in validation commands.
- [x] Feedback latency target is under 60 seconds for targeted commands.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
