'use client'

import { HudFrame } from '@/components/overview/hud-frame'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/dashboard/empty-state'
import { useOverviewAutomations } from '@/lib/agent-tools/client-hooks'
import type { AgentToolId } from '@/lib/agent-tools/types'
import type { SourceCapabilitySet, AutomationSummary } from '@/types/overview'

// ============================================================================
// Helpers
// ============================================================================

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
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

function runStatusColor(status: string): string {
  const s = status?.toLowerCase()
  if (s === 'running' || s === 'live') return 'var(--status-success)'
  if (s === 'error' || s === 'aborted') return 'var(--destructive)'
  if (s === 'paused' || s === 'disabled') return 'var(--muted-foreground)'
  return 'var(--muted-foreground)'
}

function runStatusLabel(status: string): string {
  const s = status?.toLowerCase()
  if (s === 'running' || s === 'live') return 'RUN'
  if (s === 'error' || s === 'aborted') return 'ERR'
  if (s === 'paused' || s === 'disabled') return 'PAU'
  return 'OK'
}

// ============================================================================
// Automations Table Row
// ============================================================================

function AutomRow({
  automation,
  showSource,
}: {
  automation: AutomationSummary
  showSource: boolean
}) {
  const color = runStatusColor(automation.latestStatus)
  const label = runStatusLabel(automation.latestStatus)
  const isRun = label === 'RUN'
  const isErr = label === 'ERR'
  const countLabel = automation.sessionCount > 0 ? `${automation.sessionCount}x run` : 'defined'

  return (
    <div
      className="flex items-center gap-3 px-3.5 py-[5px] border-b last:border-b-0"
      style={{ borderColor: 'color-mix(in oklch, var(--border) 35%, transparent)' }}
    >
      <span
        className="text-[9.5px] font-mono text-muted-foreground tabular-nums shrink-0 w-[58px]"
        title={automation.schedule}
      >
        {countLabel}
      </span>

      {/* Name */}
      <span className="flex items-center gap-1.5 text-[11px] text-foreground truncate flex-1 min-w-0">
        {showSource && automation.source && (
          <span className="text-[8px] font-bold font-mono tracking-[0.12em] text-muted-foreground uppercase shrink-0">
            {automation.source === 'claude-code' ? 'CLAUDE' : automation.source}
          </span>
        )}
        <span className="truncate" title={automation.name}>
          {automation.name}
        </span>
      </span>

      {/* Status */}
      <span
        className="text-[8.5px] font-bold font-mono tracking-[0.14em] shrink-0"
        style={{ color }}
      >
        {isRun && (
          <span
            className="inline-block w-1 h-1 rounded-full mr-1 align-middle animate-pulse"
            style={{ background: color }}
          />
        )}
        {label}
        {!isErr && !isRun && <span className="text-muted-foreground ml-1">· {relativeTime(automation.lastActiveAt)}</span>}
      </span>
    </div>
  )
}

// ============================================================================
// Pixel Runner Empty State (no automations for this source)
// ============================================================================

function PixelRunner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6">
      {/* Pixel art character */}
      <div className="relative h-10 w-10">
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="w-full h-full"
          style={{ fill: 'var(--muted-foreground)', opacity: 0.4 }}
        >
          <rect x="6" y="2" width="4" height="3" />
          <rect x="5" y="5" width="6" height="4" />
          <rect x="3" y="6" width="2" height="1" />
          <rect x="11" y="6" width="2" height="1" />
          <rect x="5" y="9" width="2" height="3" />
          <rect x="9" y="9" width="2" height="3" />
          <rect x="3" y="12" width="2" height="1" />
          <rect x="11" y="12" width="2" height="1" />
        </svg>
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-[9px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
          NO SCHEDULED TASKS HERE
        </span>
        <span className="text-[10px] text-muted-foreground/60 max-w-[200px] leading-relaxed">
          This source has no automation. Cron jobs and recurring agents will surface here.
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Skeleton
// ============================================================================

function AutomSkeleton() {
  return (
    <div className="flex flex-col">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3.5 py-[5px] border-b border-border/35">
          <Skeleton className="h-3 w-12 shrink-0" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Props
// ============================================================================

interface OverviewAutomationsProps {
  capabilities: { capabilities: Record<string, SourceCapabilitySet> } | null
  toolId: AgentToolId
  capsLoading?: boolean
}

// ============================================================================
// Component
// ============================================================================

export function OverviewAutomations({ capabilities, toolId, capsLoading }: OverviewAutomationsProps) {
  const { automations, loading: automationsLoading, error: automationsError } = useOverviewAutomations(toolId)

  const sourceCaps = capabilities?.capabilities?.[toolId]
  const isAll = toolId === 'all'
  const automationsEnabled = isAll || sourceCaps?.automations === true
  const hasAutomations = automationsEnabled

  const pill = hasAutomations && !automationsLoading && automations.length > 0 ? (
    <span
      className="inline-flex items-center gap-1 text-[8px] font-bold tracking-[0.14em] uppercase px-2 py-0.5 border"
      style={{
        color: 'var(--accent)',
        borderColor: 'var(--accent)',
        background: 'color-mix(in oklch, var(--accent) 10%, transparent)',
      }}
    >
      <span
        className="w-1 h-1 rounded-full animate-pulse"
        style={{ background: 'var(--accent)' }}
      />
      {automations.length} SCHEDULED
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 text-[8px] font-bold tracking-[0.14em] uppercase px-2 py-0.5 border"
      style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}
    >
      UNAVAILABLE
    </span>
  )

  const frameLabel = hasAutomations ? 'AUTOMATIONS' : 'AUTOMATIONS · OFF'

  if (capsLoading || automationsLoading) {
    return (
      <HudFrame label={frameLabel} right={pill} bodyClassName="p-0">
        <AutomSkeleton />
      </HudFrame>
    )
  }

  if (automationsError) {
    return (
      <HudFrame label={frameLabel} right={pill}>
        <EmptyState heading="LOAD ERROR" body={automationsError} />
      </HudFrame>
    )
  }

  if (!hasAutomations || automations.length === 0) {
    return (
      <HudFrame label={frameLabel} right={pill} bodyClassName="p-0">
        <PixelRunner />
      </HudFrame>
    )
  }

  return (
    <HudFrame label={frameLabel} right={pill} bodyClassName="p-0">
      <div className="flex flex-col">
        {automations.map((autom) => (
          <AutomRow
            key={`${autom.source ?? toolId}:${autom.id ?? autom.name}`}
            automation={autom}
            showSource={isAll}
          />
        ))}
      </div>
    </HudFrame>
  )
}
