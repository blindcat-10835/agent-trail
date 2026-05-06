'use client'

import { cn } from '@/lib/utils'
import { HudPanel } from '@/components/hud/hud-panel'

interface EmptyStateProps {
  icon?: React.ReactNode
  /** Primary label (accepts 'title' or 'heading' — heading takes precedence) */
  title?: string
  /** HUD-style uppercase heading — alternative to title (takes precedence) */
  heading?: string
  /** Descriptive body text (accepts 'description' or 'body' — body takes precedence) */
  description?: string
  /** HUD-style lowercase body — alternative to description (takes precedence) */
  body?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, heading, description, body, action, className }: EmptyStateProps) {
  const displayHeading = heading || title || ''
  const displayBody = body || description || ''

  return (
    <HudPanel className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
      {icon && <div className="text-muted-foreground mb-3">{icon}</div>}
      {displayHeading && (
        <h3 className="text-[11px] font-bold text-foreground uppercase tracking-[0.12em] mb-1">
          {displayHeading}
        </h3>
      )}
      {displayBody && (
        <p className="text-[10px] text-muted-foreground max-w-sm leading-relaxed uppercase tracking-[0.05em] mb-4">
          {displayBody}
        </p>
      )}
      {action}
    </HudPanel>
  )
}
