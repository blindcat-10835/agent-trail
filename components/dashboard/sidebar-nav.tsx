'use client'

import { Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { id: 'overview', label: 'OVR', title: 'Overview', href: '/dashboard' },
  { id: 'agents', label: 'AGT', title: 'Agents', href: '/dashboard?tab=agents' },
  { id: 'costs', label: 'USD', title: 'Costs & Usage', href: '/dashboard?tab=costs' },
  { id: 'skills', label: 'SKL', title: 'Skills', href: '/dashboard?tab=skills' },
  { id: 'activity', label: 'ACT', title: 'Activity Console', href: '/activity' },
  { id: 'sessions', label: 'SES', title: 'Sessions', href: '/sessions' },
]

function SidebarNavInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeTab = pathname === '/activity'
    ? 'activity'
    : pathname === '/sessions'
      ? 'sessions'
      : searchParams.get('tab') || 'overview'

  return (
    <nav className="h-full flex flex-col items-center py-2.5 gap-1 border-r border-border bg-card">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          title={item.title}
          onClick={() => router.push(item.href)}
          className={cn(
            'w-10 h-10 grid place-items-center text-[11px] font-semibold tracking-[0.06em]',
            'text-muted-foreground border border-transparent relative transition-colors',
            'hover:text-foreground hover:bg-accent/10',
            activeTab === item.id && 'text-accent bg-background border-border'
          )}
        >
          {item.label}
          {activeTab === item.id && (
            <span className="absolute -left-[1px] top-2 bottom-2 w-0.5 bg-accent" />
          )}
        </button>
      ))}
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
        {NAV_ITEMS.map((item) => (
          <div key={item.id} className="w-10 h-10 grid place-items-center text-[11px] font-semibold text-muted-foreground tracking-[0.06em]">
            {item.label}
          </div>
        ))}
        <div className="flex-1" />
      </nav>
    }>
      <SidebarNavInner />
    </Suspense>
  )
}
