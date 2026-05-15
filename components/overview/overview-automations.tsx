'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/dashboard/empty-state'
import { useOverviewAutomations } from '@/lib/agent-tools/client-hooks'
import type { AgentToolId } from '@/lib/agent-tools/types'
import type { SourceCapabilitySet } from '@/types/overview'
import type { AutomationSummary } from '@/types/overview'

// ============================================================================
// Props
// ============================================================================

interface OverviewAutomationsProps {
  capabilities: {
    capabilities: Record<string, SourceCapabilitySet>
  } | null
  toolId: AgentToolId
  capsLoading?: boolean
}

// ============================================================================
// Helpers
// ============================================================================

function relativeTime(iso: string | null): string {
  if (!iso) return '\u2014'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'just now'

  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  return `${Math.floor(days / 30)}mo ago`
}

// ============================================================================
// Skeleton Card
// ============================================================================

function AutomationCardSkeleton() {
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
// Automation Card
// ============================================================================

function AutomationCard({ automation }: { automation: AutomationSummary }) {
  return (
    <div className="hud-clip-md bg-card px-4 py-3.5 grid gap-2 hover:bg-accent/5 transition-colors relative outline outline-1 outline-border outline-offset-[-1px]">
      {/* Header: name + status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
            A
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-foreground truncate tracking-wide font-mono">
              {automation.name}
            </div>
            <div className="text-[10px] text-muted-foreground tracking-wider">
              {automation.sessionCount} session{automation.sessionCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <span className="hud-clip-sm inline-flex items-center gap-1 px-2 py-0.5 border border-border text-[9px] tracking-[0.15em] uppercase font-bold text-muted-foreground shrink-0">
          {automation.latestStatus}
        </span>
      </div>

      {/* Footer: tool count + last active */}
      <div className="text-[11px] text-foreground/65">
        {automation.toolCallCount > 0 ? (
          <>
            <span className="text-accent mr-1">▸</span>
            {automation.toolCallCount} tool call{automation.toolCallCount !== 1 ? 's' : ''}
          </>
        ) : (
          <span className="text-muted-foreground">▸ standby</span>
        )}
        <span className="text-muted-foreground ml-3">
          {relativeTime(automation.lastActiveAt)}
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Component
// ============================================================================

export function OverviewAutomations({ capabilities, toolId, capsLoading }: OverviewAutomationsProps) {
  // Always call hook — React hooks must not be conditional
  const { automations, loading: automationsLoading, error: automationsError } = useOverviewAutomations(toolId)

  const heading = (
    <div className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
      AUTOMATIONS
    </div>
  )

  // Show skeleton while capabilities are loading
  if (capsLoading) {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          <AutomationCardSkeleton />
          <AutomationCardSkeleton />
        </div>
      </div>
    )
  }

  // Determine if automations are available for this source
  const sourceCaps = capabilities?.capabilities?.[toolId]
  const automationsEnabled = sourceCaps?.automations === true
  const isAll = toolId === 'all'

  // Hide for 'all' or when capability is disabled — return placeholder for grid stability
  if (!automationsEnabled || isAll) {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        <EmptyState heading="N/A" body="AUTOMATIONS NOT AVAILABLE FOR THIS SOURCE." />
      </div>
    )
  }

  if (automationsLoading) {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          <AutomationCardSkeleton />
          <AutomationCardSkeleton />
        </div>
      </div>
    )
  }

  if (automationsError) {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        <EmptyState heading="LOAD ERROR" body={automationsError} />
      </div>
    )
  }

  if (automations.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        <EmptyState heading="NO AUTOMATIONS" body="No automations found for this source." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {heading}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
        {automations.map((automation) => (
          <AutomationCard key={automation.name} automation={automation} />
        ))}
      </div>
    </div>
  )
}
