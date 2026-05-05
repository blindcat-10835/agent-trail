import { cn } from '@/lib/utils'

interface GlowEffectProps {
  children: React.ReactNode
  intensity?: 'low' | 'medium' | 'high'
  color?: string
  className?: string
}

export function GlowEffect({ children, intensity = 'medium', color, className }: GlowEffectProps) {
  const spread = intensity === 'low' ? 8 : intensity === 'high' ? 20 : 12
  const opacity = intensity === 'low' ? 0.08 : intensity === 'high' ? 0.15 : 0.1
  const glowColor = color || 'var(--color-accent)'

  return (
    <div className={cn('relative', className)}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: `0 0 ${spread}px ${glowColor}, 0 0 ${spread * 2}px ${glowColor}`,
          opacity,
        }}
      />
      {children}
    </div>
  )
}
