---
status: complete
slug: uat-bugs-1-3
created: 2026-05-07
---

# Fix UAT Bugs 1-3: Complete

## Changes

- `components/sessions/session-explorer-table.tsx` — Added `deriveLabel()` and `deriveProject()` helpers. Label now uses first user message from turns, falls back to session ID. Project filters "default" and extracts cwd from sourceMetadata.
- `components/shell/shell-header.tsx` — Hardcoded "AGENTS TRACING" instead of dynamic `brand.name.toUpperCase()`.

Commit: `b5eef28`
