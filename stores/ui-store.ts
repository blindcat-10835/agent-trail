import { create } from 'zustand'

const RIGHT_RAIL_MIN_WIDTH = 280
const RIGHT_RAIL_MAX_WIDTH = 720
const RIGHT_RAIL_DEFAULT_WIDTH = 360

interface UIState {
  rightRailOpen: boolean
  rightRailWidth: number
  toggleRightRail: () => void
  setRightRailOpen: (open: boolean) => void
  setRightRailWidth: (width: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  rightRailOpen: true,
  rightRailWidth: RIGHT_RAIL_DEFAULT_WIDTH,
  toggleRightRail: () => set((s) => ({ rightRailOpen: !s.rightRailOpen })),
  setRightRailOpen: (open) => set({ rightRailOpen: open }),
  setRightRailWidth: (width) =>
    set({
      rightRailWidth: Math.min(RIGHT_RAIL_MAX_WIDTH, Math.max(RIGHT_RAIL_MIN_WIDTH, width)),
    }),
}))
