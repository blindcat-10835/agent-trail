'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/dashboard/empty-state'
import type { StarredSession } from '@/types/overview'

// ============================================================================
// Helpers
// ============================================================================

/** Convert ISO string to relative time label like "2h ago", "3d ago" */
function relativeTime(iso: string | null): string {
  if (!iso) return '\u2014'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'just now'

  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  return `${Math.floor(days / 30)}mo ago`
}

/** Map source string to compact badge label */
function sourceLabel(source: string): string {
  switch (source) {
    case 'openclaw': return 'OPENCLAW'
    case 'claude-code': return 'CLAUDE:CODE'
    case 'codex': return 'CODEX'
    default: return source.toUpperCase()
  }
}

// ============================================================================
// Props
// ============================================================================

interface StarredSessionsProps {
  starred: StarredSession[]
  loading: boolean
  error?: string | null
}

// ============================================================================
// Row Skeleton
// ============================================================================

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-b-0">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-3 w-10 ml-auto" />
    </div>
  )
}

// ============================================================================
// Component
// ============================================================================

export function StarredSessions({ starred, loading, error }: StarredSessionsProps) {
  const heading = (
    <div className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
      STARRED SESSIONS
    </div>
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        <div className="bg-card border border-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        <EmptyState heading="LOAD ERROR" body={error} />
      </div>
    )
  }

  if (starred.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        <EmptyState
          heading="NO STARRED SESSIONS"
          body="STAR SESSIONS FROM THE SESSIONS VIEW TO PIN THEM HERE."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {heading}
      <div className="bg-card border border-border">
        {starred.map((session) => (
          <div
            key={session.id}
            className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
          >
            {/* Session name (mono, truncate) */}
            <span className="flex-1 min-w-0 text-xs font-mono truncate" title={session.name || 'UNTITLED'}>
              {session.name || 'UNTITLED'}
            </span>

            {/* Project label */}
            <span className="text-[10px] text-muted-foreground truncate max-w-[140px]" title={session.project}>
              {session.project}
            </span>

            {/* Source badge */}
            <Badge variant="outline" className="text-[9px] h-5 px-1.5 tracking-[0.1em] shrink-0">
              {sourceLabel(session.source)}
            </Badge>

            {/* Relative time */}
            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 ml-auto min-w-[48px] text-right">
              {relativeTime(session.starredAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
