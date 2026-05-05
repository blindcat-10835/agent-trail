'use client'

import { cn } from '@/lib/utils'
import type { AgentInfo, AgentDisplayStatus } from '@/stores/gateway/gateway-store'

const STATUS_META: Record<AgentDisplayStatus, { label: string; color: string; live: boolean }> = {
  working: { label: 'WORKING', color: 'var(--color-accent)', live: true },
  tool_calling: { label: 'TOOL', color: 'oklch(0.72 0.14 220)', live: true },
  speaking: { label: 'SPEAKING', color: 'oklch(0.76 0.17 145)', live: true },
  idle: { label: 'IDLE', color: 'var(--color-muted-foreground)', live: false },
  error: { label: 'ERROR', color: 'var(--color-destructive)', live: false },
}

function fmtAgo(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

function fmtNum(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1e6) return (n / 1000).toFixed(1) + 'k'
  return (n / 1e6).toFixed(2) + 'm'
}

interface AgentCardProps {
  agent: AgentInfo
  isSelected?: boolean
  onClick?: () => void
  lastEvent?: { type: string; content: string; age: number } | null
  activityBars?: number[]
}

export function AgentCard({ agent, isSelected = false, onClick, lastEvent, activityBars }: AgentCardProps) {
  const meta = STATUS_META[agent.status]
  const glyph = agent.name.charAt(0).toUpperCase()
  const bars = activityBars ?? [2, 5, 3, 8, 4, 2, 6, 3, 7, 4, 5, 2]

  return (
    <div
      className={cn(
        'relative cursor-pointer transition-colors bg-card px-3.5 pt-3 pb-2.5 overflow-hidden',
        'hover:bg-accent/5',
        isSelected && 'bg-accent/10 outline outline-1 outline-accent outline-offset-[-1px]'
      )}
      style={{ '--status-color': meta.color } as React.CSSProperties}
      onClick={onClick}
    >
      {/* Status stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5"
        style={{ background: meta.color }}
      />

      {/* Row 1: identity + status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7 h-7 border border-border-strong grid place-items-center text-[13px] font-bold bg-background flex-shrink-0"
            style={{ color: meta.color }}
          >
            {glyph}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-foreground tracking-[0.02em] truncate">
              {agent.name}
            </div>
            <div className="text-[10px] text-muted-foreground tracking-[0.06em]">
              {agent.id.slice(0, 8)}{agent.isDefault ? ' · default' : ''}
            </div>
          </div>
        </div>
        <div
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 border text-[9.5px] tracking-[0.15em] uppercase font-semibold flex-shrink-0',
            meta.live && '[animation:blink_1.1s_ease-in-out_infinite]'
          )}
          style={{
            borderColor: meta.color,
            color: meta.color,
            background: `color-mix(in oklch, ${meta.color} 10%, transparent)`,
          }}
        >
          <span className="w-[5px] h-[5px] rounded-full bg-current" />
          {meta.label}
        </div>
      </div>

      {/* Tool row */}
      <div className="flex items-center gap-1.5 text-[11px] text-foreground/65 mb-1.5 min-h-[16px]">
        {agent.currentTool ? (
          <>
            <span className="text-accent">▸</span>
            <span className="text-foreground font-medium">{agent.currentTool}</span>
          </>
        ) : (
          <span className="text-muted-foreground">▸ awaiting dispatch</span>
        )}
      </div>

      {/* Last event */}
      {lastEvent && (
        <div className="flex gap-1.5 text-[11px] min-h-[28px] max-h-[28px] overflow-hidden border-t border-dashed border-border pt-1.5">
          <span className="text-muted-foreground flex-shrink-0">{fmtAgo(lastEvent.age)} ago</span>
          <span
            className={cn(
              'overflow-hidden text-ellipsis line-clamp-2 leading-[1.3]',
              lastEvent.type === 'tool' && 'text-[oklch(0.72_0.14_220)]',
              lastEvent.type === 'assistant' && 'text-[oklch(0.76_0.17_145)]',
              lastEvent.type === 'error' && 'text-destructive',
            )}
          >
            {lastEvent.content}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground tracking-[0.06em] font-mono">
        <div className="flex gap-2.5">
          <span>run <b className="text-foreground font-medium">—</b></span>
          <span>err <b className="text-foreground font-medium">0</b></span>
        </div>
        <div className="flex gap-px items-end h-3.5">
          {bars.map((v, i) => (
            <span
              key={i}
              className={cn(
                'block w-[2px]',
                i >= bars.length - 3 && agent.status !== 'idle'
                  ? 'bg-accent'
                  : 'bg-foreground-ghost'
              )}
              style={{ height: `${Math.max(2, (v / 18) * 14)}px` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
