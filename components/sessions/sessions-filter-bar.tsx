'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

// ============================================================================
// Types
// ============================================================================

/**
 * Filter state consumed by useToolSessions and forwarded to ingest API.
 * All fields are optional — unset filters are not sent in the query.
 */
export interface SessionFilters {
  status?: string
  model?: string
  search?: string
  sort?: string
  order?: string
}

interface SessionsFilterBarProps {
  filters: SessionFilters
  onFiltersChange: (filters: SessionFilters) => void
  availableModels?: string[]
}

// ============================================================================
// Filter Chips (per UI-SPEC copywriting)
// ============================================================================

const STATUS_OPTIONS = [
  { value: undefined, label: 'ALL' },
  { value: 'active', label: 'ACTIVE' },
  { value: 'idle', label: 'IDLE' },
  { value: 'aborted', label: 'ABORTED' },
  { value: 'error', label: 'ERROR' },
] as const

function FilterChip({
  value,
  label,
  currentValue,
  onSelect,
}: {
  value: string | undefined
  label: string
  currentValue: string | undefined
  onSelect: (value: string | undefined) => void
}) {
  const isSelected = currentValue === value || (!currentValue && !value)

  return (
    <button
      onClick={() => onSelect(value)}
      className={cn(
        'px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] border rounded transition-all',
        isSelected
          ? 'bg-accent text-accent-foreground border-accent'
          : 'bg-card text-muted-foreground border-border hover:bg-accent/5 hover:border-border/80',
      )}
    >
      {label}
    </button>
  )
}

// ============================================================================
// Filter Bar Component
// ============================================================================

export function SessionsFilterBar({
  filters,
  onFiltersChange,
  availableModels = [],
}: SessionsFilterBarProps) {
  const [expanded, setExpanded] = useState(false)

  const setFilter = useCallback(
    (key: keyof SessionFilters, value: string | undefined) => {
      onFiltersChange({ ...filters, [key]: value })
    },
    [filters, onFiltersChange],
  )

  return (
    <div className="border border-border bg-card">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-2 hover:bg-accent/5 transition-colors"
      >
        <span className="text-foreground font-semibold text-[9.5px] tracking-[0.2em] uppercase inline-flex items-center gap-2">
          <span className="w-1 h-1 bg-accent" />
          FILTERS
        </span>
        <span className="text-muted-foreground text-xs">
          {expanded ? '\u25BC' : '\u25B6'}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border">
          {/* Status filters */}
          <div className="space-y-1.5">
            <div className="text-[9.5px] text-muted-foreground uppercase tracking-[0.15em]">
              STATUS
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.value ?? 'all'}
                  value={opt.value}
                  label={opt.label}
                  currentValue={filters.status}
                  onSelect={(value) => setFilter('status', value)}
                />
              ))}
            </div>
          </div>

          {/* Model filters */}
          {availableModels.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[9.5px] text-muted-foreground uppercase tracking-[0.15em]">
                MODEL
              </div>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip
                  value={undefined}
                  label="ALL"
                  currentValue={filters.model}
                  onSelect={(value) => setFilter('model', value)}
                />
                {availableModels.map((model) => (
                  <FilterChip
                    key={model}
                    value={model}
                    label={model}
                    currentValue={filters.model}
                    onSelect={(value) => setFilter('model', value)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Search input */}
          <div className="space-y-1.5">
            <div className="text-[9.5px] text-muted-foreground uppercase tracking-[0.15em]">
              SEARCH
            </div>
            <Input
              type="text"
              value={filters.search || ''}
              onChange={(e) => setFilter('search', e.target.value || undefined)}
              placeholder="Search sessions..."
              className="w-full px-3 py-1.5 text-[11px] bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent placeholder:text-muted-foreground/50"
            />
          </div>
        </div>
      )}
    </div>
  )
}
