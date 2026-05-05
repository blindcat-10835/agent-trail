/* eslint-disable */
'use client'

import { useState, useEffect, useMemo } from 'react'
import { SessionInfo } from '@/gateway/adapter-types'
import { useGatewayStore } from '@/stores/gateway/gateway-store'
import { AgentAvatar } from '@/components/dashboard/overview/agent-avatar'
import { ChatBubble, type ChatMessage } from './chat-bubble'

interface SessionsDetailRailProps {
  session: SessionInfo | null
  onClose: () => void
}

// Helper: compute session status
function computeSessionStatus(session: SessionInfo | null): 'active' | 'idle' | 'aborted' | null {
  if (!session) return null
  if (session.aborted) return 'aborted'
  if (!session.updatedAt) return 'idle'

  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
  return session.updatedAt > fiveMinutesAgo ? 'active' : 'idle'
}

// Status badge component
function StatusBadge({ status }: { status: 'active' | 'idle' | 'aborted' }) {
  if (status === 'active') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[oklch(0.76_0.17_145)] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[oklch(0.76_0.17_145)]"></span>
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[oklch(0.76_0.17_145)]">
          ACTIVE
        </span>
      </div>
    )
  }

  if (status === 'idle') {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        IDLE
      </span>
    )
  }

  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive">
      ABORTED
    </span>
  )
}

export function SessionsDetailRail({ session, onClose }: SessionsDetailRailProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const agentsMap = useGatewayStore((s) => s.agents)
  const ownerAgent = useMemo(
    () => Array.from(agentsMap.values()).find(a => a.activeSessionKey === session?.key) ?? null,
    [agentsMap, session?.key]
  )

  // Fetch messages when session changes
  useEffect(() => {
    if (!session) {
      setMessages([])
      return
    }

    const sessionId = session.sessionId || session.key
    if (!sessionId) return

    setLoading(true)
    setError(null)

    fetch(`/api/sessions/messages?id=${encodeURIComponent(sessionId)}`)
      .then(res => {
        if (!res.ok) return []
        return res.json()
      })
      .then((data: ChatMessage[]) => {
        setMessages(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => {
        setMessages([])
        setLoading(false)
      })
  }, [session])

  if (!session) return null

  const status = computeSessionStatus(session)
  const modelShort = session.model?.split('/').pop() || '-'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
        style={{ animation: 'drawer-fade-in .15s ease' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-screen z-50 bg-background border-l border-border flex flex-col overflow-hidden"
        style={{ width: 'min(640px, 90vw)', animation: 'drawer-slide-in .22s cubic-bezier(.2,.8,.2,1)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3.5 px-5 py-4 border-b border-border bg-card flex-shrink-0 relative">
          {/* Bottom accent line */}
          <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)', opacity: 0.6 }} />

          {/* Agent avatar or placeholder */}
          {ownerAgent ? (
            <AgentAvatar agent={ownerAgent} size={40} />
          ) : (
            <div className="hud-clip-sm border border-border w-10 h-10 grid place-items-center text-muted-foreground text-base flex-shrink-0">
              ◉
            </div>
          )}

          {/* Session label + subline */}
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-foreground truncate">
              {session.label || session.key}
            </div>
            <div className="text-[10.5px] text-muted-foreground font-mono truncate">
              {ownerAgent ? ownerAgent.name : 'No agent'} · {modelShort}
            </div>
          </div>

          {/* Status badge + close */}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {status && <StatusBadge status={status} />}
            <button
              onClick={onClose}
              className="w-7 h-7 hud-clip-sm border border-border grid place-items-center text-muted-foreground text-sm hover:text-foreground hover:border-foreground/30 transition-colors"
              aria-label="Close details"
            >
              ✕
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 border-b border-border bg-card flex-shrink-0">
          {[
            { label: 'TOKENS', value: (session.totalTokens || 0).toLocaleString() },
            { label: 'COST', value: '$' + (session.cost || 0).toFixed(2) },
            { label: 'KIND', value: session.kind || '-' },
            { label: 'CREATED', value: session.createdAt ? new Date(session.createdAt).toLocaleDateString() : '-' },
          ].map((kpi) => (
            <div key={kpi.label} className="px-4 py-3 border-r border-border last:border-r-0">
              <div className="text-[9px] text-muted-foreground tracking-[0.2em] uppercase">{kpi.label}</div>
              <div className="text-sm font-bold mt-1 tabular-nums">{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Messages section */}
        <div className="flex-1 min-h-0 overflow-auto flex flex-col">
          {/* Messages header */}
          <div className="px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
            <span className="text-[9px] text-accent tracking-[0.25em] uppercase font-semibold">
              MESSAGE HISTORY
            </span>
          </div>

          {/* Messages list */}
          <div className="flex-1 px-4 py-3 overflow-auto">
            {loading && (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
              </div>
            )}

            {error && (
              <div className="text-destructive text-sm text-center py-8">
                {error}
              </div>
            )}

            {!loading && !error && messages.length === 0 && (
              <div className="text-muted-foreground text-sm text-center py-8">
                No messages
              </div>
            )}

            {!loading && !error && messages.length > 0 && (
              <>
                {messages.slice(0, 100).map((msg, idx) => (
                  <ChatBubble key={idx} message={msg} />
                ))}
                {messages.length > 100 && (
                  <div className="text-muted-foreground text-xs text-center py-2">
                    Showing 100 of {messages.length} messages
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
