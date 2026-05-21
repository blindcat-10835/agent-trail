'use client'

import { HudFrame } from '@/components/overview/hud-frame'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/dashboard/empty-state'
import { useOverviewAutomations } from '@/lib/agent-tools/client-hooks'
import { getSourceColor } from '@/lib/agent-tools/registry'
import { getSourceTag } from '@/types/trace'
import type { AgentToolId } from '@/lib/agent-tools/types'
import type { SourceCapabilitySet, AutomationSummary } from '@/types/overview'

const MAX_AUTOMATIONS = 10

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

// Parse RRULE/cron strings into short human-readable labels
function parseScheduleShort(schedule: string | undefined, sessionCount: number): string {
  if (!schedule) return `${sessionCount}x`

  // RRULE format (e.g. "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=8;BYMINUTE=0")
  if (schedule.includes('FREQ=')) {
    const parts: Record<string, string> = {}
    schedule.split(';').forEach((p) => {
      const eq = p.indexOf('=')
      if (eq > 0) parts[p.slice(0, eq)] = p.slice(eq + 1)
    })
    const freq = parts['FREQ'] ?? 'CUSTOM'
    const hourStr = parts['BYHOUR']
    const minuteStr = parts['BYMINUTE']
    const byDay = parts['BYDAY']

    let freqLabel: string
    if (freq === 'DAILY') {
      freqLabel = 'DAILY'
    } else if (freq === 'WEEKLY') {
      if (byDay) {
        const days = byDay.split(',').length
        if (days >= 7) freqLabel = 'DAILY'
        else if (byDay === 'MO,TU,WE,TH,FR') freqLabel = 'WKDAY'
        else if (byDay === 'SA,SU' || byDay === 'SU,SA') freqLabel = 'WKEND'
        else freqLabel = `WKLY·${days}D`
      } else {
        freqLabel = 'WEEKLY'
      }
    } else if (freq === 'MONTHLY') {
      freqLabel = 'MTHLY'
    } else if (freq === 'HOURLY') {
      freqLabel = 'HOURLY'
    } else {
      freqLabel = freq.slice(0, 6)
    }

    if (hourStr != null) {
      const hh = hourStr.split(',')[0].padStart(2, '0')
      const mm = (minuteStr ?? '0').split(',')[0].padStart(2, '0')
      return `${freqLabel} ${hh}:${mm}`
    }
    return freqLabel
  }

  // Unix cron format "m h d M w" — keep as-is if short enough
  const cronParts = schedule.trim().split(/\s+/)
  if (cronParts.length === 5) {
    // Compact: replace common wildcards
    return cronParts.map((p) => (p === '*' ? '✱' : p)).join(' ')
  }

  return schedule.slice(0, 14)
}

function a2StatusClass(status: string): 'ok' | 'run' | 'err' {
  const s = status?.toLowerCase()
  if (s === 'running' || s === 'live') return 'run'
  if (s === 'error' || s === 'aborted') return 'err'
  return 'ok'
}

function a2StatusText(automation: AutomationSummary): string {
  const cls = a2StatusClass(automation.latestStatus)
  if (cls === 'run') return '● RUN'
  if (cls === 'err') return 'ERR'
  return `OK · ${relativeTime(automation.lastActiveAt)}`
}

// ============================================================================
// Row
// ============================================================================

function AutomRow({ automation, showSource }: { automation: AutomationSummary; showSource: boolean }) {
  const sourceColor = automation.source
    ? getSourceColor(automation.source)
    : 'var(--muted-foreground)'
  const cls = a2StatusClass(automation.latestStatus)
  const schedLabel = parseScheduleShort(automation.schedule, automation.sessionCount)

  return (
    <div className="a2-row" style={{ '--a2-color': sourceColor } as React.CSSProperties}>
      <span className="a2-cron" title={automation.schedule ?? undefined}>
        {schedLabel}
      </span>
      <span className="a2-name">
        {showSource && automation.source && (
          <span
            style={{
              fontSize: '8px',
              fontWeight: 700,
              letterSpacing: '.12em',
              color: sourceColor,
              marginRight: 6,
              opacity: 0.85,
            }}
          >
            {getSourceTag(automation.source)}
          </span>
        )}
        {automation.name}
      </span>
      <span className={`a2-status ${cls}`}>{a2StatusText(automation)}</span>
    </div>
  )
}

// ============================================================================
// Pixel Runner Empty State
// ============================================================================

function PixelRunner() {
  return (
    <div className="empty-runner">
      <div className="er-stage">
        <svg
          className="er-char"
          viewBox="0 0 16 16"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Frame 1 — left leg forward */}
          <g className="er-f1">
            <rect x="6" y="1" width="4" height="3" />
            <rect x="5" y="4" width="6" height="4" />
            <rect x="3" y="5" width="2" height="1" />
            <rect x="11" y="5" width="2" height="1" />
            <rect x="5" y="8" width="2" height="3" />
            <rect x="9" y="8" width="2" height="3" />
            <rect x="3" y="11" width="3" height="1" />
            <rect x="10" y="11" width="3" height="1" />
          </g>
          {/* Frame 2 — right leg forward */}
          <g className="er-f2">
            <rect x="6" y="1" width="4" height="3" />
            <rect x="5" y="4" width="6" height="4" />
            <rect x="3" y="5" width="2" height="1" />
            <rect x="11" y="5" width="2" height="1" />
            <rect x="5" y="8" width="2" height="3" />
            <rect x="9" y="8" width="2" height="3" />
            <rect x="4" y="11" width="3" height="1" />
            <rect x="9" y="11" width="3" height="1" />
          </g>
        </svg>
        <span className="er-dust er-dust-1">·</span>
        <span className="er-dust er-dust-2">·</span>
        <span className="er-dust er-dust-3">·</span>
        <div className="er-floor" />
      </div>
      <div className="er-msg">
        <span className="er-tag">NO SCHEDULED TASKS</span>
        <span className="er-sub">
          Cron jobs and recurring agents will surface here once configured for this source.
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
    <div className="autom2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="a2-row" style={{ '--a2-color': 'var(--muted-foreground)' } as React.CSSProperties}>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-12" />
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
      <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
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

  const visibleAutomations = automations.slice(0, MAX_AUTOMATIONS)

  return (
    <HudFrame label={frameLabel} right={pill} bodyClassName="p-0">
      <div className="autom2">
        {visibleAutomations.map((autom) => (
          <AutomRow
            key={`${autom.source ?? toolId}:${autom.id ?? autom.name}`}
            automation={autom}
            showSource={isAll}
          />
        ))}
        {automations.length > MAX_AUTOMATIONS && (
          <div
            className="text-center text-[9px] font-mono tracking-[0.12em] text-muted-foreground/50 py-1"
          >
            +{automations.length - MAX_AUTOMATIONS} more
          </div>
        )}
      </div>
    </HudFrame>
  )
}
