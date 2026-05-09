'use client'

import { useAgentTool } from '@/lib/agent-tools/client-hooks'

export function ShellStatusBar() {
  const { definition } = useAgentTool()

  return (
    <footer className="flex items-center justify-between px-3.5 h-6 border-t border-border text-[10px] tracking-[0.12em] text-muted-foreground relative">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-40" />

      {/* Left section */}
      <div className="flex items-center gap-4">
        <span>INDEX <b>LOCAL</b></span>
        <span>PROTO <b>v3</b></span>
        <span>CONN <b>conn_8f2e</b></span>
        <span>SCOPES <b>workspace:* · agents:rw</b></span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        <span>MEM <b>42.1MB</b></span>
        <span>FPS <b>60</b></span>
        <span>SRC <b>{definition.shortLabel}</b></span>
        <span className="text-accent font-bold tracking-[0.2em]" style={{ textShadow: '0 0 8px var(--color-accent)' }}>
          ◆ TRACE
        </span>
      </div>
    </footer>
  )
}
