'use client'

import { SessionsRightRail } from '@/components/sessions/sessions-right-rail'

interface RightRailProps {
  selectedSessionId?: string | null
  onCloseSession?: () => void
}

export function RightRail({ selectedSessionId, onCloseSession }: RightRailProps) {
  return (
    <aside className="rr-root">
      <SessionsRightRail
        selectedSessionId={selectedSessionId ?? null}
        onClearSelection={onCloseSession ?? (() => {})}
      />
    </aside>
  )
}
