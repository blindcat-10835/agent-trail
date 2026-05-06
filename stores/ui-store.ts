import { create } from 'zustand'

interface UIState {
  rightRailOpen: boolean
  toggleRightRail: () => void
  setRightRailOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  rightRailOpen: true,
  toggleRightRail: () => set((s) => ({ rightRailOpen: !s.rightRailOpen })),
  setRightRailOpen: (open) => set({ rightRailOpen: open }),
}))
