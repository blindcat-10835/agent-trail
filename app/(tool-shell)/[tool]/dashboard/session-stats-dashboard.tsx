'use client'

import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import { useToolSessions } from '@/lib/agent-tools/client-hooks'
import { SessionExplorerTable } from '@/components/sessions/session-explorer-table'
import { EmptyState } from '@/components/dashboard/empty-state'
import { useToolStore } from '@/stores/tool-store'

/**
 * Session Stats Dashboard (shared by Claude Code and Codex)
 *
 * Per D-14 and D-15: Both Claude Code and Codex dashboards show
 * basic session summary statistics from ingest:
 * - Total sessions count
 * - Active sessions count
 * - Model breakdown
 * - Recent sessions list
 *
 * No agent grid, no cron, no skills, no Gateway data.
 */
export function SessionStatsDashboard() {
  const { toolId, definition } = useAgentTool()
  const selectedSessionId = useToolStore((s) => s.selectedSessionId)
  const setSelectedSessionId = useToolStore((s) => s.setSelectedSessionId)
  const { sessions, pagination, loading, error } = useToolSessions(toolId, {
    limit: '50',
  })

  // Error state — ingest unreachable
  if (error) {
    return (
      <div className="p-4 flex items-center justify-center h-full">
        <EmptyState
          heading="INGEST UNREACHABLE"
          body="ENSURE THE INGEST SERVICE IS RUNNING."
        />
      </div>
    )
  }

  // Loading state — spinner only
  if (loading && sessions.length === 0) {
    return (
      <div className="p-4 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    )
  }

  // Summary stats from sessions
  const totalSessions = pagination?.total || sessions.length
  const activeSessions = sessions.filter((s) => s.status === 'active').length

  const modelBreakdown = sessions.reduce<Record<string, number>>((acc, s) => {
    // model field comes from ingest API (not in canonical TraceSession, but present in API response)
    const model = (s as unknown as Record<string, unknown>).model as string | undefined
    const key = model || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return (
    <div className="p-4 space-y-6 min-h-0 overflow-y-auto">
      {/* Header */}
      <div>
        <h1 className="text-base font-bold tracking-[-0.01em] text-foreground">
          {definition.label} Dashboard
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Session statistics from local ingest index.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-border bg-card p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            TOTAL SESSIONS
          </div>
          <div className="text-3xl font-bold tabular-nums mt-1 font-mono">
            {loading ? '—' : totalSessions.toLocaleString()}
          </div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            LOADED ACTIVE
          </div>
          <div className="text-3xl font-bold tabular-nums mt-1 font-mono">
            {loading ? '—' : activeSessions.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Model breakdown */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          LOADED MODELS
        </h2>
        <div className="border border-border bg-card">
          {Object.entries(modelBreakdown).length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">No data</div>
          ) : (
            Object.entries(modelBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([model, count]) => (
                <div
                  key={model}
                  className="flex justify-between px-3 py-2 border-b border-border last:border-0"
                >
                  <span className="text-sm font-mono truncate mr-2">{model}</span>
                  <span className="text-sm font-mono tabular-nums flex-shrink-0">
                    {count}
                  </span>
                </div>
              ))
          )}
        </div>
      </section>

      {/* Recent sessions */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          RECENT SESSIONS
        </h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            heading="NO SESSIONS"
            body={`ENSURE ${definition.shortLabel} SESSIONS DIRECTORY IS CONFIGURED IN INGEST.`}
          />
        ) : (
          <SessionExplorerTable
            sessions={sessions.slice(0, 10)}
            selectedSessionId={selectedSessionId}
            onSelectSession={setSelectedSessionId}
          />
        )}
      </section>
    </div>
  )
}
