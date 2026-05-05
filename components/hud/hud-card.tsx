import { cn } from '@/lib/utils'

interface HudCardProps {
  children: React.ReactNode
  variant?: 'sm' | 'md' | 'lg'
  glow?: boolean
  className?: string
}

export function HudCard({ children, variant = 'md', glow = false, className }: HudCardProps) {
  return (
    <div
      className={cn(
        'bg-card border border-border outline outline-1 outline-offset-[-1px]',
        {
          'hud-clip-sm': variant === 'sm',
          'hud-clip-md': variant === 'md',
          'hud-clip-lg': variant === 'lg',
          'hud-glow': glow,
        },
        className
      )}
    >
      {children}
    </div>
  )
}
