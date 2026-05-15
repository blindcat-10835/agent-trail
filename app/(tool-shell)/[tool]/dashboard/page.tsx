'use client'

import { useState } from 'react'
import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import {
  useOverviewAggregates,
  useTopModels,
  useTopProjects,
} from '@/lib/agent-tools/client-hooks'
import { KpiHero } from '@/components/overview/kpi-hero'
import { TimeWindowSelector } from '@/components/overview/time-window-selector'
import { TopModelsTable } from '@/components/overview/top-models-table'
import { TopProjectsTable } from '@/components/overview/top-projects-table'
import { EmptyState } from '@/components/dashboard/empty-state'
import type { TimeWindow } from '@/types/overview'

/**
 * Unified Overview Dashboard Page
 *
 * Replaces per-tool dashboard routing with a single data-driven overview.
 * Uses BFF overview hooks with source scoping via toolId.
 * Layout: KPI Hero → Time Window Selector → 2-column (Top Models | Top Projects)
 */
export default function ToolDashboardPage() {
  const { toolId } = useAgentTool()
  const [window, setWindow] = useState<TimeWindow>('7d')

  const { aggregates, loading: aggLoading, error: aggError } = useOverviewAggregates(toolId, window)
  const { models, loading: modelsLoading } = useTopModels(toolId, window)
  const { projects, loading: projectsLoading } = useTopProjects(toolId, window)

  // Ingest offline: show error state
  if (aggError && !aggLoading) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          heading="INGEST OFFLINE"
          body={aggError}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Section heading */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
          Overview
        </div>
        <TimeWindowSelector value={window} onChange={setWindow} />
      </div>

      {/* KPI Hero Bar */}
      <KpiHero aggregates={aggregates} loading={aggLoading} />

      {/* Rankings: 2-column grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground uppercase">
            Top Models
          </div>
          <TopModelsTable models={models} loading={modelsLoading} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground uppercase">
            Top Projects
          </div>
          <TopProjectsTable projects={projects} loading={projectsLoading} />
        </div>
      </div>
    </div>
  )
}
