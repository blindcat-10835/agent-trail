'use client'

import { ShellHeader } from '@/components/hud/shell-header'
import { GatewayBootstrap } from '@/components/hud/gateway-bootstrap'
import { ShellStatusBar } from '@/components/hud/shell-status-bar'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { DashboardRightRail } from '@/components/dashboard/dashboard-right-rail'
import { useUIStore } from '@/stores/ui-store'

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const rightRailOpen = useUIStore((s) => s.rightRailOpen)

  return (
    <div className="grid grid-rows-[48px_1fr_26px] h-screen w-screen overflow-hidden bg-background text-foreground">
      <GatewayBootstrap />
      <ShellHeader />
      <main
        className="grid min-h-0 min-w-0 overflow-hidden transition-[grid-template-columns] duration-200"
        style={{ gridTemplateColumns: rightRailOpen ? '56px minmax(0, 1fr) 360px' : '56px minmax(0, 1fr) 0px' }}
      >
        <SidebarNav />
        <div className="min-h-0 min-w-0 overflow-hidden">
          {children}
        </div>
        {rightRailOpen && <DashboardRightRail />}
      </main>
      <ShellStatusBar />
    </div>
  )
}
