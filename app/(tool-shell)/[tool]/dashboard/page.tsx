'use client'

import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import { OpenClawDashboard } from './openclaw-dashboard'
import { SessionStatsDashboard } from './session-stats-dashboard'

/**
 * Per-Tool Dashboard Page
 *
 * Routes to the appropriate dashboard based on the current tool:
 * - OpenClaw: Overview skeleton with empty/placeholder states (D-13)
 * - Claude Code: Session statistics from ingest (D-14)
 * - Codex: Session statistics from ingest (D-15)
 */
export default function ToolDashboardPage() {
  const { toolId } = useAgentTool()

  if (toolId === 'openclaw') {
    return <OpenClawDashboard />
  }

  return <SessionStatsDashboard />
}
