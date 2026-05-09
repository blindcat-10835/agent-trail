'use client'

/**
 * Agent avatar — first-character glyph with status-colored border
 */

interface AgentAvatarProps {
  name: string
  statusColor?: string
  size?: number
}

export function AgentAvatar({ name, statusColor, size = 32 }: AgentAvatarProps) {
  const glyph = name.charAt(0).toUpperCase()

  return (
    <div
      className="flex items-center justify-center rounded border font-mono font-bold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        borderColor: statusColor ?? 'var(--color-border)',
        color: statusColor ?? 'var(--color-foreground)',
      }}
    >
      {glyph}
    </div>
  )
}
