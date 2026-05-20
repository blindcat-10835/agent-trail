'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  useAgentTool,
  useAggregateSessions,
  useToolSessions,
  notifySessionsRefresh,
  syncToolSessions,
  syncAllSessions,
} from '@/lib/agent-tools/client-hooks'
import { useToolStore } from '@/stores/tool-store'
import { useStarredStore } from '@/stores/starred-store'
import { useUIStore } from '@/stores/ui-store'
import { getSourceColor, getSourceName } from '@/lib/agent-tools/registry'
import { shortPath, projectColor } from '@/lib/utils'
import type { AgentToolId, SourceToolId } from '@/lib/agent-tools/types'
import type { TraceSession } from '@/types/trace'

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
  onClearSelection,
}: SessionsRightRailProps) {
  const { href } = useAgentTool()
  const router = useRouter()
  const setSelectedSessionId = useToolStore((s) => s.setSelectedSessionId)
  const { sessions, totalCount, loading, error, hasMore, isLoadingMore, loadMore } = useAggregateSessions({ limit: '100' })
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
      onClearSelection={onClearSelection}
      onRefresh={handleRefresh}
      onSelect={handleSelect}
      currentToolId="all"
      syncing={syncing}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      loadMore={loadMore}
    />
  )
}

function SourceSessionsRightRail({
  selectedSessionId,
  onClearSelection,
  sourceToolId,
}: SessionsRightRailProps & { sourceToolId: SourceToolId }) {
  const { href } = useAgentTool()
  const router = useRouter()
  const setSelectedSessionId = useToolStore((s) => s.setSelectedSessionId)
  const { sessions, pagination, loading, error, isLoadingMore, loadMore, refetch } = useToolSessions(
    sourceToolId,
    { limit: '100', sort: 'updated_at', order: 'desc' },
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
      onClearSelection={onClearSelection}
      onRefresh={handleRefresh}
      onSelect={handleSelect}
      currentToolId={sourceToolId}
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
  onClearSelection,
  onRefresh,
  onSelect,
  currentToolId,
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
  onClearSelection: () => void
  onRefresh: () => void
  onSelect: (session: TraceSession) => void
  currentToolId: AgentToolId
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

  const filteredSessions = useMemo(() => {
    if (railScope === 'starred') return sessions.filter((s) => starredIds.has(s.id))
    if (railScope === 'live') return sessions.filter((s) => s.status === 'active')
    return sessions
  }, [sessions, railScope, starredIds])

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
        ) : (
          filteredSessions.map((session, index) => (
            <SessionRailRow
              key={session.id || `${session.source}-${index}`}
              session={session}
              active={selectedSessionId === session.id}
              currentToolId={currentToolId}
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
  currentToolId,
  onSelect,
  isStarred,
  onToggleStar,
}: {
  session: TraceSession
  active: boolean
  currentToolId: AgentToolId
  onSelect: () => void
  isStarred: boolean
  onToggleStar: () => void
}) {
  const pc = projectColor(session.project)
  const displayStatus = deriveDisplayStatus(session)
  const sc = RR_STATUS[displayStatus] || 'var(--muted-foreground)'
  const srcC = getSourceColor(session.source)
  const srcName = getSourceName(session.source)
  const cost = session.estimatedCost != null ? `$${session.estimatedCost.toFixed(2)}` : null

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
        <div className="rr-label">{session.displayTitle || session.name || session.id}</div>
        <div className="rr-line2 mono">
          <span>{session.id.slice(-8)}</span>
          {cost && (
            <>
              <span className="rr-sep">·</span>
              <span className="rr-cost">{cost}</span>
            </>
          )}
        </div>
        {srcName && (
          <span className="rr-src-corner mono" title={srcName}>
            {srcName}
          </span>
        )}
      </div>
    </div>
  )
}
