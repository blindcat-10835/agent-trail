'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAggregateSessions } from '@/lib/agent-tools/client-hooks'
import { SessionExplorerTable } from '@/components/sessions/session-explorer-table'
import { SessionsFilterBar, type SessionFilters } from '@/components/sessions/sessions-filter-bar'
import { SessionsStatsBar } from '@/components/sessions/sessions-stats-bar'
import { EmptyState } from '@/components/dashboard/empty-state'
import { useToolStore } from '@/stores/tool-store'
import type { AggregateSourceStatus } from '@/lib/agent-tools/client-hooks'

function sourceLabel(toolId: AggregateSourceStatus['toolId']): string {
  switch (toolId) {
    case 'openclaw':
      return 'OPENCLAW'
    case 'claude-code':
      return 'CLAUDE:CODE'
    case 'codex':
      return 'CODEX'
  }
}

function SourceStatusStrip({ sources }: { sources: AggregateSourceStatus[] }) {
  if (sources.length === 0) return null

  return (
    <div className="grid grid-cols-3 border border-border bg-card">
      {sources.map((source) => (
        <div
          key={source.toolId}
          className="px-3 py-2 border-r border-border last:border-r-0"
        >
          <div className="text-[9px] text-muted-foreground tracking-[0.18em] uppercase">
            {sourceLabel(source.toolId)}
          </div>
          <div className="mt-1 text-[11px] font-mono">
            {source.status === 'error' ? (
              <span className="text-destructive">ERR</span>
            ) : (
              <span>{source.total.toLocaleString()} indexed</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function AggregateSessionsView() {
  const router = useRouter()
  const [filters, setFilters] = useState<SessionFilters>({})
  const setSelectedSessionId = useToolStore((s) => s.setSelectedSessionId)

  const { sessions, totalCount, sources, loading, error } = useAggregateSessions(
    filters as Record<string, string>,
  )

  function handleSelectSession(sessionId: string | null) {
    setSelectedSessionId(sessionId)
    if (!sessionId) return

    const session = sessions.find((s) => s.id === sessionId)
    if (session) {
      router.push(`/${session.source}/sessions`)
    }
  }

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          heading="INGEST UNREACHABLE"
          body="ENSURE THE INGEST SERVICE IS RUNNING. CHECK PNPM DEV FOR STATUS."
        />
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col h-full min-h-0 p-4 gap-4">
        <SourceStatusStrip sources={sources} />
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            heading="NO SESSIONS INDEXED"
            body="START AN AGENT SESSION IN ANY SUPPORTED TOOL TO SEE IT APPEAR HERE."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-4">
      <h1 className="text-base font-bold text-foreground">
        ALL SESSIONS
      </h1>
      <SourceStatusStrip sources={sources} />
      <SessionsStatsBar
        sessions={sessions}
        totalCount={totalCount}
        totalLabel="TOTAL INDEXED"
      />
      <SessionsFilterBar filters={filters} onFiltersChange={setFilters} />
      <div className="flex-1 min-h-0 overflow-auto">
        <SessionExplorerTable
          sessions={sessions}
          selectedSessionId={null}
          onSelectSession={handleSelectSession}
          sourceBadge={true}
        />
      </div>
    </div>
  )
}
