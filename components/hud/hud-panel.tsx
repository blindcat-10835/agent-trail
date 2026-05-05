import { cn } from '@/lib/utils'

interface HudPanelProps {
  children: React.ReactNode
  className?: string
}

export function HudPanel({ children, className }: HudPanelProps) {
  return (
    <div className={cn('bg-card border border-border', className)}>
      {children}
    </div>
  )
}
