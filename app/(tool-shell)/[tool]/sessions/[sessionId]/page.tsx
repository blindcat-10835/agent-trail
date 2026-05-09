'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAgentTool, useSessionDetail, useSessionTurns } from '@/lib/agent-tools/client-hooks'
import { ReplayHeader } from '@/components/replay/replay-header'
import { ReplayRightRail } from '@/components/replay/replay-right-rail'
import { TurnTimeline } from '@/components/replay/turn-timeline'
import { ReplaySearchBar } from '@/components/replay/replay-search-bar'
import { TurnNavigator } from '@/components/replay/turn-navigator'
import { Skeleton } from '@/components/ui/skeleton'
import type { TraceTurn } from '@/types/trace'

export default function SessionReplayPage({
  params,
}: {
  params: Promise<{ tool: string; sessionId: string }>
}) {
  const { tool, sessionId } = use(params)
  const router = useRouter()
  const { toolId, href } = useAgentTool()
  const { session, loading: sessionLoading, error: sessionError } = useSessionDetail(toolId, sessionId)

  // Pagination state management
  const [turnsOffset, setTurnsOffset] = useState(0)
  const [allTurns, setAllTurns] = useState<TraceTurn[]>([])
  const [loadingMore, setLoadingMore] = useState(false)

  const { turns: pageTurns, pagination, loading: turnsLoading, error: turnsError, refetch } = useSessionTurns(
    toolId,
    sessionId,
    { offset: turnsOffset, limit: 50 },
  )

  // Reset accumulated turns when sessionId changes
  useEffect(() => {
    setAllTurns([])
    setTurnsOffset(0)
  }, [sessionId])

  // Append page turns to accumulated list
  useEffect(() => {
    if (pageTurns.length > 0) {
      setAllTurns((prev) => {
        // Avoid duplicates if refetching same offset
        const existingIds = new Set(prev.map((t) => t.id))
        const newTurns = pageTurns.filter((t) => !existingIds.has(t.id))
        if (turnsOffset === 0) {
          return pageTurns
        }
        return [...prev, ...newTurns]
      })
    }
    setLoadingMore(false)
  }, [pageTurns, turnsOffset])

  const handleLoadMore = useCallback(() => {
    if (pagination?.hasMore && !loadingMore) {
      setLoadingMore(true)
      setTurnsOffset((prev) => prev + 50)
    }
  }, [pagination?.hasMore, loadingMore])

  const turns = allTurns
  const [replayRightRailOpen, setReplayRightRailOpen] = useState(false)

  // Derive status from session metrics for display
  const derivedStatus = deriveDisplayStatus(session)

  // --- Error: Session not found (null after loading) ---
  if (!sessionLoading && !sessionError && !session) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
          NOT FOUND
        </div>
        <div className="text-[10px] text-muted-foreground text-center">
          Session data is not available. It may have been removed or the ID is invalid.
        </div>
        <button
          onClick={() => router.push(href('/sessions'))}
          className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider border border-border rounded hover:bg-accent/10 transition-colors"
        >
          BACK TO SESSIONS
        </button>
      </div>
    )
  }

  // --- Error: Fetch failed ---
  if (sessionError || turnsError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="text-[14px] font-bold text-destructive uppercase tracking-wider">
          ERR
        </div>
        <div className="text-[11px] text-muted-foreground max-w-sm text-center leading-relaxed">
          Could not load session turns.
        </div>
        <button
          onClick={refetch}
          className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider border border-border rounded hover:bg-accent/10 transition-colors"
        >
          RETRY LOAD
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <ReplayHeader
        session={session}
        derivedStatus={derivedStatus}
        onBackToSessions={() => router.push(href('/sessions'))}
      />

      {/* Status indicator bar (prominent focal point below header) */}
      {derivedStatus && derivedStatus !== 'idle' && (
        <SessionStatusBar status={derivedStatus} />
      )}

      {/* Search and filters */}
      <div className="flex-shrink-0 space-y-0 border-b border-border">
        <div className="px-4 py-2">
          <ReplaySearchBar turns={turns} />
        </div>
      </div>

      {/* Turn navigator */}
      {turns.length > 0 && (
        <TurnNavigator turns={turns} />
      )}

      {/* Main content area: turn timeline + right rail toggle */}
      <div
        className="flex-1 min-h-0 flex transition-all duration-200"
      >
        {/* Turn timeline */}
        <div className="flex-1 min-w-0 min-h-0">
          {turnsLoading && turns.length === 0 ? (
            <div className="flex flex-col gap-4 p-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : turns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                NO TURNS
              </div>
              <div className="text-[10px] text-muted-foreground">
                This session contains no parsed turns. The file may be empty or still processing.
              </div>
            </div>
          ) : (
            <TurnTimeline
              turns={turns}
              sessionId={sessionId}
              hasMore={pagination?.hasMore ?? false}
              loadingMore={loadingMore}
              onLoadMore={handleLoadMore}
            />
          )}
        </div>

        {/* Right rail */}
        {replayRightRailOpen && session && (
          <ReplayRightRail
            session={session}
            turnCount={turns.length}
            turns={turns}
            onClose={() => setReplayRightRailOpen(false)}
          />
        )}

        {/* Right rail toggle button (always visible, fixed position) */}
        <button
          onClick={() => setReplayRightRailOpen((prev) => !prev)}
          className="flex-shrink-0 w-6 flex items-center justify-center border-l border-border hover:bg-accent/5 transition-colors text-muted-foreground hover:text-foreground text-xs"
          aria-label={replayRightRailOpen ? 'Close session info' : 'Open session info'}
        >
          {replayRightRailOpen ? '»' : '«'}
        </button>
      </div>
    </div>
  )
}

