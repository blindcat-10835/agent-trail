'use client'

import { cn } from '@/lib/utils'
import { HudPanel } from '@/components/hud/hud-panel'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <HudPanel className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
      {icon && <div className="text-muted-foreground mb-3">{icon}</div>}
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-xs text-muted-foreground mb-4">{description}</p>}
      {action}
    </HudPanel>
  )
}
