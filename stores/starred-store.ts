import { create } from 'zustand'

interface StarredState {
  ids: Set<string>
  loaded: boolean

  load: () => Promise<void>
  toggle: (sessionId: string) => void
  isStarred: (sessionId: string) => boolean
}

export const useStarredStore = create<StarredState>((set, get) => ({
  ids: new Set<string>(),
  loaded: false,

  load: async () => {
    if (get().loaded) return
    try {
      const res = await fetch('/api/agent-tools/all/sessions/starred')
      if (!res.ok) return
      const data = await res.json()
      set({ ids: new Set<string>(data.session_ids as string[]), loaded: true })
    } catch {
      // Silently ignore — stars are non-critical
    }
  },

  toggle: (sessionId: string) => {
    const { ids } = get()
    const isCurrentlyStarred = ids.has(sessionId)

    // Optimistic update
    const next = new Set(ids)
    if (isCurrentlyStarred) {
      next.delete(sessionId)
    } else {
      next.add(sessionId)
    }
    set({ ids: next })

    // Server sync (fire-and-forget, revert on failure)
    const method = isCurrentlyStarred ? 'DELETE' : 'POST'
    fetch(`/api/agent-tools/all/sessions/${encodeURIComponent(sessionId)}/star`, { method })
      .then((res) => {
        if (!res.ok) {
          // Revert on failure
          const revert = new Set(get().ids)
          if (isCurrentlyStarred) {
            revert.add(sessionId)
          } else {
            revert.delete(sessionId)
          }
          set({ ids: revert })
        }
      })
      .catch(() => {
        // Revert on network error
        const revert = new Set(get().ids)
        if (isCurrentlyStarred) {
          revert.add(sessionId)
        } else {
          revert.delete(sessionId)
        }
        set({ ids: revert })
      })
  },

  isStarred: (sessionId: string) => {
    return get().ids.has(sessionId)
  },
}))
