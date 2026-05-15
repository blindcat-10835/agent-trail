'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/dashboard/empty-state'
import { AgentCard } from '@/components/dashboard/agent-card'
import { useToolAgents } from '@/lib/agent-tools/client-hooks'
import type { AgentToolId } from '@/lib/agent-tools/types'
import type { SourceCapabilitySet } from '@/types/overview'

// ============================================================================
// Props
// ============================================================================

interface OverviewAgentsProps {
  capabilities: {
    capabilities: Record<string, SourceCapabilitySet>
  } | null
  toolId: AgentToolId
}

// ============================================================================
// Skeleton Card
// ============================================================================

function AgentCardSkeleton() {
  return (
    <div className="bg-card border border-border px-4 py-3.5 grid gap-2">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

// ============================================================================
// Component
// ============================================================================

export function OverviewAgents({ capabilities, toolId }: OverviewAgentsProps) {
  // Determine if agents are available for this source
  const sourceCaps = capabilities?.capabilities?.[toolId]
  const agentsEnabled = sourceCaps?.agents === true
  const isAll = toolId === 'all'

  // Hide for 'all' or when capability is disabled
  if (!agentsEnabled || isAll) {
    return null
  }

  const { agents, loading, error } = useToolAgents(toolId)

  const heading = (
    <div className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
      AGENTS
    </div>
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          <AgentCardSkeleton />
          <AgentCardSkeleton />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        <EmptyState heading="LOAD ERROR" body={error} />
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        <EmptyState heading="NO AGENTS" body="No agents found for this source." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {heading}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
        {agents.map((agent) => (
          <AgentCard key={agent.name} agent={agent} />
        ))}
      </div>
    </div>
  )
}
