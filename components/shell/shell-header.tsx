'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { getSourceName } from '@/lib/agent-tools/registry'
import {
  notifySessionsRefresh,
  syncAllSessions,
  useAgentTool,
  useIngestLiveUpdates,
} from '@/lib/agent-tools/client-hooks'
import { useUIStore } from '@/stores/ui-store'
import { AgentTrailLogo } from '@/components/brand/agent-trail-logo'
import { SourceSwitcher } from './source-switcher'
import { ThemeToggle } from '@/components/hud/theme-toggle'

export function ShellHeader() {
  const { toolId } = useAgentTool()
  const rightRailOpen = useUIStore((s) => s.rightRailOpen)
  const toggleRightRail = useUIStore((s) => s.toggleRightRail)
  const [syncing, setSyncing] = useState(false)
  const liveUpdates = useIngestLiveUpdates(toolId)
  const indexingSourceLabel = liveUpdates.currentSource
    ? getSourceName(liveUpdates.currentSource)
    : toolId === 'all'
      ? 'All'
      : getSourceName(toolId)

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
      {/* Brand — links to ALL-OVR */}
      <Link
        href="/all/dashboard"
        aria-label="Agents Trail overview"
        className="group flex w-fit items-center gap-3"
      >
        <AgentTrailLogo className="size-8 shrink-0 text-accent transition-[opacity,filter] group-hover:opacity-85 group-hover:drop-shadow-[0_0_6px_var(--accent-dim)]" />
        <div className="text-base font-bold tracking-[0.3em] text-accent transition-opacity group-hover:opacity-85">
          AGENTS TRAIL
        </div>
      </Link>

      {/* Source switcher */}
      <SourceSwitcher />

      {/* Controls */}
      <div className="flex items-center gap-3.5 text-xs tracking-[0.12em]">
        {liveUpdates.indexing && (
          <span
            className="live-indexing-chip"
            title={`Ingest is ${liveUpdates.phase ?? 'syncing'}${liveUpdates.connected ? '' : ' (SSE reconnecting)'}`}
          >
            INDEXING {indexingSourceLabel}
          </span>
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
