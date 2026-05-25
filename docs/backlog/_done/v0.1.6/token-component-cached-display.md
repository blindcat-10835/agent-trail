---
type: feat
title: Show cache read/write tokens on the dashboard KPI stack
status: done
priority: p2
created: 2026-05-25
updated: 2026-05-25
branch: feat/token-component-cached-display
worktree: .worktree/feat-token-component-cached-display
---

## Description

The dashboard total token number (`SUM(session_token_daily.total_tokens)`) does not equal `input + output`, because the stored `total_tokens` also folds in cache (and reasoning) tokens at parse time. The INPUT / OUTPUT cards only show the bare input/output, so the gap (cacheRead + cacheWrite + reasoning) is invisible and the total looks inexplicable.

Original idea was `regular / cached` inside the INPUT/OUTPUT cards, but that's misleading: cache semantics differ per source (claude/opencode are **additive** — cache is a separate bucket; codex/qoder are **overlap** — cached is a subset of input). Mixing cached into the input card means opposite things on different sources.

New approach: replace the `DAILY BURN · AVG` KpiMini card with a dedicated **CACHE R/W** card showing `cacheRead / cacheWrite`, shown in all time windows. This surfaces the cache numbers without conflating them with input semantics.

## Acceptance criteria

- [ ] `DAILY BURN · AVG` card replaced by a `CACHE R/W` card in `KpiMiniStack` (`components/overview/kpi-hero.tsx`)
- [ ] Card shows `cacheRead / cacheWrite` using existing `fmtTokens` (e.g. `13.55M / 1.30M`)
- [ ] Card visible in all windows (today / 7d / 30d / all)
- [ ] Works correctly when cache values are 0 or missing (codex/qoder show `X / 0`, openclaw shows `0 / 0`)
- [ ] Per-source cache computation semantics documented in `docs/DATA-FLOW.md` (additive vs overlap table)
