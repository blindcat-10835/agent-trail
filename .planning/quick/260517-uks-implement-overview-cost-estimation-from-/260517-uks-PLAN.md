---
quick_id: 260517-uks
status: complete
date: 2026-05-17
---

# Quick Task 260517-uks: Implement overview cost estimation from unified AI provider pricing table

## Goal

Implement overview cost estimates using `docs/ai_provider_pricing_unified_2026-05-17.md` as the pricing source, without bypassing the ingest/BFF architecture.

## Plan

1. Add ingest-side pricing utilities.
   - Files: `ingest/pricing/model-pricing.ts`, tests as needed.
   - Action: encode USD per-1M-token pricing rules, normalize common model names, calculate channel-aware cost from input/output/cache/reasoning token totals.
   - Verify: covered and unknown models return expected cost/status.

2. Wire overview API cost fields.
   - Files: `ingest/api/overview.ts`, `types/overview.ts`, `ingest/api/overview.test.ts`.
   - Action: return `totalCost`/`cost` plus `pricingStatus` for aggregates, daily tokens, top models, and top projects. Preserve token behavior and null/partial handling for unknown models.
   - Verify: overview endpoint tests cover priced, unknown, partial, and cost sorting cases.

3. Render cost in overview UI.
   - Files: `components/overview/kpi-hero.tsx`, `components/overview/top-models-table.tsx`, `components/overview/top-projects-table.tsx`.
   - Action: replace placeholder cost display with estimated cost values, mark partial values with `~`, and keep unknown costs as dash.
   - Verify: typecheck and targeted lint pass; local API/page check shows cost data is present.
