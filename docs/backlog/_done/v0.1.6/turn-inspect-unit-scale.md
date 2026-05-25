---
type: fix
title: Scale turn inspect units to M when over 1000K
status: done
priority: p2
created: 2026-05-25
updated: 2026-05-25
branch: fix/turn-inspect-unit-scale
worktree: .worktree/fix-turn-inspect-unit-scale
---

## Description

In the turn inspect view, `in` and `out` token counts are currently always displayed with a `K` suffix. When the value exceeds 1000K, it should be displayed in `M` (millions) for readability (e.g., `1.2M` instead of `1200K`).

## Acceptance criteria

- [ ] Values >= 1000K display as `M` with one decimal place (e.g., `1.2M`)
- [ ] Values < 1000K continue to display as `K` as before
- [ ] Works for both `in` and `out` fields in turn inspect
