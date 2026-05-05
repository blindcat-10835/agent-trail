'use client'

import { useMemo } from 'react'
import { useGatewayStore } from '@/stores/gateway/gateway-store'
import { cn } from '@/lib/utils'
import type { AgentDisplayStatus } from '@/stores/gateway/gateway-store'

type FilterMode = 'all' | 'live' | 'error'

interface DashboardKpiBarProps {
  agentCount: number
  filter: FilterMode
  onFilterChange: (f: FilterMode) => void
  eventCount: number
}

export function DashboardKpiBar({ agentCount, filter, onFilterChange, eventCount }: DashboardKpiBarProps) {
  const agentsMap = useGatewayStore((s) => s.agents)
  const agents = useMemo(() => Array.from(agentsMap.values()), [agentsMap])
  const usageDetail = useGatewayStore((s) => s.usageDetail)

  const stats = useMemo(() => {
    const sc: Record<string, number> = {}
    for (const a of agents) {
      sc[a.status] = (sc[a.status] || 0) + 1
    }
    const active = agents.length - (sc.idle || 0)
    const totalTokens = usageDetail?.providers.reduce((sum, p) => sum + (p.totalTokens || 0), 0) || 0
    const totalCost = usageDetail?.providers.reduce((sum, p) => sum + (p.estimatedCostUsd || 0), 0) || 0
    return { sc, active, working: sc.working || 0, toolExec: sc.tool_calling || 0, errors: sc.error || 0, totalTokens, totalCost }
  }, [agents, usageDetail])

  function fmtNum(n: number): string {
    if (n < 1000) return String(n)
    if (n < 1e6) return (n / 1000).toFixed(1) + 'k'
    return (n / 1e6).toFixed(2) + 'm'
  }

  const kpis = [
    { label: 'ACTIVE', value: stats.active, accent: true },
    { label: 'WORKING', value: stats.working, accent: false },
    { label: 'TOOL EXEC', value: stats.toolExec, accent: false },
    { label: 'ERRORS', value: stats.errors, accent: false },
    { label: 'TOKENS', value: fmtNum(stats.totalTokens), accent: false },
    { label: 'EVT BUF', value: `${eventCount}/100`, accent: false },
  ]

  return (
    <>
      {/* Page head */}
      <div className="flex items-end justify-between px-4 pt-3.5 pb-2.5 border-b border-border gap-3 flex-wrap">
        <div className="min-w-0 flex flex-col gap-1">
          <div className="text-[10px] text-muted-foreground tracking-[0.14em]">
            GATEWAY <span className="text-foreground-ghost px-1.5">›</span> WORKSPACE:DEFAULT <span className="text-foreground-ghost px-1.5">›</span> <span className="text-accent">AGENTS</span>
          </div>
          <h1 className="text-[13px] font-bold tracking-[0.18em] text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
            AGENTS · {agentCount} REGISTERED · {stats.active} ACTIVE
          </h1>
        </div>
        <div className="flex gap-1.5">
          <div className="inline-flex border border-border bg-card">
            {(['all', 'live', 'error'] as FilterMode[]).map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                onClick={() => onFilterChange(f)}
                className={cn(
                  'px-2.5 py-1.5 text-[10px] tracking-[0.1em] border-r border-border last:border-r-0',
                  filter === f
                    ? 'text-background bg-accent font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
                )}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI strip — 6 columns */}
      <div className="grid grid-cols-6 border-b border-border bg-card">
        {kpis.map((k) => (
          <div key={k.label} className="px-3.5 py-2.5 border-r border-border last:border-r-0 flex flex-col gap-0.5 relative overflow-hidden">
            <div className="text-[9.5px] text-muted-foreground tracking-[0.18em] uppercase">
              {k.label}
            </div>
            <div className={cn(
              'text-xl font-semibold tabular-nums tracking-tight leading-tight whitespace-nowrap',
              k.accent && 'text-accent'
            )}>
              {k.value}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
