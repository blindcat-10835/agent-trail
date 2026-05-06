'use client'

import type { TraceSession, TraceTurn } from '@/types/trace'

interface ReplayRightRailProps {
  session: TraceSession
  turnCount: number
  turns: TraceTurn[]
  onClose: () => void
}

/** Placeholder — full implementation in Plan 05-02, Task 2 */
export function ReplayRightRail({ session, turnCount, turns, onClose }: ReplayRightRailProps) {
  return <div className="w-[320px] flex-shrink-0 border-l border-border bg-card" />
}
