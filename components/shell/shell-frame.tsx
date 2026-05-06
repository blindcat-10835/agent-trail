'use client'

import { type ReactNode } from 'react'
import { useUIStore } from '@/stores/ui-store'
import { useToolStore } from '@/stores/tool-store'
import { ShellHeader } from './shell-header'
import { SidebarNav } from './sidebar-nav'
import { ShellStatusBar } from './shell-status-bar'
import { RightRail } from './right-rail'

interface ShellFrameProps {
  /** Page content rendered in the main content area */
  children: ReactNode
  /** Whether GatewayBootstrap should be mounted (OpenClaw only) */
  gatewayBootstrap?: ReactNode
  /** Currently selected session ID for right rail detail */
  selectedSessionId?: string | null
  /** Callback to clear session selection (closes detail panel) */
  onCloseSession?: () => void
}

export function ShellFrame({ children, gatewayBootstrap, selectedSessionId: propSelectedSessionId, onCloseSession }: ShellFrameProps) {
  const rightRailOpen = useUIStore((s) => s.rightRailOpen)
  const storeSelectedSessionId = useToolStore((s) => s.selectedSessionId)
  const setSelectedSessionId = useToolStore((s) => s.setSelectedSessionId)

  // Prefer prop override (for future direct wiring), fallback to store
  const selectedSessionId = propSelectedSessionId ?? storeSelectedSessionId
  const handleCloseSession = onCloseSession ?? (() => setSelectedSessionId(null))

  return (
    <div className="grid grid-rows-[48px_1fr_26px] h-screen w-screen overflow-hidden bg-background text-foreground">
      {gatewayBootstrap}
      <ShellHeader />
      <main
        className="grid min-h-0 min-w-0 overflow-hidden transition-[grid-template-columns] duration-200"
        style={{
          gridTemplateColumns: rightRailOpen
            ? '56px minmax(0, 1fr) 360px'
            : '56px minmax(0, 1fr) 0px'
        }}
      >
        <SidebarNav />
        <div className="min-h-0 min-w-0 overflow-hidden">
          {children}
        </div>
        {rightRailOpen && <RightRail selectedSessionId={selectedSessionId} onCloseSession={handleCloseSession} />}
      </main>
      <ShellStatusBar />
    </div>
  )
}
