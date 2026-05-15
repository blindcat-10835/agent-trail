'use client'

import { useState } from 'react'
import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import {
  useOverviewAggregates,
  useTopModels,
  useTopProjects,
  useStarredSessions,
  useTimeline,
  useOverviewCapabilities,
} from '@/lib/agent-tools/client-hooks'
import { KpiHero } from '@/components/overview/kpi-hero'
import { TimeWindowSelector } from '@/components/overview/time-window-selector'
import { TopModelsTable } from '@/components/overview/top-models-table'
import { TopProjectsTable } from '@/components/overview/top-projects-table'
import { StarredSessions } from '@/components/overview/starred-sessions'
import { ActivityTimeline } from '@/components/overview/activity-timeline'
import { OverviewAgents } from '@/components/overview/overview-agents'
import { EmptyState } from '@/components/dashboard/empty-state'
import type { TimeWindow } from '@/types/overview'

// ============================================================================
// Component
// ============================================================================

/**
 * Complete Overview Page Component
 *
 * Orchestrates all overview sections in a single layout:
 * 1. KPI Hero bar (full width)
 * 2. Time Window Selector (right-aligned)
 * 3. Two-column grid: Top Models | Top Projects
 * 4. Starred Sessions (full width)
 * 5. Two-column grid: Activity Timeline | Agents (if capabilities allow)
 */
export function OverviewPage() {
  const { toolId } = useAgentTool()
  const [window, setWindow] = useState<TimeWindow>('7d')

  // Window-dependent data hooks
  const { aggregates, loading: aggLoading, error: aggError } = useOverviewAggregates(toolId, window)
  const { models, loading: modelsLoading } = useTopModels(toolId, window)
  const { projects, loading: projectsLoading } = useTopProjects(toolId, window)

  // Non-window-dependent data hooks
  const { starred, loading: starredLoading } = useStarredSessions(toolId)
  const { timeline, loading: timelineLoading } = useTimeline(toolId)
  const { capabilities, loading: capsLoading } = useOverviewCapabilities(toolId)

  // Full-page error if aggregates fails (ingest likely offline)
  if (aggError && !aggLoading) {
    return (
      <EmptyState
        heading="INGEST OFFLINE"
        body={aggError}
      />
    )
  }

  return (
    <div className="p-4 space-y-6 min-h-0 overflow-y-auto">
      {/* 1. KPI Hero bar */}
      <KpiHero aggregates={aggregates} loading={aggLoading} />

      {/* 2. Time Window Selector (right-aligned) */}
      <div className="flex justify-end">
        <TimeWindowSelector value={window} onChange={setWindow} />
      </div>

      {/* 3. Two-column: Top Models | Top Projects */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground uppercase">
            TOP MODELS
          </div>
          <TopModelsTable models={models} loading={modelsLoading} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground uppercase">
            TOP PROJECTS
          </div>
          <TopProjectsTable projects={projects} loading={projectsLoading} />
        </div>
      </div>

      {/* 4. Starred Sessions (full width) */}
      <StarredSessions starred={starred} loading={starredLoading} />

      {/* 5. Two-column: Activity Timeline | Agents */}
      <div className="grid grid-cols-2 gap-4">
        <ActivityTimeline timeline={timeline} loading={timelineLoading} />
        {!capsLoading && (
          <OverviewAgents capabilities={capabilities} toolId={toolId} />
        )}
      </div>
    </div>
  )
}
