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

  // Filter — multi-select, persisted in URL search params
  activeFilters: Set<'user' | 'assistant' | 'tools' | 'skills' | 'subagents' | 'system'>
  toggleFilter: (filter: string) => void
  setFilters: (filters: string[]) => void

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

  // Filter
  activeFilters: new Set<string>() as Set<
    'user' | 'assistant' | 'tools' | 'skills' | 'subagents' | 'system'
  >,
  toggleFilter: (filter) =>
    set((s) => {
      const validFilters = [
        'user',
        'assistant',
        'tools',
        'skills',
        'subagents',
        'system',
      ] as const
      type ValidFilter = (typeof validFilters)[number]

      if (filter === 'all') {
        return { activeFilters: new Set<string>() as Set<ValidFilter> }
      }

      const next = new Set(s.activeFilters)
      if (next.has(filter as ValidFilter)) {
        next.delete(filter as ValidFilter)
      } else {
        next.add(filter as ValidFilter)
      }
      return { activeFilters: next as Set<ValidFilter> }
    }),
  setFilters: (filters) =>
    set({
      activeFilters: new Set(filters) as Set<
        'user' | 'assistant' | 'tools' | 'skills' | 'subagents' | 'system'
      >,
    }),

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
