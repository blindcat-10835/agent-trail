'use client'

import { useMemo } from 'react'
import { useGatewayStore } from '@/stores/gateway/gateway-store'
import { selectAlertsState } from '@/stores/gateway/p0-selectors'
import { RadarWidget } from './radar-widget'
import { cn } from '@/lib/utils'

function fmtNum(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1e6) return (n / 1000).toFixed(1) + 'k'
  return (n / 1e6).toFixed(2) + 'm'
}

function fmtUsd(n: number): string {
  return '$' + n.toFixed(2)
}

function fmtAgo(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

export function DashboardLeftPanel() {
  const agentsMap = useGatewayStore((s) => s.agents)
  const agents = useMemo(() => Array.from(agentsMap.values()), [agentsMap])
  const { state: alertsState, data: alerts } = useGatewayStore(selectAlertsState)
  const usageDetail = useGatewayStore((s) => s.usageDetail)
  const globalEventFeed = useGatewayStore((s) => s.globalEventFeed)

  const stats = useMemo(() => {
    const statusCounts: Record<string, number> = {}
    for (const a of agents) {
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1
    }
    const totalTokens = usageDetail?.providers.reduce((sum, p) => sum + (p.totalTokens || 0), 0) || 0
    const totalCost = usageDetail?.providers.reduce((sum, p) => sum + (p.estimatedCostUsd || 0), 0) || 0
    const errors = agents.filter((a) => a.status === 'error').length
    return { statusCounts, totalTokens, totalCost, errors }
  }, [agents, usageDetail])

  const miniStats = [
    { label: 'EVT / MIN', value: (16.4 + globalEventFeed.length * 0.02).toFixed(1), color: 'text-accent' },
    { label: 'TOK 24H', value: fmtNum(stats.totalTokens), color: 'text-accent' },
    { label: 'COST 24H', value: fmtUsd(stats.totalCost), color: 'text-foreground' },
    { label: 'ERRORS', value: String(stats.errors), color: stats.errors > 0 ? 'text-destructive' : 'text-foreground' },
  ]

  const unackedAlerts = alerts.filter((a) => !a.acked)

  return (
    <div className="h-full flex flex-col border-r border-border bg-card overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <span className="text-[11px] font-semibold tracking-[0.22em] text-accent">
          ◈ RADAR · SECTOR:DEFAULT
        </span>
        <span className="text-[11px] text-muted-foreground">{agents.length} NODES</span>
      </div>

      {/* Radar */}
      <RadarWidget agents={agents} />

      {/* Mini stats */}
      <div className="flex flex-col border-b border-border">
        {miniStats.map((s) => (
          <div key={s.label} className="grid grid-cols-[1fr_auto] items-center px-3.5 py-2 border-b border-border last:border-b-0">
            <span className="text-[11px] tracking-[0.14em] text-muted-foreground">{s.label}</span>
            <span className={cn('text-sm font-mono font-medium', s.color)}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Alerts header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border border-t">
        <span className="text-[11px] font-semibold tracking-[0.22em] text-accent">
          ⚠ ALERTS
        </span>
        <span className="text-[11px] text-muted-foreground">{unackedAlerts.length} ACTIVE</span>
      </div>

      {/* Alerts list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {alertsState === 'success' && alerts.length > 0 ? (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="grid grid-cols-[10px_1fr] gap-2 px-3.5 py-2 border-b border-border items-start"
              style={{ opacity: alert.acked ? 0.5 : 1 }}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0',
                  alert.severity === 'action-required' && 'bg-destructive shadow-[0_0_6px_var(--color-destructive)]',
                  alert.severity === 'warn' && 'bg-accent',
                  alert.severity === 'info' && 'bg-accent-dim'
                )}
              />
              <div>
                <div className="text-[11px] text-foreground/65 leading-snug">{alert.message}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 tracking-wider">
                  {alert.agentName} · {fmtAgo(Math.floor((Date.now() - alert.ts) / 1000))} ago
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="px-3.5 py-4 text-[11px] text-muted-foreground tracking-wider">
            No active alerts
          </div>
        )}
      </div>
    </div>
  )
}
