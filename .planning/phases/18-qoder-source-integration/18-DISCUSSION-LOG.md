# Phase 18: Qoder Source Integration — Discussion Log

**Discussion date:** 2026-05-18
**Workflow:** `/gsd-discuss-phase 18`
**Mode:** default (interactive AskUserQuestion)
**Branch:** `phase/18-qoder-source-integration`
**Worktree:** `.claude/worktrees/phase-18-qoder-source-integration`

This log captures the human-facing discussion that produced `18-CONTEXT.md`. It is for retrospectives and audits; downstream agents (researcher, planner, executor) read CONTEXT.md, not this file.

---

## Phase preamble (presented to user)

Domain: Qoder 桌面 IDE 的本地 SQLite 主库作为第五个数据源完整接入（type → schema → parser → sync → BFF → 前端 → replay）

Locked by SPEC.md (no re-asked WHAT-level questions):
- 10 requirements, 22 acceptance criteria
- Cost excluded (`pricingStatus = 'unknown'`)
- Privacy hardline (no `machine_token.json` / `supabase_token` / `secret://`)
- Per-session fingerprint skip cache
- Token formula: `prompt + completion`, no double-count
- Model display: raw key (`ultimate` / `experts-ultimate` / specific value)

Carried forward from earlier phases:
- Readonly DB open + soft-degradation on failure (Phase 17 D-01/D-03)
- Composite skip key (Phase 17 D-02 → Phase 18 SPEC per-session fingerprint)
- Tool category mapping via `inferClaudeToolCategory` (Phase 17 D-06)
- BFF / route / SourceSwitcher pattern (Phase 17)
- Canonical session ID prefix `qoder:` (project convention)

---

## Selected gray areas

User selected ALL four offered gray areas:

1. Migration ordering vs Phase 17
2. Skip cache fingerprint storage location
3. Subagent link UI surfacing
4. Test fixture generation strategy

---

## Area 1 — Migration ordering vs Phase 17

**Question:** Phase 18 的 schema 迁移与 Phase 17 怎么协调？

**Options presented:**
- (a) 依赖 Phase 17 先合并 (Recommended) — Phase 18 PR rebase 到含 17 的 main，CHECK 仅追加 'qoder'
- (b) Phase 18 自带 opencode+qoder 双扩展 — 可独立合并但越过 phase 边界
- (c) 硬阻塞：17 没合就不动

**User decision:** (a) 依赖 Phase 17 先合并

**Captured as:** D-01, D-02

**Notes:** Phase 17 has 4 PLANs but has not yet landed in main. The branch was cut at `main @ 668e21c` which contains only the SPEC commits. Phase 18 work proceeds in this isolated worktree; CHECK migration assumes Phase 17's `'opencode'` will be in place at merge time.

---

## Area 2 — Skip cache fingerprint storage

**Initial question:** skip cache fingerprint 存哪里？

**Options presented:**
- (a) 新增 `sessions.source_fingerprint` 列 (Recommended)
- (b) 复用 `ingest_file_cursors`（path 重用作 session key）
- (c) 新表 `ingest_session_fingerprints`

**User response:** "skip session fingerprint是啥？给我解释一下我们再做决定"

**Action taken:** Provided a written explanation of:
- Why fingerprint is needed (file mtime alone is too coarse for single-file SQLite sources)
- The four-component formula: `qoder-session-v1:<sid>:<gmt>:<count>:<max>`
- The skip comparison flow during sync
- The version prefix's role in invalidating old caches when algorithm changes

Then re-asked the question.

**User follow-up question:** "opencode应该也是一个db，phase 17有说是怎么处理的吗"

**Action taken:** Investigated Phase 17 PLANs and confirmed that:
- `sessions.file_hash` column already exists
- Phase 17 OpenCode reuses it as a generic skip key (`sha256(time_updated + message_count + part_count)`)
- Phase 17 PLAN 17-01 includes a NULL-flush of the column for its own source rows

**Re-asked question:** 已知 Phase 17 复用了 `sessions.file_hash` 列，Phase 18 该怎么走？

**Re-options presented:**
- (a) 复用 `sessions.file_hash`（与 Phase 17 对齐） (Recommended)
- (b) 改名：加 `sessions.skip_key` 列、迁移老数据
- (c) 另开 `ingest_session_fingerprints` 表（仅 Qoder 用）

**User decision:** (a) 复用 sessions.file_hash + 同时在 docs 中新建一个文档说明这个选择可能导致的问题

**Captured as:** D-03 (reuse), D-04 (NULL-flush mirroring Phase 17), D-05 (new doc `docs/skip-cache-naming-debt.md`)

**Notes:** This is a deliberate consistency-over-cleanliness trade-off. The technical debt (column name no longer matches semantics) is captured explicitly in a new documentation file rather than fixed inline, to avoid violating the Phase 17 ↔ Phase 18 boundary.

---

## Area 3 — Subagent link UI surfacing

**Question:** Qoder 的 parent_session_id / parent_tool_call_id 在 UI 上怎么呈现？

**Options presented:**
- (a) 三件齐全：表 + 父消息内联链接 + 子会话头部 back-link (Recommended)
- (b) 仅父消息链接 + 表
- (c) 仅写表，UI 在 detail 页通过查询渲染

**User decision:** (a) 三件齐全

**Captured as:** D-06 (three-pronged surfacing), D-07 (child registers as own session row)

**Notes:** Mirrors how the user mentally models the relationship — discoverable from both parent and child side. Phase 17 OpenCode did NOT do this depth because OpenCode's subtask semantics differ; Qoder has true child sessions linked via parent tool call, which justifies the explicit visual treatment.

---

## Area 4 — Test fixture strategy

**Question:** Qoder 解析器的测试 fixture 怎么生成？

**Options presented:**
- (a) 手写合成 SQLite（脚本 raw INSERT） (Recommended)
- (b) sanitize 真实 DB
- (c) JSON dump + 运行时 loader

**User decision:** (a) 手写合成 SQLite

**Captured as:** D-08 (build-fixture script), D-09 (coverage requirements), D-10 (synthetic-only, never sanitize)

**Notes:** Sanitize was rejected on privacy grounds — `chat_message.content`, `parameters`, and `tool_result` are arbitrary user input and sanitize is too easy to leak through. JSON-dump + loader was rejected as adding a layer with no benefit over direct DDL+INSERT for this use case.

---

## Deferred ideas surfaced during discussion

- Watcher-based real-time sync of Qoder DB — captured to deferred list
- Live snapshot copy-then-read for hot-locked DB — captured
- JSONL fallback when SQLite is locked or missing — captured
- Renaming `sessions.file_hash` → `sessions.source_skip_key` — captured (technical debt path)

No scope-creep events triggered during this discussion.

---

## Outcome

| Output | Location |
|---|---|
| CONTEXT.md | `.planning/phases/18-qoder-source-integration/18-CONTEXT.md` |
| Discussion log (this file) | `.planning/phases/18-qoder-source-integration/18-DISCUSSION-LOG.md` |
| Decisions count | 10 (D-01..D-10) |
| Discretion items | 7 |
| Deferred ideas | 6 |
| Canonical refs | 8 sections, ~35 paths |

**Next:** `/gsd-plan-phase 18`

---

*Phase: 18-qoder-source-integration*
*Discussion logged: 2026-05-18*
