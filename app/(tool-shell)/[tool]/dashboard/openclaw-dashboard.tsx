'use client'

import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import { useToolSessions } from '@/lib/agent-tools/client-hooks'
import { EmptyState } from '@/components/dashboard/empty-state'

/**
 * OpenClaw Dashboard Overview
 *
 * Shows indexed sessions from ingest and skeleton placeholders for
 * agents/skills/cron/activity sections.
 */
export function OpenClawDashboard() {
  const { toolId, definition } = useAgentTool()
  const { sessions, loading: sessionsLoading } = useToolSessions(toolId, { limit: '10' })

  return (
    <div className="p-4 space-y-6 min-h-0 overflow-y-auto">
      {/* KPI Bar — skeleton, empty data */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          KPI OVERVIEW
        </h2>
        <div className="grid grid-cols-4 gap-px bg-border border border-border">
          {['FLEET STATUS', 'SESSIONS', 'SPEND', 'ACTIVITY'].map((label) => (
            <div key={label} className="bg-card px-4 py-3.5 flex flex-col gap-1">
              <div className="text-[9.5px] text-muted-foreground tracking-[0.2em] uppercase">
                {label}
              </div>
              <div className="text-2xl font-bold tracking-tight text-muted-foreground/40 tabular-nums">
                —
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2 italic">
          KPI data will be populated from local file data sources in Phase 6+.
        </p>
      </section>

      {/* Agent Cards — skeleton, empty */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          AGENTS
        </h2>
        <EmptyState
          heading="NO AGENT DATA"
          body="Agent data will be populated from local file data sources in Phase 6+."
        />
      </section>

      {/* SESSIONS — from ingest */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          INDEXED SESSIONS
        </h2>
        {sessionsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            heading="NO SESSIONS"
            body={`ENSURE ${definition.shortLabel} SESSIONS DIRECTORY IS CONFIGURED IN INGEST.`}
          />
        ) : (
          <div className="border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-mono text-foreground font-bold">
                {sessions.length}
              </span>{' '}
              sessions indexed from ingest
            </div>
          </div>
        )}
      </section>

      {/* Skills — skeleton, empty */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          SKILLS
        </h2>
        <EmptyState
          heading="NO SKILL DATA"
          body="Skill data will be populated in Phase 6+."
        />
      </section>

      {/* Cron — placeholder */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          CRON
        </h2>
        <EmptyState
          heading="NO CRON DATA"
          body="Cron job data will be populated in Phase 6+."
        />
      </section>

      {/* Activity — placeholder */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          ACTIVITY
        </h2>
        <EmptyState
          heading="NO ACTIVITY DATA"
          body="Activity log data will be populated in Phase 6+."
        />
      </section>
    </div>
  )
}
