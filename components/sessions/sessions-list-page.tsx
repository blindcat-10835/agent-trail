'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToolSessions, useAggregateSessions, useAgentTool } from '@/lib/agent-tools/client-hooks'
import { getSourceColor, getSourceName } from '@/lib/agent-tools/registry'
import { useStarredStore } from '@/stores/starred-store'
import { shortPath, projectColor } from '@/lib/utils'
import type { TraceSession } from '@/types/trace'
import type { AgentToolId } from '@/lib/agent-tools/types'
import { SessionsFilterPanel, type SessionsFilterState } from './sessions-filter-panel'

const STATUS_COLORS: Record<string, string> = {
  LIVE: 'var(--status-success)',
  IDLE: 'var(--muted-foreground)',
  ERROR: 'var(--destructive)',
  TRUNCATED: 'var(--status-parser-warning)',
}

const STATUSES = ['ALL', 'LIVE', 'IDLE', 'ERROR', 'TRUNCATED'] as const
const SOURCE_IDS = ['openclaw', 'claude-code', 'codex', 'opencode'] as const

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
  return (
    <span className="src-badge" style={{ '--src-c': getSourceColor(source) } as React.CSSProperties}>
      <span className="src-badge-label">{getSourceName(source)}</span>
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


function SessionRow({
  s,
  openSession,
  isStarred,
  toggleStar,
}: {
  s: TraceSession
  openSession: (id: string) => void
  isStarred: (id: string) => boolean
  toggleStar: (id: string) => void
}) {
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
  const starred = isStarred(s.id)

  return (
    <div
      role="button"
      tabIndex={0}
      className={`sl-row ${status === 'ERROR' ? 'err' : ''}`}
      style={{ '--src-c': srcC, '--proj-c': pc } as React.CSSProperties}
      onClick={() => openSession(s.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSession(s.id) }
      }}
    >
      <span className="sl-proj-rail" />
      <span className="sl-cell sl-cell-label">
        <span className="sl-label-row">
          <button
            type="button"
            className={`sl-star-toggle${starred ? ' active' : ''}`}
            aria-label={starred ? 'Unstar session' : 'Star session'}
            title={starred ? 'Unstar session' : 'Star session'}
            onClick={(e) => { e.stopPropagation(); toggleStar(s.id) }}
          >★</button>
          <span className="sl-label">{label}</span>
        </span>
        <span className="sl-summary">{summary}</span>
        <span className="sl-id mono">
          {s.id}
          {s.gitBranch && <span className="sl-branch"> {'⎇'} {s.gitBranch}</span>}
        </span>
      </span>
      <span className="sl-cell"><StatusCell status={status} /></span>
      <span className="sl-cell sl-cell-proj">
        <span className="sl-proj-tag mono">
          <span className="sl-proj-dot" style={{ background: pc }} />
          <span className="sl-proj-name">{shortPath(s.project)}</span>
        </span>
      </span>
      <span className="sl-cell sl-model mono" title={model}>{model}</span>
      <span className="sl-cell"><SourceBadge source={s.source} /></span>
      <span className="sl-cell mono sl-num">{turns}</span>
      <span className="sl-cell"><ActivityChips tools={toolCount} subagents={subagentCount} /></span>
      <span className="sl-cell sl-cell-tok">
        <span className="mono sl-num">{fmtTok(inputTokens)}</span>
        <span className="mono sl-num sl-token-out">/{fmtTok(outputTokens)}</span>
      </span>
      <span className="sl-cell mono sl-num">{fmtDuration(s.durationMs)}</span>
      <span className="sl-cell mono sl-num sl-cost">{cost}</span>
      <span className="sl-cell mono sl-num sl-updated">{relativeTime(s.updatedAt || s.startedAt)}</span>
    </div>
  )
}

