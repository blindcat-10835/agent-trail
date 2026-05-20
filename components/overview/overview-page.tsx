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
  useDailyTokens,
} from '@/lib/agent-tools/client-hooks'
import { KpiHero } from '@/components/overview/kpi-hero'
import { TimeWindowSelector } from '@/components/overview/time-window-selector'
import { TopModelsTable } from '@/components/overview/top-models-table'
import { TopProjectsTable } from '@/components/overview/top-projects-table'
import { StarredSessions } from '@/components/overview/starred-sessions'
import { ActivityTimeline } from '@/components/overview/activity-timeline'
import { OverviewAgents } from '@/components/overview/overview-agents'
import { OverviewAutomations } from '@/components/overview/overview-automations'
import { EmptyState } from '@/components/dashboard/empty-state'
import type { TimeWindow } from '@/types/overview'

// ============================================================================
// Component — Overview v3 layout: Hero Band → Agents → Row A → Row B
// ============================================================================

const OVERVIEW_SCROLL_CLASS = 'h-full min-h-0 min-w-0 overflow-y-auto p-[18px_22px_26px] flex flex-col gap-[14px]'

export function OverviewPage() {
  const { toolId } = useAgentTool()
  const [window, setWindow] = useState<TimeWindow>('30d')
  const [modelSortBy, setModelSortBy] = useState<string>('tokens')
  const [projectSortBy, setProjectSortBy] = useState<string>('tokens')

  const { aggregates, loading: aggLoading, error: aggError } = useOverviewAggregates(toolId, window)
  const { dailyTokens, loading: dailyTokensLoading, error: dailyTokensError } = useDailyTokens(toolId, window)

  // Row A: window-dependent
  const { models, loading: modelsLoading, error: modelsError } = useTopModels(toolId, window, modelSortBy)
  const { projects, loading: projectsLoading, error: projectsError } = useTopProjects(toolId, window, projectSortBy)

  // Non-window data
  const { starred, loading: starredLoading, error: starredError } = useStarredSessions(toolId)
  const { timeline, loading: timelineLoading, error: timelineError } = useTimeline(toolId)
  const { capabilities, loading: capsLoading } = useOverviewCapabilities(toolId)

  if (aggError && !aggLoading && !aggregates) {
    return (
      <div className={OVERVIEW_SCROLL_CLASS}>
        {/* Time window selector */}
        <div className="flex items-center">
          <TimeWindowSelector value={window} onChange={setWindow} />
        </div>
        <KpiHero
          toolId={toolId}
          aggregates={null}
          dailyTokens={dailyTokens}
          dailyTokensLoading={dailyTokensLoading}
          dailyTokensError={dailyTokensError}
          window={window}
          loading={false}
          error={aggError}
        />
        <EmptyState
          heading="INGEST OFFLINE"
          body="UNABLE TO REACH INGEST SERVICE. CHECK THAT THE INGEST SERVER IS RUNNING."
        />
      </div>
    )
  }

  return (
    <div className={OVERVIEW_SCROLL_CLASS}>

      {/* ═══ TIME WINDOW SELECTOR ═══ */}
      <div className="flex items-center">
        <TimeWindowSelector value={window} onChange={setWindow} />
      </div>

      {/* ═══ HERO BAND ═══ */}
      <KpiHero
        toolId={toolId}
        aggregates={aggregates}
        dailyTokens={dailyTokens}
        dailyTokensLoading={dailyTokensLoading}
        dailyTokensError={dailyTokensError}
        window={window}
        loading={aggLoading}
        error={aggError}
      />

      {/* ═══ AGENTS STRIP (OpenClaw only) ═══ */}
      <OverviewAgents capabilities={capabilities} toolId={toolId} capsLoading={capsLoading} />

      {/* ═══ ROW A: Models · Projects · Activity ═══ */}
      <section>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: '1fr 1fr 1fr' }}
        >
          <TopModelsTable
            models={models}
            loading={modelsLoading}
            error={modelsError}
            sortBy={modelSortBy}
            onSortChange={setModelSortBy}
          />
          <TopProjectsTable
            projects={projects}
            loading={projectsLoading}
            error={projectsError}
            sortBy={projectSortBy}
            onSortChange={setProjectSortBy}
          />
          <ActivityTimeline
            timeline={timeline}
            loading={timelineLoading}
            error={timelineError}
          />
        </div>
      </section>

      {/* ═══ ROW B: Stars · Automations ═══ */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: '1.4fr 1fr' }}
      >
        <StarredSessions
          starred={starred}
          loading={starredLoading}
          error={starredError}
        />
        <OverviewAutomations
          capabilities={capabilities}
          toolId={toolId}
          capsLoading={capsLoading}
        />
      </div>

    </div>
  )
}
