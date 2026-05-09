import { create } from 'zustand'

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
  hasConnectedOnce: false,
  retry: () => set({ status: 'checking' }),
  setConnected: () => set({ status: 'connected', hasConnectedOnce: true }),
  setTimeout: () => set({ status: 'timeout' }),
}))
