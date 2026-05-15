'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/dashboard/empty-state'
import type { ProjectRanking } from '@/types/overview'

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

interface TopProjectsTableProps {
  projects: ProjectRanking[]
  loading: boolean
  error?: string | null
}

// ============================================================================
// Row Skeleton
// ============================================================================

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-b-0">
      <Skeleton className="h-4 w-4 shrink-0" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-10 ml-auto" />
      <Skeleton className="h-4 w-10" />
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

// ============================================================================
// Component
// ============================================================================

export function TopProjectsTable({ projects, loading, error }: TopProjectsTableProps) {
  // Column header
  const header = (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-border text-[9px] text-muted-foreground tracking-[0.15em] uppercase font-bold">
      <span className="w-5 shrink-0 text-center">#</span>
      <span className="flex-1 min-w-0">PROJECT</span>
      <span className="w-14 text-right font-mono tabular-nums">SESSIONS</span>
      <span className="w-12 text-right font-mono tabular-nums">TURNS</span>
      <span className="w-16 text-right font-mono tabular-nums">TOKENS</span>
      <span className="w-20 text-right font-mono tabular-nums">WEIGHT</span>
    </div>
  )

  if (loading) {
    return (
      <div className="bg-card border border-border">
        {header}
        {Array.from({ length: 5 }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState heading="LOAD ERROR" body={error} />
    )
  }

  if (projects.length === 0) {
    return (
      <EmptyState heading="NO PROJECT DATA" body="No projects found for the selected time window" />
    )
  }

  return (
    <div className="bg-card border border-border">
      {header}
      {projects.map((project, i) => (
        <div
          key={project.project}
          className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
        >
          <span className="w-5 shrink-0 text-center text-[10px] text-muted-foreground font-mono tabular-nums">
            {i + 1}
          </span>
          <span className="flex-1 min-w-0 text-xs font-mono truncate" title={project.project}>
            {project.project}
          </span>
          <span className="w-14 text-right text-[11px] font-mono tabular-nums">
            {fmtNum(project.sessionCount)}
          </span>
          <span className="w-12 text-right text-[11px] font-mono tabular-nums">
            {fmtNum(project.turnCount)}
          </span>
          <span className="w-16 text-right text-[11px] font-mono tabular-nums">
            {fmtNum(project.totalTokens)}
          </span>
          <span className="w-20 flex items-center justify-end gap-1.5">
            <span className="text-[10px] font-mono tabular-nums">{project.rankWeight.toFixed(1)}%</span>
            <span className="inline-block h-1.5 rounded-full bg-accent" style={{ width: `${Math.max(project.rankWeight, 1)}%`, maxWidth: '40px' }} />
          </span>
        </div>
      ))}
    </div>
  )
}
