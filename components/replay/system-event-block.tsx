'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Info } from 'lucide-react'
import type { TraceSystemEvent } from '@/types/trace'

interface SystemEventBlockProps {
  event: TraceSystemEvent
}

export function SystemEventBlock({ event }: SystemEventBlockProps) {
  const [expanded, setExpanded] = useState(false) // default collapsed per TURN-06
  const isQoderContext = event.subtype === 'qoder_injected_context'
  const label = isQoderContext ? 'Qoder Context' : 'System'
  const subtypeLabel = isQoderContext ? 'injected context' : event.subtype
  const preview = event.content.replace(/\n+/g, ' ').slice(0, 80)
  const hasMore = event.content.length > 80 || event.content.includes('\n')

  return (
    <div className="border-t border-border/50 bg-secondary/20">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-secondary/30 transition-colors"
      >
        {isQoderContext
          ? <Info className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          : <AlertTriangle className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        }
        <span className="text-[11px] font-semibold text-foreground">{label}</span>
        <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          {subtypeLabel}
        </span>
        {!expanded && (
          <span className="text-[9px] text-muted-foreground truncate max-w-[280px] font-mono">
            {preview}{hasMore ? '...' : ''}
          </span>
        )}
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3">
          <div className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words bg-background/50 p-2 border border-border">
            {event.content}
          </div>
        </div>
      )}
    </div>
  )
}
