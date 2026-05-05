'use client'

import { useState, useCallback, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentDisplayStatus } from '@/stores/gateway/gateway-store'

interface AgentSearchFilterProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  statusFilter: AgentDisplayStatus | 'all'
  onStatusChange: (status: AgentDisplayStatus | 'all') => void
  className?: string
}

export function AgentSearchFilter({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  className,
}: AgentSearchFilterProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)

  // 300ms debounce for search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch, onSearchChange])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLocalSearch(value)
  }

  return (
    <div className={cn('flex items-center gap-3 p-4 border-b border-border', className)}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search agents..."
          value={localSearch}
          onChange={handleSearchChange}
          className="pl-9 h-8 bg-card border-border"
        />
      </div>
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[140px] h-8 bg-card border-border">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="idle">Idle</SelectItem>
          <SelectItem value="working">Working</SelectItem>
          <SelectItem value="tool_calling">Tool Calling</SelectItem>
          <SelectItem value="speaking">Speaking</SelectItem>
          <SelectItem value="error">Error</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
