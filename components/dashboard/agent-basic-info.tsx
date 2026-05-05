'use client'

import { Badge } from '@/components/ui/badge'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentInfo } from '@/stores/gateway/gateway-store'

interface AgentBasicInfoProps {
  agent: AgentInfo
  className?: string
}

// Agent status colors (reuse from Plan 4.1)
const statusColors: Record<AgentInfo['status'], string> = {
  idle: 'oklch(0.55 0.008 160)',        // gray-500
  working: 'oklch(0.62 0.17 65)',       // blue-500 (accent)
  tool_calling: 'oklch(0.8 0.17 75)',   // yellow-500 (accent)
  speaking: 'oklch(0.65 0.15 145)',     // green-500
  error: 'oklch(0.577 0.245 27.325)',   // red-500 (destructive)
}

export function AgentBasicInfo({ agent, className }: AgentBasicInfoProps) {
  const statusColor = statusColors[agent.status]

  // Calculate session duration
  const sessionDuration = agent.sessionStartedAt
    ? Math.floor((Date.now() - agent.sessionStartedAt) / 1000)
    : null

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={cn('p-4 border-b border-border space-y-3', className)}>
      {/* Avatar + Name */}
      <div className="flex items-center gap-3">
        {agent.avatarUrl ? (
          <img
            src={agent.avatarUrl}
            alt={agent.name}
            className="w-12 h-12 rounded bg-muted"
          />
        ) : (
          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-lg font-semibold">
            {agent.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground truncate">{agent.name}</div>
          <div className="flex items-center gap-2 mt-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
            <span className="text-xs text-muted-foreground capitalize">{agent.status}</span>
          </div>
        </div>
      </div>

      {/* Current tool (if any) */}
      {agent.currentTool && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {agent.currentTool}
          </Badge>
        </div>
      )}

      {/* Session duration */}
      {sessionDuration !== null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Session: {formatDuration(sessionDuration)}</span>
        </div>
      )}

      {/* Agent ID */}
      <div className="text-xs text-muted-foreground font-mono">
        ID: {agent.id}
      </div>
    </div>
  )
}
