import { create } from 'zustand'

interface IngestHealthState {
  status: 'checking' | 'connected' | 'timeout'
  retry: () => void
  setConnected: () => void
  setTimeout: () => void
}

export const useIngestHealthStore = create<IngestHealthState>((set) => ({
  status: 'checking',
  retry: () => set({ status: 'checking' }),
  setConnected: () => set({ status: 'connected' }),
  setTimeout: () => set({ status: 'timeout' }),
}))
