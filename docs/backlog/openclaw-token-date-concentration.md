---
type: fix
title: OpenClaw token usage concentrated on recent days instead of evenly distributed
status: wontfix
priority: p3
created: 2026-05-25
updated: 2026-05-25
branch:
worktree:
---

## Description

OpenClaw 的 token 用量在 dashboard 上集中在最近两天，但用户通过定时任务使用 OpenClaw，每天的使用量应该大致相同。同时，很久以前真正和 OpenClaw 对话过的日期，token 数量也异常偏高。

现象：
- 最近两天的 token 用量异常集中
- 历史上真正对话过的日期 token 数量也偏高
- 定时任务产生的 token 没有均匀分布在各天

## 根因调查结论（2026-05-25）

**不是日期归属 bug，与 `token-date-local-timezone` 无关。** 日期归属逻辑（parser 层 + 聚合层）已验证正确，按 message timestamp 转本地时区逐日累加，与 DB 完全吻合。

真正的原因是**数据生命周期问题**：

1. **旧 parser 留下的陈旧行**：`openclaw-token-zero` 修复（commit `9a5b42e`）之前，parser 读不到 OpenClaw 的 camelCase token 字段，所有 session 都解析为 `total_tokens=0`。
2. **源文件已被 OpenClaw 轮转删除**：89 个零 token session 里有 88 个 `.jsonl` 已不存在，sync 不做孤儿行清理，所以这些 0 值永久冻结在 DB。
3. **结果**：老的定时 session 的真实 token 数据已随文件删除，不可恢复；最近几天文件尚存、新 parser 正确解析，看起来"集中"。

**历史数据不可恢复，但增量问题已自愈**：新 parser 首次同步即正确记录 token，watcher 实时监听，后续定时 session 不会再丢。

## 为何不修

- 历史数据已丢失，不管修不修都找不回来
- 图表失真是"诚实"的（真实反映数据缺失，不是误报）
- 唯一可做的清理（prune 88 个孤儿行）仅影响 session 计数，对 token 图无改善
- 后续分布已自动正常，无需干预

## Related

- `token-date-local-timezone` — UTC vs 本地时区问题（已修复，与本 issue 无关）
- `openclaw-token-zero` — OpenClaw token 显示为零（已修复，本 issue 的历史残留是该 bug 的副产品）
