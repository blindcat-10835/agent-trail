'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useToolSessions, useAggregateSessions, useAgentTool } from '@/lib/agent-tools/client-hooks'
import { useStarredStore } from '@/stores/starred-store'
import { shortPath, projectColor } from '@/lib/utils'
import type { TraceSession } from '@/types/trace'
import type { AgentToolId } from '@/lib/agent-tools/types'

const SOURCE_META: Record<string, { short_text: string; color: string }> = {
  'openclaw':    { short_text: 'OpenClaw', color: 'oklch(0.80 0.17 75)' },
  'claude-code': { short_text: 'Claude',   color: 'oklch(0.78 0.15 35)' },
  'codex':       { short_text: 'Codex',    color: 'oklch(0.78 0.10 250)' },
}

const STATUS_COLORS: Record<string, string> = {
  LIVE: 'var(--status-success)',
  IDLE: 'var(--muted-foreground)',
  ERROR: 'var(--destructive)',
  TRUNCATED: 'var(--status-parser-warning)',
}

const STATUSES = ['ALL', 'LIVE', 'IDLE', 'ERROR', 'TRUNCATED'] as const
const SOURCE_IDS = ['openclaw', 'claude-code', 'codex'] as const

const STATUS_QUERY: Partial<Record<(typeof STATUSES)[number], string>> = {
  LIVE: 'active',
  IDLE: 'idle',
  ERROR: 'error',
  TRUNCATED: 'truncated',
}

const SORT_QUERY: Record<string, string> = {
  updated: 'updated_at',
  title: 'title',
  project: 'project',
  cost: 'cost',
  turns: 'turns',
  tokens: 'tokens',
  tools: 'activity',
}

function deriveStatus(s: TraceSession): string {
  if (s.status === 'error' || s.status === 'aborted') return 'ERROR'
  if (s.metrics.isTruncated) return 'TRUNCATED'
  if (s.status === 'active') return 'LIVE'
  return 'IDLE'
}

