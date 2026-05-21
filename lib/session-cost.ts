import type { TraceSession } from '@/types/trace'

interface CostInput {
  estimatedCost?: number | null
  costPricingStatus?: string | null
  costUnit?: string | null
}

export function formatSessionCost(input: TraceSession | CostInput): string {
  const cost = (input as CostInput).estimatedCost ?? null
  if (cost == null) return '—'
  return '$' + cost.toFixed(2)
}

export interface CostSummary {
  total: number | null
  mixedUnits: boolean
  pricingStatus: string | null
  unit: string | null
}

export function summarizeSessionCosts(sessions: TraceSession[]): CostSummary {
  const withCost = sessions.filter((s) => s.estimatedCost != null)
  if (withCost.length === 0) return { total: null, mixedUnits: false, pricingStatus: null, unit: null }
  const total = withCost.reduce((sum, s) => sum + (s.estimatedCost as number), 0)
  return { total, mixedUnits: false, pricingStatus: null, unit: 'usd' }
}
