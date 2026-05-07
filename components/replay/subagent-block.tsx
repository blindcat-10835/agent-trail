'use client'

import { useState, useCallback } from 'react'
import { Bot, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAgentTool, useSessionTurns } from '@/lib/agent-tools/client-hooks'
import type { TraceSubagentLink } from '@/types/trace'
import { TurnCard } from './turn-card'
import { getTurnKey } from './key-utils'

interface SubagentBlockProps {
  subagent: TraceSubagentLink
  parentTurnIndex: number
  depth?: number
}

const MAX_DEPTH = 2

export function SubagentBlock({ subagent, parentTurnIndex, depth = 0 }: SubagentBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { toolId, href } = useAgentTool()
  const router = useRouter()

  // Only fetch when loaded=true (lazy)
  const { turns: childTurns, loading, error } = useSessionTurns(
    toolId,
    loaded ? subagent.subagentSessionId : null,
    { limit: 20 },
  )

  // Watch for fetch errors
  if (loaded && error && !loadError) {
    setLoadError(error)
  }

  const handleLoad = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setLoaded(true)
  }, [])

  const handleOpenFull = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(href(`/sessions/${subagent.subagentSessionId}`))
  }, [subagent.subagentSessionId, href, router])

  const displayId = subagent.subagentSessionId.length > 40
    ? subagent.subagentSessionId.slice(0, 40) + '...'
    : subagent.subagentSessionId

  return (
    <div className="border-t border-border/50 bg-secondary/20">
      {/* Header */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-secondary/30 transition-colors"
      >
        <Bot className="w-3 h-3 text-[oklch(0.76_0.17_75)] flex-shrink-0" />
        <span className="text-[11px] font-semibold text-foreground">Subagent</span>
        <span className="text-[9px] text-muted-foreground font-mono truncate max-w-[200px]">
          {displayId}
        </span>
        <span className="text-[9px] text-muted-foreground ml-auto">
          {subagent.relationship}
        </span>
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-3">
          {/* Depth cap check */}
          {depth >= MAX_DEPTH ? (
            <div className="text-[10px] text-muted-foreground py-2 text-center">
              Max nesting depth reached
            </div>
          ) : !loaded ? (
            <button
              onClick={handleLoad}
              className="w-full px-3 py-2 text-[10px] font-semibold uppercase tracking-wider border border-border rounded hover:bg-accent/10 hover:border-accent transition-colors text-accent text-center"
            >
              Load Subagent
            </button>
          ) : loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent" />
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-2 py-3">
              <div className="text-[10px] font-bold text-destructive uppercase">ERR</div>
              <div className="text-[9px] text-muted-foreground text-center">Could not load subagent turns.</div>
              <div className="flex gap-2">
                <button onClick={handleLoad} className="text-[9px] text-accent hover:underline">RETRY</button>
                <button onClick={() => setLoaded(false)} className="text-[9px] text-muted-foreground hover:underline">DISMISS</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 mt-2 ml-4 border-l-2 border-border/50 pl-4">
              {/* Mini turn cards for child turns */}
              {childTurns.slice(0, 5).map((turn, index) => (
                <TurnCard key={getTurnKey(turn, index)} turn={turn} />
              ))}
              {/* Open full session */}
              <button
                onClick={handleOpenFull}
                className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors font-semibold"
              >
                Open Full Session <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
