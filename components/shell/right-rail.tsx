'use client'

import { SessionsRightRail } from '@/components/sessions/sessions-right-rail'
import { useUIStore, type RailScope } from '@/stores/ui-store'

const RAIL_SCOPES: { id: RailScope; label: string }[] = [
  { id: 'recent', label: 'RECENT' },
  { id: 'starred', label: '\u2605 STARRED' },
  { id: 'live', label: '\u25CF LIVE' },
]

interface RightRailProps {
  selectedSessionId?: string | null
  onCloseSession?: () => void
}

/**
 * Right rail frame — persistent session browser with scope tabs.
 */
export function RightRail({
  selectedSessionId,
  onCloseSession,
}: RightRailProps) {
  const railScope = useUIStore((s) => s.railScope)
  const setRailScope = useUIStore((s) => s.setRailScope)

  return (
    <aside className="border-l border-border bg-card min-h-0 min-w-0 overflow-hidden">
      <div className="flex items-center border-b border-border">
        {RAIL_SCOPES.map((scope) => (
          <button
            key={scope.id}
            onClick={() => setRailScope(scope.id)}
            className={`flex-1 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] transition-colors ${
              railScope === scope.id
                ? 'text-accent border-b-2 border-accent'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {scope.label}
          </button>
        ))}
      </div>
      <SessionsRightRail
        railScope={railScope}
        selectedSessionId={selectedSessionId ?? null}
        onClearSelection={onCloseSession ?? (() => {})}
      />
    </aside>
  )
}
