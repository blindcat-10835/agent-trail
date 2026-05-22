'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { SessionsFilterPanel, type SessionsFilterState } from './sessions-filter-panel'
import { useRouter } from 'next/navigation'
import {
  useAgentTool,
  useAggregateSessions,
  useToolSessions,
  DEFAULT_SESSIONS_RAIL_QUERY,
  notifySessionsRefresh,
  syncToolSessions,
  syncAllSessions,
} from '@/lib/agent-tools/client-hooks'
import { useToolStore } from '@/stores/tool-store'
import { useStarredStore } from '@/stores/starred-store'
import { useUIStore } from '@/stores/ui-store'
import { getSourceColor, getSourceName } from '@/lib/agent-tools/registry'
import { formatSessionCost } from '@/lib/session-cost'
import { shortPath, projectColor } from '@/lib/utils'
import { SessionIdCopyButton } from '@/components/ui/session-id-copy-button'
import type { SourceToolId } from '@/lib/agent-tools/types'
import type { TraceSession } from '@/types/trace'

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}mo`
}

const RR_STATUS: Record<string, string> = {
  LIVE:      'var(--status-success)',
  IDLE:      'var(--muted-foreground)',
  ERROR:     'var(--destructive)',
  TRUNCATED: 'var(--status-parser-warning)',
}

function deriveDisplayStatus(s: TraceSession): string {
  if (s.status === 'error' || s.status === 'aborted') return 'ERROR'
  if (s.metrics.isTruncated) return 'TRUNCATED'
  if (s.status === 'active') return 'LIVE'
  return 'IDLE'
}

interface SessionsRightRailProps {
  selectedSessionId: string | null
  onClearSelection: () => void
}

export function SessionsRightRail({
  selectedSessionId,
  onClearSelection,
}: SessionsRightRailProps) {
  const { toolId } = useAgentTool()

  if (toolId === 'all') {
    return (
      <AggregateSessionsRightRail
        selectedSessionId={selectedSessionId}
        onClearSelection={onClearSelection}
      />
    )
  }

  return (
    <SourceSessionsRightRail
      selectedSessionId={selectedSessionId}
      onClearSelection={onClearSelection}
      sourceToolId={toolId}
    />
  )
}

function AggregateSessionsRightRail({
  selectedSessionId,
}: SessionsRightRailProps) {
  const { href } = useAgentTool()
  const router = useRouter()
  const setSelectedSessionId = useToolStore((s) => s.setSelectedSessionId)
  const { sessions, totalCount, loading, error, hasMore, isLoadingMore, loadMore } = useAggregateSessions(DEFAULT_SESSIONS_RAIL_QUERY)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  async function handleRefresh() {
    if (syncing) return
    setSyncing(true)
    setSyncError(null)
    try {
      await syncAllSessions()
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
      notifySessionsRefresh()
    }
  }

  function handleSelect(session: TraceSession) {
    setSelectedSessionId(session.id)
    router.push(href(`/sessions/${session.id}`))
  }

  return (
    <SessionsRailContent
      sessions={sessions}
      loading={loading || syncing}
      error={syncError ?? error}
      total={totalCount}
      selectedSessionId={selectedSessionId}
      onRefresh={handleRefresh}
      onSelect={handleSelect}
      syncing={syncing}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      loadMore={loadMore}
    />
  )
}

function SourceSessionsRightRail({
  selectedSessionId,
  sourceToolId,
}: SessionsRightRailProps & { sourceToolId: SourceToolId }) {
  const { href } = useAgentTool()
  const router = useRouter()
  const setSelectedSessionId = useToolStore((s) => s.setSelectedSessionId)
  const { sessions, pagination, loading, error, isLoadingMore, loadMore, refetch } = useToolSessions(
    sourceToolId,
    DEFAULT_SESSIONS_RAIL_QUERY,
  )
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  async function handleRefresh() {
    if (syncing) return
    setSyncing(true)
    setSyncError(null)
    try {
      await syncToolSessions(sourceToolId)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
      refetch()
    }
  }

  function handleSelect(session: TraceSession) {
    setSelectedSessionId(session.id)
    router.push(href(`/sessions/${session.id}`))
  }

  return (
    <SessionsRailContent
      sessions={sessions}
      loading={loading || syncing}
      error={syncError ?? error}
      total={pagination?.total}
      selectedSessionId={selectedSessionId}
      onRefresh={handleRefresh}
      onSelect={handleSelect}
      syncing={syncing}
      hasMore={pagination?.hasMore ?? false}
      isLoadingMore={isLoadingMore}
      loadMore={loadMore}
    />
  )
}

function SessionsRailContent({
  sessions,
  loading,
  error,
  total,
  selectedSessionId,
  onRefresh,
  onSelect,
  syncing,
  hasMore,
  isLoadingMore,
  loadMore,
}: {
  sessions: TraceSession[]
  loading: boolean
  error: string | null
  total: number | undefined
  selectedSessionId: string | null
  onRefresh: () => void
  onSelect: (session: TraceSession) => void
  syncing?: boolean
  hasMore?: boolean
  isLoadingMore?: boolean
  loadMore?: () => void
}) {
  const railScope = useUIStore((s) => s.railScope)
  const setRailScope = useUIStore((s) => s.setRailScope)
  const setRightRailOpen = useUIStore((s) => s.setRightRailOpen)
  const starredIds = useStarredStore((s) => s.ids)
  const starredIsStarred = useStarredStore((s) => s.isStarred)
  const starredToggle = useStarredStore((s) => s.toggle)

  const [filterState, setFilterState] = useState<SessionsFilterState>({
    groupByProject: false,
    dateRangeActive: false,
    dateFrom: '',
    dateTo: '',
  })
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  const filteredSessions = useMemo(() => {
    let result = sessions
    if (railScope === 'starred') result = result.filter((s) => starredIds.has(s.id))
    else if (railScope === 'live') result = result.filter((s) => s.status === 'active')
    if (filterState.dateRangeActive && filterState.dateFrom) {
      const from = new Date(filterState.dateFrom).getTime()
      result = result.filter((s) => s.startedAt ? new Date(s.startedAt).getTime() >= from : false)
    }
    if (filterState.dateRangeActive && filterState.dateTo) {
      const to = new Date(filterState.dateTo).getTime() + 86400000 - 1
      result = result.filter((s) => s.startedAt ? new Date(s.startedAt).getTime() <= to : false)
    }
    return result
  }, [sessions, railScope, starredIds, filterState])

  const groupedByProject = useMemo(() => {
    if (!filterState.groupByProject) return null
    const map: Record<string, TraceSession[]> = {}
    for (const s of filteredSessions) {
      const key = s.project || '-'
      if (!map[key]) map[key] = []
      map[key].push(s)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredSessions, filterState.groupByProject])

  const liveCount = useMemo(
    () => sessions.filter((s) => s.status === 'active').length,
    [sessions]
  )
  const starredCount = useMemo(
    () => sessions.filter((s) => starredIds.has(s.id)).length,
    [sessions, starredIds]
  )

  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loadMore || !hasMore || isLoadingMore) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore() },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore, hasMore, isLoadingMore])

  return (
    <>
      {/* HEADER */}
      <header className="rr-head">
        <div className="rr-head-row">
          <span className="eyebrow accent">◆ SESSIONS</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <SessionsFilterPanel
              state={filterState}
              onGroupByProjectToggle={() => {
                setFilterState(p => ({ ...p, groupByProject: !p.groupByProject }))
                setExpandedProjects(new Set())
              }}
              onDateRangeToggle={() => {
                setFilterState(p => ({
                  ...p,
                  dateRangeActive: !p.dateRangeActive,
                  dateFrom: p.dateRangeActive ? '' : p.dateFrom,
                  dateTo: p.dateRangeActive ? '' : p.dateTo,
                }))
              }}
              onDateFromChange={(date) => setFilterState(p => ({ ...p, dateFrom: date }))}
              onDateToChange={(date) => setFilterState(p => ({ ...p, dateTo: date }))}
              onClearAll={() => {
                setFilterState({ groupByProject: false, dateRangeActive: false, dateFrom: '', dateTo: '' })
                setExpandedProjects(new Set())
              }}
            />
            <button
              className="rr-close"
              onClick={onRefresh}
              disabled={syncing}
              title={syncing ? 'Syncing…' : 'Refresh sessions'}
              aria-label={syncing ? 'Syncing…' : 'Refresh sessions'}
            >
              <RefreshCw style={{ width: 11, height: 11 }} className={syncing ? 'animate-spin' : ''} />
            </button>
            <button
              className="rr-close"
              onClick={() => setRightRailOpen(false)}
              title="Hide rail"
              aria-label="Hide rail"
            >
              »
            </button>
          </div>
        </div>
        <div className="rr-tabs">
          <button
            className={`rr-tab ${railScope === 'recent' ? 'active' : ''}`}
            onClick={() => setRailScope('recent')}
          >
            RECENT<span className="rr-count">{total ?? sessions.length}</span>
          </button>
          <button
            className={`rr-tab ${railScope === 'starred' ? 'active' : ''}`}
            onClick={() => setRailScope('starred')}
          >
            ★<span className="rr-count">{starredCount}</span>
          </button>
          <button
            className={`rr-tab ${railScope === 'live' ? 'active' : ''}`}
            onClick={() => setRailScope('live')}
          >
            <span className="rr-livedot" />
            LIVE<span className="rr-count">{liveCount}</span>
          </button>
        </div>
      </header>

      {/* SCROLL AREA */}
      <div className="rr-scroll">
        {loading && sessions.length === 0 ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 120 }}>
            <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-accent" />
          </div>
        ) : error ? (
          <div className="rr-empty">
            <div className="rr-empty-tag">ERR</div>
            <div className="rr-empty-body">{error}</div>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="rr-empty">
            <div className="rr-empty-tag">EMPTY</div>
            <div className="rr-empty-body">No sessions match this filter.</div>
          </div>
        ) : groupedByProject ? (
          groupedByProject.map(([project, projectSessions]) => {
            const pc = projectColor(project)
            const isOpen = expandedProjects.has(project)
            return (
              <div key={project}>
                <button
                  type="button"
                  className="rr-group-header"
                  onClick={() => setExpandedProjects(prev => {
                    const next = new Set(prev)
                    if (next.has(project)) next.delete(project)
                    else next.add(project)
                    return next
                  })}
                >
                  <svg
                    className={`rr-group-chevron${isOpen ? ' rr-group-chevron--open' : ''}`}
                    width="9" height="9" viewBox="0 0 16 16" fill="currentColor"
                  >
                    <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"/>
                  </svg>
                  <span className="rr-group-dot" style={{ background: pc }} />
                  <span className="rr-group-name">{shortPath(project)}</span>
                  <span className="rr-group-count">{projectSessions.length}</span>
                </button>
                {isOpen && projectSessions.map((session, index) => (
                  <SessionRailRow
                    key={session.id || `${session.source}-${index}`}
                    session={session}
                    active={selectedSessionId === session.id}
                    onSelect={() => onSelect(session)}
                    isStarred={starredIsStarred(session.id)}
                    onToggleStar={() => starredToggle(session.id)}
                  />
                ))}
              </div>
            )
          })
        ) : (
          filteredSessions.map((session, index) => (
            <SessionRailRow
              key={session.id || `${session.source}-${index}`}
              session={session}
              active={selectedSessionId === session.id}
              onSelect={() => onSelect(session)}
              isStarred={starredIsStarred(session.id)}
              onToggleStar={() => starredToggle(session.id)}
            />
          ))
        )}
        {isLoadingMore && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-accent" />
          </div>
        )}
        <div ref={sentinelRef} style={{ height: 1 }} />
      </div>
    </>
  )
}

function SessionRailRow({
  session,
  active,
  onSelect,
  isStarred,
  onToggleStar,
}: {
  session: TraceSession
  active: boolean
  onSelect: () => void
  isStarred: boolean
  onToggleStar: () => void
}) {
  const visibleSessionId = session.sourceSessionId ?? session.id
  const pc = projectColor(session.project)
  const displayStatus = deriveDisplayStatus(session)
  const sc = RR_STATUS[displayStatus] || 'var(--muted-foreground)'
  const srcC = getSourceColor(session.source)
  const srcName = getSourceName(session.source)

  return (
    <div
      role="button"
      tabIndex={0}
      className={`rr-item${active ? ' active' : ''}${displayStatus === 'ERROR' ? ' err' : ''}`}
      style={{ '--src-c': srcC, '--proj-c': pc } as React.CSSProperties}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
    >
      <span className="rr-spine" />
      <div className="rr-body">
        <div className="rr-line1">
          <span className="rr-proj-dot" style={{ background: pc }} />
          <span className="rr-proj mono">{shortPath(session.project) || '—'}</span>
          <span className="rr-status" style={{ color: sc }}>
            {displayStatus === 'LIVE'
              ? <span className="rr-pulse" style={{ background: sc }} />
              : displayStatus === 'ERROR'
                ? '✕'
                : displayStatus === 'TRUNCATED'
                  ? '⚠'
                  : null}
          </span>
          <button
            type="button"
            className={`rr-star-toggle${isStarred ? ' active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleStar() }}
            aria-label={isStarred ? 'Unstar session' : 'Star session'}
            title={isStarred ? 'Unstar session' : 'Star session'}
          >
            ★
          </button>
        </div>
        <div className="rr-label">{session.displayTitle || session.name || visibleSessionId}</div>
        <div className="rr-line2 mono">
          <SessionIdCopyButton
            sessionId={session.id}
            displaySessionId={visibleSessionId}
            copySessionId={visibleSessionId}
            displayMode="tail8"
            className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          />
          {session.estimatedCost != null && (
            <>
              <span className="rr-sep">·</span>
              <span className="rr-cost">{formatSessionCost(session)}</span>
            </>
          )}
        </div>
        {relativeTime(session.updatedAt || session.startedAt) && (
          <span className="rr-updated mono">{relativeTime(session.updatedAt || session.startedAt)}</span>
        )}
        {srcName && (
          <span className="rr-src-corner mono" title={srcName}>
            {srcName}
          </span>
        )}
      </div>
    </div>
  )
}
