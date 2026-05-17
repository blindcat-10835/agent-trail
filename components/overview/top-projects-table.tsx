'use client'

import { shortPath } from '@/lib/utils'
import { HudFrame } from '@/components/overview/hud-frame'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/dashboard/empty-state'
import type { PricingStatus, ProjectRanking } from '@/types/overview'

// ============================================================================
// Constants
// ============================================================================

const PROJECT_COLORS = [
  'var(--accent)',
  'oklch(0.78 0.12 220)',
  'oklch(0.78 0.15 45)',
  'oklch(0.75 0.17 340)',
  'oklch(0.78 0.15 165)',
  'oklch(0.72 0.18 290)',
  'oklch(0.76 0.14 25)',
  'oklch(0.78 0.10 250)',
]

const SORT_MODES = ['tokens', 'cost'] as const

// ============================================================================
// Helpers
// ============================================================================

function fmtTokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1e6) return (n / 1000).toFixed(1) + 'K'
  return (n / 1e6).toFixed(2) + 'M'
}

function fmtCost(n: number | null, status?: PricingStatus): string {
  if (n == null) return '—'
  const value = n < 0.01 ? n.toFixed(4) : n < 1 ? n.toFixed(3) : n.toFixed(2)
  return `${status === 'partial' ? '~' : ''}$${value}`
}

// ============================================================================
// Sort Toggle
// ============================================================================

function SortToggle({
  sortBy,
  onSortChange,
}: {
  sortBy: string
  onSortChange: (v: string) => void
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {SORT_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onSortChange(mode)}
          className={
            sortBy === mode
              ? 'text-[8.5px] font-bold tracking-[0.14em] uppercase px-1.5 py-0.5 border border-accent text-accent hud-clip-sm transition-colors'
              : 'text-[8.5px] font-bold tracking-[0.14em] uppercase px-1.5 py-0.5 text-muted-foreground hover:text-foreground transition-colors'
          }
        >
          {mode === 'tokens' ? 'TOKENS' : 'COST'}
        </button>
      ))}
    </span>
  )
}

// ============================================================================
// Winner Component
// ============================================================================

