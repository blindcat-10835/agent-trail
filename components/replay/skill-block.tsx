'use client'

import { useState } from 'react'
import { Sparkles, ChevronDown, ChevronRight } from 'lucide-react'
import type { TraceSkillUse } from '@/types/trace'
import { cn } from '@/lib/utils'

interface SkillBlockProps {
  skill: TraceSkillUse
}

export function SkillBlock({ skill }: SkillBlockProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-t border-border/50 bg-secondary/20">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-secondary/30 transition-colors"
      >
        <Sparkles className="w-3 h-3 text-[oklch(0.76_0.17_75)] flex-shrink-0" />
        <span className="text-[11px] font-semibold text-foreground">{skill.name}</span>
        <span className="text-[9px] text-muted-foreground truncate max-w-[300px]">
          {skill.inputSummary.slice(0, 80)}{skill.inputSummary.length > 80 ? '...' : ''}
        </span>
        <span className={cn(
          'text-[9px] font-semibold uppercase ml-auto',
          skill.status === 'success' ? 'text-[oklch(0.76_0.17_145)]' : 'text-destructive'
        )}>
          {skill.status === 'success' ? 'OK' : 'ERR'}
        </span>
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          <div>
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground block mb-1">INPUT</span>
            <div className="text-[11px] text-foreground/80 bg-background/50 p-2 border border-border whitespace-pre-wrap break-all">
              {skill.inputSummary}
            </div>
          </div>
          {skill.result && (
            <div>
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground block mb-1">RESULT</span>
              <div className="text-[11px] text-foreground/80 bg-background/50 p-2 border border-border whitespace-pre-wrap break-all">
                {skill.result}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
