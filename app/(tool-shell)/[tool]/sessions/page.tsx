'use client'

import { useState } from 'react'
import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import { useToolSessions } from '@/lib/agent-tools/client-hooks'
import { useToolStore } from '@/stores/tool-store'
import { SessionExplorerTable } from '@/components/sessions/session-explorer-table'
import {
  SessionsFilterBar,
  type SessionFilters,
} from '@/components/sessions/sessions-filter-bar'
import { SessionsStatsBar } from '@/components/sessions/sessions-stats-bar'

export default function ToolSessionsPage() {
  const { toolId } = useAgentTool()
  const [filters, setFilters] = useState<SessionFilters>({})
  const setSelectedSessionId = useToolStore((s) => s.setSelectedSessionId)
  const selectedSessionId = useToolStore((s) => s.selectedSessionId)

  const { sessions, pagination, loading, error, refetch } = useToolSessions(
    toolId,
    filters as Record<string, string>,
  )

  // Ingest unreachable error state (per UI-SPEC copywriting)
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="text-[14px] font-bold text-destructive uppercase tracking-wider">
          INGEST UNREACHABLE
        </div>
        <div className="text-[11px] text-muted-foreground max-w-sm text-center leading-relaxed">
          ENSURE THE INGEST SERVICE IS RUNNING. CHECK PNPM DEV FOR STATUS.
        </div>
        <button
          onClick={refetch}
          className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider border border-border rounded hover:bg-accent/10 transition-colors"
        >
          RETRY
        </button>
      </div>
    )
  }

  // Loading state — spinner only (per UI-SPEC: no text)
  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <SessionsStatsBar
        sessions={sessions}
        totalCount={pagination?.total || 0}
      />
      <SessionsFilterBar
        filters={filters}
        onFiltersChange={setFilters}
      />
      <div className="flex-1 min-h-0 overflow-auto">
        <SessionExplorerTable
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onSelectSession={setSelectedSessionId}
        />
      </div>
    </div>
  )
}
