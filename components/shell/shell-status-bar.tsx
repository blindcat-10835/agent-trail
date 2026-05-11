'use client'

import { useAgentTool, useIngestStatus } from '@/lib/agent-tools/client-hooks'

export function ShellStatusBar() {
  const { toolId, definition } = useAgentTool()
  const ingestStatus = useIngestStatus(toolId)

  const connLabel = (() => {
    switch (ingestStatus) {
      case 'connected':
        return <b className="font-mono tabular-nums text-[var(--status-success)]">ONLINE</b>
      case 'disconnected':
        return <b className="font-mono tabular-nums text-[var(--status-success)]" style={{ opacity: 0.5 }}>OFFLINE</b>
      case 'reconnecting':
        return <b className="font-mono tabular-nums text-[var(--status-warning)] animate-pulse">RECONN</b>
      case 'loading':
        return <b className="font-mono tabular-nums text-muted-foreground">...</b>
    }
  })()

  return (
    <footer className="flex items-center justify-between px-3.5 h-6 border-t border-border text-[10px] tracking-[0.12em] text-muted-foreground relative">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-40" />

      {/* Left section — system state */}
      <div className="flex items-center gap-4">
        <span>INDEX <b>LOCAL</b></span>
        <span>PROTO <b>v3</b></span>
        <span>CONN {connLabel}</span>
        <span>SCOPES <b>workspace:* · agents:rw</b></span>
      </div>

      {/* Right section — runtime scope */}
      <div className="flex items-center gap-4">
        <span>SES <b className="font-mono tabular-nums">{definition.shortLabel}</b></span>
        <span>SRC <b>{definition.shortLabel}</b></span>
        <span className="text-accent font-bold tracking-[0.2em]" style={{ textShadow: '0 0 8px var(--color-accent)' }}>
          ◆ TRACE
        </span>
      </div>
    </footer>
  )
}
