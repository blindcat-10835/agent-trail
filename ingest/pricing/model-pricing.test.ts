import { describe, expect, it } from 'vitest';
import { estimateModelCost, rollUpCosts } from './model-pricing.js';

describe('model pricing', () => {
  it('estimates OpenAI cached input without double-counting cached tokens', () => {
    const estimate = estimateModelCost('gpt-5.4', {
      inputTokens: 1_000_000,
      outputTokens: 100_000,
      cacheReadTokens: 250_000,
      reasoningTokens: 50_000,
    });

    expect(estimate).toMatchObject({
      cost: 4.1875,
      pricingStatus: 'priced',
      canonicalModel: 'gpt-5.4',
      provider: 'OpenAI',
    });
  });

  it('estimates Claude cache write/read as additive channels', () => {
    const estimate = estimateModelCost('claude-sonnet-4-20250514', {
      inputTokens: 1_000_000,
      outputTokens: 100_000,
      cacheReadTokens: 250_000,
      cacheWriteTokens: 50_000,
    });

    expect(estimate.cost).toBe(4.7625);
    expect(estimate.pricingStatus).toBe('priced');
    expect(estimate.canonicalModel).toBe('claude-sonnet-4');
  });

  it('matches dashboard model aliases from the pricing table', () => {
    expect(estimateModelCost('glm-5.1', { inputTokens: 1_000_000, outputTokens: 0 }).cost).toBe(1.4);
    expect(estimateModelCost('MiniMax-M2.5-highspeed', { inputTokens: 0, outputTokens: 1_000_000 }).cost).toBe(1.213);
    expect(estimateModelCost('claude-opus-4-7', { inputTokens: 0, outputTokens: 1_000_000 }).cost).toBe(25);
  });

  it('returns unknown for unpriced models', () => {
    expect(estimateModelCost('gpt-4o', { inputTokens: 1_000_000, outputTokens: 0 })).toMatchObject({
      cost: null,
      pricingStatus: 'unknown',
    });
  });

  it('rolls up partial costs when some models are unknown', () => {
    const rollup = rollUpCosts([
      estimateModelCost('gpt-5.4-mini', { inputTokens: 1_000_000, outputTokens: 0 }),
      estimateModelCost('unknown-model', { inputTokens: 1_000_000, outputTokens: 0 }),
    ]);

    expect(rollup).toEqual({
      cost: 0.75,
      pricingStatus: 'partial',
      pricedCount: 1,
      unknownCount: 1,
    });
  });
});
