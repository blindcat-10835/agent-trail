'use client'

import { useGatewayStore } from '@/stores/gateway/gateway-store'
import { IngestStatus } from './ingest-status'

export function ShellStatusBar() {
  const connectionStatus = useGatewayStore((s) => s.connectionStatus)
  const isDashboardLoading = useGatewayStore((s) => s.isDashboardLoading)
  const agentCount = useGatewayStore((s) => s.agents.size)
  const isStale = isDashboardLoading && agentCount > 0

  return (
    <footer className="flex items-center justify-between px-3.5 h-6 border-t border-border text-[10px] tracking-[0.12em] text-muted-foreground relative">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-40" />

      {/* Left section */}
      <div className="flex items-center gap-4">
        <span>
          WS <b className={connectionStatus === 'connected' ? 'text-accent' : ''}>{connectionStatus.toUpperCase()}</b>
        </span>
        {isStale && (
          <span className="text-[oklch(0.76_0.17_145)] animate-pulse">
            SYNCING
          </span>
        )}
        <IngestStatus />
        <span>PROTO <b>v3</b></span>
        <span>CONN <b>conn_8f2e</b></span>
        <span>SCOPES <b>workspace:* · agents:rw</b></span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        <span className="text-muted-foreground/50">LOCAL ONLY · NO UPLOADS</span>
        <span>MEM <b>42.1MB</b></span>
        <span>FPS <b>60</b></span>
        <span className="text-accent font-bold tracking-[0.2em]" style={{ textShadow: '0 0 8px var(--color-accent)' }}>
          ◆ OVAO
        </span>
      </div>
    </footer>
  )
}