export function SessionsListPage() {
  const router = useRouter()
  const { toolId, href } = useAgentTool()
  const isAll = toolId === 'all'

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [sort, setSort] = useState<string>('updated')
  const [sourceFilter, setSourceFilter] = useState<string>('ALL')
  const [starredOnly, setStarredOnly] = useState(false)
  const [groupByProject, setGroupByProject] = useState(false)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [dateRangeActive, setDateRangeActive] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Collapse all groups when groupByProject is turned off
  useEffect(() => {
    if (!groupByProject) setExpandedProjects(new Set())
  }, [groupByProject])

  const isStarred = useStarredStore((s) => s.isStarred)
  const toggleStar = useStarredStore((s) => s.toggle)

  const query = useMemo(() => {
    const next: Record<string, string> = {
      limit: '100',
      sort: SORT_QUERY[sort] ?? 'updated_at',
      order: 'desc',
    }

    const trimmedQuery = q.trim()
    if (trimmedQuery) next.q = trimmedQuery
    if (statusFilter !== 'ALL') next.status = STATUS_QUERY[statusFilter as keyof typeof STATUS_QUERY] ?? statusFilter.toLowerCase()
    if (starredOnly) next.starred = 'true'
    return next
  }, [q, sort, starredOnly, statusFilter])

  const effectiveToolId = (isAll ? 'openclaw' : toolId) as AgentToolId
  const toolResult = useToolSessions(effectiveToolId, query, { enabled: !isAll })
  const aggResult = useAggregateSessions(query, { enabled: isAll })

  const rawSessions = isAll ? aggResult.sessions : toolResult.sessions
  const filtered = useMemo(() => {
    let result = rawSessions
    if (sourceFilter !== 'ALL') result = result.filter((s) => s.source === sourceFilter)
    if (dateRangeActive && dateFrom) {
      const from = new Date(dateFrom).getTime()
      result = result.filter((s) => {
        const t = s.startedAt ? new Date(s.startedAt).getTime() : null
        return t != null && t >= from
      })
    }
    if (dateRangeActive && dateTo) {
      const to = new Date(dateTo).getTime() + 86400000 - 1
      result = result.filter((s) => {
        const t = s.startedAt ? new Date(s.startedAt).getTime() : null
        return t != null && t <= to
      })
    }
    return result
  }, [rawSessions, sourceFilter, dateRangeActive, dateFrom, dateTo])
  const paginationTotal = isAll ? aggResult.totalCount : toolResult.pagination?.total
  const loading = isAll ? aggResult.loading : toolResult.loading
  const error = isAll ? aggResult.error : toolResult.error
  const refetch = isAll ? aggResult.refetch : toolResult.refetch
  const hasMore = isAll ? aggResult.hasMore : (toolResult.pagination?.hasMore ?? false)
  const isLoadingMore = isAll ? aggResult.isLoadingMore : toolResult.isLoadingMore
  const loadMore = isAll ? aggResult.loadMore : toolResult.loadMore
  const groupCounts = isAll ? aggResult.groupCounts : toolResult.groupCounts

  function openSession(sessionId: string) {
    router.push(href('/sessions/' + sessionId))
  }

  const totals = useMemo(() => ({
    count: sourceFilter === 'ALL' ? (paginationTotal ?? filtered.length) : filtered.length,
    turns: filtered.reduce((a, s) => a + (s.totalTurns ?? s.metrics.userMessageCount), 0),
    tok: filtered.reduce((a, s) => a + (s.metrics.totalTokens ?? (s.metrics.inputTokens ?? 0) + (s.metrics.outputTokens ?? 0)), 0),
    cost: filtered.reduce((a, s) => a + (s.estimatedCost ?? 0), 0),
  }), [filtered, paginationTotal, sourceFilter])

  // Group sessions by project when groupByProject is active
  const groupedByProject = useMemo(() => {
    if (!groupByProject) return null
    const map: Record<string, TraceSession[]> = {}
    for (const s of filtered) {
      const key = s.project || '-'
      if (!map[key]) map[key] = []
      map[key].push(s)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered, groupByProject])

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
          <SessionsFilterPanel
            state={{ groupByProject, dateRangeActive, dateFrom, dateTo }}
            onGroupByProjectToggle={() => setGroupByProject(p => !p)}
            onDateRangeToggle={() => {
              if (dateRangeActive) { setDateFrom(''); setDateTo('') }
              setDateRangeActive(p => !p)
            }}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onClearAll={() => {
              setGroupByProject(false)
              setDateRangeActive(false)
              setDateFrom('')
              setDateTo('')
            }}
          />
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
              <option key={source} value={source}>{getSourceName(source).toUpperCase()}</option>
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
        ) : groupedByProject ? (
          groupedByProject.map(([project, sessions]) => {
            const pc = projectColor(project)
            const isOpen = expandedProjects.has(project)
            return (
              <div key={project}>
                <button
                  type="button"
                  className="sl-group-header"
                  onClick={() => setExpandedProjects(prev => {
                    const next = new Set(prev)
                    if (next.has(project)) next.delete(project)
                    else next.add(project)
                    return next
                  })}
                >
                  <svg
                    className={`sl-group-chevron${isOpen ? ' sl-group-chevron--open' : ''}`}
                    width="10" height="10" viewBox="0 0 16 16" fill="currentColor"
                  >
                    <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"/>
                  </svg>
                  <span className="sl-group-proj-dot" style={{ background: pc }} />
                  <span className="sl-group-name">{shortPath(project)}</span>
                  <span className="sl-group-count">{sessions.length}</span>
                </button>
                {isOpen && sessions.map((s) => <SessionRow key={s.id} s={s} openSession={openSession} isStarred={isStarred} toggleStar={toggleStar} />)}
              </div>
            )
          })
        ) : (
          filtered.map((s) => <SessionRow key={s.id} s={s} openSession={openSession} isStarred={isStarred} toggleStar={toggleStar} />)
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
