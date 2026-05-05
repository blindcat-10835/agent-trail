'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { LogEntry, LogFilter, LogSummary } from '@/types/activity'
import { ActivitySummaryCards } from '@/components/activity/activity-summary-cards'
import { ActivityEntryDrawer } from '@/components/activity/activity-entry-drawer'
import { LogBrowser } from '@/components/activity/log-browser'

export default function ActivityPage() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [summary, setSummary] = useState<LogSummary | null>(null)
  const [filter, setFilter] = useState<LogFilter>('all')
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [updatedAgo, setUpdatedAgo] = useState('just now')

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId]
  )

  // Simple time ago formatter
  function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return '<1m'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    return `${Math.floor(seconds / 3600)}h`
  }

  // Refresh data from API
  const refresh = useCallback(() => {
    setRefreshing(true)
    setError(null)

    fetch('/api/logs')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load logs')
        return r.json()
      })
      .then((data: { entries: LogEntry[]; summary: LogSummary }) => {
        setEntries(data.entries)
        setSummary(data.summary)
        setLastRefresh(new Date())
        setLoading(false)
        setRefreshing(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLoading(false)
        setRefreshing(false)
      })
  }, [])

  // Initial load + polling every 60 seconds
  useEffect(() => {
    const initialRefresh = window.setTimeout(refresh, 0)
    const interval = setInterval(refresh, 60000)
    return () => {
      window.clearTimeout(initialRefresh)
      clearInterval(interval)
    }
  }, [refresh])

  // Update "updated ago" ticker every 30 seconds
  useEffect(() => {
    const tick = () => setUpdatedAgo(formatTimeAgo(lastRefresh))
    tick()
    const interval = setInterval(tick, 30000)
    return () => clearInterval(interval)
  }, [lastRefresh])

  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden flex flex-col bg-background">
      {/* Sticky header */}
      <div className="flex-shrink-0 px-3.5 py-2.5 border-b border-border bg-card flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-foreground font-semibold text-[9.5px] tracking-[0.2em] uppercase">
            ACTIVITY CONSOLE
          </h1>
          {!loading && summary && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {summary.totalEntries} event{summary.totalEntries !== 1 ? 's' : ''}
              {summary.errorCount > 0 && (
                <span className="text-destructive">
                  {' · '}{summary.errorCount} error{summary.errorCount !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10.5px] text-muted-foreground">Updated {updatedAgo}</span>
          <button
            onClick={refresh}
            aria-label="Refresh activity data"
            className="w-8 h-8 flex items-center justify-center rounded-md bg-background border border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-3.5 min-h-0">
        {error && entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="text-destructive text-sm font-medium">{error}</div>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-accent text-accent-foreground rounded-md text-xs font-medium hover:bg-accent/90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring/50"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <>
            {/* Skeleton cards */}
            <div className="grid grid-cols-3 gap-3 mb-4 @mobile:grid-cols-1">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-card border border-border p-3.5 hud-clip-md">
                  <div className="h-2.5 w-20 bg-muted rounded mb-2" />
                  <div className="h-6 w-12 bg-muted rounded" />
                </div>
              ))}
            </div>

            {/* Skeleton log rows */}
            <div className="bg-card border border-border rounded-md overflow-hidden">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className="flex items-center px-3 py-2.5 gap-3"
                  style={{ borderBottom: i < 5 ? '1px solid hsl(var(--border))' : undefined }}
                >
                  <div className="flex-shrink-0 w-2 h-2 bg-muted rounded-full" />
                  <div className="w-28 h-3 bg-muted rounded" />
                  <div className="w-14 h-5 bg-muted rounded" />
                  <div className="flex-1 h-3.5 bg-muted rounded" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Summary cards */}
            <div className="mb-4">
              <ActivitySummaryCards summary={summary} />
            </div>

            {/* Log browser */}
            <LogBrowser
              entries={entries}
              summary={summary}
              loading={false}
              filter={filter}
              onFilterChange={setFilter}
              selectedEntryId={selectedEntryId}
              onSelectEntry={(entry) => {
                setSelectedEntryId((current) => current === entry.id ? null : entry.id)
              }}
            />
          </>
        )}
      </div>

      {selectedEntry && (
        <ActivityEntryDrawer
          entry={selectedEntry}
          onClose={() => setSelectedEntryId(null)}
        />
      )}
    </div>
  )
}
