'use client'

import { useState, useMemo } from 'react'
import { RefreshCw, X } from 'lucide-react'
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
import {
  SessionFilterDropdown,
  type SessionFilterState,
  type GroupMode,
} from './session-filter-dropdown'
import { cn } from '@/lib/utils'
import type { AgentToolId, SourceToolId } from '@/lib/agent-tools/types'
import type { TraceSession, TraceSource } from '@/types/trace'
import { TOOL_IDS } from '@/lib/agent-tools/registry'

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
  const { definition, href } = useAgentTool()
  const router = useRouter()
  const setSelectedSessionId = useToolStore((s) => s.setSelectedSessionId)
  const aggregateSessions = useAggregateSessions({ limit: '500' })
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
      definitionLabel={definition.shortLabel}
      sessions={aggregateSessions.sessions}
      loading={aggregateSessions.loading || syncing}
      error={syncError ?? aggregateSessions.error}
      total={aggregateSessions.totalCount}
      selectedSessionId={selectedSessionId}
      onClearSelection={onClearSelection}
      onRefresh={handleRefresh}
      onSelect={handleSelect}
      currentToolId="all"
      syncing={syncing}
    />
  )
}

function SourceSessionsRightRail({
  selectedSessionId,
  onClearSelection,
  sourceToolId,
}: SessionsRightRailProps & { sourceToolId: SourceToolId }) {
  const { definition, href } = useAgentTool()
  const router = useRouter()
  const setSelectedSessionId = useToolStore((s) => s.setSelectedSessionId)
  const sourceSessions = useToolSessions(
    sourceToolId,
    { limit: '500', sort: 'updated_at', order: 'desc' },
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
      sourceSessions.refetch()
    }
  }

  function handleSelect(session: TraceSession) {
    setSelectedSessionId(session.id)
    router.push(href(`/sessions/${session.id}`))
  }

  return (
    <SessionsRailContent
      definitionLabel={definition.shortLabel}
      sessions={sourceSessions.sessions}
      loading={sourceSessions.loading || syncing}
      error={syncError ?? sourceSessions.error}
      total={sourceSessions.pagination?.total}
      selectedSessionId={selectedSessionId}
      onClearSelection={onClearSelection}
      onRefresh={handleRefresh}
      onSelect={handleSelect}
      currentToolId={sourceToolId}
      syncing={syncing}
    />
  )
}

interface GroupSection {
  label: string
  sessions: TraceSession[]
}

