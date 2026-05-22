---
type: fix
title: OpenCode model keys are not normalized in all rollups
status: done
priority: p2
created: 2026-05-21
branch: fix/opencode-model-rollup
worktree: .worktree/fix-opencode-model-rollup
updated: 2026-05-22
---

## Description

OpenCode 解析出的 model 目前会保留 provider / plan 前缀，例如 `zhipuai-coding-plan/glm-5.1`。这个场景下，dashboard 实际上应该归一成 `glm5.1` 这样的 canonical model key，而不是直接拿原始字符串展示和聚合。

另外，`all` 视图里如果不同 tool source 命中了同一个 model，token、cost 等统计应该按 model 合并加总，而不是按 source 分开算，导致同一个 model 在总览里被拆散或漏算。

## Acceptance criteria

- [x] OpenCode parser 或 normalization 层对 `zhipuai-coding-plan/glm-5.1` 这类值输出 canonical model key `glm5.1`
- [x] UI 上不再出现带 provider / plan 前缀的 OpenCode model label
- [x] `all` 视图里相同 model 即使来自不同 tool source，也按同一个 model 聚合
- [x] `all` 视图中该 model 的 token、cost 等汇总指标会正确加总
