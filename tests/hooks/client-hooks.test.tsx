// @vitest-environment jsdom

/**
 * Tests for client hooks exported from lib/agent-tools/client-hooks.tsx.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'

import {
  SESSION_REFRESH_EVENT,
  notifySessionsRefresh,
  useIngestStatus,
  useSSE,
  useToolSessions,
} from '@/lib/agent-tools/client-hooks'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      sessions: [],
      pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
    }),
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('useSSE', () => {
  it('is an exported function from client-hooks', () => {
    expect(typeof useSSE).toBe('function')
  })

  it('has the expected signature (toolId param required, sessionId + onEvent optional)', () => {
    // Verify the function accepts the right arity
    expect(useSSE.length).toBeGreaterThanOrEqual(1)
  })
})

describe('useIngestStatus', () => {
  it('is an exported function from client-hooks', () => {
    expect(typeof useIngestStatus).toBe('function')
  })

  it('has the expected signature (toolId param required)', () => {
    expect(useIngestStatus.length).toBeGreaterThanOrEqual(1)
  })
})

describe('session refresh event', () => {
  it('refetches tool sessions when the global refresh event is dispatched', async () => {
    function Consumer() {
      useToolSessions('codex', { limit: '40', sort: 'updated_at', order: 'desc' })
      return null
    }

    render(<Consumer />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    window.dispatchEvent(new Event(SESSION_REFRESH_EVENT))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('dispatches the documented session refresh event name', () => {
    const listener = vi.fn()
    window.addEventListener(SESSION_REFRESH_EVENT, listener)

    notifySessionsRefresh()

    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(SESSION_REFRESH_EVENT, listener)
  })
})
