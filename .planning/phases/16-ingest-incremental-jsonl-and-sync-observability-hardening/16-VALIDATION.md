---
phase: 16
slug: ingest-incremental-jsonl-and-sync-observability-hardening
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-14
---

# Phase 16 - Validation Strategy

> Per-phase validation contract for append-only ingest, cursor fallback, and sync observability.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm vitest run tests/unit/ingest/sync-cursor.test.ts tests/unit/ingest/sync-incremental-write.test.ts` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~60-120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the targeted Vitest command listed in the task.
- **After every plan wave:** Run the plan-level `<verify>` command.
- **Before `$gsd-verify-work`:** `pnpm test:run`, `pnpm typecheck`, and `pnpm typecheck:ingest` must be green or documented with an environment-only limitation.
- **Max feedback latency:** 120 seconds for targeted checks.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | PERF-108 | T-16-01 | Cursor fallback rejects stale or unsafe file metadata | unit/migration | `pnpm vitest run tests/unit/ingest/db-migration.test.ts tests/unit/ingest/sync-cursor.test.ts` | W0 | pending |
| 16-01-02 | 01 | 1 | PERF-107 | T-16-01 | Complete-line offset advances only after safe append detection | unit | `pnpm vitest run tests/unit/ingest/sync-cursor.test.ts` | W0 | pending |
| 16-02-01 | 02 | 2 | PERF-107 | T-16-02 | Offset parsers read only appended complete lines | unit | `pnpm vitest run tests/unit/ingest/claude-incremental-parser.test.ts tests/unit/ingest/codex-incremental-parser.test.ts` | W0 | pending |
| 16-02-02 | 02 | 2 | PERF-108 | T-16-02 | Unsafe append state falls back to full parser | unit | `pnpm vitest run tests/unit/ingest/sync-incremental.test.ts` | W0 | pending |
| 16-03-01 | 03 | 3 | PERF-109 | T-16-03 | Append writes are idempotent and do not duplicate derived rows | unit | `pnpm vitest run tests/unit/ingest/sync-incremental-write.test.ts tests/unit/ingest/turn-activity-regression.test.ts` | W0 | pending |
| 16-04-01 | 04 | 4 | PERF-110 | T-16-04 | Debug payload exposes run history and current-file metrics without leaking file contents | unit/integration | `pnpm vitest run tests/unit/ingest/sync-scheduler.test.ts ingest/api/overview.test.ts ingest/api/sources.test.ts tests/integration/ingest/api.test.ts` | W0 | pending |
| 16-04-02 | 04 | 4 | PERF-111 | T-16-04 | One structured completion log is emitted per sync run | unit | `pnpm vitest run tests/unit/ingest/sync-observability.test.ts` | W0 | pending |
| 16-04-03 | 04 | 4 | PERF-112 | T-16-05 | Concurrency and SQLite batching are explicit and bounded | unit/config | `pnpm vitest run tests/unit/ingest/config.test.ts tests/unit/ingest/sync-observability.test.ts` | W0 | pending |

---

## Wave 0 Requirements

Existing Vitest infrastructure covers all Phase 16 requirements. New test files should be added during execution:

- `tests/unit/ingest/sync-cursor.test.ts`
- `tests/unit/ingest/claude-incremental-parser.test.ts`
- `tests/unit/ingest/codex-incremental-parser.test.ts`
- `tests/unit/ingest/sync-incremental.test.ts`
- `tests/unit/ingest/sync-incremental-write.test.ts`
- `tests/unit/ingest/sync-observability.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RSS stays bounded on a real large local JSONL append | PERF-107, PERF-110 | Local corpus size and process memory are environment dependent | Start `pnpm dev:ingest`, append one complete line to a large Claude/Codex JSONL, inspect `/api/v1/debug/sync`, and compare RSS before/after with `ps -p <pid> -o rss=`. |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands or explicit manual-only justification.
- [x] Sampling continuity: no 3 consecutive tasks without automated verification.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags are used in verification commands.
- [x] Feedback latency target is below 120 seconds for targeted checks.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
