'use client'

import type { TraceSession } from '@/types/trace'

interface ReplayHeaderProps {
  session: TraceSession | null
  derivedStatus: string | null
  onBackToSessions: () => void
}

export function ReplayHeader({ session, derivedStatus, onBackToSessions }: ReplayHeaderProps) {
  const sessionName = session?.project || session?.id || 'Unknown Session'

  return (
    <header className="flex-shrink-0 border-b border-border bg-card">
      {/* Top row: breadcrumb + right rail toggle hint */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <button
          onClick={onBackToSessions}
          className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent hover:text-accent/80 transition-colors"
        >
          Sessions
        </button>
        <span className="text-[11px] text-muted-foreground">&gt;</span>
        <span className="text-[11px] font-semibold text-foreground truncate max-w-[400px]">
          {sessionName}
        </span>
      </div>

      {/* Bottom row: session name + status */}
      <div className="flex items-center gap-3 px-4 pb-3">
        <h1 className="text-[20px] font-semibold text-foreground truncate flex-1 min-w-0">
          {sessionName}
        </h1>
      </div>
    </header>
  )
}
