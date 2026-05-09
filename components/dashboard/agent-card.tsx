'use client'

/**
 * Agent card for the OpenClaw dashboard overview
 *
 * Displays agent name, session count, status indicator, last active time,
 * and tool call count.
 */

import type { AgentInfo } from '@/types/trace'
import { AgentAvatar } from './agent-avatar'
import { AGENT_STATUS_META } from './agent-status-meta'

interface AgentCardProps {
  agent: AgentInfo
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'never'
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function AgentCard({ agent }: AgentCardProps) {
  const meta = AGENT_STATUS_META[agent.latestStatus] ?? AGENT_STATUS_META.unknown

  return (
    <div className="border border-border bg-card p-3 flex flex-col gap-2 hover:bg-accent/5 transition-colors">
      {/* Header row: avatar + name + status */}
      <div className="flex items-center gap-2.5">
        <AgentAvatar name={agent.name} statusColor={meta.color} />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold truncate">{agent.name}</span>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: meta.color }}
            />
            <span
              className="text-[10px] font-medium tracking-[0.1em] uppercase"
              style={{ color: meta.color }}
            >
              {meta.label}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border">
        <span>
          <span className="font-mono text-foreground font-bold">{agent.sessionCount}</span>{' '}
          session{agent.sessionCount !== 1 ? 's' : ''}
        </span>
        <span className="text-border">|</span>
        <span>
          <span className="font-mono text-foreground font-bold">{agent.toolCallCount}</span>{' '}
          tools
        </span>
        <span className="text-border">|</span>
        <span>{formatRelativeTime(agent.lastActiveAt)}</span>
      </div>
    </div>
  )
}
