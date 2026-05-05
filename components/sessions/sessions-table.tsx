/* eslint-disable */
'use client'

import { Fragment, useState } from 'react'
import { SessionInfo } from '@/gateway/adapter-types'
import { cn } from '@/lib/utils'

interface SessionsTableProps {
  sessions: SessionInfo[]
  selectedKey: string | null
  onSelectKey: (key: string | null) => void
}

// Helper: format time ago (copied from overview-tab.tsx)
function fmtAgo(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

// Helper: compute session status
function computeSessionStatus(session: SessionInfo): 'active' | 'idle' | 'aborted' {
  if (session.aborted) return 'aborted'
  if (!session.updatedAt) return 'idle'

  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
  return session.updatedAt > fiveMinutesAgo ? 'active' : 'idle'
}

// Status badge component
function StatusBadge({ status }: { status: 'active' | 'idle' | 'aborted' }) {
  if (status === 'active') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[oklch(0.76_0.17_145)] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[oklch(0.76_0.17_145)]"></span>
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[oklch(0.76_0.17_145)]">
          LIVE
        </span>
      </div>
    )
  }

  if (status === 'idle') {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        IDL
      </span>
    )
  }

  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive">
      ABT
    </span>
  )
}

export function SessionsTable({ sessions, selectedKey, onSelectKey }: SessionsTableProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  // Toggle expand state
  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // Handle row click: select session and toggle expand
  const handleRowClick = (session: SessionInfo) => {
    onSelectKey(session.key)
    toggleExpand(session.key)
  }

  return (
    <div className="border border-border bg-card">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_70px_140px_90px] gap-3 px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Label
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Status
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Model
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
          Updated
        </span>
      </div>

      {/* Data rows */}
      {sessions.map(session => {
        const status = computeSessionStatus(session)
        const isSelected = selectedKey === session.key
        const isExpanded = expandedKeys.has(session.key)

        // Model short name (e.g., "claude-opus-4-6" from "anthropic/claude-opus-4-6")
        const modelShort = session.model?.split('/').pop() || '-'

        // Time ago
        const timeAgo = session.updatedAt
          ? fmtAgo(Math.floor((Date.now() - session.updatedAt) / 1000))
          : '-'

        return (
          <Fragment key={session.key}>
            {/* Main row */}
            <div
              onClick={() => handleRowClick(session)}
              className={cn(
                'grid grid-cols-[1fr_70px_140px_90px] gap-3 px-3 py-2 border-b border-border cursor-pointer transition-colors',
                'hover:bg-accent/5',
                isSelected && 'bg-accent/10 border-accent'
              )}
            >
              {/* Label */}
              <div className="font-medium truncate text-sm">{session.label || session.key}</div>

              {/* Status */}
              <div>
                <StatusBadge status={status} />
              </div>

              {/* Model */}
              <div className="text-muted-foreground text-sm truncate font-mono">
                {modelShort}
              </div>

              {/* Updated */}
              <div className="text-muted-foreground text-sm text-right tabular-nums">
                {timeAgo}
              </div>
            </div>

            {/* Expanded row details */}
            {isExpanded && (
              <div className="border-t border-border bg-muted/30 p-3">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
                  {/* Tokens */}
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      Tokens
                    </span>
                    <div className="font-mono text-sm tabular-nums">
                      {(session.totalTokens || 0).toLocaleString()}
                    </div>
                  </div>

                  {/* Cost */}
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      Cost
                    </span>
                    <div className="font-mono text-sm tabular-nums">
                      ${(session.cost || 0).toFixed(2)}
                    </div>
                  </div>

                  {/* Kind */}
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      Kind
                    </span>
                    <div className="text-sm">{session.kind || '-'}</div>
                  </div>

                  {/* Last Message */}
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      Last Message
                    </span>
                    <div className="text-sm truncate">{session.lastMessage || '-'}</div>
                  </div>
                </div>
              </div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
