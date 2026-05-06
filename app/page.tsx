'use client'

import { useRouter } from 'next/navigation'
import { useAggregateSessions } from '@/lib/agent-tools/client-hooks'
import { SessionExplorerTable } from '@/components/sessions/session-explorer-table'
import { SessionsFilterBar, type SessionFilters } from '@/components/sessions/sessions-filter-bar'
import { SessionsStatsBar } from '@/components/sessions/sessions-stats-bar'
import { EmptyState } from '@/components/dashboard/empty-state'
import type { SessionColumnDef } from '@/lib/agent-tools/types'
import { useState } from 'react'

const AGGREGATE_SESSION_COLUMNS: SessionColumnDef[] = [
  { id: 'label', header: 'LABEL', accessor: 'label', sortable: true, width: 'minmax(180px,2fr)' },
  { id: 'status', header: 'STATUS', accessor: 'status', width: '80px' },
  { id: 'project', header: 'PROJECT', accessor: 'project', sortable: true, width: 'minmax(120px,1fr)' },
  { id: 'model', header: 'MODEL', accessor: 'model', sortable: true, width: 'minmax(120px,1fr)' },
  { id: 'updatedAt', header: 'UPDATED', accessor: 'updatedAt', sortable: true, width: '80px' },
]

export default function AggregateLandingPage() {
  const router = useRouter()
  const [filters, setFilters] = useState<SessionFilters>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { sessions, loading, error } = useAggregateSessions(
    filters as Record<string, string>,
  )

  // When a session is selected, navigate to its tool's session page
  function handleSelectSession(sessionId: string | null) {
    setSelectedId(sessionId)
    if (sessionId) {
      const session = sessions.find((s) => s.id === sessionId)
      if (session) {
        router.push(`/${session.source}/sessions/${sessionId}`)
      }
    }
  }

  // Loading state
  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <EmptyState
          heading="INGEST UNREACHABLE"
          body="ENSURE THE INGEST SERVICE IS RUNNING. CHECK PNPM DEV FOR STATUS."
        />
      </div>
    )
  }

  // Empty state
  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <EmptyState
          heading="NO SESSIONS INDEXED"
          body="START AN AGENT SESSION IN ANY SUPPORTED TOOL TO SEE IT APPEAR HERE."
        />
      </div>
    )
  }

  const totalCount = sessions.length

  return (
    <div className="flex flex-col h-screen min-h-0 p-4 gap-4">
      <h1 className="text-base font-bold tracking-[-0.01em] text-foreground">
        ALL SESSIONS
      </h1>
      <SessionsStatsBar sessions={sessions} totalCount={totalCount} />
      <SessionsFilterBar filters={filters} onFiltersChange={setFilters} />
      <div className="flex-1 min-h-0 overflow-auto">
        <SessionExplorerTable
          sessions={sessions}
          selectedSessionId={selectedId}
          onSelectSession={handleSelectSession}
          sourceBadge={true}
          columns={AGGREGATE_SESSION_COLUMNS}
        />
      </div>
    </div>
  )
}
