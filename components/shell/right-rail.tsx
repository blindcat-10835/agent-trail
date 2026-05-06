'use client'

import { SessionsDetailRail } from '@/components/sessions/sessions-detail-rail'

interface RightRailProps {
  selectedSessionId?: string | null
  onCloseSession?: () => void
}

/**
 * Right rail frame — renders session detail when a session is selected.
 *
 * Per D-12: Right rail always visible alongside any page. When no session
 * is selected, shows a neutral placeholder. When a session is selected
 * (via the Session Explorer table), renders the SessionsDetailRail
 * with full session metadata via the BFF proxy.
 */
export function RightRail({
  selectedSessionId,
  onCloseSession,
}: RightRailProps) {
  return (
    <aside className="border-l border-border bg-card min-h-0 min-w-0 overflow-hidden">
      <SessionsDetailRail
        sessionId={selectedSessionId ?? null}
        onClose={onCloseSession ?? (() => {})}
      />
    </aside>
  )
}
