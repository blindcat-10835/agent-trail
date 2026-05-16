'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface HudFrameProps {
  label?: string
  right?: ReactNode
  glow?: boolean
  className?: string
  bodyClassName?: string
  children: ReactNode
}

export function HudFrame({ label, right, glow, className, bodyClassName, children }: HudFrameProps) {
  return (
    <section
      className={cn('relative bg-card border border-border flex flex-col', className)}
      style={
        glow
          ? {
              boxShadow:
                '0 0 14px color-mix(in oklch, var(--accent) 10%, transparent), inset 0 0 24px color-mix(in oklch, var(--accent) 4%, transparent)',
              borderColor: 'color-mix(in oklch, var(--accent) 30%, var(--border))',
            }
          : undefined
      }
    >
      {/* HUD corner ticks */}
      <span className="absolute -top-px -left-px w-[9px] h-[9px] border border-accent border-r-0 border-b-0 pointer-events-none z-10" />
      <span className="absolute -top-px -right-px w-[9px] h-[9px] border border-accent border-l-0 border-b-0 pointer-events-none z-10" />
      <span className="absolute -bottom-px -left-px w-[9px] h-[9px] border border-accent border-r-0 border-t-0 pointer-events-none z-10" />
      <span className="absolute -bottom-px -right-px w-[9px] h-[9px] border border-accent border-l-0 border-t-0 pointer-events-none z-10" />

      {label !== undefined && (
        <header className="flex items-center gap-3 px-3.5 py-[9px] border-b border-border/70 shrink-0">
          <span className="text-[9.5px] font-bold tracking-[0.22em] text-muted-foreground uppercase">
            {label}
          </span>
          <span
            className="flex-1 h-px"
            style={{
              background:
                'repeating-linear-gradient(90deg, color-mix(in oklch, var(--border) 80%, transparent) 0 4px, transparent 4px 8px)',
            }}
          />
          {right && <span className="text-[10px]">{right}</span>}
        </header>
      )}

      <div className={cn('flex-1 min-h-0', bodyClassName ?? 'p-3.5')}>
        {children}
      </div>
    </section>
  )
}
