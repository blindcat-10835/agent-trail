'use client'

import { useRef } from 'react'
import type { AgentInfo } from '@/stores/gateway/gateway-store'
import { AGENT_STATUS_META } from './agent-status-meta'

export function AgentAvatar({ agent, size = 32 }: { agent: AgentInfo; size?: number }) {
  const imgRef = useRef<HTMLImageElement>(null)
  const glyph = agent.name.charAt(0).toUpperCase()
  const fallback = agent.emoji ?? glyph

  return (
    <div
      className="hud-clip-sm border border-border-strong bg-background grid place-items-center font-bold flex-shrink-0 overflow-hidden"
      style={{ width: size, height: size, fontSize: size * 0.5, color: AGENT_STATUS_META[agent.status]?.color }}
    >
      {agent.avatarUrl ? (
        <img
          ref={imgRef}
          src={agent.avatarUrl}
          alt={agent.name}
          className="w-full h-full object-cover"
          onError={() => { if (imgRef.current) imgRef.current.style.display = 'none' }}
        />
      ) : (
        <span>{fallback}</span>
      )}
    </div>
  )
}
