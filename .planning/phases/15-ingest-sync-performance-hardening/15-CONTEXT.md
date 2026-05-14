# Phase 15: Ingest Sync Performance Hardening - Context

**Gathered:** 2026-05-14  
**Status:** Ready for planning  
**Source:** Debug policy express path (`.planning/debug/ingest-memory-performance-fix-policy.md`)

<domain>
## Phase Boundary

Fix the ingest process memory and CPU amplification diagnosed from PID 20043. The deliverable is an ingest sync path where startup warmup, background indexing, watcher events, manual sync, and periodic resync cannot overlap into repeated full-source parsing of the same large JSONL files.

This phase covers the near-term repair required to make ingest safe for local real data:

- serialize and coalesce sync entry points
- preserve changed file paths from watcher events
- scope watcher-triggered sync to changed paths
- prevent periodic resync reentry
- skip unchanged files before parser allocation
- remove whole-file `readFileSync` hashing from the hot path
- expose enough health/debug state to see active and queued sync work

Full append-only DB upsert for every parser is allowed only if it remains tractable after P0/P1. Otherwise, this phase should create the cursor/metric foundation and defer full append-only rewrites to a later phase.

</domain>

<decisions>
## Implementation Decisions

### Required Fix Direction

- Use `.planning/debug/ingest-memory-performance-fix-policy.md` as the canonical diagnosis and optimization policy.
- Borrow the agentsview pattern conceptually: watcher passes `paths`, sync engine serializes all sync runs, unchanged files are skipped before parsing.
- Do not fix this by increasing Node heap, disabling watcher entirely, or only changing debounce timing.
- Do not let any caller use bare `syncSource(sourceType)` for background/watcher/periodic work after the scheduler exists.

### Scheduler Boundary

- Introduce one ingest sync scheduler that owns active/queued state.
- The scheduler must accept full-source requests and changed-path requests.
- If a sync is active, new requests are coalesced into pending state instead of starting a second sync.
- Watcher, periodic resync, startup warmup/background indexing, and manual sync APIs should converge on the scheduler or an equivalent exclusive wrapper.

### Watcher Boundary

- `pendingPaths` must no longer be discarded.
- Watcher debounce should call a callback with changed paths, not only `sourceType`.
- Periodic resync should be represented as a low-priority full-source request and must skip/coalesce if sync is active.
- Watcher should ignore non-session extensions unless a source-specific metadata path is deliberately supported.

### Sync Boundary

- Add `syncPaths(paths)` or equivalent path-scoped sync API.
- Classify changed paths into OpenClaw, Claude Code, and Codex candidates using existing source directory config and filename rules.
- Path sync should parse only matched session files and should ignore unrelated `.json` / `.md` paths by default.
- Preserve existing `syncSource(sourceType)` public behavior for explicit full sync calls, but route application entry points through scheduler.

### Skip And Hash Boundary

- Add pre-parse skip using `file_path`, `file_size`, `file_mtime`, and parser cache version.
- Preserve `force=true` behavior to bypass skip.
- Replace `fs.readFileSync()` hash with streaming hash or remove default hash work from unchanged hot paths.
- The skip cache must reduce parser work, not merely avoid DB writes after parser work has already happened.

### Observability Boundary

- `/health` or a debug status endpoint must show actual sync state, not only watcher state.
- Required fields: active sync, queued sync, reason, source/scope, started time, current file if available, skipped-before-parse count, parsed count, last error, last duration.
- The previous misleading situation - health says idle while large JSONL parsing continues - must not recur.

</decisions>

<canonical_refs>
## Canonical References

Downstream agents MUST read these before planning or implementing.

### Diagnosis And Policy

- `.planning/debug/ingest-memory-performance-fix-policy.md` - root cause analysis, visual execution paths, staged repair policy, acceptance criteria.

### Current Ingest Entry Points

- `ingest/index.ts` - startup order, watcher creation, warmup sync, background full sync.
- `ingest/src/watcher.ts` - debounce, pending paths, periodic resync, callback contract.
- `ingest/sync/index.ts` - `syncSource`, source-specific sync functions, skip cache, hash, candidate collection.
- `ingest/parser/codex.ts` - large Codex JSONL parser and string pressure source.
- `ingest/parser/claude.ts` - Claude JSONL parser and candidate for path/pre-parse skip.
- `ingest/db/schema.sql` and `ingest/db/index.ts` - sessions fields, migrations, sync status.

### Tests

- `ingest/src/watcher.test.ts` - watcher debounce/lifecycle tests.
- `tests/unit/ingest/sync.test.ts` - sync layer unit tests and parser mocks.
- `tests/unit/ingest/codex-relationships.test.ts` - Codex relationship behavior.
- `tests/unit/ingest/db-migration.test.ts` - schema migration regression.
- `tests/integration/ingest/api.test.ts` - ingest API regression.

### Reference Implementation

- `../references/agentsview/cmd/agentsview/main.go` - startup sync before watcher, periodic interval, watcher callback to `SyncPaths`.
- `../references/agentsview/internal/sync/watcher.go` - debounce map of paths.
- `../references/agentsview/internal/sync/engine.go` - `syncMu`, `SyncPaths`, pre-parse skip, bounded workers.
- `../references/agentsview/internal/parser/linereader.go` - offset JSONL line reader.
- `../references/agentsview/internal/sync/hash.go` - streaming file hash.

</canonical_refs>

<specifics>
## Specific Ideas

- Start with P0. P0 is the actual incident stopper: scheduler, path handoff, no reentry.
- P1 should then make full scans cheaper through pre-parse skip and streaming hash.
- P2/P3 work should focus on observability and incremental-read readiness unless implementation remains small enough to finish safely.
- Use exact tests to prove the regression cannot recur: one changed watcher path must not call full `syncSource(sourceType)`, and two concurrent scheduler requests must not run concurrently.

</specifics>

<deferred>
## Deferred Ideas

- Full append-only DB upsert for every parser can be a follow-up if it expands beyond this phase.
- User-facing frontend UI changes are out of scope except exposing existing health/debug fields if already surfaced.
- Support for additional agents from agentsview is out of scope.

</deferred>

---

*Phase: 15-ingest-sync-performance-hardening*  
*Context gathered: 2026-05-14 via debug policy express path*
