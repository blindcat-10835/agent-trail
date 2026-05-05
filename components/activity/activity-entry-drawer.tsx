'use client'

import { cn } from '@/lib/utils'
import type { LogEntry } from '@/types/activity'

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

interface ActivityEntryDrawerProps {
  entry: LogEntry
  onClose: () => void
}

export function ActivityEntryDrawer({ entry, onClose }: ActivityEntryDrawerProps) {
  const accentColor =
    entry.level === 'error'
      ? 'var(--color-destructive)'
      : entry.level === 'warn'
        ? 'var(--color-accent)'
        : 'oklch(0.76 0.17 145)'

  const statusLabel = entry.level.toUpperCase()
  const sourceLabel = entry.source.toUpperCase()
  const glyph = entry.source === 'cron' ? '⏱' : '⚙'

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
        style={{ animation: 'drawer-fade-in .15s ease' }}
        onClick={onClose}
      />
      <aside
        className="fixed top-0 right-0 h-screen z-50 bg-background border-l border-border flex flex-col overflow-hidden"
        style={{
          width: 'min(560px, 92vw)',
          animation: 'drawer-slide-in .22s cubic-bezier(.2,.8,.2,1)',
        }}
        role="dialog"
        aria-label={`Activity entry ${entry.id}`}
      >
        <div className="flex items-center gap-3.5 px-5 py-4 border-b border-border bg-card flex-shrink-0 relative">
          <div
            className="absolute bottom-0 left-0 right-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
              opacity: 0.6,
            }}
          />
          <div
            className="hud-clip-sm border border-border-strong bg-background grid place-items-center font-bold flex-shrink-0"
            style={{ width: 40, height: 40, fontSize: 18, color: accentColor }}
          >
            {glyph}
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold text-foreground tracking-wide truncate">
              {entry.summary}
            </div>
            <div className="text-[10.5px] text-muted-foreground tracking-wider">
              {sourceLabel} · {entry.category}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-[9px] tracking-[0.15em] uppercase font-bold',
                entry.level === 'error' && 'text-destructive',
                entry.level === 'warn' && 'text-accent',
                entry.level === 'info' && 'text-[oklch(0.76_0.17_145)]'
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {statusLabel}
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 hud-clip-sm border border-border grid place-items-center text-muted-foreground text-sm hover:text-foreground hover:border-foreground/30 transition-colors"
              aria-label="Close activity details"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-5">
          <div>
            <div className="text-[9px] text-accent tracking-[0.25em] uppercase font-semibold mb-2 pb-1 border-b border-border">
              SUMMARY
            </div>
            <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
              {entry.summary}
            </div>
          </div>

          <div>
            <div className="text-[9px] text-accent tracking-[0.25em] uppercase font-semibold mb-2 pb-1 border-b border-border">
              METADATA
            </div>
            <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-[11.5px]">
              <dt className="text-muted-foreground tracking-[0.1em] uppercase text-[10px] self-center">Timestamp</dt>
              <dd className="text-foreground font-mono">{formatTs(entry.ts)}</dd>

              <dt className="text-muted-foreground tracking-[0.1em] uppercase text-[10px] self-center">Source</dt>
              <dd className="text-foreground">{entry.source}</dd>

              <dt className="text-muted-foreground tracking-[0.1em] uppercase text-[10px] self-center">Level</dt>
              <dd
                className={cn(
                  'font-semibold',
                  entry.level === 'error' && 'text-destructive',
                  entry.level === 'warn' && 'text-accent',
                  entry.level === 'info' && 'text-[oklch(0.76_0.17_145)]'
                )}
              >
                {entry.level}
              </dd>

              <dt className="text-muted-foreground tracking-[0.1em] uppercase text-[10px] self-center">Category</dt>
              <dd className="text-foreground font-mono">{entry.category}</dd>

              <dt className="text-muted-foreground tracking-[0.1em] uppercase text-[10px] self-center">Duration</dt>
              <dd className="text-foreground">{formatDuration(entry.durationMs)}</dd>

              {entry.jobId && (
                <>
                  <dt className="text-muted-foreground tracking-[0.1em] uppercase text-[10px] self-center">Job ID</dt>
                  <dd className="text-foreground font-mono break-all">{entry.jobId}</dd>
                </>
              )}

              {entry.agentId && (
                <>
                  <dt className="text-muted-foreground tracking-[0.1em] uppercase text-[10px] self-center">Agent ID</dt>
                  <dd className="text-foreground font-mono break-all">{entry.agentId}</dd>
                </>
              )}
            </dl>
          </div>

          <div>
            <div className="text-[9px] text-accent tracking-[0.25em] uppercase font-semibold mb-2 pb-1 border-b border-border">
              RAW DETAILS
            </div>
            <div className="bg-background border border-border rounded-sm p-3 max-h-[420px] overflow-auto">
              <pre className="font-mono text-[10px] text-muted-foreground whitespace-pre-wrap break-words m-0 leading-relaxed">
                {JSON.stringify(entry.details, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
