'use client'

import { SessionsRightRail } from '@/components/sessions/sessions-right-rail'

interface RightRailProps {
  selectedSessionId?: string | null
  onCloseSession?: () => void
}

/**
 * Right rail frame — persistent session browser.
 */
export function RightRail({
  selectedSessionId,
  onCloseSession,
}: RightRailProps) {
  return (
    <aside className="border-l border-border bg-card min-h-0 min-w-0 overflow-hidden">
      <SessionsRightRail
        selectedSessionId={selectedSessionId ?? null}
        onClearSelection={onCloseSession ?? (() => {})}
      />
    </aside>
  )
}
