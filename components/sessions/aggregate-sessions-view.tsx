'use client'

import { useAggregateSessions } from '@/lib/agent-tools/client-hooks'
import { SessionsStatsBar } from '@/components/sessions/sessions-stats-bar'
import { EmptyState } from '@/components/dashboard/empty-state'
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
  const { sessions, totalCount, sources, loading, error } = useAggregateSessions({
    limit: '500',
  })

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

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-4">
      <h1 className="text-base font-bold text-foreground">
        ALL SOURCES
      </h1>
      <SourceStatusStrip sources={sources} />
      {sessions.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            heading="NO SESSIONS INDEXED"
            body="START AN AGENT SESSION IN ANY SUPPORTED TOOL TO SEE IT APPEAR HERE."
          />
        </div>
      ) : (
        <>
          <SessionsStatsBar
            sessions={sessions}
            totalCount={totalCount}
            totalLabel="TOTAL INDEXED"
          />
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
              PROJECTS
            </h2>
            <div className="border border-border bg-card">
              {Object.entries(projectBreakdown(sessions))
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
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
          </section>
        </>
      )}
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
