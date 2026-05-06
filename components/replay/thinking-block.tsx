'use client'

import { useState } from 'react'
import { Brain, ChevronDown, ChevronRight } from 'lucide-react'
import type { TraceThinkingBlock } from '@/types/trace'

interface ThinkingBlockProps {
  thinking: TraceThinkingBlock
}

export function ThinkingBlock({ thinking }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false) // default collapsed

  return (
    <div className="border-t border-border/50 bg-secondary/20">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-secondary/30 transition-colors"
      >
        <Brain className="w-3 h-3 text-[oklch(0.76_0.17_235)] flex-shrink-0" />
        <span className="text-[11px] font-semibold text-foreground">Thinking</span>
        {thinking.isRedacted ? (
          <span className="text-[9px] text-muted-foreground italic">(redacted)</span>
        ) : (
          <span className="text-[9px] text-muted-foreground truncate max-w-[200px]">
            {thinking.content.slice(0, 60)}...
          </span>
        )}
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3">
          {thinking.isRedacted ? (
            <div className="text-[11px] text-muted-foreground italic py-1">
              Thinking content was redacted in the source log.
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words bg-background/50 p-2 border border-border">
              {thinking.content}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
