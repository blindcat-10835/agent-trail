'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { StatusIndicator } from './status-indicator'
import { ThemeToggle } from './theme-toggle'
import { useUIStore } from '@/stores/ui-store'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/office', label: 'Office' },
] as const

export function ShellHeader() {
  const pathname = usePathname()
  const rightRailOpen = useUIStore((s) => s.rightRailOpen)
  const toggleRightRail = useUIStore((s) => s.toggleRightRail)

  return (
    <header className="grid grid-cols-[280px_1fr_auto] items-center px-5 h-12 border-b border-border bg-gradient-to-b from-card to-background relative">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="hud-clip-sm w-7 h-7 bg-accent flex items-center justify-center text-background font-bold text-sm">
          ◆
        </div>
        <div className="text-base font-bold tracking-[0.3em] text-accent">
          OVAO
        </div>
        <div className="text-[10px] text-muted-foreground tracking-[0.2em] pl-2.5 border-l border-border">
          GATEWAY · v3.2.1
        </div>
      </div>

      {/* Top-level navigation */}
      <nav className="flex items-center justify-center gap-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`hud-clip-sm border border-border px-2.5 py-1 text-xs tracking-[0.14em] font-semibold transition-all ${
              pathname === item.href
                ? 'border-accent text-accent bg-accent/10'
                : 'text-muted-foreground hover:border-accent hover:text-accent'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Controls */}
      <div className="flex items-center gap-3.5 text-xs tracking-[0.12em]">
        <StatusIndicator />
        <ThemeToggle />
        <button
          onClick={toggleRightRail}
          title={rightRailOpen ? 'Hide panel' : 'Show panel'}
          className="hud-clip-sm border border-border w-7 h-7 grid place-items-center text-muted-foreground hover:text-accent hover:border-accent transition-colors"
        >
          {rightRailOpen ? '»' : '«'}
        </button>
      </div>

      {/* Bottom gradient line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-60" />
    </header>
  )
}
