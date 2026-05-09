'use client'

import { cn } from '@/lib/utils'
import type { AgentInfo } from '@/types/trace'
import { AgentAvatar } from './agent-avatar'
import { AGENT_STATUS_META } from './agent-status-meta'

interface AgentCardProps {
  agent: AgentInfo
}

export function AgentCard({ agent }: AgentCardProps) {
  const m = AGENT_STATUS_META[agent.latestStatus] ?? AGENT_STATUS_META.unknown

  return (
    <div
      className={cn(
        'hud-clip-md bg-card px-4 py-3.5 grid gap-2 hover:bg-accent/5 transition-colors relative outline outline-1 outline-border outline-offset-[-1px]',
        agent.latestStatus === 'error' && 'outline-destructive/50',
      )}
    >
      {/* Glowing left-edge status bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-0.5"
        style={{ background: m.color, boxShadow: `0 0 8px ${m.color}` }}
      />

      {/* Header: avatar + name + status badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <AgentAvatar agent={agent} />
          <div className="min-w-0">
            <div className="text-sm font-bold text-foreground truncate tracking-wide">
              {agent.name}
            </div>
            <div className="text-[10px] text-muted-foreground tracking-wider">
              {agent.sessionCount} session{agent.sessionCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <span
          className="hud-clip-sm inline-flex items-center gap-1 px-2 py-0.5 border text-[9px] tracking-[0.15em] uppercase font-bold shrink-0"
          style={{
            borderColor: m.color,
            color: m.color,
            background: `color-mix(in oklch, ${m.color} 10%, transparent)`,
          }}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full bg-current', m.live && 'animate-pulse')} />
          {m.label}
        </span>
      </div>

      {/* Footer: tool count + last active */}
      <div className="text-[11px] text-foreground/65">
        {agent.toolCallCount > 0 ? (
          <>
            <span className="text-accent mr-1">▸</span>
            {agent.toolCallCount} tool call{agent.toolCallCount !== 1 ? 's' : ''}
          </>
        ) : (
          <span className="text-muted-foreground">▸ standby</span>
        )}
      </div>
    </div>
  )
}
