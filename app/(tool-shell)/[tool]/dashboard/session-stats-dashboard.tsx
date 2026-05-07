'use client'

import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import { useToolSessions } from '@/lib/agent-tools/client-hooks'
import { EmptyState } from '@/components/dashboard/empty-state'

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

      {/* Project breakdown */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          PROJECTS
        </h2>
        {sessions.length === 0 ? (
          <EmptyState
            heading="NO SESSIONS"
            body={`ENSURE ${definition.shortLabel} SESSIONS DIRECTORY IS CONFIGURED IN INGEST.`}
          />
        ) : (
          <div className="border border-border bg-card">
            {Object.entries(projectBreakdown(sessions))
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8)
              .map(([project, count]) => (
                <div
                  key={project}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2 border-b border-border last:border-0"
                >
                  <span className="truncate text-sm font-mono">{project}</span>
                  <span className="text-sm font-mono tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  )
}

function projectBreakdown(sessions: Array<{ project: string }>): Record<string, number> {
  return sessions.reduce<Record<string, number>>((acc, session) => {
    const project = session.project && session.project !== 'default' ? session.project : '-'
    acc[project] = (acc[project] || 0) + 1
    return acc
  }, {})
}
