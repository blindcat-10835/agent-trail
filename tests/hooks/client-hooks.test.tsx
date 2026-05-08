// @vitest-environment jsdom

/**
 * Tests for client hooks exported from lib/agent-tools/client-hooks.tsx.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'

import {
  SESSION_REFRESH_EVENT,
  notifySessionsRefresh,
  syncAllSessions,
  syncToolSessions,
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

// ============================================================================
// syncToolSessions
// ============================================================================

describe('syncToolSessions', () => {
  it('calls /api/agent-tools/codex/sync before session refetch', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ type: 'codex', syncResult: {}, status: 'completed' }),
    })

    await syncToolSessions('codex')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/agent-tools/codex/sync')
    expect(opts.method).toBe('POST')
  })

  it('appends ?force=true when force option is set', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ type: 'codex', syncResult: {}, status: 'completed' }),
    })

    await syncToolSessions('codex', { force: true })

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('force=true')
  })

  it('does not append force param when force is false', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ type: 'codex', syncResult: {}, status: 'completed' }),
    })

    await syncToolSessions('codex', { force: false })

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).not.toContain('force')
  })

  it('throws on non-ok response and does not call sessions endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Unsupported source type' }),
    })

    await expect(syncToolSessions('all')).rejects.toThrow('Unsupported source type')
    // Only one fetch call was made (the sync one) — no sessions refetch
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('preserves session list state when sync fails (error thrown, caller responsible)', async () => {
    // When sync throws, the caller (SessionsRightRail) catches it and still
    // calls refetch() to preserve the current list. This test verifies the
    // error propagation contract.
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: 'Ingest service unreachable' }),
    })

    let caughtError: Error | null = null
    try {
      await syncToolSessions('claude-code')
    } catch (err) {
      caughtError = err as Error
    }

    expect(caughtError).not.toBeNull()
    expect(caughtError?.message).toBe('Ingest service unreachable')
  })
})

// ============================================================================
// syncAllSessions
// ============================================================================

describe('syncAllSessions', () => {
  it('calls /api/sync before aggregate refetch', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [], force: false }),
    })

    await syncAllSessions()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/sync')
    expect(opts.method).toBe('POST')
  })

  it('appends ?force=true when force option is set', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [], force: true }),
    })

    await syncAllSessions({ force: true })

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('force=true')
  })

  it('throws on non-ok response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Aggregate sync failed: 500' }),
    })

    await expect(syncAllSessions()).rejects.toThrow()
  })
})
