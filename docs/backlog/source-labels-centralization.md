---
type: refactor
title: Centralize SOURCE_LABELS and sourceTag usage
status: todo
priority: p2
created: 2026-05-21
branch:
worktree:
---

## Description

`sourceTag` 和 `SOURCE_LABELS` 在 codebase 各处分散硬编码，应该集中到一个地方。

期望的结构：

```ts
// types/trace.ts (or similar)
export const SOURCE_LABELS: Record<TraceSource, string> = {
  'claude-code': 'Claude',
  openclaw: 'OpenClaw',
  codex: 'Codex',
  opencode: 'OpenCode',
  qoder: 'Qoder',
};
```

所有显示 source 名字的地方都从这里读，不要再字符串硬编码。

## Acceptance criteria

- [ ] `SOURCE_LABELS` 定义在统一位置（建议 `types/trace.ts`）
- [ ] grep `claude-code|openclaw|codex|opencode|qoder` 字面量后，所有显示用途都改为读 `SOURCE_LABELS[source]`
- [ ] 新增 source 时只改一处即可

## Related

- 这是 `filter-by-project` 的前置 refactor（filter UI 也要显示 source label）
