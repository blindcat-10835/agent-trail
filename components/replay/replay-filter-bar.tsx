'use client'

import { useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'user', label: 'User' },
  { id: 'assistant', label: 'Assistant' },
  { id: 'tools', label: 'Tools' },
  { id: 'skills', label: 'Skills' },
  { id: 'subagents', label: 'Subagents' },
  { id: 'system', label: 'System' },
] as const

export function ReplayFilterBar() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const rawFilter = searchParams.get('filter') || ''
  const activeFilters = new Set(rawFilter ? rawFilter.split(',').filter(Boolean) : [])

  const handleToggle = useCallback((filterId: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (filterId === 'all') {
      params.delete('filter')
    } else {
      let current = params.get('filter')?.split(',').filter(Boolean) || []
      if (current.includes(filterId)) {
        current = current.filter((f) => f !== filterId)
      } else {
        current = [...current.filter((f) => f !== 'all'), filterId]
      }
      if (current.length > 0) {
        params.set('filter', current.join(','))
      } else {
        params.delete('filter')
      }
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  const isActive = (id: string) => {
    if (id === 'all') return activeFilters.size === 0
    return activeFilters.has(id)
  }

  return (
    <div className="flex items-center gap-1.5 px-6 py-2 flex-shrink-0 overflow-x-auto">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          onClick={() => handleToggle(f.id)}
          className={cn(
            'px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider border rounded transition-colors flex-shrink-0',
            isActive(f.id)
              ? 'bg-accent/15 border-accent text-accent'
              : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