function fmtTok(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

function fmtDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function getSourceColor(source: string): string {
  return SOURCE_META[source]?.color || 'var(--muted-foreground)'
}

function StatusCell({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || 'var(--muted-foreground)'
  const pulse = status === 'LIVE'
  return (
    <span className="sl-status" style={{ color: c }}>
      {pulse
        ? <span className="sl-pulse" style={{ background: c }} />
        : <span className="sl-dot" style={{ background: c }} />}
      {status}
    </span>
  )
}

function SourceBadge({ source }: { source: string }) {
  const m = SOURCE_META[source]
  if (!m) return null
  return (
    <span className="src-badge" style={{ '--src-c': m.color } as React.CSSProperties}>
      <span className="src-badge-label">{m.short_text}</span>
    </span>
  )
}

function ActivityChips({ tools, subagents }: { tools: number; subagents: number }) {
  return (
    <span className="act-chips">
      <span className="act-chip" title={`${tools} tool calls`}>
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
        <span className="mono">{tools}</span>
      </span>
      {subagents > 0 && (
        <span className="act-chip act-chip-agent" title={`${subagents} subagent calls`}>
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="7" width="18" height="13" rx="2"/>
            <circle cx="9" cy="13" r="1" fill="currentColor"/>
            <circle cx="15" cy="13" r="1" fill="currentColor"/>
            <path d="M12 7V4"/>
          </svg>
          <span className="mono">{subagents}</span>
        </span>
      )}
    </span>
  )
}


export function SessionsListPage() {
  const router = useRouter()
  const { toolId, href } = useAgentTool()
  const isAll = toolId === 'all'

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [projectFilter, setProjectFilter] = useState<string>('ALL')
  const [sort, setSort] = useState<string>('updated')
  const [sourceFilter, setSourceFilter] = useState<string>('ALL')
  const [starredOnly, setStarredOnly] = useState(false)

  const isStarred = useStarredStore((s) => s.isStarred)

  const query = useMemo(() => {
    const next: Record<string, string> = {
      limit: '100',
      sort: SORT_QUERY[sort] ?? 'updated_at',
      order: 'desc',
    }

    const trimmedQuery = q.trim()
    if (trimmedQuery) next.q = trimmedQuery
    if (statusFilter !== 'ALL') next.status = STATUS_QUERY[statusFilter as keyof typeof STATUS_QUERY] ?? statusFilter.toLowerCase()
    if (projectFilter !== 'ALL') next.project = projectFilter
    if (starredOnly) next.starred = 'true'
    return next
  }, [q, projectFilter, sort, starredOnly, statusFilter])

  const effectiveToolId = (isAll ? 'openclaw' : toolId) as AgentToolId
  const toolResult = useToolSessions(effectiveToolId, query, { enabled: !isAll })
  const aggResult = useAggregateSessions(query, { enabled: isAll })

  const rawSessions = isAll ? aggResult.sessions : toolResult.sessions
  const filtered = useMemo(
    () => sourceFilter === 'ALL' ? rawSessions : rawSessions.filter((s) => s.source === sourceFilter),
    [rawSessions, sourceFilter],
  )
  const paginationTotal = isAll ? aggResult.totalCount : toolResult.pagination?.total
  const loading = isAll ? aggResult.loading : toolResult.loading
  const error = isAll ? aggResult.error : toolResult.error
  const refetch = isAll ? aggResult.refetch : toolResult.refetch
  const hasMore = isAll ? aggResult.hasMore : (toolResult.pagination?.hasMore ?? false)
  const isLoadingMore = isAll ? aggResult.isLoadingMore : toolResult.isLoadingMore
  const loadMore = isAll ? aggResult.loadMore : toolResult.loadMore
  const groupCounts = isAll ? aggResult.groupCounts : toolResult.groupCounts

  const totals = useMemo(() => ({
    count: sourceFilter === 'ALL' ? (paginationTotal ?? filtered.length) : filtered.length,
    turns: filtered.reduce((a, s) => a + (s.totalTurns ?? s.metrics.userMessageCount), 0),
    tok: filtered.reduce((a, s) => a + (s.metrics.totalTokens ?? (s.metrics.inputTokens ?? 0) + (s.metrics.outputTokens ?? 0)), 0),
    cost: filtered.reduce((a, s) => a + (s.estimatedCost ?? 0), 0),
  }), [filtered, paginationTotal, sourceFilter])

  const projects = useMemo(
    () => {
      const labels = groupCounts?.project?.map((item) => item.label).filter((label) => label !== '-') ?? []
      if (labels.length > 0) return labels.sort()
      return Array.from(new Set(rawSessions.map((s) => s.project))).sort()
    },
    [groupCounts, rawSessions]
  )

  if (loading && rawSessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="sl-root">
        <div className="sl-empty" style={{ paddingTop: 80 }}>
          <div className="sl-empty-title">INGEST UNREACHABLE</div>
          <div className="sl-empty-body">Ensure the ingest service is running on port 8078.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="sl-root">
      {/* HUD HEADER */}
      <div className="sl-hud">
        <div className="sl-hud-left">
          <h1 className="sl-title">Sessions</h1>
          <div className="sl-subline mono">
            {totals.count} sessions {'·'} {totals.turns} turns {'·'} {fmtTok(totals.tok)} tok
            {totals.cost > 0 && <> {'·'} <span className="accent">${totals.cost.toFixed(2)}</span></>}
          </div>
        </div>
        <div className="sl-hud-right">
          <button className="sl-newscan" onClick={() => refetch()}>
            {'↻'} RESCAN
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="sl-bar">
        <div className="sl-search">
          <span className="sl-search-icon">{'⌕'}</span>
          <input
            className="sl-search-input"
            placeholder="Search by label · project · id"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="sl-chip-group">
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`sl-chip ${statusFilter === s ? 'active' : ''}`}
              style={s !== 'ALL' ? { '--c': STATUS_COLORS[s] } as React.CSSProperties : undefined}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
          <button
            className={`sl-chip ${starredOnly ? 'active' : ''}`}
            style={{ '--c': 'var(--accent)' } as React.CSSProperties}
            onClick={() => setStarredOnly((value) => !value)}
          >
            STARRED
          </button>
        </div>
        <select className="sl-select" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="ALL">PROJECT {'·'} ALL</option>
          {projects.map((p) => (
            <option key={p} value={p}>{p.toUpperCase()}</option>
          ))}
        </select>
        <select className="sl-select" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="updated">SORT {'·'} UPDATED</option>
          <option value="title">SORT {'·'} TITLE</option>
          <option value="project">SORT {'·'} PROJECT</option>
          <option value="cost">SORT {'·'} COST</option>
          <option value="turns">SORT {'·'} TURNS</option>
          <option value="tokens">SORT {'·'} TOKENS</option>
          <option value="tools">SORT {'·'} ACTIVITY</option>
        </select>
        {isAll && (
          <select className="sl-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="ALL">SOURCE {'·'} ALL</option>
            {SOURCE_IDS.map((source) => (
              <option key={source} value={source}>{SOURCE_META[source].short_text.toUpperCase()}</option>
            ))}
          </select>
        )}
      </div>

      {/* TABLE HEADER */}
      <div className="sl-thead">
        <span className="sl-th sl-th-proj" />
        <span className="sl-th">TITLE / SUMMARY</span>
        <span className="sl-th">STATUS</span>
        <span className="sl-th">PROJECT</span>
        <span className="sl-th">MODEL</span>
        <span className="sl-th">TOOL</span>
        <span className="sl-th sl-th-num">TURNS</span>
        <span className="sl-th">ACTIVITY</span>
        <span className="sl-th sl-th-num">TOKENS I/O</span>
        <span className="sl-th sl-th-num">DUR</span>
        <span className="sl-th sl-th-num">COST</span>
        <span className="sl-th sl-th-num">UPDATED</span>
      </div>

      {/* ROWS */}
      <div className="sl-rows">
        {filtered.length === 0 ? (
          <div className="sl-empty">
            <div className="sl-empty-title">NO MATCH</div>
            <div className="sl-empty-body">Try clearing the search or status filter.</div>
          </div>
        ) : (
          filtered.map((s) => {
            const pc = projectColor(s.project)
            const srcC = getSourceColor(s.source)
            const status = deriveStatus(s)
            const inputTokens = s.metrics.inputTokens ?? s.inputTokens ?? 0
            const outputTokens = s.metrics.outputTokens ?? s.outputTokens ?? 0
            const turns = s.totalTurns ?? s.metrics.userMessageCount
            const cost = s.estimatedCost != null ? `$${s.estimatedCost.toFixed(2)}` : '—'
            const label = s.displayTitle || s.name || s.id
            const toolCount = s.activityCounts?.toolCalls ?? 0
            const subagentCount = s.activityCounts?.subagents ?? 0
            const summary = s.summary || s.gitBranch || s.id
            const model = s.model || '—'

            return (
              <button
                key={s.id}
                className={`sl-row ${status === 'ERROR' ? 'err' : ''}`}
                style={{ '--src-c': srcC, '--proj-c': pc } as React.CSSProperties}
                onClick={() => router.push(href('/sessions/' + s.id))}
              >
                <span className="sl-proj-rail" />
                <span className="sl-cell sl-cell-label">
                  <span className="sl-label-row">
                    {isStarred(s.id) && <span className="sl-star">{'★'}</span>}
                    <span className="sl-label">{label}</span>
                  </span>
                  <span className="sl-summary">{summary}</span>
                  <span className="sl-id mono">
                    {s.id}
                    {s.gitBranch && <span className="sl-branch"> {'⎇'} {s.gitBranch}</span>}
                  </span>
                </span>
                <span className="sl-cell">
                  <StatusCell status={status} />
                </span>
                <span className="sl-cell sl-cell-proj">
                  <span className="sl-proj-tag mono">
                    <span className="sl-proj-dot" style={{ background: pc }} />
                    <span className="sl-proj-name">{shortPath(s.project)}</span>
                  </span>
                </span>
                <span className="sl-cell sl-model mono" title={model}>{model}</span>
                <span className="sl-cell">
                  <SourceBadge source={s.source} />
                </span>
                <span className="sl-cell mono sl-num">{turns}</span>
                <span className="sl-cell">
                  <ActivityChips tools={toolCount} subagents={subagentCount} />
                </span>
                <span className="sl-cell sl-cell-tok">
                  <span className="mono sl-num">{fmtTok(inputTokens)}</span>
                  <span className="mono sl-num sl-token-out">/{fmtTok(outputTokens)}</span>
                </span>
                <span className="sl-cell mono sl-num">{fmtDuration(s.durationMs)}</span>
                <span className="sl-cell mono sl-num sl-cost">{cost}</span>
                <span className="sl-cell mono sl-num sl-updated">{relativeTime(s.updatedAt || s.startedAt)}</span>
              </button>
            )
          })
        )}
        {hasMore && filtered.length > 0 && (
          <div className="sl-load-more">
            <button className="sl-newscan" onClick={() => loadMore()} disabled={isLoadingMore}>
              {isLoadingMore ? 'LOADING…' : 'LOAD MORE'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
