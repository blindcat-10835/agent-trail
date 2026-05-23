import { create } from 'zustand'
import type { TimeWindow } from '@/types/overview'

const RIGHT_RAIL_MIN_WIDTH = 280
const RIGHT_RAIL_MAX_WIDTH = 720
const RIGHT_RAIL_DEFAULT_WIDTH = 360

export type RailScope = 'recent' | 'starred' | 'live'

interface UIState {
  rightRailOpen: boolean
  rightRailWidth: number
  railScope: RailScope
  overviewTimeWindow: TimeWindow
  toggleRightRail: () => void
  setRightRailOpen: (open: boolean) => void
  setRightRailWidth: (width: number) => void
  setRailScope: (scope: RailScope) => void
  setOverviewTimeWindow: (window: TimeWindow) => void
}

export const useUIStore = create<UIState>((set) => ({
  rightRailOpen: true,
  rightRailWidth: RIGHT_RAIL_DEFAULT_WIDTH,
  railScope: 'recent',
  overviewTimeWindow: '30d',
  toggleRightRail: () => set((s) => ({ rightRailOpen: !s.rightRailOpen })),
  setRightRailOpen: (open) => set({ rightRailOpen: open }),
  setRightRailWidth: (width) =>
    set({
      rightRailWidth: Math.min(RIGHT_RAIL_MAX_WIDTH, Math.max(RIGHT_RAIL_MIN_WIDTH, width)),
    }),
  setRailScope: (scope) => set({ railScope: scope }),
  setOverviewTimeWindow: (window) => set({ overviewTimeWindow: window }),
}))
