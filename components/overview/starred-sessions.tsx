'use client'

import { shortPath } from '@/lib/utils'
import { getSourceColor } from '@/lib/agent-tools/registry'
import { HudFrame } from '@/components/overview/hud-frame'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/dashboard/empty-state'
import type { StarredSession } from '@/types/overview'

// ============================================================================
// Helpers
// ============================================================================

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

function sourceLabel(source: string): string {
  switch (source) {
    case 'openclaw': return 'OPENCLAW'
    case 'claude-code': return 'CLAUDE'
    case 'codex': return 'CODEX'
    case 'opencode': return 'OPENCODE'
    case 'qoder': return 'QODER'
    default: return (source ?? '').toUpperCase()
  }
}

// ============================================================================
// Star Thread
// ============================================================================

function StarThread({ items }: { items: StarredSession[] }) {
  return (
    <ol className="list-none p-0 m-0 flex flex-col">
      {items.map((session, i) => {
        const color = getSourceColor(session.source)
        const isFirst = i === 0
        const isLast = i === items.length - 1

        return (
          <li
            key={session.id}
            className="grid items-stretch"
            style={{ gridTemplateColumns: '36px 1fr' }}
          >
            {/* Anchor column: vertical line + star */}
            <span className="relative flex flex-col items-center justify-center">
              {/* Vertical thread line */}
              <span
                className="absolute left-1/2 -translate-x-1/2"
                style={{
                  top: isFirst ? '50%' : -1,
                  bottom: isLast ? '50%' : -1,
                  width: 1,
                  background: `color-mix(in oklch, ${color} 30%, transparent)`,
                }}
              />
              {/* Star icon */}
              <span
                className="relative z-[1] text-[15px] leading-none select-none px-1 py-1"
                style={{
                  color,
                  textShadow: `0 0 12px ${color}`,
                  background: 'var(--card)',
                }}
              >
                ★
              </span>
            </span>

            {/* Card column */}
            <div
              className="py-[11px] pr-3.5 pl-1"
              style={{
                borderBottom: isLast
                  ? 'none'
                  : '1px solid color-mix(in oklch, var(--border) 35%, transparent)',
              }}
            >
              {/* Line 1: project · source · time */}
              <div
                className="flex items-center gap-2 mb-[5px] font-mono"
                style={{ fontSize: 9.5, letterSpacing: '0.06em' }}
              >
                <span className="font-bold" style={{ color, letterSpacing: '0.04em' }}>
                  {shortPath(session.project)}
                </span>
                <span className="opacity-40">·</span>
                <span
                  className="text-muted-foreground uppercase tracking-[0.14em]"
                  style={{ fontSize: 9 }}
                >
                  {sourceLabel(session.source)}
                </span>
                <span
                  className="ml-auto text-muted-foreground px-1.5 py-0.5 border"
                  style={{ borderColor: 'color-mix(in oklch, var(--border) 60%, transparent)', fontSize: 9 }}
                >
                  {relativeTime(session.starredAt)}
                </span>
              </div>

              {/* Session name */}
              <div
                className="text-foreground leading-[1.4] mb-1.5"
                style={{ fontSize: 13, fontWeight: 500 }}
              >
                {session.name || 'UNTITLED SESSION'}
              </div>

              {/* Line 2: status */}
              <div
                className="flex items-center gap-2 font-mono text-muted-foreground"
                style={{ fontSize: 10 }}
              >
                <span>{session.status.toUpperCase()}</span>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ============================================================================
// Skeleton
// ============================================================================

function ThreadSkeleton() {
  return (
    <div className="flex flex-col">
      {[1, 2, 3].map((i) => (
        <div key={i} className="grid py-3 border-b border-border/35 last:border-b-0" style={{ gridTemplateColumns: '36px 1fr' }}>
          <Skeleton className="h-4 w-4 self-center mx-auto" />
          <div className="flex flex-col gap-1.5 pl-1">
            <Skeleton className="h-2 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
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
// Component
// ============================================================================

export function StarredSessions({ starred, loading, error }: StarredSessionsProps) {
  const rightSlot = (
    <span className="text-[9px] font-mono text-muted-foreground tracking-[0.04em] cursor-pointer hover:text-accent transition-colors">
      SEE ALL ›
    </span>
  )

  if (loading) {
    return (
      <HudFrame label="★ STARRED · RECENT" right={rightSlot} bodyClassName="p-0">
        <ThreadSkeleton />
      </HudFrame>
    )
  }

  if (error) {
    return (
      <HudFrame label="★ STARRED · RECENT" right={rightSlot}>
        <EmptyState heading="LOAD ERROR" body={error} />
      </HudFrame>
    )
  }

  if (starred.length === 0) {
    return (
      <HudFrame label="★ STARRED · RECENT" right={rightSlot}>
        <EmptyState
          heading="NO STARRED SESSIONS"
          body="STAR SESSIONS FROM THE SESSIONS VIEW TO PIN THEM HERE."
        />
      </HudFrame>
    )
  }

  return (
    <HudFrame label="★ STARRED · RECENT" right={rightSlot} bodyClassName="p-0">
      <StarThread items={starred.slice(0, 5)} />
    </HudFrame>
  )
}
