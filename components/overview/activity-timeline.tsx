'use client'

import { shortPath } from '@/lib/utils'
import { HudFrame } from '@/components/overview/hud-frame'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/dashboard/empty-state'
import type { TimelineEvent, TimelineEventType } from '@/types/overview'

const EVENT_COLOR: Record<TimelineEventType, string> = {
  session_started: 'oklch(0.78 0.12 220)',
  session_completed: 'var(--muted-foreground)',
  session_error: 'var(--destructive)',
  sync_error: 'var(--destructive)',
  automation_completed: 'oklch(0.78 0.15 45)',
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'just now'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}mo`
}

function getTimelineEventKey(event: TimelineEvent): string {
  return [event.source, event.id, event.eventType, event.eventTime || 'unknown'].join(':')
}

function sourceTag(source: string): string {
  switch (source) {
    case 'openclaw': return 'OPENCLAW'
    case 'claude-code': return 'CLAUDE:CODE'
    case 'codex': return 'CODEX'
    default: return (source ?? '').toUpperCase()
  }
}

function eventBody(event: TimelineEvent): string {
  const prefix =
    event.eventType === 'session_started'
      ? 'Session started'
      : event.eventType === 'session_completed'
        ? 'Session completed'
        : event.eventType === 'session_error'
          ? event.errorMessage ?? 'Session error'
          : event.eventType === 'automation_completed'
            ? 'Automation finished'
            : event.errorMessage ?? 'Sync error'

  if (event.name) return `${prefix}: ${event.name}`
  if (event.project) return `${prefix} in ${shortPath(event.project)}`
  return prefix
}

// ============================================================================
// Stream Feed
// ============================================================================

function StreamFeed({ items }: { items: TimelineEvent[] }) {
  return (
    <div className="flex flex-col">
      {items.map((event, i) => {
        const color = EVENT_COLOR[event.eventType] ?? 'var(--muted-foreground)'
        const isFirst = i === 0
        const isLast = i === items.length - 1

        return (
          <div
            key={getTimelineEventKey(event)}
            className="grid items-stretch py-[7px]"
            style={{ gridTemplateColumns: '42px 16px 1fr', gap: 8, position: 'relative' }}
          >
            {/* Time */}
            <span className="text-[10.5px] font-mono tabular-nums text-muted-foreground self-center">
              {relativeTime(event.eventTime)}
            </span>

            {/* Rail */}
            <span className="relative flex items-center justify-center">
              {/* Stem */}
              <span
                className="absolute left-1/2 -translate-x-1/2"
                style={{
                  top: isFirst ? '50%' : -7,
                  bottom: isLast ? '50%' : -7,
                  width: 1,
                  background: color,
                  opacity: 0.35,
                }}
              />
              {/* Diamond pip */}
              <span
                className="relative z-[1] w-[7px] h-[7px] rotate-45"
                style={{ background: color, boxShadow: `0 0 8px ${color}` }}
              />
            </span>

            {/* Body */}
            <div className="flex flex-col gap-1 min-w-0 self-center">
              <span
                className="text-[12px] leading-[1.4] truncate"
                style={{ color: 'var(--foreground)' }}
                title={eventBody(event)}
              >
                {eventBody(event)}
              </span>
              <span
                className="text-[8.5px] font-bold tracking-[0.16em] uppercase w-fit px-1.5 py-0.5 border"
                style={{
                  color: 'var(--muted-foreground)',
                  borderColor: 'var(--border)',
                  background: 'color-mix(in oklch, var(--background) 50%, transparent)',
                }}
              >
                {sourceTag(event.source)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// Skeleton
// ============================================================================

function FeedSkeleton() {
  return (
    <div className="flex flex-col">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="grid py-2" style={{ gridTemplateColumns: '42px 16px 1fr', gap: 8 }}>
          <Skeleton className="h-3 w-8 self-center" />
          <Skeleton className="h-2 w-2 self-center mx-auto rotate-45" />
          <div className="flex flex-col gap-1 self-center">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2 w-14" />
          </div>
        </div>
      ))}
    </div>
  )
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
// Component
// ============================================================================

export function ActivityTimeline({ timeline, loading, error }: ActivityTimelineProps) {
  const liveIndicator = (
    <span
      className="inline-flex items-center gap-1.5 text-[9.5px] font-bold tracking-[0.18em]"
      style={{ color: 'var(--status-success)' }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ background: 'var(--status-success)', boxShadow: '0 0 6px var(--status-success)' }}
      />
      STREAMING
    </span>
  )

  if (loading) {
    return (
      <HudFrame label="LIVE ACTIVITY" right={liveIndicator} bodyClassName="p-0 px-3.5">
        <FeedSkeleton />
      </HudFrame>
    )
  }

  if (error) {
    return (
      <HudFrame label="LIVE ACTIVITY" right={liveIndicator}>
        <EmptyState heading="LOAD ERROR" body={error} />
      </HudFrame>
    )
  }

  if (timeline.length === 0) {
    return (
      <HudFrame label="LIVE ACTIVITY" right={liveIndicator}>
        <EmptyState heading="NO RECENT ACTIVITY" body="No timeline events found for this source." />
      </HudFrame>
    )
  }

  return (
    <HudFrame label="LIVE ACTIVITY" right={liveIndicator} bodyClassName="p-0 px-3.5">
      <StreamFeed items={timeline.slice(0, 8)} />
    </HudFrame>
  )
}
