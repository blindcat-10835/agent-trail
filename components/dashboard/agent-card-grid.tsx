'use client'

import { useMemo } from 'react'
import { useGatewayStore } from '@/stores/gateway/gateway-store'
import { AgentCard } from './agent-card'
import { EmptyState } from './empty-state'
import { cn } from '@/lib/utils'
import type { AgentInfo } from '@/stores/gateway/gateway-store'

type FilterMode = 'all' | 'live' | 'error'

interface AgentCardGridProps {
  agents: AgentInfo[]
  selectedAgentId: string | null
  onAgentClick: (agentId: string) => void
  filter: FilterMode
  className?: string
}

export function AgentCardGrid({
  agents,
  selectedAgentId,
  onAgentClick,
  filter,
  className,
}: AgentCardGridProps) {
  const globalEventFeed = useGatewayStore((s) => s.globalEventFeed)

  const lastEventPerAgent = useMemo(() => {
    const map = new Map<string, { type: string; content: string; age: number }>()
    for (const ev of globalEventFeed) {
      if (!map.has(ev.agentId)) {
        map.set(ev.agentId, {
          type: ev.type,
          content: ev.content,
          age: Math.floor((Date.now() - ev.time) / 1000),
        })
      }
    }
    return map
  }, [globalEventFeed])

  const filteredAgents = useMemo(() => {
    let filtered = agents
    if (filter === 'live') {
      filtered = filtered.filter((a) => a.status !== 'idle')
    } else if (filter === 'error') {
      filtered = filtered.filter((a) => a.status === 'error')
    }
    return filtered.sort((a, b) => {
      const aActive = a.status !== 'idle'
      const bActive = b.status !== 'idle'
      if (aActive && !bActive) return -1
      if (!aActive && bActive) return 1
      return a.name.localeCompare(b.name)
    })
  }, [agents, filter])

  if (filteredAgents.length === 0) {
    return (
      <EmptyState
        title={filter !== 'all' ? 'No matching agents' : 'No agents found'}
        description={
          filter !== 'all'
            ? 'Try adjusting your filter'
            : 'Connect to Gateway to see agents'
        }
        className={cn('h-full min-h-[200px]', className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'grid gap-px bg-border border border-border',
        'grid-cols-[repeat(auto-fill,minmax(280px,1fr))]',
        className
      )}
    >
      {filteredAgents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          isSelected={selectedAgentId === agent.id}
          onClick={() => onAgentClick(agent.id)}
          lastEvent={lastEventPerAgent.get(agent.id)}
        />
      ))}
    </div>
  )
}
