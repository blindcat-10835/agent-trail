'use client'

import { useState, useCallback } from 'react'
import { Wrench, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import type { TraceToolCall } from '@/types/trace'
import { cn } from '@/lib/utils'

interface ToolBlockProps {
  tool: TraceToolCall
}

export function ToolBlock({ tool }: ToolBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [inputCollapsed, setInputCollapsed] = useState(true)

  const lineCount = tool.inputJson ? tool.inputJson.split('\n').length : 0
  const isLongInput = lineCount > 10
  const statusColor =
    tool.status === 'success' ? 'bg-[oklch(0.76_0.17_145)]' :
    tool.status === 'error' ? 'bg-destructive' :
    'bg-[oklch(0.76_0.17_75)]' // pending = yellow

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    let text = `Tool: ${tool.name} (${tool.category})\n---\nInput:\n${tool.inputJson}`
    if (tool.resultEvents.length > 0) {
      text += `\n---\nResult:\n${tool.resultEvents.map((r) => r.content).join('\n')}`
    }
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [tool])

  return (
    <div className="border-t border-border/50 bg-secondary/20">
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-secondary/30 transition-colors"
      >
        <Wrench className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <span className="text-[11px] font-semibold text-foreground">{tool.name}</span>
        <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground px-1.5 py-0.5 bg-secondary border border-border rounded">
          {tool.category}
        </span>
        {/* Status dot */}
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', statusColor, tool.status === 'pending' && 'animate-pulse')} />
        {tool.status === 'error' && (
          <span className="text-[9px] text-destructive font-semibold">ERROR</span>
        )}
        {tool.durationMs != null && (
          <span className="text-[9px] text-muted-foreground ml-auto font-mono">
            {tool.durationMs < 1000 ? `${tool.durationMs}ms` : `${(tool.durationMs / 1000).toFixed(1)}s`}
          </span>
        )}
        {/* Copy */}
        <button onClick={handleCopy} className="p-0.5 text-muted-foreground hover:text-accent transition-colors flex-shrink-0" title={copied ? 'Copied!' : 'Copy'}>
          {copied ? <Check className="w-2.5 h-2.5 text-accent" /> : <Copy className="w-2.5 h-2.5" />}
        </button>
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {/* Input JSON */}
          {tool.inputJson && (
            <div>
              <button
                onClick={() => isLongInput && setInputCollapsed((prev) => !prev)}
                className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1"
                disabled={!isLongInput}
              >
                INPUT {isLongInput && (inputCollapsed ? '(expand)' : '(collapse)')}
              </button>
              <pre className={cn(
                'text-[11px] font-mono text-muted-foreground bg-background/50 p-2 border border-border overflow-x-auto whitespace-pre-wrap break-all',
                isLongInput && inputCollapsed && 'max-h-[200px] overflow-hidden'
              )}>
                {formatJson(tool.inputJson)}
              </pre>
            </div>
          )}

          {/* Result events */}
          {tool.resultEvents.length > 0 && (
            <div>
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground block mb-1">
                RESULT
              </span>
              {tool.resultEvents.map((event, i) => (
                <div key={i} className="text-[11px] font-mono text-foreground/80 bg-background/50 p-2 border border-border mb-1 whitespace-pre-wrap break-all">
                  {event.timestamp && (
                    <span className="text-[9px] text-muted-foreground block mb-0.5">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                  {event.content}
                </div>
              ))}
            </div>
          )}

          {/* Error display */}
          {tool.error && (
            <div className="text-[11px] text-destructive bg-destructive/10 p-2 border border-destructive/30 font-mono">
              {tool.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatJson(json: string): string {
  try { return JSON.stringify(JSON.parse(json), null, 2) }
  catch { return json }
}
