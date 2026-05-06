'use client'

import type { TraceSession } from '@/types/trace'

interface ReplayHeaderProps {
  session: TraceSession | null
  derivedStatus: string | null
  onBackToSessions: () => void
}

/** Placeholder — full implementation in Plan 05-02, Task 2 */
export function ReplayHeader({ session, derivedStatus, onBackToSessions }: ReplayHeaderProps) {
  return <header className="flex-shrink-0 border-b border-border bg-card h-12" />
}
