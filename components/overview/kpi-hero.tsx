'use client'

import { Skeleton } from '@/components/ui/skeleton'
import type { OverviewAggregates } from '@/types/overview'

// ============================================================================
// Helpers
// ============================================================================

function fmtNum(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1e6) return (n / 1000).toFixed(1) + 'k'
  return (n / 1e6).toFixed(2) + 'm'
}

function fmtTokenSplit(input: number, output: number): string {
  return `${fmtNum(input)} in / ${fmtNum(output)} out`
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
        <div className="text-[10.5px] text-foreground/65 font-mono tabular-nums">{sublabel}</div>
      )}
    </div>
  )
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function KpiSkeleton() {
  return (
    <div className="px-4 py-3.5 border-r border-border last:border-r-0 flex flex-col gap-1.5 min-w-0">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-7 w-20" />
    </div>
  )
}

// ============================================================================
// Props
// ============================================================================

interface KpiHeroProps {
  aggregates: OverviewAggregates | null
  loading: boolean
  error?: string | null
}

// ============================================================================
// Component
// ============================================================================

export function KpiHero({ aggregates, loading, error }: KpiHeroProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-4 bg-card border border-border">
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </div>
    )
  }

  // Connection error with no data — show terse HUD error
  if (error && !aggregates) {
    return (
      <div className="grid grid-cols-4 bg-card border border-destructive">
        <div className="col-span-4 px-4 py-3.5 flex items-center justify-center">
          <span className="text-[10.5px] font-bold tracking-[0.15em] text-destructive uppercase">
            INGEST OFFLINE
          </span>
        </div>
      </div>
    )
  }

  const dash = '\u2014'

  return (
    <div className="grid grid-cols-4 bg-card border border-border">
      <KpiTile
        label="SESSIONS"
        value={aggregates ? fmtNum(aggregates.sessionCount) : dash}
        mono
      />
      <KpiTile
        label="TURNS"
        value={aggregates ? fmtNum(aggregates.turnCount) : dash}
        mono
      />
      <KpiTile
        label="TOKENS"
        value={aggregates ? fmtNum(aggregates.totalTokens) : dash}
        sublabel={aggregates ? fmtTokenSplit(aggregates.inputTokens, aggregates.outputTokens) : undefined}
        mono
      />
      <KpiTile
        label="PROJECTS"
        value={aggregates ? String(aggregates.projectCount) : dash}
      />
    </div>
  )
}
