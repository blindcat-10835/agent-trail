---
phase: 1
slug: trace-contract-brownfield-reset
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (pending verification during implementation) |
| **Config file** | vitest.config.ts (to be created in Wave 0) |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test` + `pnpm tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | FOUND-02 | T-1-03 / — | N/A (type definitions only) | unit | `pnpm tsc --noEmit` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | FOUND-05 | — | N/A | unit | `pnpm test types.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | FOUND-03 | T-1-01 / — | Malformed JSONL skipped with error count | unit | `pnpm test fixtures.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | FOUND-03 | T-1-02 / — | Hardcoded fixture paths, no user input | unit | `pnpm test fixtures.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | FOUND-04 | — | N/A (documentation) | manual | — | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 2 | FOUND-01 | — | N/A (documentation) | manual | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — vitest configuration
- [ ] `types/trace.ts` — canonical trace contract (type definitions)
- [ ] `lib/parseFixture.ts` — minimal parser validator stub
- [ ] `tests/fixtures.test.ts` — golden file test stubs
- [ ] `tests/types.test.ts` — status type test stubs
- [ ] Framework install: `pnpm add -D vitest @types/node`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Documentation uses agent-tracing-dashboard branding throughout | FOUND-01 | Requires reading project docs and UI labels | Search all .md files and visible UI text for "OVAO" — should only appear in historical/archival context |
| Preserved capabilities list is complete and categorized | FOUND-04 | Requires domain knowledge to verify completeness | Compare capabilities list against current OpenClaw overview components (Agent, KPI, Sessions, Cron, Skills, Activity) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
