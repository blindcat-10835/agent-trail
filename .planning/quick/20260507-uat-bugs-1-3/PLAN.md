---
slug: uat-bugs-1-3
status: executing
created: 2026-05-07
---

# Fix UAT Bugs 1-3: Labels, Project, Title

Fix three UI bugs from UAT testing.

## Tasks

1. **Bug 1 & 2** — `session-explorer-table.tsx`: Fix `renderCellValue` for 'label' and 'project' accessors. Label should try first user message from turns, fall back to session ID. Project should filter "default" and try extracting cwd from sourceMetadata.

2. **Bug 3** — `shell-header.tsx`: Replace dynamic `brand.name.toUpperCase()` with fixed "AGENTS TRACING".