function SessionsRailContent({
  definitionLabel,
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
}: {
  definitionLabel: string
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
}) {
  // -- Filter state with localStorage restore for groupMode --
  const [filter, setFilter] = useState<SessionFilterState>(() => {
    let groupMode: GroupMode = 'none'
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('agents-tracing-group-mode')
        if (stored === 'agent' || stored === 'project') groupMode = stored
      } catch {}
    }
    return { groupMode, sourceFilter: new Set(), starredOnly: false, searchQuery: '' }
  })
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const starredIds = useStarredStore((s) => s.ids)
  const starredToggle = useStarredStore((s) => s.toggle)
  const starredIsStarred = useStarredStore((s) => s.isStarred)

  // -- Filtered sessions --
  const filteredSessions = useMemo(() => {
    let result = sessions

    // Search filter
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase()
      result = result.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.project && s.project.toLowerCase().includes(q)),
      )
    }

    // Source filter (empty set = show all)
    if (filter.sourceFilter.size > 0) {
      result = result.filter((s) => filter.sourceFilter.has(s.source))
    }

    // Starred only filter
    if (filter.starredOnly) {
      result = result.filter((s) => starredIds.has(s.id))
    }

    return result
  }, [sessions, filter.searchQuery, filter.sourceFilter, filter.starredOnly, starredIds])

  // -- Grouped sessions --
  const groupedSessions = useMemo((): GroupSection[] | null => {
    if (filter.groupMode === 'none') return null

    const map = new Map<string, TraceSession[]>()
    for (const s of filteredSessions) {
      const key =
        filter.groupMode === 'agent'
          ? (s.agentName || s.source)
          : (s.project || 'default')
      const list = map.get(key) || []
      list.push(s)
      map.set(key, list)
    }

    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([label, sessions]) => ({ label, sessions }))
  }, [filteredSessions, filter.groupMode])

  // -- Filter callback handlers --
  const handleGroupModeChange = (mode: GroupMode) => {
    setFilter((prev) => ({ ...prev, groupMode: mode }))
    try { localStorage.setItem('agents-tracing-group-mode', mode) } catch {}
  }

  const handleSourceToggle = (source: TraceSource) => {
    setFilter((prev) => {
      const next = new Set(prev.sourceFilter)
      if (next.has(source)) next.delete(source)
      else next.add(source)
      return { ...prev, sourceFilter: next.size === TOOL_IDS.length ? new Set() : next }
    })
  }

  const handleClearAll = () => {
    setFilter({ groupMode: 'none', sourceFilter: new Set(), starredOnly: false, searchQuery: '' })
    try { localStorage.removeItem('agents-tracing-group-mode') } catch {}
  }

  const toggleGroupCollapse = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Sessions
          </div>
          <div className="mt-0.5 text-[11px] font-mono text-foreground">
            {(total ?? sessions.length).toLocaleString()} indexed
          </div>
        </div>
        {selectedSessionId && (
          <button
            type="button"
            onClick={onClearSelection}
            className="grid h-7 w-7 place-items-center border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            aria-label="Clear selected session"
            title="Clear selected session"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <SessionFilterDropdown
          filter={filter}
          onGroupModeChange={handleGroupModeChange}
          onSourceToggle={handleSourceToggle}
          onClearSources={() => setFilter((prev) => ({ ...prev, sourceFilter: new Set() }))}
          onStarredOnlyToggle={() => setFilter((prev) => ({ ...prev, starredOnly: !prev.starredOnly }))}
          onSearchChange={(q) => setFilter((prev) => ({ ...prev, searchQuery: q }))}
          onClearAll={handleClearAll}
        />
        <button
          type="button"
          onClick={onRefresh}
          disabled={syncing}
          className={cn(
            'grid h-7 w-7 place-items-center border border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent',
            syncing && 'cursor-not-allowed opacity-50',
          )}
          aria-label={syncing ? 'Syncing…' : 'Refresh sessions'}
          title={syncing ? 'Syncing…' : 'Refresh sessions'}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', (loading || syncing) && 'animate-spin')} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && sessions.length === 0 ? (
          <div className="grid h-full place-items-center">
            <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-accent" />
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-destructive">
              ERR
            </div>
            <div className="text-[10px] leading-relaxed text-muted-foreground">
              {error}
            </div>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              NO SESSIONS
            </div>
            <div className="text-[10px] leading-relaxed text-muted-foreground">
              {sessions.length === 0
                ? `${definitionLabel} index is empty.`
                : 'No sessions match current filters.'}
            </div>
          </div>
        ) : groupedSessions ? (
          <div className="divide-y divide-border">
            {groupedSessions.map((group) => (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => toggleGroupCollapse(group.label)}
                  className="flex w-full items-center gap-1.5 border-b border-border bg-muted/30 px-3 py-1.5 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="text-[9px] text-muted-foreground/60 transition-transform" style={{ transform: collapsedGroups.has(group.label) ? 'rotate(-90deg)' : undefined }}>
                    &#9662;
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </span>
                  <span className="text-[9px] font-mono tabular-nums text-muted-foreground/60">
                    ({group.sessions.length})
                  </span>
                </button>
                {!collapsedGroups.has(group.label) &&
                  group.sessions.map((session, index) => (
                    <SessionRailRow
                      key={session.id || `${session.source}-${index}`}
                      session={session}
                      active={selectedSessionId === session.id}
                      currentToolId={currentToolId}
                      onSelect={() => onSelect(session)}
                      isStarred={starredIsStarred(session.id)}
                      onToggleStar={() => starredToggle(session.id)}
                    />
                  ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredSessions.map((session, index) => (
              <SessionRailRow
                key={session.id || `${session.source}-${index}`}
                session={session}
                active={selectedSessionId === session.id}
                currentToolId={currentToolId}
                onSelect={() => onSelect(session)}
                isStarred={starredIsStarred(session.id)}
                onToggleStar={() => starredToggle(session.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
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
  const name = deriveSessionName(session)
  const project = deriveProject(session)
  const updated = formatRelativeTime(getSessionFreshness(session))
  const sourceLabel = formatSourceLabel(
    currentToolId === 'all' ? session.source : (currentToolId as SourceToolId),
  )

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'grid w-full gap-1 px-3 py-2.5 text-left transition-colors hover:bg-accent/5',
        active && 'bg-accent/10 text-accent',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">
          {name}
        </span>
        <span className="shrink-0 border border-border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {sourceLabel}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-[10px] text-muted-foreground">
        <span className="truncate font-mono" title={project}>
          {project}
        </span>
        <span className="font-mono tabular-nums">
          {updated}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleStar() }}
          className={`flex-shrink-0 ml-1 text-sm transition-colors ${
            isStarred ? 'text-amber-500' : 'text-muted-foreground/30 hover:text-muted-foreground'
          }`}
          aria-label={isStarred ? 'Unstar session' : 'Star session'}
        >
          {isStarred ? '★' : '☆'}
        </button>
      </div>
    </button>
  )
}

function deriveSessionName(session: TraceSession): string {
  return session.name?.trim() || session.id.slice(-8) || 'Untitled session'
}

function deriveProject(session: TraceSession): string {
  if (session.project && session.project !== 'default') return session.project
  return '-'
}

function getSessionFreshness(session: TraceSession): string | null {
  const dynamicSession = session as TraceSession & {
    updatedAt?: string | null
  }
  return getFreshestIso([
    dynamicSession.updatedAt,
    session.endedAt,
    session.startedAt,
  ])
}

function getFreshestIso(values: Array<string | null | undefined>): string | null {
  let freshest: { iso: string; time: number } | null = null
  for (const value of values) {
    if (!value) continue
    const time = new Date(value).getTime()
    if (!Number.isFinite(time)) continue
    if (!freshest || time > freshest.time) freshest = { iso: value, time }
  }
  return freshest?.iso ?? null
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '-'
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 0) return 'now'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

function formatSourceLabel(source: SourceToolId): string {
  if (source === 'claude-code') return 'CLAUDE'
  if (source === 'openclaw') return 'OPENCLAW'
  return 'CODEX'
}
