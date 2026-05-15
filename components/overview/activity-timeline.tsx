'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/dashboard/empty-state'
import type { TimelineEvent, TimelineEventType } from '@/types/overview'

// ============================================================================
// Helpers
// ============================================================================

/** Event type → visual treatment */
const EVENT_META: Record<TimelineEventType, { label: string; color: string }> = {
  session_started: { label: 'STARTED', color: 'var(--accent)' },
  session_completed: { label: 'COMPLETED', color: 'var(--muted-foreground)' },
  session_error: { label: 'ERROR', color: 'var(--destructive)' },
  sync_error: { label: 'SYNC ERROR', color: 'var(--destructive)' },
}

/** Convert ISO string to relative time label */
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

// ============================================================================
// Props
// ============================================================================

interface ActivityTimelineProps {
  timeline: TimelineEvent[]
  loading: boolean
  error?: string | null
}

// ============================================================================
// Row Skeleton
// ============================================================================

function RowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-3 py-2 border-b border-border last:border-b-0">
      <Skeleton className="h-2 w-2 rounded-full shrink-0 mt-1" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-3 w-10 ml-auto" />
    </div>
  )
}

// ============================================================================
// Component
// ============================================================================

export function ActivityTimeline({ timeline, loading, error }: ActivityTimelineProps) {
  const heading = (
    <div className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
      ACTIVITY
    </div>
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        <div className="bg-card border border-border">
          {Array.from({ length: 5 }).map((_, i) => (
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

  if (timeline.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        <EmptyState heading="NO RECENT ACTIVITY" body="No timeline events found for this source." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {heading}
      <div className="bg-card border border-border">
        {timeline.map((event) => {
          const meta = EVENT_META[event.eventType] ?? { label: event.eventType.toUpperCase(), color: 'var(--muted-foreground)' }
          const isErroneous = event.eventType === 'session_error' || event.eventType === 'sync_error'

          return (
            <div
              key={event.id}
              className="px-3 py-2 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Status dot */}
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: meta.color }}
                />

                {/* Event label */}
                <span
                  className="text-[10px] font-bold tracking-[0.15em] uppercase shrink-0"
                  style={{ color: isErroneous ? 'var(--destructive)' : 'var(--foreground)' }}
                >
                  {meta.label}
                </span>

                {/* Separator */}
                <span className="text-muted-foreground text-[10px]">·</span>

                {/* Session/project name */}
                <span className="text-[11px] font-mono truncate min-w-0" title={event.name || event.project}>
                  {event.name || event.project || '\u2014'}
                </span>

                {/* Relative time */}
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 ml-auto">
                  {relativeTime(event.eventTime)}
                </span>
              </div>

              {/* Error message on second line */}
              {isErroneous && event.errorMessage && (
                <div className="mt-1 ml-[18px] text-[10px] text-destructive truncate" title={event.errorMessage}>
                  {event.errorMessage}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
