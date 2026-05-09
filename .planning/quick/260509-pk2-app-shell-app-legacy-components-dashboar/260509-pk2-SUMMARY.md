---
status: complete
---

# Quick Task 260509-pk2: 清理死代码

**Description:** 删除 app/(shell)/, app/(legacy)/, components/dashboard/(除empty-state), components/hud/(除5个活跃文件), components/sessions/(除3个活跃文件) — 并验证功能正常

**Date:** 2026-05-09

## Results

### Deleted (48 files, ~4300 lines)

| Category | Deleted | Kept |
|----------|---------|------|
| Route groups | `app/(shell)/` (6 files), `app/(legacy)/` (5 files) | `app/(tool-shell)/` |
| Dashboard components | 19 files + 6 overview/ subdir files | `empty-state.tsx` |
| HUD components | 5 files | `gateway-bootstrap`, `hud-panel`, `ingest-health-overlay`, `status-indicator`, `theme-toggle` |
| Sessions components | 5 files | `aggregate-sessions-view`, `sessions-right-rail`, `sessions-stats-bar` |

### Verification

- `pnpm build` — passed cleanly, no errors
- All `(tool-shell)` routes present: `/[tool]/dashboard`, `/[tool]/activity`, `/[tool]/sessions`, `/[tool]/sessions/[sessionId]`
- Route conflicts resolved — no more `(shell)` vs `(legacy)` collision
- 9 kept component files verified present

### Commit

`7a5c632` — 48 files changed, 4299 deletions
