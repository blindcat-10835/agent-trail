'use client'

import { cn } from '@/lib/utils'
import type { AgentInfo } from '@/stores/gateway/gateway-store'
import { AGENT_STATUS_META } from './agent-status-meta'
import { AgentAvatar } from './agent-avatar'

interface OverviewAgentCardProps {
  agent: AgentInfo
  selected: boolean
  onSelect: () => void
}

export function OverviewAgentCard({ agent, selected, onSelect }: OverviewAgentCardProps) {
  const m = AGENT_STATUS_META[agent.status] ?? AGENT_STATUS_META.idle

  return (
    <button
      onClick={onSelect}
      className={cn(
        'hud-clip-md bg-card px-4 py-3.5 grid gap-2 text-left hover:bg-accent/5 transition-colors relative outline outline-1 outline-border outline-offset-[-1px]',
        selected && 'bg-accent/10 outline-accent',
        agent.status === 'error' && 'outline-destructive/50'
      )}
    >
      <div className="absolute left-0 top-3 bottom-3 w-0.5" style={{ background: m.color, boxShadow: `0 0 8px ${m.color}` }} />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <AgentAvatar agent={agent} />
          <div className="min-w-0">
            <div className="text-sm font-bold text-foreground truncate tracking-wide">{agent.name}</div>
            <div className="text-[10px] text-muted-foreground tracking-wider truncate">{agent.id.slice(0, 8)}</div>
          </div>
        </div>
        <span
          className="hud-clip-sm inline-flex items-center gap-1 px-2 py-0.5 border text-[9px] tracking-[0.15em] uppercase font-bold flex-shrink-0"
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
      <div className="text-[11px] text-foreground/65 truncate">
        {agent.currentTool ? <><span className="text-accent mr-1">▸</span>{agent.currentTool}</> : <span className="text-muted-foreground">▸ standby</span>}
      </div>
    </button>
  )
}
