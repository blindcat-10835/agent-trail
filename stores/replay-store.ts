import { create } from 'zustand'

interface ReplayState {
  // Scroll — keyed by sessionId, restored on back-navigation
  scrollPositions: Record<string, number>
  setScrollPosition: (sessionId: string, position: number) => void

  // Expand state — per turn, keyed by turnId
  expandedTurns: Set<string>
  toggleTurn: (turnId: string) => void
  expandAll: (turnIds: string[]) => void
  collapseAll: () => void

  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchMatches: { turnId: string; matchCount: number }[]
  setSearchMatches: (matches: { turnId: string; matchCount: number }[]) => void
  currentMatchIndex: number
  setCurrentMatchIndex: (index: number) => void

  // Turn navigation
  currentTurnIndex: number
  setCurrentTurnIndex: (index: number) => void
  focusedTurnId: string | null
  setFocusedTurnId: (turnId: string | null) => void
}

export const useReplayStore = create<ReplayState>((set) => ({
  // Scroll
  scrollPositions: {},
  setScrollPosition: (sessionId, position) =>
    set((s) => ({
      scrollPositions: { ...s.scrollPositions, [sessionId]: position },
    })),

  // Expand
  expandedTurns: new Set<string>(),
  toggleTurn: (turnId) =>
    set((s) => {
      const next = new Set(s.expandedTurns)
      if (next.has(turnId)) {
        next.delete(turnId)
      } else {
        next.add(turnId)
      }
      return { expandedTurns: next }
    }),
  expandAll: (turnIds) =>
    set({ expandedTurns: new Set(turnIds) }),
  collapseAll: () =>
    set({ expandedTurns: new Set<string>() }),

  // Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  searchMatches: [],
  setSearchMatches: (matches) => set({ searchMatches: matches }),
  currentMatchIndex: 0,
  setCurrentMatchIndex: (index) => set({ currentMatchIndex: index }),

  // Turn navigation
  currentTurnIndex: 0,
  setCurrentTurnIndex: (index) => set({ currentTurnIndex: index }),
  focusedTurnId: null,
  setFocusedTurnId: (turnId) => set({ focusedTurnId: turnId }),
}))
