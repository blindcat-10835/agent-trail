'use client'

import type { TimeWindow } from '@/types/overview'

interface TimeWindowSelectorProps {
  value: TimeWindow
  onChange: (value: TimeWindow) => void
}

const WINDOWS: { id: TimeWindow; label: string }[] = [
  { id: 'today', label: 'TODAY' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'all', label: 'ALL' },
]

export function TimeWindowSelector({ value, onChange }: TimeWindowSelectorProps) {
  return (
    <div className="range-toggle">
      {WINDOWS.map((w) => (
        <button
          key={w.id}
          type="button"
          onClick={() => onChange(w.id)}
          className={`range-tab${value === w.id ? ' active' : ''}`}
        >
          <span className="range-tab-corner range-tab-corner-tl" />
          <span className="range-tab-corner range-tab-corner-br" />
          <span className="range-tab-label">{w.label}</span>
        </button>
      ))}
    </div>
  )
}
