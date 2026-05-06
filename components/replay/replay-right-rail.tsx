'use client'

import type { TraceSession, TraceTurn } from '@/types/trace'

interface ReplayRightRailProps {
  session: TraceSession
  turnCount: number
  turns: TraceTurn[]
  onClose: () => void
}

export function ReplayRightRail({ session, turnCount, turns, onClose }: ReplayRightRailProps) {
  const totalTokens = session.metrics?.totalTokens || 0
  const costEstimate = totalTokens * 0.000002
  const model = (session as any).model || '-'
  const modelShort = typeof model === 'string' ? model.split('/').pop() || '-' : '-'

  return (
    <div className="w-[320px] flex-shrink-0 border-l border-border bg-card overflow-y-auto">
      {/* Header with close button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          SESSION INFO
        </span>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors text-xs"
          aria-label="Close session info"
        >
          ×
        </button>
      </div>

      {/* KPI Strip — 4-column grid (matches sessions-detail-rail pattern) */}
      <div className="grid grid-cols-4 border-b border-border">
        {[
          { label: 'TOKENS', value: totalTokens.toLocaleString() },
          { label: 'COST', value: '$' + costEstimate.toFixed(2) },
          { label: 'KIND', value: session.source },
          {
            label: 'CREATED',
            value: session.startedAt
              ? new Date(session.startedAt).toLocaleDateString()
              : '-',
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="px-3 py-2 border-r border-border last:border-r-0"
          >
            <div className="text-[9px] text-muted-foreground tracking-[0.2em] uppercase">
              {kpi.label}
            </div>
            <div className="text-xs font-bold mt-1 tabular-nums truncate">
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Session metadata */}
      <div className="p-4 space-y-3 border-b border-border">
        <div>
          <span className="block text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
            SESSION ID
          </span>
          <div className="font-mono text-[10px] text-muted-foreground break-all leading-relaxed">
            {session.id}
          </div>
        </div>
        <div>
          <span className="block text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
            PROJECT
          </span>
          <div className="text-xs text-foreground">{session.project || '-'}</div>
        </div>
        <div>
          <span className="block text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
            MODEL
          </span>
          <div className="font-mono text-[10px] text-muted-foreground">{modelShort}</div>
        </div>
        {session.startedAt && (
          <div>
            <span className="block text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
              STARTED
            </span>
            <div className="text-xs tabular-nums text-foreground">
              {new Date(session.startedAt).toLocaleString()}
            </div>
          </div>
        )}
        {session.endedAt && (
          <div>
            <span className="block text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
              ENDED
            </span>
            <div className="text-xs tabular-nums text-foreground">
              {new Date(session.endedAt).toLocaleString()}
            </div>
          </div>
        )}
        {session.metrics?.messageCount !== undefined && (
          <div>
            <span className="block text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
              MESSAGES
            </span>
            <div className="text-xs text-foreground">
              {session.metrics.messageCount.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Turn Index — compact numbered list */}
      <div>
        <div className="px-4 py-2 bg-muted/30 border-b border-border">
          <span className="text-[9px] text-muted-foreground tracking-[0.25em] uppercase font-semibold">
            TURNS
          </span>
          <span className="ml-2 text-[9px] text-muted-foreground font-mono">
            {turnCount}
          </span>
        </div>
        <div className="p-2 max-h-[400px] overflow-y-auto">
          <div className="grid grid-cols-5 gap-1">
            {turns.slice(0, 50).map((turn) => (
              <button
                key={turn.id}
                onClick={() => {
                  // Scroll to turn — handled by TurnTimeline (Plan 04)
                  const el = document.getElementById(`turn-${turn.index}`)
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="px-2 py-1 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-accent/10 rounded transition-colors text-center"
              >
                {turn.index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
