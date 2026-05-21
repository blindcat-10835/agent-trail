'use client'

import { useEffect, useRef, useState } from 'react'
import { Filter } from 'lucide-react'
import { cn, projectColor, shortPath } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export interface ProjectEntry {
  label: string
  count?: number
}

export interface SessionsFilterState {
  selectedProjects: Set<string>
  dateFrom: string
  dateTo: string
}

interface SessionsFilterPanelProps {
  projects: ProjectEntry[]
  state: SessionsFilterState
  onProjectToggle: (project: string) => void
  onDateFromChange: (date: string) => void
  onDateToChange: (date: string) => void
  onClearAll: () => void
}

// ============================================================================
// Helpers
// ============================================================================

function hasActiveFilters(state: SessionsFilterState): boolean {
  return state.selectedProjects.size > 0 || !!state.dateFrom || !!state.dateTo
}

// ============================================================================
// SessionsFilterPanel
// ============================================================================

export function SessionsFilterPanel({
  projects,
  state,
  onProjectToggle,
  onDateFromChange,
  onDateToChange,
  onClearAll,
}: SessionsFilterPanelProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const filtersActive = hasActiveFilters(state)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      {/* Funnel trigger */}
      <button
        type="button"
        className={cn(
          'sfp-trigger sl-newscan flex items-center gap-1.5',
          open && 'sfp-trigger--open',
          mounted && filtersActive && 'sfp-trigger--active',
        )}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Filter sessions"
        title="Filter sessions"
        aria-expanded={open}
      >
        <Filter
          className={cn(
            'h-[10px] w-[10px]',
            mounted && filtersActive ? 'text-[var(--accent)]' : 'text-current',
          )}
        />
        FILTER
        {mounted && filtersActive && (
          <span className="sfp-badge">{state.selectedProjects.size + (state.dateFrom || state.dateTo ? 1 : 0)}</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="sfp-panel">

          {/* BY PROJECT */}
          <div className="sfp-section">
            <div className="sfp-section-title">By Project</div>
            {projects.length === 0 ? (
              <div className="sfp-empty">No projects found</div>
            ) : (
              projects.map((entry) => {
                const selected = state.selectedProjects.has(entry.label)
                const pc = projectColor(entry.label)
                return (
                  <div
                    key={entry.label}
                    role="button"
                    tabIndex={0}
                    className={cn('sfp-project-row', selected && 'sfp-project-row--selected')}
                    style={{ '--proj-c': pc } as React.CSSProperties}
                    onClick={() => onProjectToggle(entry.label)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onProjectToggle(entry.label)
                      }
                    }}
                  >
                    <span className={cn('sfp-check', selected && 'sfp-check--on')}>
                      {selected && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1.5 4L3 5.5L6.5 2.5" />
                        </svg>
                      )}
                    </span>
                    <span className="sfp-proj-dot" style={{ background: pc }} />
                    <span className="sfp-proj-name">{shortPath(entry.label)}</span>
                    {selected && entry.count != null && (
                      <span className="sfp-proj-count">{entry.count}</span>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div className="sfp-divider" />

          {/* BY DATE RANGE */}
          <div className="sfp-section">
            <div className="sfp-section-title">By Date Range</div>
            <div className="sfp-date-row">
              <span className="sfp-date-label">FROM</span>
              <input
                type="date"
                className="sfp-date-input"
                value={state.dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
              />
            </div>
            <div className="sfp-date-row">
              <span className="sfp-date-label">TO</span>
              <input
                type="date"
                className="sfp-date-input"
                value={state.dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
              />
            </div>
          </div>

          {/* CLEAR ALL */}
          {filtersActive && (
            <>
              <div className="sfp-divider" />
              <button
                type="button"
                className="sfp-clear-btn"
                onClick={() => {
                  onClearAll()
                  setOpen(false)
                }}
              >
                Clear all
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
