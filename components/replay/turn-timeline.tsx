'use client'

import { useEffect } from 'react'
import type { TraceTurn } from '@/types/trace'
import { useReplayStore } from '@/stores/replay-store'
import { TurnCard } from './turn-card'

interface TurnTimelineProps {
  turns: TraceTurn[]
}

export function TurnTimeline({ turns }: TurnTimelineProps) {
  const expandedTurns = useReplayStore((s) => s.expandedTurns)
  const expandAll = useReplayStore((s) => s.expandAll)
  const collapseAll = useReplayStore((s) => s.collapseAll)

  const isLongSession = turns.length > 10
  const allExpanded = turns.length > 0 && turns.every((t) => expandedTurns.has(t.id))

  // Auto-expand all turns for short sessions on first load
  useEffect(() => {
    if (!isLongSession && turns.length > 0) {
      expandAll(turns.map((t) => t.id))
    }
  }, [turns.length, isLongSession]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="px-6 py-4 space-y-4">
      {/* Expand All / Collapse All toggle (long sessions only) */}
      {isLongSession && (
        <div className="flex items-center gap-3 pb-2">
          <button
            onClick={() => expandAll(turns.map((t) => t.id))}
            className="text-[10px] font-semibold uppercase tracking-wider text-accent hover:text-accent/80 transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            Collapse All
          </button>
        </div>
      )}

      {/* Turn cards */}
      {turns.map((turn) => (
        <TurnCard key={turn.id} turn={turn} />
      ))}

      {/* End-of-session marker */}
      {turns.length > 0 && (
        <div className="flex items-center justify-center py-6">
          <div className="h-px flex-1 bg-border" />
          <span className="px-3 text-[9px] text-muted-foreground uppercase tracking-[0.2em]">
            END OF SESSION
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}
    </div>
  )
}
