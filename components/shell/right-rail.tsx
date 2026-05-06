'use client'

import { type ReactNode } from 'react'

interface RightRailProps {
  children?: ReactNode
}

export function RightRail({ children }: RightRailProps) {
  return (
    <aside className="border-l border-border bg-card min-h-0 min-w-0 overflow-hidden">
      {children || (
        <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
          Select a session
        </div>
      )}
    </aside>
  )
}
