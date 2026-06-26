'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import { HudPanel } from '@/components/hud/hud-panel'
import { EmptyState } from '@/components/dashboard/empty-state'

interface ToolCallStat {
  name: string
  category: string
  total_calls: number
  success_count: number
  error_count: number
  total_duration_ms: number
  session_count: number
  source: string
  avg_duration_ms: number
}

interface ToolCallStatsResponse {
  stats: ToolCallStat[]
  total_tool_calls: number
}

function fmtDur(ms: number): string {
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)}m`
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

function ToolCallRow({
  stat,
  maxCalls,
}: {
  stat: ToolCallStat
  maxCalls: number
}) {
  const barWidth = (stat.total_calls / maxCalls) * 100
  const successRate = stat.total_calls > 0
    ? ((stat.success_count / stat.total_calls) * 100).toFixed(0)
    : '0'
  const hasErrors = stat.error_count > 0

  return (
    <div className="border-b border-border/40 last:border-0">
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/5 transition-colors">
        <div className="w-full flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground min-w-[100px] truncate">
              {stat.name}
            </span>
            <span className="text-[8px] text-muted-foreground uppercase tracking-[0.1em] font-mono">
              {stat.category}
            </span>
            <span className="text-[8px] text-muted-foreground uppercase font-mono">
              {stat.source}
            </span>
            <span className="text-[10px] font-bold font-mono text-foreground ml-auto">
              {stat.total_calls}
            </span>
            <span className="text-[9px] font-mono text-muted-foreground min-w-[50px] text-right">
              {fmtDur(stat.total_duration_ms)}
            </span>
            <span className={`text-[9px] font-mono ${hasErrors ? 'text-red-400' : 'text-green-400'}`}>
              {successRate}%
            </span>
            <span className="text-[8px] text-muted-foreground font-mono">
              {stat.session_count} ses
            </span>
          </div>
          <div className="h-1 bg-border/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent/40 rounded-full transition-all"
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ToolCallsPage() {
  const { toolId, definition } = useAgentTool()
  const [data, setData] = useState<ToolCallStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'calls' | 'duration'>('calls')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/agent-tools/${toolId}/sessions/toolcalls`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [toolId])

  useEffect(() => { fetchData() }, [fetchData])

  const sortedStats = useMemo(() => {
    if (!data?.stats) return []
    return [...data.stats].sort((a, b) =>
      sortBy === 'duration'
        ? b.total_duration_ms - a.total_duration_ms
        : b.total_calls - a.total_calls
    )
  }, [data, sortBy])

  const maxCalls = useMemo(
    () => Math.max(...sortedStats.map((s) => s.total_calls), 1),
    [sortedStats],
  )

  if (loading) {
    return (
      <div className="h-full min-h-0 min-w-0 overflow-y-auto p-[18px_22px_26px]">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-[12px] font-bold uppercase tracking-[0.15em] text-foreground">TOOL CALLS</h1>
          <span className="text-[9px] text-muted-foreground animate-pulse">LOADING...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full min-h-0 min-w-0 overflow-y-auto p-[18px_22px_26px]">
        <EmptyState heading="LOAD ERROR" body={error} />
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 min-w-0 overflow-y-auto p-[18px_22px_26px] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-[12px] font-bold uppercase tracking-[0.15em] text-foreground">TOOL CALLS</h1>
          <span className="text-[9px] text-muted-foreground">{definition.label}</span>
          {data && (
            <span className="text-[9px] font-mono text-muted-foreground">
              {data.total_tool_calls} TOTAL
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setSortBy('calls')}
            className={`text-[8px] px-2 py-1 font-bold uppercase tracking-[0.1em] border transition-colors ${
              sortBy === 'calls'
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border text-muted-foreground hover:border-accent'
            }`}
          >
            BY CALLS
          </button>
          <button
            onClick={() => setSortBy('duration')}
            className={`text-[8px] px-2 py-1 font-bold uppercase tracking-[0.1em] border transition-colors ${
              sortBy === 'duration'
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border text-muted-foreground hover:border-accent'
            }`}
          >
            BY DURATION
          </button>
        </div>
      </div>

      {sortedStats.length === 0 ? (
        <EmptyState heading="NO TOOL DATA" body="No tool call data available for this source." />
      ) : (
        <HudPanel>
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border/40">
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground min-w-[100px]">TOOL</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground">CAT</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground">SRC</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground ml-auto">CALLS</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground min-w-[50px] text-right">DURATION</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground">SUCCESS</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground">SESSIONS</span>
          </div>
          {sortedStats.map((stat) => (
            <ToolCallRow key={`${stat.name}-${stat.source}`} stat={stat} maxCalls={maxCalls} />
          ))}
        </HudPanel>
      )}
    </div>
  )
}
