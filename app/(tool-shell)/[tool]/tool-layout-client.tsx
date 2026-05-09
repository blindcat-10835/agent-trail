'use client'

import { type ReactNode, useEffect } from 'react'
import { AgentToolProvider } from '@/lib/agent-tools/client-hooks'
import { ShellFrame } from '@/components/shell/shell-frame'
import { useToolStore } from '@/stores/tool-store'
import type { AgentToolId } from '@/lib/agent-tools/types'

interface ToolLayoutClientProps {
  toolId: AgentToolId
  children: ReactNode
}

export function ToolLayoutClient({ toolId, children }: ToolLayoutClientProps) {
  const setSelectedToolId = useToolStore((s) => s.setSelectedToolId)
  const setSelectedSessionId = useToolStore((s) => s.setSelectedSessionId)

  // Sync tool store on mount and tool change
  useEffect(() => {
    setSelectedToolId(toolId)
    if (toolId === 'all') {
      setSelectedSessionId(null)
    }
  }, [toolId, setSelectedToolId, setSelectedSessionId])

  return (
    <AgentToolProvider toolId={toolId}>
      <ShellFrame>
        {children}
      </ShellFrame>
    </AgentToolProvider>
  )
}
