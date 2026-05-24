export interface QoderCostUsageRow {
  inputTokens: number;
  outputTokens: number;
  model: string | null | undefined;
}

export interface QoderSessionCostEstimateInput {
  usageRows: QoderCostUsageRow[];
  isSubagent: boolean;
}

export interface QoderSessionCostEstimate {
  costUsd: number | null;
  credits: number | null;
  costSource: string | null;
  pricingStatus: string | null;
}

export const QODER_TOKEN_CALIBRATED_COST_SOURCE = 'qoder-token-calibrated-estimate';

// Calibrated from the user's Qoder usage list on 2026-05-18:
// 1,317.58 credits for 35.814329M gross tokens while Ultimate was billed at 0.8x.
const DEFAULT_BASE_CREDITS_PER_M_TOKENS = 1317.58 / (35.814329 * 0.8);
const DEFAULT_USD_PER_CREDIT = 0.01;
const DEFAULT_ULTIMATE_MULTIPLIER = 0.8;

const DIRECT_MODEL_MULTIPLIERS: Record<string, number> = {
  'qwen3.7-max': 0.5,
  'qwen3.6-plus': 0.2,
  'deepseek-v4-pro': 0.5,
  'deepseek-v4-flash': 0.1,
  'glm-5.1': 0.6,
  'kimi-k2.6': 0.3,
  'minimax-m2.7': 0.2,
  'minimax-m2.5': 0.2,
};

export function estimateQoderSessionCost(
  input: QoderSessionCostEstimateInput,
): QoderSessionCostEstimate {
  if (input.isSubagent || input.usageRows.length === 0) {
    return emptyEstimate();
  }

  const baseCreditsPerMillionTokens = resolveEnvNumber(
    'QODER_BASE_CREDITS_PER_M_TOKENS',
    DEFAULT_BASE_CREDITS_PER_M_TOKENS,
  );
  const usdPerCredit = resolveEnvNumber('QODER_USD_PER_CREDIT', DEFAULT_USD_PER_CREDIT);

  let credits = 0;
  let pricedRows = 0;
  let unknownRows = 0;

  for (const row of input.usageRows) {
    const multiplier = getQoderModelMultiplier(row.model);
    if (multiplier == null) {
      unknownRows += 1;
      continue;
    }

    const grossTokens = Math.max(row.inputTokens, 0) + Math.max(row.outputTokens, 0);
    if (grossTokens === 0) continue;

    credits += (grossTokens / 1_000_000) * baseCreditsPerMillionTokens * multiplier;
    pricedRows += 1;
  }

  if (pricedRows === 0) {
    return emptyEstimate();
  }

  return {
    credits: round(credits),
    costUsd: round(credits * usdPerCredit),
    costSource: QODER_TOKEN_CALIBRATED_COST_SOURCE,
    pricingStatus: unknownRows > 0 ? 'partial' : 'priced',
  };
}

export function getQoderModelMultiplier(model: string | null | undefined): number | null {
  const normalizedModel = normalizeModel(model);
  if (!normalizedModel) return null;

  if (normalizedModel === 'lite') return 0;
  if (
    normalizedModel === 'auto'
    || normalizedModel === 'experts-auto'
    || normalizedModel === 'quest-auto'
  ) {
    return 1.0;
  }
  if (normalizedModel === 'efficient') return 0.3;
  if (normalizedModel === 'performance') return 1.1;

  if (
    normalizedModel === 'ultimate'
    || normalizedModel === 'experts-ultimate'
    || normalizedModel === 'quest-ultimate'
  ) {
    return resolveEnvNumber('QODER_ULTIMATE_MULTIPLIER', DEFAULT_ULTIMATE_MULTIPLIER);
  }

  const unprefixedModel = normalizedModel.replace(/^(experts|quest)-/, '');
  return DIRECT_MODEL_MULTIPLIERS[unprefixedModel] ?? null;
}

function resolveEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function emptyEstimate(): QoderSessionCostEstimate {
  return {
    costUsd: null,
    credits: null,
    costSource: null,
    pricingStatus: null,
  };
}

function normalizeModel(model: string | null | undefined): string {
  return model?.trim().toLowerCase() ?? '';
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
