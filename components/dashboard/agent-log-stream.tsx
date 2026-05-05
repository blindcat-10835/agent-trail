'use client'

import { useEffect, useRef } from 'react'
import { LogEntry } from '@/types/log'
import { cn } from '@/lib/utils'

interface AgentLogStreamProps {
  logs: LogEntry[]
  className?: string
}

// Log type colors (terminal style, optimized for dark background)
const logTypeColors: Record<LogEntry['type'], string> = {
  lifecycle: 'text-white',
  tool: 'text-yellow-400',
  assistant: 'text-green-400',
  error: 'text-red-400',
}

export function AgentLogStream({ logs, className }: AgentLogStreamProps) {
  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  if (logs.length === 0) {
    return (
      <div className={cn('h-full flex items-center justify-center text-xs text-muted-foreground', className)}>
        No logs yet
      </div>
    )
  }

  return (
    <div className={cn('h-full bg-black font-mono text-xs p-3 overflow-y-auto', className)}>
      <div className="space-y-1">
        {logs.map((log) => (
          <div
            key={log.id}
            className={cn('flex gap-2', logTypeColors[log.type])}
          >
            <span className="text-muted-foreground select-none">{log.time}</span>
            <span className="flex-1 break-words">{log.content}</span>
          </div>
        ))}
      </div>
      {/* Invisible anchor for auto-scroll */}
      <div ref={logEndRef} />
    </div>
  )
}
