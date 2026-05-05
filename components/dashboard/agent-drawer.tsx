'use client'

import { useMemo } from 'react'
import { useGatewayStore } from '@/stores/gateway/gateway-store'
import { cn } from '@/lib/utils'
import type { AgentInfo, AgentDisplayStatus } from '@/stores/gateway/gateway-store'

const STATUS_META: Record<AgentDisplayStatus, { label: string; color: string }> = {
  working: { label: 'WORKING', color: 'var(--color-accent)' },
  tool_calling: { label: 'TOOL', color: 'oklch(0.72 0.14 220)' },
  speaking: { label: 'SPEAKING', color: 'oklch(0.76 0.17 145)' },
  idle: { label: 'IDLE', color: 'var(--color-muted-foreground)' },
  error: { label: 'ERROR', color: 'var(--color-destructive)' },
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function fmtAgo(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

interface AgentDrawerProps {
  agent: AgentInfo
  onClose: () => void
}

export function AgentDrawer({ agent, onClose }: AgentDrawerProps) {
  const meta = STATUS_META[agent.status]
  const glyph = agent.name.charAt(0).toUpperCase()
  const agentLogs = useGatewayStore((s) => s.agentLogs[agent.id] ?? [])
  const globalEventFeed = useGatewayStore((s) => s.globalEventFeed)

  const ownEvents = useMemo(
    () => globalEventFeed.filter((e) => e.agentId === agent.id).slice(0, 20),
    [globalEventFeed, agent.id]
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-foreground/10 z-40 animate-[fade-in_0.15s_ease]"
        onClick={onClose}
      />
      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 h-screen w-[min(720px,90vw)] bg-background border-l border-border-strong z-50 grid grid-rows-[auto_auto_1fr] animate-[slide-in_0.22s_cubic-bezier(0.2,0.8,0.2,1)] overflow-hidden"
        role="dialog"
        aria-label={`Agent ${agent.name}`}
      >
        {/* Head */}
        <header className="grid grid-cols-[auto_1fr_auto] gap-3.5 items-center px-5 py-4 border-b border-border bg-card">
          <div
            className="w-10 h-10 border border-border-strong grid place-items-center text-base font-bold bg-background"
            style={{ color: meta.color }}
          >
            {glyph}
          </div>
          <div>
            <div className="text-base font-semibold text-foreground tracking-[0.02em]">
              {agent.name}
            </div>
            <div className="text-[11px] text-muted-foreground tracking-[0.06em] mt-0.5">
              {agent.id} · <span className="text-foreground/65">{agent.isDefault ? 'default' : ''}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-6.5 h-6.5 border border-border grid place-items-center text-muted-foreground hover:text-foreground hover:border-foreground"
          >
            ✕
          </button>
        </header>

        {/* Stats row */}
        <div className="grid grid-cols-4 border-b border-border bg-card">
          {[
            { label: 'STATUS', value: meta.label, color: meta.color },
            { label: 'CURRENT TOOL', value: agent.currentTool || '—' },
            { label: 'SESSIONS', value: agent.activeSessionKey ? '1' : '0' },
            { label: 'EVENTS', value: String(ownEvents.length) },
          ].map((k) => (
            <div key={k.label} className="px-4 py-3 border-r border-border last:border-r-0">
              <div className="text-[9.5px] text-muted-foreground tracking-[0.2em] uppercase mb-1">{k.label}</div>
              <div className="text-lg font-semibold tabular-nums" style={{ color: k.color }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="grid grid-cols-[1fr_240px] min-h-0 overflow-hidden">
          {/* Main column */}
          <div className="px-5 py-4 overflow-y-auto border-r border-border">
            {/* Event timeline */}
            <section className="mb-4">
              <div className="text-[9.5px] text-muted-foreground tracking-[0.22em] uppercase mb-2 pb-1 border-b border-dashed border-border">
                LIVE EVENT TIMELINE · last {ownEvents.length}
              </div>
              <div className="border border-border bg-card">
                {ownEvents.length === 0 && (
                  <div className="grid grid-cols-[60px_16px_60px_1fr] gap-2 px-2.5 py-1.5 text-[11px] items-baseline">
                    <span className="text-muted-foreground text-[10px] tabular-nums">--:--:--</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground self-center" />
                    <span className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">WAITING</span>
                    <span className="text-muted-foreground">No live events yet.</span>
                  </div>
                )}
                {ownEvents.map((e, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[60px_16px_60px_1fr] gap-2 px-2.5 py-1.5 border-b border-border last:border-b-0 text-[11px] items-baseline"
                  >
                    <span className="text-muted-foreground text-[10px] tabular-nums">{fmtTime(e.time)}</span>
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full self-center',
                        e.type === 'tool' && 'bg-[oklch(0.72_0.14_220)]',
                        e.type === 'assistant' && 'bg-[oklch(0.76_0.17_145)]',
                        e.type === 'error' && 'bg-destructive',
                        e.type === 'lifecycle' && 'bg-muted-foreground',
                      )}
                    />
                    <span className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{e.type}</span>
                    <span className="text-foreground/65">{e.content}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Log stream */}
            <section>
              <div className="text-[9.5px] text-muted-foreground tracking-[0.22em] uppercase mb-2 pb-1 border-b border-dashed border-border">
                LOG · last {agentLogs.length}
              </div>
              <div className="border border-border bg-card max-h-[300px] overflow-y-auto font-mono text-[11px]">
                {agentLogs.length === 0 && (
                  <div className="px-3 py-4 text-muted-foreground">No logs available.</div>
                )}
                {agentLogs.map((log, i) => (
                  <div key={i} className="px-3 py-1.5 border-b border-border last:border-b-0">
                    <span className="text-muted-foreground mr-2">{log.time}</span>
                    <span className={cn(
                      log.type === 'error' && 'text-destructive',
                      log.type === 'tool' && 'text-[oklch(0.72_0.14_220)]',
                      log.type === 'assistant' && 'text-[oklch(0.76_0.17_145)]',
                    )}>
                      {log.content}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Aside column */}
          <div className="px-4 py-4 overflow-y-auto bg-card">
            {/* Identity */}
            <section className="mb-4">
              <div className="text-[9.5px] text-muted-foreground tracking-[0.22em] uppercase mb-2 pb-1 border-b border-dashed border-border">
                IDENTITY
              </div>
              <dl className="grid grid-cols-[80px_1fr] gap-1 text-[11px]">
                <dt className="text-muted-foreground tracking-[0.1em]">ID</dt>
                <dd className="text-foreground tabular-nums break-all">{agent.id}</dd>
                <dt className="text-muted-foreground tracking-[0.1em]">STATUS</dt>
                <dd style={{ color: meta.color }}>{meta.label}</dd>
                <dt className="text-muted-foreground tracking-[0.1em]">DEFAULT</dt>
                <dd className="text-foreground">{agent.isDefault ? 'yes' : 'no'}</dd>
              </dl>
            </section>

            {/* Actions */}
            <section>
              <div className="text-[9.5px] text-muted-foreground tracking-[0.22em] uppercase mb-2 pb-1 border-b border-dashed border-border">
                ACTIONS
              </div>
              <div className="grid gap-1">
                {['Pause agent', 'Flush context', 'Download logs'].map((a) => (
                  <button
                    key={a}
                    className="text-left px-2.5 py-1.5 text-[11px] tracking-[0.06em] text-foreground/65 border border-border hover:text-foreground hover:border-accent transition-colors"
                  >
                    › {a}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </aside>
    </>
  )
}
