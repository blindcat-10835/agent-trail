'use client'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { DashboardKpiBar } from '@/components/dashboard/dashboard-kpi-bar'
import { AgentCardGrid } from '@/components/dashboard/agent-card-grid'
import { AgentDrawer } from '@/components/dashboard/agent-drawer'
import { OverviewTab } from '@/components/dashboard/overview-tab'
import { useGatewayStore } from '@/stores/gateway/gateway-store'

type SubPage = 'overview' | 'agents' | 'costs' | 'skills'
type FilterMode = 'all' | 'live' | 'error'

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex-1 bg-background" />}>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardContent() {
  const agentsMap = useGatewayStore((s) => s.agents)
  const agents = useMemo(() => Array.from(agentsMap.values()), [agentsMap])
  const globalEventFeed = useGatewayStore((s) => s.globalEventFeed)
  const searchParams = useSearchParams()
  const router = useRouter()

  const activePage = (searchParams.get('tab') as SubPage) || 'overview'
  const setActivePage = (tab: SubPage) => {
    router.push(tab === 'overview' ? '/dashboard' : `/dashboard?tab=${tab}`)
  }

  const [filter, setFilter] = useState<FilterMode>('all')
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  const selectedAgent = selectedAgentId
    ? agentsMap.get(selectedAgentId) ?? null
    : null

  return (
    <>
      {/* Center content */}
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        {activePage === 'overview' && <OverviewTab onNavigateToSkills={() => setActivePage('skills')} />}
        {activePage === 'agents' && (
          <>
            <DashboardKpiBar
              agentCount={agents.length}
              filter={filter}
              onFilterChange={setFilter}
              eventCount={globalEventFeed.length}
            />
            <div className="flex-1 overflow-y-auto">
              <AgentCardGrid
                agents={agents}
                selectedAgentId={selectedAgentId}
                onAgentClick={setSelectedAgentId}
                filter={filter}
              />
            </div>
          </>
        )}
        {activePage === 'costs' && (
          <PlaceholderPage title="COSTS" />
        )}
        {activePage === 'skills' && (
          <PlaceholderPage title="SKILLS" />
        )}
      </div>

      {/* Agent drawer overlay */}
      {selectedAgent && (
        <AgentDrawer
          agent={selectedAgent}
          onClose={() => setSelectedAgentId(null)}
        />
      )}
    </>
  )
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="grid flex-1 min-h-0 place-items-center text-muted-foreground text-[11px] tracking-[0.2em] uppercase">
      {title} · coming soon
    </div>
  )
}
