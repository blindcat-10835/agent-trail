'use client'

import type { AgentInfo } from '@/stores/gateway/gateway-store'
import type { LogEntry } from '@/types/log'
import type { GlobalEventFeedItem } from '@/stores/gateway/p0-types'
import { cn } from '@/lib/utils'
import { AGENT_STATUS_META } from './agent-status-meta'
import { AgentAvatar } from './agent-avatar'

interface OverviewAgentDrawerProps {
  agent: AgentInfo
  logs: LogEntry[]
  events: GlobalEventFeedItem[]
  onClose: () => void
}

export function OverviewAgentDrawer({ agent, logs, events, onClose }: OverviewAgentDrawerProps) {
  const m = AGENT_STATUS_META[agent.status] ?? AGENT_STATUS_META.idle
  const typeShort = (t: string) =>
    t === 'lifecycle' ? 'LFC' : t === 'tool' ? 'TOL' : t === 'assistant' ? 'AST' : 'ERR'

  return (
    <>
      {/* Mask */}
      <div
        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
        style={{ animation: 'drawer-fade-in .15s ease' }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-screen z-50 bg-background border-l border-border flex flex-col overflow-hidden"
        style={{
          width: 'min(740px, 92vw)',
          animation: 'drawer-slide-in .22s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3.5 px-5 py-4 border-b border-border bg-card flex-shrink-0 relative">
          <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${m.color}, transparent)`, opacity: 0.6 }} />
          <AgentAvatar agent={agent} size={40} />
          <div className="min-w-0">
            <div className="text-base font-bold text-foreground tracking-wide">{agent.name}</div>
            <div className="text-[10.5px] text-muted-foreground tracking-wider">{agent.id.slice(0, 12)}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 border text-[9px] tracking-[0.15em] uppercase font-bold"
              style={{
                borderColor: m.color,
                color: m.color,
                background: `color-mix(in oklch, ${m.color} 10%, transparent)`,
              }}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full bg-current', m.live && 'animate-pulse')} />
              {m.label}
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 hud-clip-sm border border-border grid place-items-center text-muted-foreground text-sm hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 border-b border-border bg-card flex-shrink-0">
          {([
            { label: 'STATUS', value: m.label, color: m.color },
            { label: 'TOOL', value: agent.currentTool || '—', color: undefined },
            { label: 'SESSION', value: agent.activeSessionKey ? 'active' : 'none', color: undefined },
            { label: 'DEFAULT', value: agent.isDefault ? 'yes' : 'no', color: undefined },
          ] as const).map((kpi) => (
            <div key={kpi.label} className="px-4 py-3 border-r border-border last:border-r-0">
              <div className="text-[9px] text-muted-foreground tracking-[0.2em] uppercase">{kpi.label}</div>
              <div className="text-sm font-bold mt-1" style={kpi.color ? { color: kpi.color } : undefined}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        {/* Body: events + identity */}
        <div className="flex-1 min-h-0 grid grid-cols-[1fr_220px] overflow-hidden">
          {/* Main: event timeline */}
          <div className="p-5 overflow-y-auto border-r border-border">
            <div className="text-[9px] text-accent tracking-[0.25em] uppercase font-semibold mb-2 pb-1 border-b border-border">
              EVENTS · last {events.length}
            </div>
            {events.length === 0 && (
              <div className="py-4 text-muted-foreground text-[11px]">No recent events.</div>
            )}
            <div className="border border-border">
              {events.map((e, i) => (
                <div key={i} className="grid grid-cols-[52px_10px_40px_1fr] gap-2 px-2.5 py-1.5 border-b border-border last:border-b-0 items-baseline text-[11px]">
                  <span className="text-muted-foreground text-[10px] tabular-nums font-mono">
                    {String(new Date(e.time).getHours()).padStart(2, '0')}:{String(new Date(e.time).getMinutes()).padStart(2, '0')}:{String(new Date(e.time).getSeconds()).padStart(2, '0')}
                  </span>
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full self-center',
                    e.type === 'tool' && 'bg-[oklch(0.72_0.14_220)]',
                    e.type === 'assistant' && 'bg-[oklch(0.76_0.17_145)]',
                    e.type === 'error' && 'bg-destructive',
                    e.type === 'lifecycle' && 'bg-muted-foreground',
                  )} />
                  <span className="text-[9px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                    {typeShort(e.type)}
                  </span>
                  <span className="text-foreground/65 truncate">{e.content}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Aside: identity + logs */}
          <div className="p-4 overflow-y-auto bg-card">
            <div className="text-[9px] text-accent tracking-[0.25em] uppercase font-semibold mb-2 pb-1 border-b border-border">
              IDENTITY
            </div>
            <dl className="grid grid-cols-[56px_1fr] gap-1 text-[10.5px] mb-4">
              <dt className="text-muted-foreground tracking-[0.1em]">ID</dt>
              <dd className="text-foreground font-mono text-[10px] break-all">{agent.id.slice(0, 16)}</dd>
              <dt className="text-muted-foreground tracking-[0.1em]">STATUS</dt>
              <dd style={{ color: m.color }}>{m.label}</dd>
              <dt className="text-muted-foreground tracking-[0.1em]">TOOL</dt>
              <dd className="text-foreground truncate">{agent.currentTool || '—'}</dd>
              <dt className="text-muted-foreground tracking-[0.1em]">SESSION</dt>
              <dd className="text-foreground">{agent.activeSessionKey ? 'active' : 'none'}</dd>
              <dt className="text-muted-foreground tracking-[0.1em]">DEFAULT</dt>
              <dd className="text-foreground">{agent.isDefault ? 'yes' : 'no'}</dd>
            </dl>

            {logs.length > 0 && (
              <>
                <div className="text-[9px] text-accent tracking-[0.25em] uppercase font-semibold mb-2 pb-1 border-b border-border">
                  LOG · last {logs.length}
                </div>
                <div className="font-mono text-[10px] max-h-[200px] overflow-y-auto">
                  {logs.map((l, i) => (
                    <div key={i} className="py-0.5 border-b border-border last:border-b-0">
                      <span className="text-muted-foreground mr-1">{l.time}</span>
                      <span className={cn(
                        l.type === 'error' && 'text-destructive',
                        l.type === 'tool' && 'text-[oklch(0.72_0.14_220)]',
                        l.type === 'assistant' && 'text-[oklch(0.76_0.17_145)]',
                      )}>{l.content}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
