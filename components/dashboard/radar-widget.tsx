'use client'

import { useMemo } from 'react'
import type { AgentInfo, AgentDisplayStatus } from '@/stores/gateway/gateway-store'

const DOT_COLORS: Record<AgentDisplayStatus, string> = {
  working: 'var(--color-accent)',
  speaking: 'oklch(0.65 0.15 145)',
  tool_calling: 'oklch(0.8 0.17 75)',
  idle: 'var(--color-muted-foreground)',
  error: 'var(--color-destructive)',
}

const STATUS_META: Record<AgentDisplayStatus, { label: string; color: string }> = {
  working: { label: 'working', color: 'var(--color-accent)' },
  speaking: { label: 'speaking', color: 'oklch(0.65 0.15 145)' },
  tool_calling: { label: 'tool', color: 'oklch(0.8 0.17 75)' },
  idle: { label: 'idle', color: 'var(--color-muted-foreground)' },
  error: { label: 'error', color: 'var(--color-destructive)' },
}

interface RadarWidgetProps {
  agents: AgentInfo[]
}

export function RadarWidget({ agents }: RadarWidgetProps) {
  const cx = 50
  const cy = 50
  const rings = [20, 35, 46]

  const placements = useMemo(() => {
    return agents.map((a, i) => {
      const ang = (i / agents.length) * Math.PI * 2 - Math.PI / 2
      const r = a.status === 'idle' ? 35 : a.status === 'error' ? 30 : 22 + (i % 3) * 7
      return { a, x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r }
    })
  }, [agents])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of agents) {
      counts[a.status] = (counts[a.status] || 0) + 1
    }
    return counts
  }, [agents])

  return (
    <div className="flex flex-col items-center gap-2.5 p-3.5 border-b border-border">
      <div className="w-[170px] h-[170px] relative flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {rings.map((r, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth=".5"
              strokeDasharray={i === 0 ? '0' : '1 1.5'}
            />
          ))}
          <line x1={cx} y1="4" x2={cx} y2="96" stroke="var(--color-border)" strokeWidth=".3" />
          <line x1="4" y1={cy} x2="96" y2={cy} stroke="var(--color-border)" strokeWidth=".3" />
          {/* sweep */}
          <g className="animate-[sweep_4s_linear_infinite]" style={{ transformOrigin: `${cx}% ${cy}%` }}>
            <path
              d={`M${cx},${cy} L${cx},${cy - 46} A46,46 0 0,1 ${cx + Math.sin(Math.PI / 5) * 46},${cy - Math.cos(Math.PI / 5) * 46} Z`}
              fill="url(#sweep-grad)"
              opacity=".7"
            />
            <defs>
              <radialGradient id="sweep-grad" cx="0%" cy="100%" r="100%">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity=".35" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
              </radialGradient>
            </defs>
          </g>
          {/* pings on active agents */}
          {placements
            .filter((p) => p.a.status !== 'idle')
            .map((p) => (
              <circle
                key={p.a.id + 'ping'}
                cx={p.x}
                cy={p.y}
                r="3.5"
                fill="none"
                stroke={DOT_COLORS[p.a.status]}
                strokeWidth=".5"
                className="animate-[ping_1.8s_ease-out_infinite]"
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              />
            ))}
          {/* agent dots */}
          {placements.map((p) => (
            <g key={p.a.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r="2"
                fill={DOT_COLORS[p.a.status]}
                className={p.a.status !== 'idle' ? 'animate-[node-pulse_2s_ease-in-out_infinite]' : ''}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              />
            </g>
          ))}
          {/* center */}
          <circle cx={cx} cy={cy} r="3.5" fill="var(--color-accent)" opacity=".9" />
          <circle cx={cx} cy={cy} r="6" fill="none" stroke="var(--color-accent)" strokeWidth=".4" opacity=".4" />
        </svg>
      </div>

      {/* Status legend */}
      <div className="w-full grid grid-cols-2 gap-1 text-[10px] tracking-wider">
        {(['working', 'speaking', 'tool_calling', 'error'] as AgentDisplayStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: STATUS_META[s].color }}
            />
            <b className="font-medium text-foreground">{statusCounts[s] || 0}</b> {STATUS_META[s].label}
          </span>
        ))}
      </div>
    </div>
  )
}
