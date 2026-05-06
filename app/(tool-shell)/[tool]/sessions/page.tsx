'use client'

import { useAgentTool } from '@/lib/agent-tools/client-hooks'

export default function ToolSessionsPage() {
  const { definition } = useAgentTool()
  return (
    <div className="p-4">
      <h1 className="text-lg font-bold tracking-tight">{definition.label} Sessions</h1>
    </div>
  )
}
