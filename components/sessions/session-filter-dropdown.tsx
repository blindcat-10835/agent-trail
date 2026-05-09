'use client'

import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal, Search, Star, X } from 'lucide-react'
import type { TraceSource } from '@/types/trace'
import { TOOL_IDS } from '@/lib/agent-tools/registry'
import { useStarredStore } from '@/stores/starred-store'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export type GroupMode = 'none' | 'agent' | 'project'

export interface SessionFilterState {
  groupMode: GroupMode
  sourceFilter: Set<TraceSource>
  starredOnly: boolean
  searchQuery: string
}

// ============================================================================
// Source labels
// ============================================================================

const SOURCE_LABELS: Record<TraceSource, string> = {
  'claude-code': 'Claude Code',
  openclaw: 'OpenClaw',
  codex: 'Codex',
}

// ============================================================================
// Props
// ============================================================================

interface SessionFilterDropdownProps {
  filter: SessionFilterState
  onGroupModeChange: (mode: GroupMode) => void
  onSourceToggle: (source: TraceSource) => void
  onClearSources: () => void
  onStarredOnlyToggle: () => void
  onSearchChange: (query: string) => void
  onClearAll: () => void
}

// ============================================================================
// Helpers
// ============================================================================

function hasActiveFilters(filter: SessionFilterState): boolean {
  return (
    filter.groupMode !== 'none' ||
    filter.starredOnly ||
    filter.searchQuery.length > 0 ||
    filter.sourceFilter.size > 0
  )
}

/** An empty sourceFilter set means "all sources". */
function isAllSourcesSelected(filter: SessionFilterState): boolean {
  return filter.sourceFilter.size === 0
}

// ============================================================================
// Checkmark SVG icon
// ============================================================================

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 5.5L4 7.5L8 3" />
    </svg>
  )
}

// ============================================================================
// Filter Dropdown Panel
// ============================================================================

export function SessionFilterDropdown({
  filter,
  onGroupModeChange,
  onSourceToggle,
  onClearSources,
  onStarredOnlyToggle,
  onSearchChange,
  onClearAll,
}: SessionFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const starredCount = useStarredStore((s) => s.ids.size)
  const filtersActive = hasActiveFilters(filter)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'relative grid h-6 w-6 place-items-center text-muted-foreground transition-colors hover:text-foreground',
          open && 'text-foreground',
        )}
        aria-label="Filter sessions"
        title="Filter sessions"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {filtersActive && (
          <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-green-500" />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 border border-border bg-background rounded-md shadow-lg p-2 z-50">
          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              value={filter.searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search sessions..."
              className="w-full bg-muted border border-border rounded-sm py-1 pl-6 pr-5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-green-500/40"
            />
            {filter.searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* DISPLAY section */}
          <div className="mb-2">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-0.5">
              Display
            </div>
            <FilterToggle
              label="Group by tool"
              active={filter.groupMode === 'agent'}
              onClick={() =>
                onGroupModeChange(filter.groupMode === 'agent' ? 'none' : 'agent')
              }
            />
            <FilterToggle
              label="Group by project"
              active={filter.groupMode === 'project'}
              onClick={() =>
                onGroupModeChange(filter.groupMode === 'project' ? 'none' : 'project')
              }
            />
          </div>

          {/* STARRED section */}
          <div className="mb-2">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-0.5">
              Starred
            </div>
            <button
              type="button"
              onClick={onStarredOnlyToggle}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-[11px] transition-colors hover:bg-muted/50',
                filter.starredOnly && 'text-foreground',
                !filter.starredOnly && 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-sm border',
                  filter.starredOnly
                    ? 'border-amber-500 bg-amber-500'
                    : 'border-border',
                )}
              >
                {filter.starredOnly && (
                  <CheckIcon className="text-background" />
                )}
              </span>
              <Star className="h-3 w-3 text-amber-500" />
              <span className="flex-1 text-left">Starred only</span>
              {starredCount > 0 && (
                <span className="text-[10px] font-mono tabular-nums text-amber-500">
                  {starredCount}
                </span>
              )}
            </button>
          </div>

          {/* SOURCE section */}
          <div className="mb-2">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-0.5">
              Source
            </div>
            {/* All sources toggle */}
            <SourceRow
              label="All"
              checked={isAllSourcesSelected(filter)}
              onClick={() => {
                if (!isAllSourcesSelected(filter)) {
                  onClearSources()
                }
              }}
            />
            {TOOL_IDS.map((source) => (
              <SourceRow
                key={source}
                label={SOURCE_LABELS[source]}
                checked={
                  isAllSourcesSelected(filter) ||
                  filter.sourceFilter.has(source)
                }
                onClick={() => onSourceToggle(source)}
              />
            ))}
          </div>

          {/* Clear filters */}
          {filtersActive && (
            <button
              type="button"
              onClick={onClearAll}
              className="w-full rounded-sm border border-border py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Filter Toggle (Display section)
// ============================================================================

function FilterToggle({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-[11px] transition-colors hover:bg-muted/50',
        active && 'text-foreground',
        !active && 'text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-sm border',
          active ? 'border-green-500 bg-green-500' : 'border-border',
        )}
      >
        {active && <CheckIcon className="text-background" />}
      </span>
      <span>{label}</span>
    </button>
  )
}

// ============================================================================
// Source Row (Source section)
// ============================================================================

function SourceRow({
  label,
  checked,
  onClick,
}: {
  label: string
  checked: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-[11px] transition-colors hover:bg-muted/50',
        checked && 'text-foreground',
        !checked && 'text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-sm border',
          checked ? 'border-green-500 bg-green-500' : 'border-border',
        )}
      >
        {checked && <CheckIcon className="text-background" />}
      </span>
      <span>{label}</span>
    </button>
  )
}
