'use client'

import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import { AggregateSessionsView } from '@/components/sessions/aggregate-sessions-view'
import { SessionStatsDashboard } from '../dashboard/session-stats-dashboard'

export default function ToolSessionsPage() {
  const { toolId } = useAgentTool()

  if (toolId === 'all') {
    return <AggregateSessionsView />
  }

  return <SessionStatsDashboard />
}
