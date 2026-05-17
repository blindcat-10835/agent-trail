'use client'

import { cn } from '@/lib/utils'
import type { TimeWindow } from '@/types/overview'

// ============================================================================
// Props
// ============================================================================

interface TimeWindowSelectorProps {
  value: TimeWindow
  onChange: (value: TimeWindow) => void
}

// ============================================================================
// Constants
// ============================================================================

const WINDOWS: { id: TimeWindow; label: string }[] = [
  { id: 'today', label: 'TODAY' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'all', label: 'ALL' },
]

// ============================================================================
// Component
// ============================================================================

export function TimeWindowSelector({ value, onChange }: TimeWindowSelectorProps) {
  return (
    <div className="flex items-center gap-0">
      {WINDOWS.map((w) => (
        <button
          key={w.id}
          type="button"
          onClick={() => onChange(w.id)}
          className={cn(
            'px-3 py-1.5 text-[10px] font-bold tracking-[0.15em] transition-colors',
            value === w.id
              ? 'bg-accent text-accent-foreground hud-clip-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {w.label}
        </button>
      ))}
    </div>
  )
}
