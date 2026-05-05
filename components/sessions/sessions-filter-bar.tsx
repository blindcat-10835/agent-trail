/* eslint-disable */
'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { SessionInfo } from '@/gateway/adapter-types'

export function useSessionsFilter(sessions: SessionInfo[]) {
  const [filters, setFilters] = useState({
    status: 'all' as 'all' | 'active' | 'idle' | 'aborted',
    model: 'all' as string,
    kind: 'all' as string,
    search: '' as string
  })

  const filtered = useMemo(() => sessions.filter(s => {
    if (filters.status !== 'all') {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      const updatedAt = s.updatedAt ?? 0
      const isActive = updatedAt > fiveMinutesAgo && !s.aborted
      const isIdle = updatedAt <= fiveMinutesAgo && !s.aborted
      const isAborted = s.aborted === true

      if (filters.status === 'active' && !isActive) return false
      if (filters.status === 'idle' && !isIdle) return false
      if (filters.status === 'aborted' && !isAborted) return false
    }

    if (filters.model !== 'all') {
      const shortModel = s.model?.split('/').pop() ?? ''
      if (shortModel !== filters.model) return false
    }

    if (filters.kind !== 'all' && s.kind !== filters.kind) return false

    if (filters.search && !s.label?.toLowerCase().includes(filters.search.toLowerCase())) {
      return false
    }

    return true
  }), [sessions, filters])

  return { filters, setFilters, filtered }
}

interface SessionsFilterBarProps {
  filters: ReturnType<typeof useSessionsFilter>['filters']
  setFilters: ReturnType<typeof useSessionsFilter>['setFilters']
  availableModels: string[]
  availableKinds: string[]
}

export function SessionsFilterBar({ filters, setFilters, availableModels, availableKinds }: SessionsFilterBarProps) {
  const [expanded, setExpanded] = useState(false)

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'idle', label: 'Idle' },
    { value: 'aborted', label: 'Aborted' }
  ] as const

  function FilterChip({ value, label, group }: { value: string; label: string; group: 'status' | 'model' | 'kind' }) {
    const isSelected = group === 'status' ? filters.status === value :
                       group === 'model' ? filters.model === value :
                       filters.kind === value

    return (
      <button
        onClick={() => {
          if (group === 'status') setFilters(prev => ({ ...prev, status: value as any }))
          else if (group === 'model') setFilters(prev => ({ ...prev, model: value }))
          else setFilters(prev => ({ ...prev, kind: value }))
        }}
        className={cn(
          'px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] border rounded transition-all',
          isSelected
            ? 'bg-accent text-accent-foreground border-accent'
            : 'bg-card text-muted-foreground border-border hover:bg-accent/5 hover:border-border/80'
        )}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="border border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-2 hover:bg-accent/5 transition-colors"
      >
        <span className="text-foreground font-semibold text-[9.5px] tracking-[0.2em] uppercase inline-flex items-center gap-2">
          <span className="w-1 h-1 bg-accent" />
          FILTERS
        </span>
        <span className="text-muted-foreground text-xs">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border">
          {/* Status filters */}
          <div className="space-y-1.5">
            <div className="text-[9.5px] text-muted-foreground uppercase tracking-[0.15em]">STATUS</div>
            <div className="flex flex-wrap gap-1.5">
              {statusOptions.map(opt => (
                <FilterChip key={opt.value} value={opt.value} label={opt.label} group="status" />
              ))}
            </div>
          </div>

          {/* Model filters */}
          <div className="space-y-1.5">
            <div className="text-[9.5px] text-muted-foreground uppercase tracking-[0.15em]">MODEL</div>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip value="all" label="All" group="model" />
              {availableModels.map(model => (
                <FilterChip key={model} value={model} label={model} group="model" />
              ))}
            </div>
          </div>

          {/* Kind filters */}
          <div className="space-y-1.5">
            <div className="text-[9.5px] text-muted-foreground uppercase tracking-[0.15em]">KIND</div>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip value="all" label="All" group="kind" />
              {availableKinds.map(kind => (
                <FilterChip key={kind} value={kind} label={kind} group="kind" />
              ))}
            </div>
          </div>

          {/* Search input */}
          <div className="space-y-1.5">
            <div className="text-[9.5px] text-muted-foreground uppercase tracking-[0.15em]">SEARCH</div>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Search sessions..."
              className="w-full px-3 py-1.5 text-[11px] bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent placeholder:text-muted-foreground/50"
            />
          </div>
        </div>
      )}
    </div>
  )
}
