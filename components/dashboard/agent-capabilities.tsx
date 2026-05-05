'use client'

import { Badge } from '@/components/ui/badge'
import { Cpu, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentInfo } from '@/stores/gateway/gateway-store'

interface AgentCapabilitiesProps {
  agent: AgentInfo
  className?: string
}

// Placeholder: AgentInfo type doesn't include capabilities yet
// This will be populated when Gateway API provides this data
export function AgentCapabilities({ agent, className }: AgentCapabilitiesProps) {
  return (
    <div className={cn('p-4 border-t border-border space-y-3', className)}>
      {/* Models section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Cpu className="h-3 w-3" />
          <span>Models</span>
        </div>
        <div className="text-xs text-muted-foreground">
          No model information available
        </div>
      </div>

      {/* Tools section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Wrench className="h-3 w-3" />
          <span>Tools</span>
        </div>
        {agent.currentTool ? (
          <Badge variant="secondary" className="text-xs">
            {agent.currentTool}
          </Badge>
        ) : (
          <div className="text-xs text-muted-foreground">
            No tool information available
          </div>
        )}
      </div>
    </div>
  )
}
