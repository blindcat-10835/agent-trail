'use client'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/dashboard/empty-state'
import type { ModelRanking } from '@/types/overview'

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

interface TopModelsTableProps {
  models: ModelRanking[]
  loading: boolean
  error?: string | null
  sortBy: string
  onSortChange: (sortBy: string) => void
}

// ============================================================================
// Row Skeleton
// ============================================================================

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-b-0">
      <Skeleton className="h-4 w-4 shrink-0" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-10 ml-auto" />
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

// ============================================================================
// Component
// ============================================================================

const SORT_MODES = ['tokens', 'cost'] as const

export function TopModelsTable({ models, loading, error, sortBy, onSortChange }: TopModelsTableProps) {
  const isTokenMode = sortBy !== 'cost'

  // Toggle row
  const toggle = (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border">
      <span className="text-[9px] font-bold tracking-[0.15em] text-muted-foreground uppercase mr-2">RANK BY</span>
      {SORT_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onSortChange(mode)}
          className={cn(
            'text-[9px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 transition-colors',
            sortBy === mode
              ? 'bg-accent text-accent-foreground hud-clip-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {mode === 'tokens' ? 'TOKENS' : 'COST'}
        </button>
      ))}
    </div>
  )

  // Column header — conditional on mode
  const header = (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-border text-[9px] text-muted-foreground tracking-[0.15em] uppercase font-bold">
      <span className="w-5 shrink-0 text-center">#</span>
      <span className="flex-1 min-w-0">MODEL</span>
      <span className="w-14 text-right font-mono tabular-nums">SESSIONS</span>
      {isTokenMode ? (
        <>
          <span className="w-16 text-right font-mono tabular-nums">TOKENS</span>
          <span className="w-20 text-right font-mono tabular-nums">SHARE</span>
        </>
      ) : (
        <span className="w-16 text-right font-mono tabular-nums">COST</span>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="bg-card border border-border">
        {toggle}
        {header}
        {Array.from({ length: 5 }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-card border border-border">
        {toggle}
        <EmptyState heading="LOAD ERROR" body={error} />
      </div>
    )
  }

  if (models.length === 0) {
    return (
      <div className="bg-card border border-border">
        {toggle}
        <EmptyState heading="NO MODEL DATA" body="No models found for the selected time window" />
      </div>
    )
  }

  return (
    <div className="bg-card border border-border">
      {toggle}
      {header}
      {models.map((model, i) => (
        <div
          key={model.name}
          className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
        >
          <span className="w-5 shrink-0 text-center text-[10px] text-muted-foreground font-mono tabular-nums">
            {i + 1}
          </span>
          <span className="flex-1 min-w-0 text-xs font-mono truncate" title={model.name}>
            {model.name}
          </span>
          <span className="w-14 text-right text-[11px] font-mono tabular-nums">
            {fmtNum(model.sessionCount)}
          </span>
          {isTokenMode ? (
            <>
              <span className="w-16 text-right text-[11px] font-mono tabular-nums">
                {fmtNum(model.totalTokens)}
              </span>
              <span className="w-20 flex items-center justify-end gap-1.5">
                <span className="text-[10px] font-mono tabular-nums">{model.sharePercent.toFixed(1)}%</span>
                <span className="inline-block h-1.5 rounded-full bg-accent" style={{ width: `${Math.max(model.sharePercent, 1)}%`, maxWidth: '40px' }} />
              </span>
            </>
          ) : (
            <span className="w-16 text-right text-[11px] font-mono tabular-nums">
              {model.cost !== null ? fmtNum(model.cost) : '\u2014'}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
