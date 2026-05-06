'use client'

import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import { useSessionDetail } from '@/lib/agent-tools/client-hooks'
import type { SessionStatus, TraceSession } from '@/types/trace'

// ============================================================================
// Props
// ============================================================================

interface SessionsDetailRailProps {
  sessionId: string | null
  onClose: () => void
}

type DisplayTraceSession = TraceSession & {
  label?: string | null
  model?: string | null
  kind?: string | null
}

// ============================================================================
// Status Badge (per UI-SPEC copywriting)
// ============================================================================

const STATUS_CONFIG: Record<
  SessionStatus,
  { label: string; color: string; pulse?: boolean }
> = {
  active:   { label: 'LIVE', color: 'text-[oklch(0.76_0.17_145)]', pulse: true },
  idle:     { label: 'IDL',  color: 'text-muted-foreground' },
  aborted:  { label: 'ABT',  color: 'text-destructive' },
  error:    { label: 'ERR',  color: 'text-destructive' },
  unknown:  { label: '---',  color: 'text-muted-foreground' },
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const cfg = STATUS_CONFIG[status]

  if (cfg.pulse) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[oklch(0.76_0.17_145)] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[oklch(0.76_0.17_145)]" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[oklch(0.76_0.17_145)]">
          {cfg.label}
        </span>
      </div>
    )
  }

  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider">
      <span className={cfg.color}>{cfg.label}</span>
    </span>
  )
}

// ============================================================================
// Session Detail Rail
// ============================================================================

export function SessionsDetailRail({
  sessionId,
  onClose,
}: SessionsDetailRailProps) {
  const { toolId } = useAgentTool()
  const { session, loading, error } = useSessionDetail(toolId, sessionId)

  // Empty state — no session selected
  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Select a session
      </div>
    )
  }

  // Loading state — spinner only (per UI-SPEC: no text)
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
        <div className="text-[11px] font-bold text-destructive uppercase tracking-wider">
          ERR
        </div>
        <div className="text-[10px] text-muted-foreground text-center">
          {error}
        </div>
        <button
          onClick={onClose}
          className="text-[10px] text-accent hover:underline"
        >
          DISMISS
        </button>
      </div>
    )
  }

  // Not found — session data is null
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          NOT FOUND
        </div>
        <div className="text-[10px] text-muted-foreground text-center">
          Session data is not available.
        </div>
        <button
          onClick={onClose}
          className="text-[10px] text-accent hover:underline"
        >
          DISMISS
        </button>
      </div>
    )
  }

  // Derive display values from TraceSession
  const displaySession = session as DisplayTraceSession
  const label = displaySession.label || session.project || session.id
  const model = displaySession.model || '-'
  const modelShort = model.split('/').pop() || '-'
  const totalTokens = session.metrics.totalTokens || 0
  const costEstimate = totalTokens * 0.000002
  const kind = displaySession.kind || session.source

  return (
    <div className="min-h-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        {/* Session icon placeholder */}
        <div className="hud-clip-sm border border-border w-8 h-8 grid place-items-center text-muted-foreground text-sm flex-shrink-0">
          &#9673;
        </div>

        {/* Label + subline */}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-foreground truncate">
            {label}
          </div>
          <div className="text-[10.5px] text-muted-foreground font-mono truncate">
            {modelShort}
          </div>
        </div>

        {/* Status badge + close */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={session.status} />
          <button
            onClick={onClose}
            className="w-6 h-6 hud-clip-sm border border-border grid place-items-center text-muted-foreground text-xs hover:text-foreground hover:border-foreground/30 transition-colors"
            aria-label="Close details"
          >
            &#10005;
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 border-b border-border bg-card flex-shrink-0">
        {[
          { label: 'TOKENS', value: totalTokens.toLocaleString() },
          {
            label: 'COST',
            value: '$' + costEstimate.toFixed(2),
          },
          { label: 'KIND', value: kind },
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

      {/* View Session button — navigates to replay */}
      <div className="px-4 py-2 border-b border-border">
        <button
          onClick={() => {
            const url = `/${toolId}/sessions/${sessionId}`
            window.location.href = url
          }}
          className="w-full px-3 py-2 text-[10px] font-semibold uppercase tracking-wider border border-border rounded hover:bg-accent/10 hover:border-accent transition-colors text-accent text-center"
        >
          View Session
        </button>
      </div>

      {/* Message/event list section (placeholder for Phase 5 turn replay) */}
      <div className="border-b border-border">
        <div className="px-4 py-2 bg-muted/30">
          <span className="text-[9px] text-accent tracking-[0.25em] uppercase font-semibold">
            MESSAGE HISTORY
          </span>
        </div>
        <div className="px-4 py-3">
          <div className="text-muted-foreground text-[11px] text-center py-6">
            Turn replay available in Phase 5
          </div>
        </div>
      </div>

      {/* Session metadata */}
      <div className="p-4 space-y-3">
        <div>
          <span className="block text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
            SESSION ID
          </span>
          <div className="font-mono text-[10px] text-muted-foreground break-all">
            {session.id}
          </div>
        </div>
        <div>
          <span className="block text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
            PROJECT
          </span>
          <div className="text-sm">{session.project || '-'}</div>
        </div>
        {session.startedAt && (
          <div>
            <span className="block text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
              STARTED
            </span>
            <div className="text-sm tabular-nums">
              {new Date(session.startedAt).toLocaleString()}
            </div>
          </div>
        )}
        {session.endedAt && (
          <div>
            <span className="block text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
              ENDED
            </span>
            <div className="text-sm tabular-nums">
              {new Date(session.endedAt).toLocaleString()}
            </div>
          </div>
        )}
        <div>
          <span className="block text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
            MESSAGES
          </span>
          <div className="text-sm">
            {session.metrics.messageCount.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  )
}
