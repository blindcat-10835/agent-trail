/* eslint-disable react-hooks/purity */
'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useGatewayStore } from '@/stores/gateway/gateway-store'
import { cn } from '@/lib/utils'
import { OverviewAgentCard } from './overview/agent-card'
import { OverviewAgentDrawer } from './overview/agent-drawer'
import { CronDrawer } from './overview/cron-drawer'
import { SkillsList } from './overview/skills-list'
import { SessionsDetailRail } from '@/components/sessions/sessions-detail-rail'
import { QuickActions } from './quick-actions'
import type { LogEntry } from '@/types/activity'

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

function fmtSchedule(sc: { kind: string; at?: string; everyMs?: number; expr?: string }): string {
  if (sc.kind === 'cron') return sc.expr ?? ''
  if (sc.kind === 'every') return `every ${Math.round((sc.everyMs ?? 0) / 1000)}s`
  return sc.at ?? ''
}

function StatTile({ label, value, sub, accent, glyph }: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  accent?: boolean
  glyph?: string
}) {
  return (
    <div className="bg-card px-4 py-3.5 border border-border flex flex-col gap-1 relative overflow-hidden min-w-0">
      <div className="text-[9.5px] text-muted-foreground tracking-[0.2em] uppercase">{label}</div>
      <div className={cn('text-3xl font-bold tracking-tight tabular-nums leading-tight whitespace-nowrap', accent && 'text-accent')}>
        {value}
      </div>
      {sub && <div className="text-[10.5px] text-foreground/65 flex gap-2 items-center">{sub}</div>}
      {glyph && <div className="absolute right-3.5 top-3 text-base text-foreground-ghost">{glyph}</div>}
    </div>
  )
}

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="border border-border bg-card flex flex-col min-h-0 min-w-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-accent/5 flex-shrink-0 gap-3">
        <span className="text-foreground font-semibold text-[9.5px] tracking-[0.2em] uppercase inline-flex items-center gap-2">
          <span className="w-1 h-1 bg-accent" />
          {title}
        </span>
        {meta && <span className="text-muted-foreground font-medium text-[9.5px] tracking-[0.2em]">{meta}</span>}
      </div>
      <div className="flex-1 min-h-0 min-w-0 overflow-auto">{children}</div>
    </section>
  )
}

