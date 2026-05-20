// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

const CONNECTED_ONCE_STORAGE_KEY = 'agents-tracing-dashboard:ingest-connected-once'

describe('useIngestHealthStore', () => {
  afterEach(() => {
    window.sessionStorage.clear()
    vi.resetModules()
  })

  it('uses a deterministic SSR-safe initial connected-once value', async () => {
    window.sessionStorage.setItem(CONNECTED_ONCE_STORAGE_KEY, 'true')

    const { useIngestHealthStore } = await import('@/stores/ingest-health-store')

    expect(useIngestHealthStore.getState().status).toBe('checking')
    expect(useIngestHealthStore.getState().hasConnectedOnce).toBe(false)
  })

  it('hydrates connected-once state from sessionStorage after mount', async () => {
    window.sessionStorage.setItem(CONNECTED_ONCE_STORAGE_KEY, 'true')

    const { useIngestHealthStore } = await import('@/stores/ingest-health-store')

    useIngestHealthStore.getState().hydrateConnectedOnce()

    expect(useIngestHealthStore.getState().hasConnectedOnce).toBe(true)
  })
})
