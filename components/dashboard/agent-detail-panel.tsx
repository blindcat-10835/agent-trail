'use client'

import { useGatewayStore } from '@/stores/gateway/gateway-store'
import { selectAgentDetailState } from '@/stores/gateway/p0-selectors'
import { AgentBasicInfo } from './agent-basic-info'
import { AgentLogStream } from './agent-log-stream'
import { AgentCapabilities } from './agent-capabilities'
import { EmptyState } from './empty-state'
import { Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentDetailPanelProps {
  selectedAgentId: string | null
  className?: string
}

export function AgentDetailPanel({ selectedAgentId, className }: AgentDetailPanelProps) {
  const { state: uiState, data: agent } = selectAgentDetailState(
    selectedAgentId ?? ''
  )(useGatewayStore())

  // No agent selected
  if (!selectedAgentId) {
    return (
      <EmptyState
        title="No agent selected"
        description="Click an agent card to view details"
        className={cn('h-full', className)}
      />
    )
  }

  // Loading state
  if (uiState === 'loading') {
    return (
      <div className={cn('h-full flex items-center justify-center', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Error state
  if (uiState === 'error' || uiState === 'disconnected') {
    return (
      <EmptyState
        icon={<AlertCircle className="h-8 w-8 text-destructive" />}
        title="Connection error"
        description="Failed to load agent details"
        className={cn('h-full', className)}
      />
    )
  }

  // Invalid agent (not found)
  if (uiState === 'invalid-agent' || !agent) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-8 w-8 text-destructive" />}
        title="Agent not found"
        description={`Agent "${selectedAgentId}" does not exist`}
        className={cn('h-full', className)}
      />
    )
  }

  // Success: show agent details
  const agentLogs = useGatewayStore((state) => state.agentLogs[selectedAgentId] ?? [])

  return (
    <div className={cn('h-full flex flex-col bg-card', className)}>
      {/* Basic info section */}
      <AgentBasicInfo agent={agent} />

      {/* Log stream section */}
      <div className="flex-1 min-h-0">
        <div className="h-full flex flex-col">
          <div className="px-4 py-2 border-b border-border">
            <h3 className="text-xs font-semibold text-foreground">Logs</h3>
          </div>
          <AgentLogStream logs={agentLogs} />
        </div>
      </div>

      {/* Capabilities section */}
      <AgentCapabilities agent={agent} />
    </div>
  )
}
