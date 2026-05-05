'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { LogEntry, LogFilter, LogSummary } from '@/types/activity'
import { Skeleton } from '@/components/ui/skeleton'

interface LogBrowserProps {
  entries: LogEntry[]
  summary: LogSummary | null
  loading: boolean
  filter: LogFilter
  onFilterChange: (filter: LogFilter) => void
  selectedEntryId?: string | null
  onSelectEntry?: (entry: LogEntry) => void
}

export function LogBrowser({
  entries,
  summary: _summary,
  loading,
  filter,
  onFilterChange,
  selectedEntryId = null,
  onSelectEntry,
}: LogBrowserProps) {
  const [search, setSearch] = useState('')
  void _summary

  // Helper functions
  function formatTs(ts: number): string {
    if (!ts) return '--'
    const d = new Date(ts)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  function formatDuration(ms: number | null): string {
    if (ms == null) return '--'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  // Filter pills configuration
  const PILLS: { key: LogFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'error', label: 'Errors' },
    { key: 'cron', label: 'Cron' },
    { key: 'config', label: 'Config' },
  ]

  // Calculate filter counts
  const counts: Record<LogFilter, number> = {
    all: entries.length,
    error: entries.filter(e => e.level === 'error').length,
    cron: entries.filter(e => e.source === 'cron').length,
    config: entries.filter(e => e.source === 'config').length,
  }

  // Filter entries based on active filter and search
  const filtered = entries.filter(e => {
    if (filter === 'error' && e.level !== 'error') return false
    if (filter === 'cron' && e.source !== 'cron') return false
    if (filter === 'config' && e.source !== 'config') return false
    if (search && !e.summary.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Loading state
  if (loading) {
    return (
      <div>
        <div className="flex items-center flex-wrap gap-2 mb-3">
          {PILLS.map(p => (
            <Skeleton key={p.key} className="h-8 w-16 rounded-full" />
          ))}
          <Skeleton className="h-8 ml-auto w-40 rounded-md" />
        </div>
        <div className="bg-card border border-border rounded-md overflow-hidden">
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className="flex items-center px-3 py-2.5 gap-3"
              style={{ borderBottom: i < 5 ? '1px solid hsl(var(--border))' : undefined }}
            >
              <Skeleton className="flex-shrink-0 w-2 h-2 rounded-full" />
              <Skeleton className="w-28 h-3" />
              <Skeleton className="w-14 h-5 rounded" />
              <Skeleton className="flex-1 h-3.5" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Filter pills and search */}
      <div className="flex items-center flex-wrap gap-2 mb-3">
        {PILLS.map(pill => {
          const isActive = filter === pill.key
          return (
            <button
              key={pill.key}
              onClick={() => onFilterChange(pill.key)}
              className="flex items-center flex-shrink-0 rounded-full px-3 py-1.5 text-[10.5px] font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring/50"
              style={{
                background: isActive ? 'hsl(var(--accent) / 0.1)' : 'hsl(var(--card))',
                color: isActive ? 'hsl(var(--accent))' : 'hsl(var(--muted-foreground))',
                border: isActive ? '1px solid hsl(var(--accent))' : '1px solid hsl(var(--border))',
              }}
            >
              <span>{pill.label}</span>
              <span
                className="ml-1 font-semibold"
                style={{ color: isActive ? 'hsl(var(--accent))' : 'hsl(var(--muted-foreground))' }}
              >
                {counts[pill.key]}
              </span>
            </button>
          )
        })}

        {/* Search input */}
        <input
          type="text"
          placeholder="Search logs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ml-auto bg-background border border-border text-foreground rounded-md px-3 py-1.5 text-[10.5px] focus:outline-none focus:ring-2 focus:ring-ring/50 max-w-[240px] w-full @mobile:max-w-none"
        />
      </div>

      {/* Entry list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground gap-2">
          <span className="text-sm font-medium">
            {entries.length === 0 ? 'No log entries found' : 'No entries match this filter'}
          </span>
          <span className="text-xs text-muted-foreground">
            {entries.length === 0
              ? 'Log entries from cron runs and config changes will appear here'
              : 'Try adjusting your filter or search'}
          </span>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-md overflow-hidden">
          {filtered.map((entry, idx) => {
            const isError = entry.level === 'error'
            const isSelected = selectedEntryId === entry.id
            const levelDotColor =
              entry.level === 'error'
                ? 'bg-destructive'
                : entry.level === 'warn'
                  ? 'bg-accent'
                  : 'bg-[oklch(0.76_0.17_145)]'
            const sourceBadge =
              entry.source === 'cron'
                ? { label: 'CRON', color: 'text-[oklch(0.72_0.14_220)]', bg: 'bg-[oklch(0.72_0.14_220_/_0.1)]' }
                : { label: 'CONFIG', color: 'text-[oklch(0.65_0.18_300)]', bg: 'bg-[oklch(0.65_0.18_300_/_0.1)]' }

            return (
              <div key={entry.id}>
                {idx > 0 && (
                  <div className="h-px bg-border mx-3" style={{ marginLeft: '0.75rem', marginRight: '0.75rem' }} />
                )}

                {/* Row */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => onSelectEntry?.(entry)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectEntry?.(entry)
                    }
                  }}
                  className={cn(
                    'flex items-center px-3 py-2.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring/50 transition-colors',
                    isSelected ? 'bg-accent/10' : 'hover:bg-accent/5'
                  )}
                  style={{
                    background: !isSelected && isError ? 'hsl(var(--destructive) / 0.05)' : undefined,
                  }}
                >
                  {/* Status dot */}
                  <span className={`flex-shrink-0 w-2 h-2 rounded-full ${levelDotColor}`} />

                  {/* Timestamp */}
                  <span className="flex-shrink-0 font-mono text-xs text-muted-foreground ml-3 min-w-[130px]">
                    {formatTs(entry.ts)}
                  </span>

                  {/* Source badge */}
                  <span
                    className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ml-2 ${sourceBadge.color} ${sourceBadge.bg}`}
                  >
                    {sourceBadge.label}
                  </span>

                  {/* Summary */}
                  <span className="truncate text-xs text-foreground ml-3 flex-1 min-w-0">
                    {entry.summary.length > 120 ? entry.summary.slice(0, 117) + '...' : entry.summary}
                  </span>

                  {/* Duration */}
                  <span className="flex-shrink-0 hidden md:inline text-xs text-muted-foreground ml-3">
                    {formatDuration(entry.durationMs)}
                  </span>

                  <span className="flex-shrink-0 text-[10px] uppercase tracking-[0.14em] text-muted-foreground ml-3">
                    Inspect
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