/**
 * Derive the primary display status from session data.
 * Priority: error > aborted > active > running > awaiting-user > truncated > parser-warning > idle
 * Metrics fields (isTruncated, parserMalformedLines) augment base SessionStatus.
 */
function deriveDisplayStatus(session: import('@/types/trace').TraceSession | null): string | null {
  if (!session) return null
  const { status, metrics } = session
  if (status === 'error') return 'error'
  if (status === 'aborted') return 'aborted'
  if (metrics.isTruncated) return 'truncated'
  if (metrics.parserMalformedLines > 0) return 'parser-warning'
  // Future: detect 'running' or 'awaiting-user' from additional session metadata
  if (status === 'active') return 'active'
  if (status === 'idle') return 'idle'
  return status
}

/** Inline session status bar (prominent, below header, above turn list) */
function SessionStatusBar({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; pulse?: boolean; icon?: string }> = {
    active:   { label: 'LIVE', color: 'text-[oklch(0.76_0.17_145)]', pulse: true },
    idle:     { label: 'IDLE', color: 'text-muted-foreground' },
    aborted:  { label: 'ABORTED', color: 'text-destructive', icon: '⚠' },
    error:    { label: 'ERROR', color: 'text-destructive', icon: '✕' },
    running:  { label: 'RUNNING', color: 'text-accent', pulse: true },
    'awaiting-user': { label: 'AWAITING USER', color: 'text-[oklch(0.76_0.17_75)]', pulse: true },
    truncated: { label: 'TRUNCATED', color: 'text-muted-foreground', icon: '⚠' },
    'parser-warning': { label: 'PARSE WARNINGS', color: 'text-[oklch(0.76_0.17_55)]', icon: '⚠' },
  }
  const cfg = config[status]
  if (!cfg) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border">
      {cfg.pulse ? (
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.color} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.color}`} />
        </span>
      ) : cfg.icon ? (
        <span className={cfg.color}>{cfg.icon}</span>
      ) : null}
      <span className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${cfg.color}`}>
        {cfg.label}
      </span>
    </div>
  )
}
