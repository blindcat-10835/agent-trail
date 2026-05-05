'use client'

import type { LogSummary } from '@/types/activity'

interface ActivitySummaryCardsProps {
  summary: LogSummary | null
}

export function ActivitySummaryCards({ summary }: ActivitySummaryCardsProps) {
  const totalEntries = summary?.totalEntries ?? 0
  const errorCount = summary?.errorCount ?? 0
  const cronCount = summary?.sources.cron ?? 0
  const configCount = summary?.sources.config ?? 0

  return (
    <div className="grid grid-cols-3 gap-3 @mobile:grid-cols-1">
      {/* Total Events Card */}
      <div className="bg-card border border-border p-3.5 hud-clip-md">
        <div className="text-[9.5px] text-muted-foreground tracking-[0.2em] uppercase mb-1">
          TOTAL EVENTS
        </div>
        <div className="text-3xl font-bold tabular-nums text-foreground">
          {totalEntries}
        </div>
      </div>

      {/* Errors Card */}
      <div className="bg-card border border-border p-3.5 hud-clip-md relative overflow-hidden">
        <div className="text-[9.5px] text-muted-foreground tracking-[0.2em] uppercase mb-1">
          ERRORS
        </div>
        <div className="flex items-center gap-2">
          {errorCount > 0 && (
            <span className="animate-pulse w-2 h-2 rounded-full bg-destructive flex-shrink-0" />
          )}
          <div
            className="text-3xl font-bold tabular-nums"
            style={{ color: errorCount > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--accent))' }}
          >
            {errorCount}
          </div>
        </div>
      </div>

      {/* Sources Card */}
      <div className="bg-card border border-border p-3.5 hud-clip-md">
        <div className="text-[9.5px] text-muted-foreground tracking-[0.2em] uppercase mb-1">
          SOURCES
        </div>
        <div className="flex items-center gap-3">
          <div>
            <span className="text-base font-semibold tabular-nums text-[oklch(0.72_0.14_220)]">
              {cronCount}
            </span>
            <span className="text-[10.5px] text-muted-foreground ml-1">cron</span>
          </div>
          <div>
            <span className="text-base font-semibold tabular-nums text-[oklch(0.65_0.18_300)]">
              {configCount}
            </span>
            <span className="text-[10.5px] text-muted-foreground ml-1">config</span>
          </div>
        </div>
      </div>
    </div>
  )
}
