---
type: fix
title: Qoder updated time not taken from correct source
status: todo
priority: p2
created: 2026-05-21
branch:
worktree:
---

## Description

Qoder session 的 "更新时间" 没有从正确的地方取得，目前显示的时间不对（可能取的是文件 mtime 而非最后一条 message 时间，或反之）。

## Approach to investigate

- 看 `ingest/parser/qoder/` 里 updated_at 是怎么算的
- 跟 Claude Code / Codex 的对齐：应该是 last message timestamp
- 同步前端 session 列表里这个字段的显示来源

## Acceptance criteria

- [ ] Qoder session 的 updated_at 来源跟其他 source 一致
- [ ] 列表按 updated_at 排序时 Qoder session 的位置合理
