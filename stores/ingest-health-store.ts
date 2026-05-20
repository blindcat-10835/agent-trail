import { create } from 'zustand'

const CONNECTED_ONCE_STORAGE_KEY = 'agents-tracing-dashboard:ingest-connected-once'

function readHasConnectedOnce(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(CONNECTED_ONCE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function writeHasConnectedOnce(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(CONNECTED_ONCE_STORAGE_KEY, 'true')
  } catch {
    // Storage can be unavailable in private browsing or test environments.
  }
}

interface IngestHealthState {
  status: 'checking' | 'connected' | 'timeout'
  /** True once a successful connection has been established at least once */
  hasConnectedOnce: boolean
  retry: () => void
  setConnected: () => void
  setTimeout: () => void
}

export const useIngestHealthStore = create<IngestHealthState>((set) => ({
  status: 'checking',
  hasConnectedOnce: readHasConnectedOnce(),
  retry: () => set({ status: 'checking' }),
  setConnected: () => {
    writeHasConnectedOnce()
    set({ status: 'connected', hasConnectedOnce: true })
  },
  setTimeout: () => set({ status: 'timeout' }),
}))
