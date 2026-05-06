'use client'

import { type ReactNode } from 'react'
import { useUIStore } from '@/stores/ui-store'
import { ShellHeader } from './shell-header'
import { SidebarNav } from './sidebar-nav'
import { ShellStatusBar } from './shell-status-bar'
import { RightRail } from './right-rail'

interface ShellFrameProps {
  /** Page content rendered in the main content area */
  children: ReactNode
  /** Whether GatewayBootstrap should be mounted (OpenClaw only) */
  gatewayBootstrap?: ReactNode
}

export function ShellFrame({ children, gatewayBootstrap }: ShellFrameProps) {
  const rightRailOpen = useUIStore((s) => s.rightRailOpen)

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
        {rightRailOpen && <RightRail />}
      </main>
      <ShellStatusBar />
    </div>
  )
}
