---
quick_id: 260517-uks
status: complete
date: 2026-05-17
commit: 1883e36
---

# Quick Task 260517-uks Summary

## 结果

已根据 `docs/ai_provider_pricing_unified_2026-05-17.md` 实现 overview cost 估算功能。实现提交：`1883e36 feat(overview): estimate costs from pricing table`。

## 主要改动

- 新增 ingest-side 定价注册表与 cost 计算器：`ingest/pricing/model-pricing.ts`。
- 扩展 overview API：aggregates、daily-tokens、top-models、top-projects 均返回 cost/pricingStatus。
- UI 接入 cost：KPI hero 显示 30D total cost 与 daily burn；top models/projects 的 cost 排序展示估算金额。
- unknown model 返回 `cost: null`；部分可定价时返回 `pricingStatus: partial`，UI 用 `~$` 标记估算不完整。

## 验证

- `pnpm vitest run ingest/pricing/model-pricing.test.ts ingest/api/overview.test.ts`
- `pnpm typecheck:ingest`
- `pnpm typecheck`
- `pnpm exec eslint ingest/pricing/model-pricing.ts ingest/pricing/model-pricing.test.ts ingest/api/overview.ts ingest/api/overview.test.ts components/overview/kpi-hero.tsx components/overview/top-models-table.tsx components/overview/top-projects-table.tsx types/overview.ts`
- Local API smoke：`/api/v1/overview/aggregates?window=30d` 和 BFF `/api/agent-tools/all/overview/aggregates?window=30d` 均返回 `totalCost` 与 `pricingStatus`。
- Chrome headless screenshot：`/tmp/agents-tracing-dashboard-overview-cost.png`。

## 备注

Anthropic cache write 使用价格表中的 5-minute cache write 价格。当前 cost 是本地估算，不是供应商账单；缺少价格规则的历史模型会让聚合状态变为 `partial`。
