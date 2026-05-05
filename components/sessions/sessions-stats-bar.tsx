/* eslint-disable */
'use client'

import { useMemo } from 'react'
import type { SessionInfo } from '@/gateway/adapter-types'

function fmtNum(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1e6) return (n / 1000).toFixed(1) + 'k'
  return (n / 1e6).toFixed(2) + 'm'
}

function fmtUsd(n: number): string {
  return '$' + n.toFixed(2)
}

interface SessionsStatsBarProps {
  sessions: SessionInfo[]
}

export function SessionsStatsBar({ sessions }: SessionsStatsBarProps) {
  // Date.now() is intentional here for real-time active session tracking
  // Session status updates should reflect current time, not render time
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000 // eslint-disable-line react-compiler/react-compiler

  const stats = useMemo(() => {
    const totalSessions = sessions.length
    const activeSessions = sessions.filter(s => {
      const updatedAt = s.updatedAt ?? 0
      return updatedAt > fiveMinutesAgo && !s.aborted
    }).length
    const totalTokens = sessions.reduce((sum, s) => sum + (s.totalTokens || 0), 0)
    const totalCost = sessions.reduce((sum, s) => sum + (s.cost || 0), 0)

    return { totalSessions, activeSessions, totalTokens, totalCost }
  }, [sessions, fiveMinutesAgo])

  function StatTile({ label, value, sub }: {
    label: string
    value: React.ReactNode
    sub?: React.ReactNode
  }) {
    return (
      <div className="bg-card px-4 py-3.5 border border-border flex flex-col gap-1 relative overflow-hidden min-w-0">
        <div className="text-[9.5px] text-muted-foreground tracking-[0.2em] uppercase">{label}</div>
        <div className="text-3xl font-bold tracking-tight tabular-nums leading-tight whitespace-nowrap">
          {value}
        </div>
        {sub && <div className="text-[10.5px] text-foreground/65">{sub}</div>}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-4 gap-px bg-border border border-border">
      <StatTile
        label="TOTAL SESSIONS"
        value={stats.totalSessions}
        sub={`${stats.activeSessions} active now`}
      />
      <StatTile
        label="ACTIVE SESSIONS"
        value={stats.activeSessions}
      />
      <StatTile
        label="TOTAL TOKENS"
        value={fmtNum(stats.totalTokens)}
      />
      <StatTile
        label="TOTAL COST"
        value={fmtUsd(stats.totalCost)}
      />
    </div>
  )
}
