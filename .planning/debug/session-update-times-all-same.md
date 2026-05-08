---
status: resolved
trigger: "我发现现在所有的session显示的最后update时间都变成一样的了。很显然不正常，请你找一下原因。"
created: "2026-05-08"
updated: "2026-05-08"
---

# Bug: session-update-times-all-same

## Symptoms

- **Expected behavior**: 每个 session 显示各自真正的最后更新时间，不同 session 有不同的更新时间
- **Actual behavior**: Session Explorer 列表页中，所有 session 显示的 last update 时间都变成一样的了
- **Location**: Session Explorer 列表页
- **Timeline**: 最近才出现，之前是正常的
- **Reproduction**: 打开应用首页/Session Explorer 列表就能看到
- **Error messages**: 无（用户未报告错误信息）

## Current Focus

- hypothesis: "`session-explorer-table.tsx` renders `updatedAt` column using `session.endedAt || session.startedAt` instead of `session.updatedAt`, causing all sessions to show similar timestamps from sync-based `endedAt` fallback"
- test: ""
- expecting: ""
- next_action: "fix the field reference and verify"

## Evidence

- timestamp: 2026-05-08
  finding: "Frontend `renderCellValue` for `updatedAt` accessor in `session-explorer-table.tsx:107-108` uses `session.endedAt || session.startedAt` instead of `session.updatedAt`"
  source: "components/sessions/session-explorer-table.tsx:107-108"
  confidence: high

- timestamp: 2026-05-08
  finding: "API correctly computes `updated_at` via SQL `MAX(COALESCE(...))` across ended_at, started_at, last_sync_at, file_mtime and maps it to `updatedAt` in parseSessionRow"
  source: "ingest/api/sessions.ts:16-17, 245"
  confidence: high

- timestamp: 2026-05-08
  finding: "Legacy `sessions-table.tsx` correctly uses `session.updatedAt` directly (line 111-112) — the bug was introduced in the new `session-explorer-table.tsx`"
  source: "components/sessions/sessions-table.tsx:111-112"
  confidence: high

## Eliminated

## Resolution

- root_cause: "`session-explorer-table.tsx:108` renders the `updatedAt` column using `session.endedAt || session.startedAt` instead of the API-computed `session.updatedAt` field. The API correctly derives `updated_at` as `MAX(COALESCE(ended_at, ''), COALESCE(started_at, ''), COALESCE(last_sync_at, ''), COALESCE(file_mtime, ''))` and maps it to `updatedAt` in `parseSessionRow`, but the frontend table component ignores this field entirely, falling back to `endedAt` (with `startedAt` as fallback). When sessions are synced in the same batch, they share similar `endedAt` values, causing all rows to display identical update times."
- fix: "Changed `session.endedAt || session.startedAt` to `session.updatedAt ?? null` in `renderCellValue()` switch case for `updatedAt` accessor"
- verification: "Build check and visual inspection of Session Explorer table to confirm distinct update times per session"
- files_changed: ["components/sessions/session-explorer-table.tsx"]
