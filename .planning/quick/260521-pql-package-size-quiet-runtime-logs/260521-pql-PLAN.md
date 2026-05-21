---
quick_id: 260521-pql
slug: package-size-quiet-runtime-logs
status: complete
created: 2026-05-21
completed: 2026-05-21
commit: faf5ad6
---

# Quick Task 260521-pql: Package size and quiet runtime logs

## Goal

Reduce packaged/runtime footprint where safe, and make npm/Docker runtime output quiet by default while preserving useful diagnostics on failure or when debug logging is explicitly enabled.

## Tasks

1. Runtime package slimming
   - Move build-only dependencies out of runtime dependencies when safe.
   - Stop copying a full production `node_modules` tree into the Docker runtime image; keep only the Next standalone tree plus native modules needed by the ingest bundle.
   - Verify dependency install metadata still supports Node 22+ npm users and Node 24 Docker builds.

2. Quiet runtime logs
   - Add a lightweight ingest logger with level control.
   - Default packaged/Docker runs to warn-level ingest logs.
   - Update the npm launcher to buffer child output and print buffered logs only on child failure unless debug logging is enabled.
   - Route Docker startup through the same launcher behavior.

3. Verification and documentation
   - Run type checks and available syntax/YAML checks.
   - Document the log-level override for users.
   - Create SUMMARY.md and update `.planning/STATE.md`.

## Completion

Implemented in `faf5ad6`.
