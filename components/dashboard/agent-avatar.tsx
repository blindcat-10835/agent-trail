'use client'

import type { AgentInfo } from '@/types/trace'
import { AGENT_STATUS_META } from './agent-status-meta'

export function AgentAvatar({ agent, size = 32 }: { agent: AgentInfo; size?: number }) {
  const glyph = agent.name.charAt(0).toUpperCase()

  return (
    <div
      className="hud-clip-sm border border-border-strong bg-background grid place-items-center font-bold shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        color: AGENT_STATUS_META[agent.latestStatus]?.color,
      }}
    >
      <span>{glyph}</span>
    </div>
  )
}
