'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/dashboard/empty-state'
import { useToolAgents } from '@/lib/agent-tools/client-hooks'
import type { AgentToolId } from '@/lib/agent-tools/types'
import type { SourceCapabilitySet } from '@/types/overview'

// ============================================================================
// Helpers
// ============================================================================

function statusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'running':
    case 'live':
      return 'var(--status-success)'
    case 'pending':
    case 'waiting':
      return 'var(--status-warning)'
    case 'error':
    case 'aborted':
      return 'var(--destructive)'
    default:
      return 'var(--muted-foreground)'
  }
}

function statusLabel(status: string): string {
  if (!status) return 'IDLE'
  const s = status.toLowerCase()
  if (s === 'running') return 'LIVE'
  return status.toUpperCase()
}

function getInitials(name: string): string {
  return name
    .split(/[-_\s]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

// ============================================================================
// Agent Chip
// ============================================================================

function AgentChip({
  name,
  sessionCount,
  toolCallCount,
  latestStatus,
}: {
  name: string
  sessionCount: number
  toolCallCount: number
  latestStatus: string
}) {
  const color = statusColor(latestStatus)
  const label = statusLabel(latestStatus)
  const isError = latestStatus?.toLowerCase() === 'error' || latestStatus?.toLowerCase() === 'aborted'
  const isLive = latestStatus?.toLowerCase() === 'running' || latestStatus?.toLowerCase() === 'live'

  return (
    <div
      className="relative flex items-center gap-2.5 bg-card border border-border overflow-hidden hover:bg-accent/5 transition-colors"
      style={{ minWidth: 0 }}
    >
      {/* Left status rail */}
      <span
        className="absolute left-0 top-0 bottom-0 w-[2px] shrink-0"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />

      {/* Avatar */}
      <div
        className="shrink-0 w-7 h-7 flex items-center justify-center text-[10px] font-bold ml-3"
        style={
          isError
            ? { background: 'var(--destructive)', color: '#fff' }
            : { background: `color-mix(in oklch, ${color} 15%, var(--muted))`, color }
        }
      >
        {getInitials(name)}
      </div>

      {/* Name + meta */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1 py-2 pr-2">
        <span className="text-[11px] font-mono text-foreground truncate" title={name}>
          {name}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground tabular-nums">
          {sessionCount}s · {toolCallCount}t
        </span>
      </div>

      {/* Status pill */}
      <span
        className="shrink-0 inline-flex items-center gap-1 text-[8px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 border mr-2"
        style={{
          color,
          borderColor: color,
          background: `color-mix(in oklch, ${color} 10%, transparent)`,
        }}
      >
        {isLive && (
          <span
            className="w-1 h-1 rounded-full animate-pulse"
            style={{ background: color }}
          />
        )}
        {label}
      </span>
    </div>
  )
}

// ============================================================================
// Skeleton Strip
// ============================================================================

function AgentStripSkeleton() {
  return (
    <div className="flex gap-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2.5 h-[44px] w-40 bg-card border border-border px-3">
          <Skeleton className="h-7 w-7 shrink-0" />
          <div className="flex flex-col gap-1 flex-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Props
// ============================================================================

interface OverviewAgentsProps {
  capabilities: { capabilities: Record<string, SourceCapabilitySet> } | null
  toolId: AgentToolId
  capsLoading?: boolean
}

// ============================================================================
// Component
// ============================================================================

export function OverviewAgents({ capabilities, toolId, capsLoading }: OverviewAgentsProps) {
  const { agents, loading: agentsLoading, error: agentsError } = useToolAgents(toolId)

  if (capsLoading) {
    return (
      <div className="flex flex-col gap-1.5">
        <AgentStripSkeleton />
      </div>
    )
  }

  const sourceCaps = capabilities?.capabilities?.[toolId]
  const agentsEnabled = sourceCaps?.agents === true
  const isAll = toolId === 'all'

  if (!agentsEnabled || isAll) return null

  if (agentsLoading) {
    return (
      <div className="flex flex-col gap-1.5">
        <AgentStripSkeleton />
      </div>
    )
  }

  if (agentsError || agents.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      {/* Strip header */}
      <div className="flex items-center gap-2">
        <span
          className="text-[8.5px] font-bold tracking-[0.22em] uppercase"
          style={{ color: 'var(--accent)', textShadow: '0 0 8px color-mix(in oklch, var(--accent) 50%, transparent)' }}
        >
          ◆ AGENTS · LIVE
        </span>
        <span
          className="flex-1 h-px"
          style={{
            background: 'repeating-linear-gradient(90deg, color-mix(in oklch, var(--border) 80%, transparent) 0 4px, transparent 4px 8px)',
          }}
        />
        <span className="text-[9px] font-mono text-muted-foreground tabular-nums">
          {agents.length} REGISTERED
        </span>
      </div>

      {/* Agent chips row */}
      <div className="flex gap-2 flex-wrap">
        {agents.map((agent) => (
          <div key={agent.name} className="min-w-[200px] flex-1">
            <AgentChip
              name={agent.name}
              sessionCount={agent.sessionCount}
              toolCallCount={agent.toolCallCount}
              latestStatus={agent.latestStatus}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
