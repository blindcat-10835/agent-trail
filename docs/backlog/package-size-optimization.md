---
type: refactor
title: Optimize npm package size and build pipeline clarity
status: todo
priority: p2
created: 2026-05-21
branch:
worktree:
---

## Description

当前 npm package 体积偏大，打包流程也有点复杂，需要梳理清楚。

## Approach to investigate

- 实测 `pnpm pack:npm` 后的 tarball 大小，跟同类工具对比
- `scripts/prepare-npm-package.mjs` 拷了哪些不必要的文件？
- `node_modules` 是否在打包产物里？哪些依赖能 hoist 成 peer 或移除？
- 看 `.next/standalone` 输出能否更精简
- 把整条流水线（build → build:ingest → prepare → publish）画一张图 / 写一段文档

## Acceptance criteria

- [ ] 当前包大小有数据（包括 unpacked + tar.gz）
- [ ] 打包流程图 / 文档进 `docs/`
- [ ] 至少减少 X%（具体目标定下来后填）
- [ ] 流程改动后下一次 release 验证 npm install 正常

## Related

- 最近的 commit `faf5ad6 feat(runtime): slim package and quiet logs` 已经做了一轮，继续这条线
