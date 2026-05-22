import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface QoderSessionCostEstimateInput {
  dbPath: string;
  startedAt: string | null;
  mode: string | null;
  model: string | null | undefined;
  maxInputTokens: number | null;
  userMessageCount: number;
  isSubagent: boolean;
}

export interface QoderSessionCostEstimate {
  costUsd: number | null;
  credits: number | null;
  costSource: string | null;
  pricingStatus: string | null;
}

const DEFAULT_SUBSCRIPTION_USD_PER_CREDIT = 30 / 6000;
const ULTIMATE_PERSONAL_PROMO_START = Date.parse('2026-04-26T00:00:00.000Z');
const USER_TYPE_CACHE = new Map<string, string | null>();

const DIRECT_MODEL_MULTIPLIERS: Record<string, number> = {
  'qwen3.6-plus': 0.2,
  'deepseek-v4-pro': 0.5,
  'deepseek-v4-flash': 0.1,
  'glm-5.1': 0.6,
  'kimi-k2.6': 0.3,
  'minimax-m2.7': 0.2,
};

type QoderModeKind = 'ask' | 'agent' | 'experts';

export function estimateQoderSessionCost(
  input: QoderSessionCostEstimateInput,
): QoderSessionCostEstimate {
  if (input.isSubagent || input.userMessageCount <= 0) {
    return emptyEstimate();
  }

  const normalizedModel = normalizeModel(input.model);
  const modeKind = resolveModeKind(input.mode, normalizedModel);
  if (modeKind == null) {
    return emptyEstimate();
  }

  const baseCreditsPerRequest = resolveBaseCreditsPerRequest(modeKind, input.maxInputTokens);
  const tierMultiplier = resolveTierMultiplier(
    normalizedModel,
    input.startedAt,
    readQoderUserType(input.dbPath),
  );

  if (baseCreditsPerRequest == null || tierMultiplier == null) {
    return emptyEstimate();
  }

  const credits = input.userMessageCount * baseCreditsPerRequest * tierMultiplier;
  return {
    credits: round(credits),
    costUsd: round(credits * resolveUsdPerCredit()),
    costSource: 'qoder-credit-estimate',
    pricingStatus: 'priced',
  };
}

function resolveUsdPerCredit(): number {
  const raw = process.env.QODER_USD_PER_CREDIT;
  if (!raw) return DEFAULT_SUBSCRIPTION_USD_PER_CREDIT;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_SUBSCRIPTION_USD_PER_CREDIT;
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

function resolveModeKind(mode: string | null, normalizedModel: string): QoderModeKind | null {
  const normalizedMode = mode?.trim().toLowerCase() ?? '';

  if (normalizedModel.startsWith('experts-') || normalizedMode === 'experts') {
    return 'experts';
  }

  if (
    normalizedMode === 'agent'
    || normalizedMode === 'agent_sub'
    || normalizedMode.startsWith('agent_sub_')
  ) {
    return 'agent';
  }

  if (normalizedMode === 'ask' || normalizedMode === 'assistant') {
    return 'ask';
  }

  return normalizedModel ? 'agent' : null;
}

function resolveBaseCreditsPerRequest(
  modeKind: QoderModeKind,
  maxInputTokens: number | null,
): number | null {
  const largeContext = (maxInputTokens ?? 200_000) > 50_000;

  if (modeKind === 'ask') {
    return largeContext ? 4 : 3;
  }

  if (modeKind === 'agent') {
    return largeContext ? 12 : 7;
  }

  if (modeKind === 'experts') {
    return 75;
  }

  return null;
}

function resolveTierMultiplier(
  normalizedModel: string,
  startedAt: string | null,
  userType: string | null,
): number | null {
  if (!normalizedModel) return null;

  if (normalizedModel === 'lite') return 0;
  if (normalizedModel === 'auto' || normalizedModel === 'experts-auto' || normalizedModel === 'quest-auto') {
    return 1.0;
  }
  if (normalizedModel === 'efficient') return 0.3;
  if (normalizedModel === 'performance') return 1.1;

  if (
    normalizedModel === 'ultimate'
    || normalizedModel === 'experts-ultimate'
    || normalizedModel === 'quest-ultimate'
  ) {
    return isPersonalUltimatePromo(startedAt, userType) ? 0.8 : 1.6;
  }

  return DIRECT_MODEL_MULTIPLIERS[normalizedModel] ?? null;
}

function isPersonalUltimatePromo(startedAt: string | null, userType: string | null): boolean {
  if (!userType?.startsWith('personal')) return false;
  if (!startedAt) return false;
  const startedAtMs = Date.parse(startedAt);
  if (!Number.isFinite(startedAtMs)) return false;
  return startedAtMs >= ULTIMATE_PERSONAL_PROMO_START;
}

function readQoderUserType(dbPath: string): string | null {
  const cacheRoot = path.resolve(path.dirname(dbPath), '..');
  const cached = USER_TYPE_CACHE.get(cacheRoot);
  if (cached !== undefined) {
    return cached;
  }

  const statusPath = path.join(cacheRoot, 'status.json');
  if (!existsSync(statusPath)) {
    USER_TYPE_CACHE.set(cacheRoot, null);
    return null;
  }

  try {
    const raw = readFileSync(statusPath, 'utf-8');
    const parsed = JSON.parse(raw) as { user_type?: unknown };
    const userType = typeof parsed.user_type === 'string' ? parsed.user_type : null;
    USER_TYPE_CACHE.set(cacheRoot, userType);
    return userType;
  } catch {
    USER_TYPE_CACHE.set(cacheRoot, null);
    return null;
  }
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
