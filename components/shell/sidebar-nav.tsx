'use client'

import { Suspense } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import { cn } from '@/lib/utils'

function SidebarNavInner() {
  const { definition, capabilities, href } = useAgentTool()
  const router = useRouter()
  const pathname = usePathname()

  // Filter nav items by required capability
  const visibleItems = definition.nav.filter(
    item => !item.requiredCapability || capabilities[item.requiredCapability]
  )

  return (
    <nav className="h-full flex flex-col items-center py-2.5 gap-1 border-r border-border bg-card">
      {visibleItems.map((item) => {
        // Build the full href for this nav item under the current tool
        const itemHref = href(item.href(definition.id).replace(/^\/[^/]+/, ''))
        // Active if pathname matches the item's target (or starts with it for nested routes)
        const isActive =
          pathname === itemHref || pathname.startsWith(itemHref + '/') || pathname.startsWith(itemHref + '?')

        return (
          <button
            key={item.id}
            title={item.title}
            onClick={() => router.push(itemHref)}
            className={cn(
              'w-10 h-10 grid place-items-center text-[11px] font-semibold tracking-[0.06em]',
              'text-muted-foreground border border-transparent relative transition-colors',
              'hover:text-foreground hover:bg-accent/10',
              isActive && 'text-accent bg-background border-border'
            )}
          >
            {item.label}
            {isActive && (
              <span className="absolute -left-[1px] top-2 bottom-2 w-0.5 bg-accent" />
            )}
          </button>
        )
      })}
      <div className="flex-1" />
      <button
        title="Help"
        className="w-10 h-10 grid place-items-center text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/10"
      >
        ?
      </button>
    </nav>
  )
}

export function SidebarNav() {
  return (
    <Suspense fallback={
      <nav className="h-full flex flex-col items-center py-2.5 gap-1 border-r border-border bg-card">
        {/* Minimal skeleton fallback */}
      </nav>
    }>
      <SidebarNavInner />
    </Suspense>
  )
}
