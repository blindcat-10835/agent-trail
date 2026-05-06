'use client'

import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import { useUIStore } from '@/stores/ui-store'
import { SourceSwitcher } from './source-switcher'
import { StatusIndicator } from '@/components/hud/status-indicator'
import { ThemeToggle } from '@/components/hud/theme-toggle'

export function ShellHeader() {
  const { definition } = useAgentTool()
  const rightRailOpen = useUIStore((s) => s.rightRailOpen)
  const toggleRightRail = useUIStore((s) => s.toggleRightRail)
  const brand = definition.ui.brand

  return (
    <header className="grid grid-cols-[280px_1fr_auto] items-center px-5 h-12 border-b border-border bg-gradient-to-b from-card to-background relative">
      {/* Brand — profile-driven */}
      <div className="flex items-center gap-3">
        <div className="hud-clip-sm w-7 h-7 bg-accent flex items-center justify-center text-background font-bold text-sm">
          ◆
        </div>
        <div className="text-base font-bold tracking-[0.3em] text-accent">
          {brand.name.toUpperCase()}
        </div>
        {brand.versionLabel && (
          <div className="text-[10px] text-muted-foreground tracking-[0.2em] pl-2.5 border-l border-border">
            {brand.versionLabel}
          </div>
        )}
      </div>

      {/* Source switcher — replaces old nav */}
      <SourceSwitcher />

      {/* Controls — preserved from existing header */}
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

      {/* Bottom gradient line — preserved from existing header */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-60" />
    </header>
  )
}
