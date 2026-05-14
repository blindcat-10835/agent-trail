# Phase 15: Ingest Sync Performance Hardening - Research

**Gathered:** 2026-05-14  
**Primary input:** `.planning/debug/ingest-memory-performance-fix-policy.md`

## 1. Root Cause Summary

The high memory and CPU incident is caused by sync work amplification, not by one isolated slow function.

Current behavior:

- `ingest/index.ts` starts the watcher before startup warmup and background full sync finish.
- `ingest/src/watcher.ts` records changed paths in `pendingPaths`, but debounce flush only calls `onSyncTrigger(sourceType)`.
- `ingest/index.ts` wires that callback to `syncSource(sourceType)`, so a single file change becomes a full source sync.
- `runPeriodicResync()` calls the same callback every 5 minutes and does not await active sync work.
- `syncSource('codex')` performs relationship collection, candidate collection, full parser work, display-name string processing, then `writeSessionToDatabase()`.
- `writeSessionToDatabase()` computes skip hash after parsing, and `computeFileHash()` uses `fs.readFileSync(filePath)`.

Observed incident evidence:

- RSS around 1.5-1.6GB, physical footprint around 3.3GB, peak around 3.7GB.
- CPU 100%+.
- V8 samples hot in RegExp, string flattening, allocation, and GC.
- Around 967 JSONL file descriptors.
- One 518MB Codex JSONL open around 80 times.

The most important repair is to stop multiple full source syncs from overlapping.

## 2. Current Code Map

### Startup And Runtime Entrypoints

- `ingest/index.ts`
  - `initializeSourcesAndSync()`
  - creates watcher
  - starts watcher
  - runs warmup sync
  - runs background full sync

- `ingest/src/watcher.ts`
  - `WatcherConfig.onSyncTrigger: (sourceType) => void | Promise<void>`
  - `pendingPaths: Map<SyncSourceType, Set<string>>`
  - debounce loop calls `config.onSyncTrigger(sourceType)`
  - periodic loop calls `config.onSyncTrigger(sourceType)` and only attaches `.catch()`

- `ingest/sync/index.ts`
  - `syncSource(sourceType, options?)`
  - `syncOpenClawSource()`
  - `syncClaudeCodeSource()`
  - `syncCodexSource()`
  - `collectSessionFileCandidates()`
  - `writeSessionToDatabase()`
  - `computeFileHash()`

### Existing Test Map

- `ingest/src/watcher.test.ts` covers debounce, temp filtering, lifecycle, and extension matching.
- `tests/unit/ingest/sync.test.ts` covers source support and mocked sync paths.
- `tests/unit/ingest/codex-relationships.test.ts` protects Codex relationship behavior.
- `tests/unit/ingest/db-migration.test.ts` protects additive schema migrations.

## 3. Reference Pattern From agentsview

The reference implementation in `../references/agentsview` uses four patterns that map directly to this repair:

- Watcher callback receives `paths []string`, not only a source type.
- Sync engine has `syncMu`, serializing `SyncPaths`, `SyncAll`, and `ResyncAll`.
- `SyncPaths(paths)` classifies and processes only the changed files.
- `shouldSkipByPath()` checks file size, mtime, and data version before parser work.

It also has offset JSONL helpers and streaming hash. Those are useful for later hardening, but the incident-level repair starts with path-scoped sync and serialization.

## 4. Planning Implications

The plan should not start with append-only JSONL rewrites. That is the most invasive part and can be done after the reentry bug is gone.

Recommended plan order:

1. P0 - scheduler/no-reentry/path handoff.
2. P1 - pre-parse skip and streaming hash.
3. P2/P3 foundation - observability, debug metrics, incremental-read readiness, and regression coverage.

## Validation Architecture

Validation must prove the failure mode cannot recur.

Required automated checks:

- Watcher debounce passes changed file paths to callback.
- Watcher no longer invokes full source sync for a single changed path.
- Periodic resync calls scheduler and does not directly start parallel sync work.
- Scheduler serializes concurrent full/path requests and coalesces queued work.
- Path sync ignores non-session files and only parses matched changed session files.
- Pre-parse skip avoids parser invocation for unchanged files.
- Hashing no longer uses whole-file `fs.readFileSync()` in the hot path.
- Existing ingest sync/parser/API tests continue to pass.

Suggested commands:

```bash
pnpm vitest run ingest/src/watcher.test.ts tests/unit/ingest/sync.test.ts tests/unit/ingest/codex-relationships.test.ts
pnpm typecheck:ingest
pnpm test:run -- tests/unit/ingest tests/integration/ingest
```

Manual/local validation:

- Start `pnpm dev:ingest`.
- Append one line to a known Codex JSONL.
- Confirm logs/debug status show path-scoped sync, not full `codex` source sync.
- Confirm no repeated FD explosion with `lsof -nP -p <pid>` during sync.

