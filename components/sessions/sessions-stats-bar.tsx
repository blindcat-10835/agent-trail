'use client'

import { useMemo } from 'react'
import type { TraceSession } from '@/types/trace'
import { formatSessionCost, summarizeSessionCosts } from '@/lib/session-cost'

// ============================================================================
// Helpers
// ============================================================================

function fmtNum(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1e6) return (n / 1000).toFixed(1) + 'k'
  return (n / 1e6).toFixed(2) + 'm'
}

// ============================================================================
// Props
// ============================================================================

interface SessionsStatsBarProps {
  sessions: TraceSession[]
  totalCount: number
  totalLabel?: string
}

// ============================================================================
// KPI Tile
// ============================================================================

function KpiTile({
  label,
  value,
  sublabel,
  mono,
}: {
  label: string
  value: string
  sublabel?: string
  mono?: boolean
}) {
  return (
    <div className="px-4 py-3.5 border-r border-border last:border-r-0 flex flex-col gap-1 min-w-0">
      <div className="text-[9.5px] text-muted-foreground tracking-[0.2em] uppercase">
        {label}
      </div>
      <div
        className={`text-2xl font-bold tracking-tight leading-tight whitespace-nowrap ${
          mono ? 'font-mono' : 'tabular-nums'
        }`}
      >
        {value}
      </div>
      {sublabel && (
        <div className="text-[10.5px] text-foreground/65">{sublabel}</div>
      )}
    </div>
  )
}

// ============================================================================
// Stats Bar Component
// ============================================================================

export function SessionsStatsBar({
  sessions,
  totalCount,
  totalLabel = 'TOTAL SESSIONS',
}: SessionsStatsBarProps) {
  const stats = useMemo(() => {
    const activeCount = sessions.filter((s) => s.status === 'active').length
    const totalTokens = sessions.reduce(
      (sum, s) => sum + (s.metrics.totalTokens || 0),
      0,
    )
    const costSummary = summarizeSessionCosts(sessions)

    return { activeCount, totalTokens, costSummary }
  }, [sessions])

  return (
    <div className="grid grid-cols-4 bg-card border border-border">
      <KpiTile
        label={totalLabel}
        value={totalCount.toLocaleString()}
        sublabel={`${stats.activeCount} loaded active`}
      />
      <KpiTile
        label="LOADED ACTIVE"
        value={String(stats.activeCount)}
      />
      <KpiTile
        label="LOADED TOKENS"
        value={fmtNum(stats.totalTokens)}
        mono
      />
      <KpiTile
        label="LOADED COST"
        value={stats.costSummary.total != null && !stats.costSummary.mixedUnits
          ? formatSessionCost({
              estimatedCost: stats.costSummary.total,
              costPricingStatus: stats.costSummary.pricingStatus,
              costUnit: stats.costSummary.unit === 'mixed' ? null : stats.costSummary.unit,
            })
          : '—'}
        sublabel={stats.costSummary.mixedUnits ? 'mixed units' : undefined}
        mono
      />
    </div>
  )
}