function Winner({ items, sortBy }: { items: ProjectRanking[]; sortBy: string }) {
  if (!items.length) return null

  const [winner, ...rest] = items
  const winnerColor = PROJECT_COLORS[0]
  const winnerMetric = sortBy === 'cost'
    ? fmtCost(winner.cost, winner.pricingStatus)
    : `${winner.rankWeight.toFixed(1)}%`
  const winnerSub = sortBy === 'cost'
    ? `${winner.rankWeight.toFixed(1)}% share`
    : fmtTokens(winner.totalTokens)

  return (
    <div className="flex flex-col">
      {/* #01 Leader Hero */}
      <div
        className="relative overflow-hidden"
        style={{
          padding: '14px 14px 13px',
          background: `linear-gradient(180deg, color-mix(in oklch, ${winnerColor} 14%, var(--card)) 0%, color-mix(in oklch, ${winnerColor} 4%, var(--card)) 100%)`,
          borderLeft: `2px solid ${winnerColor}`,
          boxShadow: `inset 0 0 28px color-mix(in oklch, ${winnerColor} 6%, transparent)`,
        }}
      >
        {/* Ghost rank number */}
        <span
          className="absolute top-2 right-3.5 font-bold font-mono leading-none pointer-events-none select-none"
          style={{
            fontSize: 30,
            letterSpacing: '-0.04em',
            color: winnerColor,
            opacity: 0.5,
            textShadow: `0 0 12px ${winnerColor}`,
          }}
        >
          01
        </span>
        {/* Decorative circle */}
        <span
          className="absolute -right-5 -bottom-8 w-[90px] h-[90px] rounded-full pointer-events-none"
          style={{ border: `1px solid color-mix(in oklch, ${winnerColor} 22%, transparent)` }}
        />

        <div
          className="text-[8.5px] font-bold tracking-[0.22em] uppercase mb-1.5"
          style={{ color: winnerColor, opacity: 0.85 }}
        >
          CURRENT LEADER
        </div>
        <div
          className="font-mono leading-tight mb-2 truncate"
          style={{ fontSize: 15, color: 'var(--foreground)', letterSpacing: '-0.01em' }}
          title={winner.project}
        >
          {shortPath(winner.project)}
        </div>
        <div className="flex items-baseline gap-2.5 mb-2.5">
          <span
            className="font-bold font-mono tabular-nums leading-none"
            style={{
              fontSize: 22,
              color: winnerColor,
              textShadow: `0 0 10px color-mix(in oklch, ${winnerColor} 35%, transparent)`,
            }}
          >
            {winnerMetric}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {winnerSub}
          </span>
        </div>
        {/* Progress bar */}
        <div
          className="h-1 overflow-hidden"
          style={{ background: 'color-mix(in oklch, var(--muted) 60%, transparent)' }}
        >
          <div
            className="h-full"
            style={{
              width: `${winner.rankWeight}%`,
              background: `linear-gradient(90deg, color-mix(in oklch, ${winnerColor} 40%, transparent), ${winnerColor})`,
              boxShadow: `0 0 8px color-mix(in oklch, ${winnerColor} 50%, transparent)`,
            }}
          />
        </div>
      </div>

      {/* Ranked Rows */}
      <div className="flex flex-col py-2">
        {rest.map((proj, i) => {
          const color = PROJECT_COLORS[i + 1] ?? 'var(--accent-dim)'
          return (
            <div
              key={proj.project}
              className="grid items-center px-3.5 py-[5px] border-t first:border-t-0"
              style={{
                gridTemplateColumns: '24px 8px minmax(0,1fr) 44px 44px 36px',
                gap: 8,
                fontSize: 11,
                borderColor: 'color-mix(in oklch, var(--border) 35%, transparent)',
              }}
            >
              <span className="text-[10px] font-mono text-muted-foreground tracking-[0.04em]">
                {String(i + 2).padStart(2, '0')}
              </span>
              <span
                className="w-[7px] h-[7px] shrink-0"
                style={{ background: color, boxShadow: `0 0 5px ${color}` }}
              />
              <span
                className="text-[10.5px] font-mono text-card-foreground truncate"
                title={proj.project}
              >
                {shortPath(proj.project)}
              </span>
              <div
                className="h-[3px] overflow-hidden"
                style={{ background: 'color-mix(in oklch, var(--muted) 50%, transparent)' }}
              >
                <div
                  className="h-full"
                  style={{ width: `${proj.rankWeight}%`, background: color }}
                />
              </div>
              <span className="text-[10px] font-mono tabular-nums text-muted-foreground text-right">
                {sortBy === 'cost' ? fmtCost(proj.cost, proj.pricingStatus) : fmtTokens(proj.totalTokens)}
              </span>
              <span className="text-[10.5px] font-mono tabular-nums text-muted-foreground text-right">
                {proj.rankWeight.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// Skeleton
// ============================================================================

function WinnerSkeleton() {
  return (
    <div className="flex flex-col gap-0">
      <div className="p-3.5">
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-5 w-32 mb-3" />
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-1 w-full" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2 px-3.5 py-1.5 border-t border-border/35">
          <Skeleton className="h-3 w-5 shrink-0" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-2 w-8 shrink-0" />
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Props
// ============================================================================

interface TopProjectsTableProps {
  projects: ProjectRanking[]
  loading: boolean
  error?: string | null
  sortBy: string
  onSortChange: (sortBy: string) => void
}

// ============================================================================
// Component
// ============================================================================

export function TopProjectsTable({ projects, loading, error, sortBy, onSortChange }: TopProjectsTableProps) {
  const rightSlot = (
    <span className="inline-flex items-center gap-2">
      <span className="text-[9px] font-mono text-muted-foreground tracking-[0.04em]">
        BY
      </span>
      <SortToggle sortBy={sortBy} onSortChange={onSortChange} />
    </span>
  )

  if (loading) {
    return (
      <HudFrame label="TOP PROJECTS" right={rightSlot} bodyClassName="p-0">
        <WinnerSkeleton />
      </HudFrame>
    )
  }

  if (error) {
    return (
      <HudFrame label="TOP PROJECTS" right={rightSlot}>
        <EmptyState heading="LOAD ERROR" body={error} />
      </HudFrame>
    )
  }

  if (projects.length === 0) {
    return (
      <HudFrame label="TOP PROJECTS" right={rightSlot}>
        <EmptyState heading="NO PROJECT DATA" body="No projects found for the selected time window." />
      </HudFrame>
    )
  }

  return (
    <HudFrame label="TOP PROJECTS" right={rightSlot} bodyClassName="p-0">
      <Winner items={projects} sortBy={sortBy} />
    </HudFrame>
  )
}
