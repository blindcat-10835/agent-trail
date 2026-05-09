'use client'

import { useCallback, useRef, type ReactNode } from 'react'
import { useUIStore } from '@/stores/ui-store'
import { useToolStore } from '@/stores/tool-store'
import { ShellHeader } from './shell-header'
import { SidebarNav } from './sidebar-nav'
import { ShellStatusBar } from './shell-status-bar'
import { RightRail } from './right-rail'

interface ShellFrameProps {
  /** Page content rendered in the main content area */
  children: ReactNode
  /** Currently selected session ID for right rail detail */
  selectedSessionId?: string | null
  /** Callback to clear session selection (closes detail panel) */
  onCloseSession?: () => void
}

export function ShellFrame({ children, selectedSessionId: propSelectedSessionId, onCloseSession }: ShellFrameProps) {
  const rightRailOpen = useUIStore((s) => s.rightRailOpen)
  const rightRailWidth = useUIStore((s) => s.rightRailWidth)
  const setRightRailWidth = useUIStore((s) => s.setRightRailWidth)
  const storeSelectedSessionId = useToolStore((s) => s.selectedSessionId)
  const setSelectedSessionId = useToolStore((s) => s.setSelectedSessionId)

  // Prefer prop override (for future direct wiring), fallback to store
  const selectedSessionId = propSelectedSessionId ?? storeSelectedSessionId
  const handleCloseSession = onCloseSession ?? (() => setSelectedSessionId(null))

  const isDragging = useRef(false)

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      const startX = e.clientX
      const startWidth = rightRailWidth

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return
        const delta = startX - ev.clientX
        setRightRailWidth(startWidth + delta)
      }

      const onMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [rightRailWidth, setRightRailWidth],
  )

  return (
    <div className="grid grid-rows-[48px_1fr_26px] h-screen w-screen overflow-hidden bg-background text-foreground">
      <ShellHeader />
      <main
        className="grid min-h-0 min-w-0 overflow-hidden"
        style={{
          gridTemplateColumns: rightRailOpen
            ? `56px minmax(0, 1fr) 4px ${rightRailWidth}px`
            : '56px minmax(0, 1fr)',
        }}
      >
        <SidebarNav />
        <div className="min-h-0 min-w-0 overflow-hidden">
          {children}
        </div>
        {rightRailOpen && (
          <>
            <div
              onMouseDown={handleResizeStart}
              className="shrink-0 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
            />
            <RightRail selectedSessionId={selectedSessionId} onCloseSession={handleCloseSession} />
          </>
        )}
      </main>
      <ShellStatusBar />
    </div>
  )
}
