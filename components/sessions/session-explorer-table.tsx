'use client'

import { Fragment, useState } from 'react'
import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import type { TraceSession, SessionStatus } from '@/types/trace'
import type { SessionColumnDef } from '@/lib/agent-tools/types'
import { cn } from '@/lib/utils'

// ============================================================================
// Props
// ============================================================================

interface SessionExplorerTableProps {
  sessions: TraceSession[]
  selectedSessionId: string | null
  onSelectSession: (sessionId: string | null) => void
  sourceBadge?: boolean // show source badge for aggregate view (Plan 04-05)
}

// ============================================================================
// Status Badge Configuration (per UI-SPEC copywriting)
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

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format time ago from ISO timestamp.
 * Preserves the fmtAgo pattern from the existing sessions-table.tsx.
 */
function fmtAgo(iso: string | null): string {
  if (!iso) return '-'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 0) return 'now'
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

/**
 * Extract source badge label from TraceSource.
 */
function sourceBadgeLabel(source: string): string {
  switch (source) {
    case 'openclaw': return 'OPENCLAW'
    case 'claude-code': return 'CLAUDE:CODE'
    case 'codex': return 'CODEX'
    default: return source.toUpperCase()
  }
}

/**
 * Render a single row value based on the accessor key.
 * Resilient: handles missing fields gracefully.
 */
function renderCellValue(
  session: TraceSession,
  accessor: string,
): string {
  switch (accessor) {
    case 'label':
      return (session as any).label || session.project || session.id
    case 'status':
      return session.status
    case 'model':
      return (session as any).model || '-'
    case 'project':
      return session.project || '-'
    case 'updatedAt':
      return fmtAgo(session.endedAt || session.startedAt)
    default:
      return (session as any)[accessor] ?? '-'
  }
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: SessionStatus }) {
  const cfg = STATUS_CONFIG[status]

  if (cfg.pulse) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[oklch(0.76_0.17_145)] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[oklch(0.76_0.17_145)]" />
        </span>
        <span className={cn('text-[10px] font-semibold uppercase tracking-wider', cfg.color)}>
          {cfg.label}
        </span>
      </div>
    )
  }

  return (
    <span className={cn('text-[10px] font-semibold uppercase tracking-wider', cfg.color)}>
      {cfg.label}
    </span>
  )
}

// ============================================================================
// Session Explorer Table
// ============================================================================

export function SessionExplorerTable({
  sessions,
  selectedSessionId,
  onSelectSession,
  sourceBadge = false,
}: SessionExplorerTableProps) {
  const { definition } = useAgentTool()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const columns: SessionColumnDef[] = definition.ui.sessionColumns

  // Build dynamic grid template from column widths
  const gridCols = columns.map((c) => c.width || '1fr').join(' ')

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleRowClick = (session: TraceSession) => {
    if (selectedSessionId === session.id) {
      onSelectSession(null)
    } else {
      onSelectSession(session.id)
      toggleExpand(session.id)
    }
  }

  return (
    <div className="border border-border bg-card">
      {/* Header row */}
      <div
        className={cn(
          'grid gap-3 px-3 py-2 border-b border-border bg-muted/30',
        )}
        style={{ gridTemplateColumns: sourceBadge ? `70px ${gridCols}` : gridCols }}
      >
        {sourceBadge && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            SOURCE
          </span>
        )}
        {columns.map((col) => (
          <span
            key={col.id}
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground',
              col.id === 'updatedAt' && 'text-right',
            )}
          >
            {col.header}
          </span>
        ))}
      </div>

      {/* Data rows */}
      {sessions.map((session) => {
        const isSelected = selectedSessionId === session.id
        const isExpanded = expandedIds.has(session.id)
        const modelShort = renderCellValue(session, 'model')
          .split('/')
          .pop() || '-'

        return (
          <Fragment key={session.id}>
            {/* Main row */}
            <div
              onClick={() => handleRowClick(session)}
              className={cn(
                'grid gap-3 px-3 py-2 border-b border-border cursor-pointer transition-colors',
                'hover:bg-accent/5',
                isSelected && 'bg-accent/10 border-accent',
              )}
              style={{ gridTemplateColumns: sourceBadge ? `70px ${gridCols}` : gridCols }}
            >
              {/* Source badge (aggregate view only) */}
              {sourceBadge && (
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground self-center">
                  {sourceBadgeLabel(session.source)}
                </div>
              )}

              {columns.map((col) => {
                if (col.id === 'status') {
                  return (
                    <div key={col.id}>
                      <StatusBadge status={session.status} />
                    </div>
                  )
                }

                if (col.id === 'model') {
                  return (
                    <div
                      key={col.id}
                      className="text-muted-foreground text-sm truncate font-mono"
                    >
                      {modelShort}
                    </div>
                  )
                }

                if (col.id === 'updatedAt') {
                  return (
                    <div
                      key={col.id}
                      className="text-muted-foreground text-sm text-right tabular-nums"
                    >
                      {renderCellValue(session, col.accessor)}
                    </div>
                  )
                }

                return (
                  <div
                    key={col.id}
                    className={cn(
                      'text-sm truncate',
                      col.id === 'label'
                        ? 'font-medium'
                        : 'text-muted-foreground',
                    )}
                  >
                    {renderCellValue(session, col.accessor)}
                  </div>
                )
              })}
            </div>

            {/* Expanded row metadata */}
            {isExpanded && (
              <div className="border-t border-border bg-muted/30 p-3">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
                  {/* Tokens */}
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      TOKENS
                    </span>
                    <div className="font-mono text-sm tabular-nums">
                      {(session.metrics.totalTokens || 0).toLocaleString()}
                    </div>
                  </div>

                  {/* Cost (estimated at $2/M tokens) */}
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      COST
                    </span>
                    <div className="font-mono text-sm tabular-nums">
                      ${((session.metrics.totalTokens || 0) * 0.000002).toFixed(2)}
                    </div>
                  </div>

                  {/* Kind (from message count) */}
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      MESSAGES
                    </span>
                    <div className="text-sm">
                      {(session.metrics.messageCount || 0).toLocaleString()}
                    </div>
                  </div>

                  {/* Project */}
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      PROJECT
                    </span>
                    <div className="text-sm truncate">
                      {session.project || '-'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Fragment>
        )
      })}

      {/* Empty state */}
      {sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="text-[14px] font-bold text-foreground uppercase tracking-wider mb-2">
            NO SESSIONS
          </div>
          <div className="text-[11px] text-muted-foreground max-w-sm leading-relaxed">
            ENSURE {definition.shortLabel} SESSIONS DIRECTORY IS CONFIGURED IN INGEST.
          </div>
        </div>
      )}
    </div>
  )
}
