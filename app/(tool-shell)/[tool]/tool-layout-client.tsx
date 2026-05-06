'use client'

import { type ReactNode, useEffect } from 'react'
import { AgentToolProvider } from '@/lib/agent-tools/client-hooks'
import { ShellFrame } from '@/components/shell/shell-frame'
import { GatewayBootstrap } from '@/components/hud/gateway-bootstrap'
import { useToolStore } from '@/stores/tool-store'
import type { AgentToolId } from '@/lib/agent-tools/types'

interface ToolLayoutClientProps {
  toolId: AgentToolId
  children: ReactNode
}

export function ToolLayoutClient({ toolId, children }: ToolLayoutClientProps) {
  const setSelectedToolId = useToolStore((s) => s.setSelectedToolId)

  // Sync tool store on mount and tool change
  useEffect(() => {
    setSelectedToolId(toolId)
  }, [toolId, setSelectedToolId])

  return (
    <AgentToolProvider toolId={toolId}>
      <ShellFrame
        gatewayBootstrap={toolId === 'openclaw' ? <GatewayBootstrap /> : null}
      >
        {children}
      </ShellFrame>
    </AgentToolProvider>
  )
}
