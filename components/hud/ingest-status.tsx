'use client'

import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import { useIngestStatus, type IngestStatus } from '@/lib/agent-tools/client-hooks'

const STATUS_DISPLAY: Record<IngestStatus, { color: string; label: string }> = {
  connected: { color: '#22c55e', label: 'INGEST ONLINE' },
  disconnected: { color: '#ef4444', label: 'INGEST OFFLINE' },
  reconnecting: { color: '#f97316', label: 'INGEST RECONNECTING' },
  loading: { color: '#6b7280', label: 'INGEST CHECKING' },
}

/**
 * Visual status indicator for ingest service connection state.
 *
 * Displays a color-coded dot and label in the shell status bar
 * showing whether the ingest service is reachable. Uses the
 * StatusIndicator HUD pattern for visual consistency.
 *
 * Works across all tools (openclaw, claude-code, codex) via useAgentTool().
 */
export function IngestStatus() {
  const { toolId } = useAgentTool()
  const status = useIngestStatus(toolId)
  const display = STATUS_DISPLAY[status]

  return (
    <div className="hud-clip-sm flex items-center gap-1.5 border border-border/40 px-2.5 py-1 text-[11px] font-semibold">
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: display.color,
          boxShadow: `0 0 8px ${display.color}`,
        }}
      />
      <span>{display.label}</span>
    </div>
  )
}