export function OverviewTab({ onNavigateToSkills }: { onNavigateToSkills?: () => void }) {
  const router = useRouter()
  const agentsMap = useGatewayStore((s) => s.agents)
  const agents = useMemo(() => Array.from(agentsMap.values()), [agentsMap])
  const usageDetail = useGatewayStore((s) => s.usageDetail)
  const allSessions = useGatewayStore((s) => s.sessions)
  const sessions = useMemo(() => allSessions.filter(s => !s.key.includes(':cron:')), [allSessions])
  const cronTasks = useGatewayStore((s) => s.cronTasks)
  const globalEventFeed = useGatewayStore((s) => s.globalEventFeed)
  const agentLogs = useGatewayStore((s) => s.agentLogs)

  const [peekAgentId, setPeekAgentId] = useState<string | null>(null)
  const peekAgent = peekAgentId ? agentsMap.get(peekAgentId) ?? null : null
  const peekLogs = peekAgentId ? (agentLogs[peekAgentId] ?? []) : []

  const [selectedCronId, setSelectedCronId] = useState<string | null>(null)
  const peekCronTask = selectedCronId ? (cronTasks.find((c) => c.id === selectedCronId) ?? null) : null

  const [peekSessionKey, setPeekSessionKey] = useState<string | null>(null)
  const peekSession = peekSessionKey ? (sessions.find(s => s.key === peekSessionKey) ?? null) : null

  // Activity logs state
  const [activityLogs, setActivityLogs] = useState<LogEntry[]>([])
  const [activityLoading, setActivityLoading] = useState(true)

  const cronRuns = useMemo(
    () =>
      activityLogs
        .filter((e) => e.source === 'cron' && e.jobId === selectedCronId)
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 10),
    [activityLogs, selectedCronId]
  )

  // Fetch activity logs on mount
  useEffect(() => {
    fetch('/api/logs')
      .then(r => r.json())
      .then((data: { entries: LogEntry[] }) => {
        setActivityLogs(data.entries)
        setActivityLoading(false)
      })
      .catch(() => setActivityLoading(false))
  }, [])

  const stats = useMemo(() => {
    const sc: Record<string, number> = {}
    for (const a of agents) {
      sc[a.status] = (sc[a.status] || 0) + 1
    }
    const active = agents.length - (sc.idle || 0)
    const totalTokens = usageDetail?.providers.reduce((sum, p) => sum + (p.totalTokens || 0), 0) || 0
    const totalCost = usageDetail?.providers.reduce((sum, p) => sum + (p.estimatedCostUsd || 0), 0) || 0
    const totalIn = usageDetail?.providers.reduce((sum, p) => sum + (p.tokensIn || 0), 0) || 0
    const totalOut = usageDetail?.providers.reduce((sum, p) => sum + (p.tokensOut || 0), 0) || 0
    const activeSessions = sessions.filter(s => s.updatedAt && (Date.now() - s.updatedAt) < 300000 && !s.aborted).length
    return { sc, active, totalTokens, totalCost, totalIn, totalOut, activeSessions }
  }, [agents, usageDetail, sessions])

  const errorCount = useMemo(() => activityLogs.filter(e => e.level === 'error').length, [activityLogs])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3.5 grid gap-3 auto-rows-min">
      {/* Hero stat tiles */}
      <div className="grid grid-cols-4 gap-px bg-border border border-border">
        <StatTile
          label="FLEET STATUS"
          value={<>{stats.active}<span className="text-base text-muted-foreground"> / {agents.length}</span></>}
          sub={
            <>
              <span className="text-accent">● {stats.sc.working || 0} working</span>
              <span className="text-[oklch(0.72_0.14_220)]">● {stats.sc.tool_calling || 0} tool</span>
              <span className="text-[oklch(0.76_0.17_145)]">● {stats.sc.speaking || 0} speaking</span>
            </>
          }
          accent
          glyph="◆"
        />
        <StatTile
          label="SESSIONS ACT"
          value={<>{stats.activeSessions}<span className="text-base text-muted-foreground"> / {sessions.length}</span></>}
          sub={
            <>
              <span className="text-accent">● {stats.activeSessions} active</span>
            </>
          }
          glyph="◉"
        />
        <StatTile
          label="SPEND · 24H"
          value={fmtUsd(stats.totalCost)}
          sub={
            <>
              <span className="text-[oklch(0.72_0.14_220)]">↘ in {fmtNum(stats.totalIn)}</span>
              <span className="text-[oklch(0.76_0.17_145)]">↗ out {fmtNum(stats.totalOut)}</span>
            </>
          }
          accent
          glyph="$"
        />
        <StatTile
          label="ACTIVITY · ERRORS"
          value={<span className={errorCount > 0 ? 'text-destructive' : ''}>{errorCount}</span>}
          sub={
            <>
              <span className="text-accent">{activityLogs.length} events</span>
              <span className="text-muted-foreground">feed {globalEventFeed.length}</span>
            </>
          }
          glyph="◉"
        />
      </div>

      {/* Agent section header */}
      <div className="flex items-center justify-between">
        <span className="text-foreground font-semibold text-[9.5px] tracking-[0.2em] uppercase inline-flex items-center gap-2">
          <span className="w-1 h-1 bg-accent" />
          AGENTS · {agents.length} REGISTERED
        </span>
        <span className="text-muted-foreground text-[9.5px] tracking-[0.15em]">CLICK TO INSPECT</span>
      </div>

      {/* Agent grid — auto-fill, separated cards with HUD clip */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
        {agents.map((a) => (
          <OverviewAgentCard
            key={a.id}
            agent={a}
            selected={peekAgentId === a.id}
            onSelect={() => setPeekAgentId(peekAgentId === a.id ? null : a.id)}
          />
        ))}
      </div>

      {/* Drawer overlay */}
      {peekAgent && (
        <OverviewAgentDrawer
          agent={peekAgent}
          logs={peekLogs.slice(0, 10)}
          events={globalEventFeed.filter((e) => e.agentId === peekAgent.id).slice(0, 16)}
          onClose={() => setPeekAgentId(null)}
        />
      )}

      {/* Cron drawer overlay */}
      {peekCronTask && (
        <CronDrawer
          task={peekCronTask}
          runs={cronRuns}
          onClose={() => setSelectedCronId(null)}
        />
      )}

      {/* Session drawer overlay */}
      {peekSession && (
        <SessionsDetailRail
          session={peekSession}
          onClose={() => setPeekSessionKey(null)}
        />
      )}

      {/* Two column: channels + cron */}
      <div className="grid grid-cols-2 gap-3">
        <Section title="SESSIONS" meta={`${sessions.length} total`}>
          <div className="text-[11.5px]">
            {sessions.length === 0 && (
              <div className="px-3 py-4 text-muted-foreground">No sessions active.</div>
            )}
            {sessions.length > 0 && (
              <>
                <div className="px-3 py-2 border-b border-border bg-accent/5">
                  <span className="text-accent font-semibold">{sessions.filter(s => {
                    const isActive = s.updatedAt && (Date.now() - s.updatedAt) < 300000 && !s.aborted
                    return isActive
                  }).length}</span>
                  <span className="text-muted-foreground ml-1">active now</span>
                </div>
                {sessions.slice(0, 5).map((s) => {
                  const isActive = s.updatedAt && (Date.now() - s.updatedAt) < 300000 && !s.aborted
                  const statusColor = isActive ? 'text-[oklch(0.76_0.17_145)]' : s.aborted ? 'text-destructive' : 'text-muted-foreground'
                  const statusTag = isActive ? 'ACT' : s.aborted ? 'ABT' : 'IDL'
                  const modelName = s.model?.split('/').pop() || '-'
                  const timeAgo = s.updatedAt ? fmtAgo(Math.floor((Date.now() - s.updatedAt) / 1000)) : '-'
                  return (
                    <div key={s.key} className="grid grid-cols-[50px_1fr_70px_60px] gap-2.5 items-center px-3 py-1.5 border-b border-border last:border-b-0 hover:bg-accent/5 tabular-nums cursor-pointer" onClick={() => setPeekSessionKey(peekSessionKey === s.key ? null : s.key)}>
                      <span className={cn('inline-flex items-center gap-1.5 px-1.5 py-0.5 border text-[9px] tracking-[0.14em] font-semibold justify-center', statusColor)} style={{ borderColor: 'currentColor', background: `color-mix(in oklch, currentColor 8%, transparent)` }}>
                        <span className="w-[5px] h-[5px] rounded-full bg-current" />
                        {statusTag}
                      </span>
                      <div className="min-w-0">
                        <div className="text-foreground font-medium truncate">{s.label || s.key}</div>
                        {s.lastMessage && (
                          <div className="text-[10.5px] text-muted-foreground truncate">{s.lastMessage.length > 40 ? s.lastMessage.slice(0, 37) + '...' : s.lastMessage}</div>
                        )}
                      </div>
                      <span className="text-[10.5px] text-muted-foreground truncate">{modelName}</span>
                      <span className="text-[10.5px] text-muted-foreground text-right">{timeAgo}</span>
                    </div>
                  )
                })}
              </>
            )}
            <Link
              href="/sessions"
              className="w-full text-center py-2 text-[10.5px] text-accent hover:text-accent/80 font-semibold tracking-[0.12em] uppercase transition-colors border-t border-border block"
            >
              View All Sessions →
            </Link>
          </div>
        </Section>

        <Section title="CRON · SCHEDULED" meta={`${cronTasks.length} jobs`}>
          <div className="text-[11.5px]">
            {cronTasks.length === 0 && (
              <div className="px-3 py-4 text-muted-foreground">No cron jobs configured.</div>
            )}
            {cronTasks.map((cron) => (
              <div
                key={cron.id}
                className={cn(
                  'grid grid-cols-[56px_1fr_70px_60px] gap-2.5 items-center px-3 py-1.5 border-b border-border last:border-b-0 hover:bg-accent/5 tabular-nums cursor-pointer',
                  selectedCronId === cron.id && 'bg-accent/10'
                )}
                onClick={() => setSelectedCronId(cron.id === selectedCronId ? null : cron.id)}
              >
                <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 border border-[oklch(0.76_0.17_145)] text-[oklch(0.76_0.17_145)] text-[9px] tracking-[0.14em] font-semibold justify-center bg-[oklch(0.76_0.17_145_/_0.08)]">
                  <span className="w-[5px] h-[5px] rounded-full bg-current" />
                  OK
                </span>
                <span className="text-foreground font-medium truncate">{cron.name}</span>
                <span className="text-[10.5px] text-muted-foreground truncate">{fmtSchedule(cron.schedule)}</span>
                <span className="text-[10.5px] text-muted-foreground text-right">{cron.enabled ? 'on' : 'off'}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Three column: quick actions + skills + recent alerts */}
      <div className="grid grid-cols-3 gap-3">
        <Section title="QUICK ACTIONS">
          <QuickActions />
        </Section>

        <Section title="SKILLS" meta={`${useGatewayStore((s) => s.skills.length)} registered`}>
          <SkillsList onViewAll={onNavigateToSkills} />
        </Section>

        <Section title="ACTIVITY · RECENT" meta={errorCount > 0 ? `${errorCount} errors` : 'all clear'}>
          <div>
            {activityLoading && (
              <>
                {[1, 2, 3].map(i => (
                  <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-2.5 px-3 py-2.5 border-b border-border items-start animate-pulse">
                    <span className="w-2 h-2 mt-1 rounded-full bg-muted" />
                    <div className="flex-1">
                      <div className="h-3 bg-muted rounded mb-1 w-3/4" />
                      <div className="h-2.5 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </>
            )}
            {!activityLoading && activityLogs.length === 0 && (
              <div className="px-3 py-4 text-muted-foreground">No recent activity</div>
            )}
            {!activityLoading && activityLogs.slice(0, 10).map((entry) => {
              const levelColor = entry.level === 'error'
                ? 'bg-destructive shadow-[0_0_8px_var(--color-destructive)]'
                : entry.level === 'warn'
                  ? 'bg-accent'
                  : 'bg-[oklch(0.76_0.17_145)]'
              const sourceBadge = entry.source === 'cron'
                ? { label: 'CRON', color: 'text-[oklch(0.72_0.14_220)]', bg: 'bg-[oklch(0.72_0.14_220_/_0.1)]' }
                : { label: 'CONFIG', color: 'text-[oklch(0.65_0.18_300)]', bg: 'bg-[oklch(0.65_0.18_300_/_0.1)]' }
              const linkedCron = entry.source === 'cron' && entry.jobId
                ? cronTasks.find((c) => c.id === entry.jobId) ?? null
                : null
              return (
                <div
                  key={entry.id}
                  className={cn(
                    'grid grid-cols-[auto_1fr_auto] gap-2.5 px-3 py-2.5 border-b border-border last:border-b-0 items-start',
                    linkedCron && 'cursor-pointer hover:bg-accent/5',
                    linkedCron && selectedCronId === linkedCron.id && 'bg-accent/10'
                  )}
                  onClick={linkedCron ? () => setSelectedCronId(linkedCron.id === selectedCronId ? null : linkedCron.id) : undefined}
                >
                  <span className={cn('w-2 h-2 mt-1 rounded-full', levelColor)} />
                  <div className="min-w-0">
                    <div className="text-[11.5px] text-foreground leading-snug truncate" title={entry.summary}>
                      {entry.summary.length > 80 ? entry.summary.slice(0, 77) + '...' : entry.summary}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <span className={cn('px-1 py-0.5 rounded text-[9px] font-semibold', sourceBadge.color, sourceBadge.bg)}>
                        {sourceBadge.label}
                      </span>
                      <span>{fmtAgo(Math.floor((Date.now() - entry.ts) / 1000))} ago</span>
                    </div>
                  </div>
                </div>
              )
            })}
            {!activityLoading && activityLogs.length > 0 && (
              <button
                onClick={() => router.push('/activity')}
                className="w-full text-center py-2 text-[10.5px] text-accent hover:text-accent/80 font-semibold tracking-[0.12em] uppercase transition-colors"
              >
                View Activity Console →
              </button>
            )}
          </div>
        </Section>
      </div>
    </div>
  )
}
