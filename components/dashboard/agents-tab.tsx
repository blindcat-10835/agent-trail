'use client'

import { useMemo } from 'react'
import { useGatewayStore } from '@/stores/gateway/gateway-store'
import { cn } from '@/lib/utils'
import type { AgentInfo } from '@/stores/gateway/gateway-store'

interface AgentsTabProps {
  selectedAgentId: string | null
  onAgentClick: (agentId: string) => void
}

export function AgentsTab({ selectedAgentId, onAgentClick }: AgentsTabProps) {
  const agentsMap = useGatewayStore((state) => state.agents)
  const agents = useMemo(() => Array.from(agentsMap.values()), [agentsMap])

  return (
    <div className="p-2 space-y-1">
      {agents.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onAgentClick(agent.id)}
          className={cn(
            'w-full flex items-center gap-2 p-2 rounded transition-colors text-left',
            'hover:bg-border',
            selectedAgentId === agent.id && 'bg-accent/20 border border-accent'
          )}
        >
          {agent.avatarUrl ? (
            <img
              src={agent.avatarUrl}
              alt={agent.name}
              className="w-6 h-6 rounded bg-muted"
            />
          ) : (
            <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-semibold">
              {agent.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground truncate">{agent.name}</div>
            <div className="text-xs text-muted-foreground capitalize">{agent.status}</div>
          </div>
        </button>
      ))}
    </div>
  )
}
