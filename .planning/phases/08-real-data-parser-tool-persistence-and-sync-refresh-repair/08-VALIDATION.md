---
phase: 08
slug: real-data-parser-tool-persistence-and-sync-refresh-repair
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-09
---

# Phase 8 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick parser command | `pnpm test:run tests/unit/ingest/claude-parser.test.ts tests/unit/ingest/codex-parser.test.ts tests/fixtures/parser-regression/real-shape.test.ts` |
| Sync command | `pnpm test:run tests/unit/ingest/sync.test.ts tests/unit/ingest/tool-persistence.test.ts tests/unit/ingest/turn-activity-regression.test.ts` |
| BFF/hook command | `pnpm test:run tests/hooks/client-hooks.test.tsx tests/unit/bff/sync-route.test.ts` |
| Full suite command | `pnpm typecheck && pnpm typecheck:ingest && pnpm test:run` |
| Local real-session command | `RUN_REAL_SESSION_TESTS=1 pnpm test:real-sessions` |

## Sampling Rate

- After every task commit: run the relevant quick command for touched layer.
- After every plan wave: run `pnpm typecheck:ingest` for parser/sync waves, `pnpm typecheck` for BFF/frontend wave.
- Before final verification: run full suite plus opt-in local corpus if local logs are available.
- Max feedback latency target: under 60 seconds for targeted tests.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | HARD-01 | Privacy | Redacted fixture only; local manifest gitignored | unit/local | `pnpm test:run tests/fixtures/parser-regression/real-shape.test.ts` | W0 | pending |
| 08-01-02 | 01 | 1 | HARD-01 | Privacy | Full local logs never committed | local | `RUN_REAL_SESSION_TESTS=1 pnpm test:real-sessions` | W0 | pending |
| 08-02-01 | 02 | 2 | SRC-03 | N/A | Codex unknown real payloads do not spam warnings | unit | `pnpm test:run tests/unit/ingest/codex-parser.test.ts` | yes | pending |
| 08-02-02 | 02 | 2 | SRC-02, SRC-05 | Privacy | Claude tool outputs parsed as data, never executed | unit | `pnpm test:run tests/unit/ingest/claude-parser.test.ts` | yes | pending |
| 08-03-01 | 03 | 3 | DATA-02, TURN-03 | Data integrity | Derived rows replaced transactionally | unit | `pnpm test:run tests/unit/ingest/tool-persistence.test.ts` | W0 | pending |
| 08-03-02 | 03 | 3 | TURN-01, REPLAY-03 | Data integrity | `assembleTurns()` reads DB tool rows | unit | `pnpm test:run tests/unit/ingest/turn-activity-regression.test.ts` | W0 | pending |
| 08-04-01 | 04 | 4 | DATA-04 | BFF boundary | Frontend calls BFF sync, not ingest directly | unit | `pnpm test:run tests/hooks/client-hooks.test.tsx tests/unit/bff/sync-route.test.ts` | W0 | pending |
| 08-05-01 | 05 | 5 | DATA-05, HARD-01 | Privacy | Target sessions verified structurally only | local | `RUN_REAL_SESSION_TESTS=1 pnpm test:real-sessions` | W0 | pending |

## Wave 0 Requirements

Existing infrastructure covers the framework. Plan 01 creates the missing real-shape fixtures and local corpus harness before parser and persistence changes depend on them.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser replay visually shows tool/result blocks | REPLAY-01, REPLAY-03 | Requires running ingest + Next dev servers and selecting target local sessions | Force sync, open affected Claude/Codex sessions, verify tool blocks appear under the expected turn. |
| No React `key=null` warning for target session | DATA-02, REPLAY-01 | Browser console observation is still useful after DB id fix | Open `606dac00-4f36-40e2-89c8-da91416b6b39` replay and watch console. |

## Validation Sign-Off

- [x] All plans have automated verification commands.
- [x] No three consecutive tasks lack automated verification.
- [x] Local real data path is opt-in and privacy-safe.
- [x] No watch-mode flags in validation commands.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending

