'use client'

import { useGatewayStore } from '@/stores/gateway/gateway-store'
import type { ConnectionStatus } from '@/gateway/types'

const statusDisplay: Record<ConnectionStatus, { color: string; label: string }> = {
  connected: { color: '#22c55e', label: 'CONNECTED' },
  connecting: { color: '#eab308', label: 'CONNECTING' },
  reconnecting: { color: '#f97316', label: 'RECONNECTING' },
  disconnected: { color: '#6b7280', label: 'OFFLINE' },
  error: { color: '#ef4444', label: 'ERROR' },
}

export function StatusIndicator() {
  const connectionStatus = useGatewayStore((s) => s.connectionStatus)
  const display = statusDisplay[connectionStatus]

  return (
    <div className="hud-clip-sm flex items-center gap-1.5 border border-border/40 px-2.5 py-1 text-[11px] font-semibold">
      <div
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{
          backgroundColor: display.color,
          boxShadow: `0 0 8px ${display.color}`,
        }}
      />
      <span>{display.label}</span>
    </div>
  )
}
