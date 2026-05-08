'use client'

import { useCallback, useState } from 'react'
import { notifySessionsRefresh, syncAllSessions, useAgentTool } from '@/lib/agent-tools/client-hooks'
import { useUIStore } from '@/stores/ui-store'
import { SourceSwitcher } from './source-switcher'
import { StatusIndicator } from '@/components/hud/status-indicator'
import { ThemeToggle } from '@/components/hud/theme-toggle'

export function ShellHeader() {
  const { capabilities } = useAgentTool()
  const rightRailOpen = useUIStore((s) => s.rightRailOpen)
  const toggleRightRail = useUIStore((s) => s.toggleRightRail)
  const [syncing, setSyncing] = useState(false)

  const handleSync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await syncAllSessions()
      notifySessionsRefresh()
    } catch {
      // Sync errors are non-fatal for the header — sessions list still refetches
      notifySessionsRefresh()
    } finally {
      setSyncing(false)
    }
  }, [syncing])

  return (
    <header className="grid grid-cols-[280px_1fr_auto] items-center px-5 h-12 border-b border-border bg-gradient-to-b from-card to-background relative">
      {/* Brand — fixed title */}
      <div className="flex items-center gap-3">
        <div className="hud-clip-sm w-7 h-7 bg-accent flex items-center justify-center text-background font-bold text-sm">
          ◆
        </div>
        <div className="text-base font-bold tracking-[0.3em] text-accent">
          AGENTS TRACING
        </div>
      </div>

      {/* Source switcher */}
      <SourceSwitcher />

      {/* Controls */}
      <div className="flex items-center gap-3.5 text-xs tracking-[0.12em]">
        {capabilities.liveGateway ? (
          <StatusIndicator />
        ) : (
          <div className="hud-clip-sm flex items-center gap-1.5 border border-border/40 px-2.5 py-1 text-[11px] font-semibold">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span>LOCAL</span>
          </div>
        )}
        <button
          onClick={handleSync}
          disabled={syncing}
          title="Sync all sessions"
          className="hud-clip-sm border border-border w-7 h-7 grid place-items-center text-muted-foreground hover:text-accent hover:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncing ? '⟳' : '↻'}
        </button>
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
