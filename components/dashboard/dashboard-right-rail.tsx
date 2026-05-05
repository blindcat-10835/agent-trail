'use client'

import { useState, useMemo, useEffect } from 'react'
import { useGatewayStore } from '@/stores/gateway/gateway-store'
import { cn } from '@/lib/utils'
import type { LogEntry } from '@/types/activity'

type RailTab = 'feed' | 'activity' | 'providers'

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function fmtAgo(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

function fmtNum(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1e6) return (n / 1000).toFixed(1) + 'k'
  return (n / 1e6).toFixed(2) + 'm'
}

function fmtUsd(n: number): string {
  return '$' + n.toFixed(2)
}

export function DashboardRightRail() {
  const [tab, setTab] = useState<RailTab>('feed')
  const globalEventFeed = useGatewayStore((s) => s.globalEventFeed)
  const usageDetail = useGatewayStore((s) => s.usageDetail)

  // Activity logs state
  const [activityLogs, setActivityLogs] = useState<LogEntry[]>([])

  // Fetch activity logs on mount
  useEffect(() => {
    fetch('/api/logs')
      .then(r => r.json())
      .then((data: { entries: LogEntry[] }) => {
        setActivityLogs(data.entries.slice(0, 10)) // Top 10
      })
      .catch(() => {})
  }, [])

  // Calculate error count for badge
  const errorCount = useMemo(() => activityLogs.filter(e => e.level === 'error').length, [activityLogs])

  return (
    <aside className="h-full grid grid-rows-[auto_1fr_auto] border-l border-border bg-card min-h-0">
      {/* Tabs */}
      <div className="flex border-b border-border bg-background">
        {([
          { id: 'feed' as const, label: 'FEED' },
          { id: 'activity' as const, label: 'ACTIVITY' },
          { id: 'providers' as const, label: 'PROVIDERS' },
        ] as const).map((t) => (
          <button
            key={t.id}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 py-2.5 text-[10px] tracking-[0.18em] text-muted-foreground border-r border-border last:border-r-0 relative',
              tab === t.id && 'text-accent bg-card'
            )}
          >
            {t.label}
            {t.id === 'activity' && errorCount > 0 && (
              <span className="ml-1 bg-destructive text-background px-1 text-[9px] tracking-normal">
                {errorCount}
              </span>
            )}
            {tab === t.id && (
              <span className="absolute left-0 right-0 bottom-[-1px] h-0.5 bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="overflow-y-auto min-h-0">
        {/* Feed */}
        {tab === 'feed' && (
          <div className="text-[11px]">
            {globalEventFeed.length === 0 && (
              <div className="px-4 py-5 text-muted-foreground text-[11px] tracking-[0.08em]">
                ▸ waiting for events…
              </div>
            )}
            {globalEventFeed.map((ev) => (
              <div
                key={`${ev.agentId}-${ev.time}-${ev.runId}`}
                className="grid grid-cols-[52px_12px_1fr] gap-1.5 px-3 py-2 border-b border-border items-baseline animate-[feed-in_0.3s_ease-out]"
              >
                <span className="text-muted-foreground text-[10px] tabular-nums">{fmtTime(ev.time)}</span>
                <span
                  className={cn(
                    'text-[10px] font-bold',
                    ev.type === 'tool' && 'text-[oklch(0.72_0.14_220)]',
                    ev.type === 'assistant' && 'text-[oklch(0.76_0.17_145)]',
                    ev.type === 'error' && 'text-destructive',
                    ev.type === 'lifecycle' && 'text-muted-foreground',
                  )}
                >
                  {ev.type === 'lifecycle' ? 'LFC' : ev.type === 'tool' ? 'TOL' : ev.type === 'assistant' ? 'AST' : 'ERR'}
                </span>
                <span className="text-foreground/65 leading-snug">
                  <span className="text-accent font-semibold mr-1.5">{ev.agentName}</span>
                  {ev.content}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Activity */}
        {tab === 'activity' && (
          <div>
            {activityLogs.length === 0 && (
              <div className="px-4 py-5 text-muted-foreground text-[11px] tracking-[0.08em]">
                No recent activity
              </div>
            )}
            {activityLogs.map((entry) => {
              const levelColor = entry.level === 'error'
                ? 'bg-destructive shadow-[0_0_8px_var(--color-destructive)]'
                : entry.level === 'warn'
                  ? 'bg-accent'
                  : 'bg-[oklch(0.76_0.17_145)]'
              const sourceBadge = entry.source === 'cron'
                ? { label: 'CRON', color: 'text-[oklch(0.72_0.14_220)]', bg: 'bg-[oklch(0.72_0.14_220_/_0.1)]' }
                : { label: 'CONFIG', color: 'text-[oklch(0.65_0.18_300)]', bg: 'bg-[oklch(0.65_0.18_300_/_0.1)]' }
              return (
                <div
                  key={entry.id}
                  className="grid grid-cols-[auto_1fr] gap-2.5 px-3 py-2.5 border-b border-border items-start"
                >
                  <span
                    className={cn(
                      'w-2 h-2 mt-1 rounded-full flex-shrink-0',
                      levelColor
                    )}
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] text-foreground leading-snug truncate" title={entry.summary}>
                      {entry.summary.length > 100 ? entry.summary.slice(0, 97) + '...' : entry.summary}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <span className={cn('px-1 py-0.5 rounded text-[9px] font-semibold', sourceBadge.color, sourceBadge.bg)}>
                        {sourceBadge.label}
                      </span>
                      <span>{fmtAgo(Math.floor((Date.now() - entry.ts) / 1000))} ago</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Providers */}
        {tab === 'providers' && (
          <div>
            {(usageDetail?.providers ?? []).map((p) => {
              const tokensIn = p.tokensIn ?? 0
              const tokensOut = p.tokensOut ?? 0
              const total = tokensIn + tokensOut || 1
              return (
                <div key={p.provider} className="grid grid-cols-[1fr_auto] gap-1 px-3 py-2.5 border-b border-border items-center">
                  <div className="text-[12px] font-semibold text-foreground">{p.displayName}</div>
                  <div className="text-[11px] text-foreground/65 tabular-nums text-right">
                    {fmtUsd(p.estimatedCostUsd ?? 0)}
                  </div>
                  <div className="text-[10px] text-muted-foreground col-span-2">{p.provider}</div>
                  <div className="col-span-2 h-[3px] bg-background flex mt-1">
                    <span className="block h-full bg-[oklch(0.72_0.14_220)]" style={{ width: `${(tokensIn / total) * 100}%` }} />
                    <span className="block h-full bg-[oklch(0.76_0.17_145)]" style={{ width: `${(tokensOut / total) * 100}%` }} />
                  </div>
                  <div className="col-span-2 flex justify-between text-[10px] text-muted-foreground mt-1 tabular-nums">
                    <span><span className="text-[oklch(0.72_0.14_220)]">IN</span> {fmtNum(tokensIn)}</span>
                    <span><span className="text-[oklch(0.76_0.17_145)]">OUT</span> {fmtNum(tokensOut)}</span>
                  </div>
                </div>
              )
            })}
            {!usageDetail?.providers?.length && (
              <div className="px-4 py-5 text-muted-foreground text-[11px] tracking-[0.08em]">
                No provider data
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border flex justify-between items-center text-[10px] text-muted-foreground tracking-[0.08em]">
        <span>LIVE STREAM</span>
        <span>{globalEventFeed.length} evt buffered</span>
      </div>
    </aside>
  )
}
