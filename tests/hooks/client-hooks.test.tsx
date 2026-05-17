// @vitest-environment jsdom

/**
 * Tests for client hooks exported from lib/agent-tools/client-hooks.tsx.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'

import {
  SESSION_REFRESH_EVENT,
  notifySessionsRefresh,
  syncAllSessions,
  syncToolSessions,
  useAggregateSessions,
  useIngestStatus,
  useSSE,
  useSessionTurns,
  useToolSessions,
} from '@/lib/agent-tools/client-hooks'
import type { TraceSession, TraceTurn } from '@/types/trace'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
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
// useAggregateSessions
// ============================================================================

function sessionFixture(
  id: string,
  source: TraceSession['source'],
  timestamps: {
    startedAt: string
    endedAt?: string | null
    updatedAt?: string | null
  },
): TraceSession {
  return {
    id,
    source,
    project: 'project',
    name: id,
    startedAt: timestamps.startedAt,
    endedAt: timestamps.endedAt ?? null,
    updatedAt: timestamps.updatedAt ?? undefined,
    status: 'idle',
    metrics: {
      messageCount: 1,
      userMessageCount: 1,
      hasToolCalls: false,
      parserMalformedLines: 0,
      isTruncated: false,
    },
    turns: [],
  }
}

type AggregateHookResult = ReturnType<typeof useAggregateSessions>
type SessionTurnsHookResult = ReturnType<typeof useSessionTurns>

describe('useAggregateSessions', () => {
  it('fetches initial aggregate sessions through the four BFF source URLs', async () => {
    let latest: AggregateHookResult | undefined

    function Consumer() {
      latest = useAggregateSessions({ limit: '100' })
      return null
    }

    render(<Consumer />)

    await waitFor(() => expect(latest?.loading).toBe(false))

    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls).toHaveLength(4)
    expect(urls).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^\/api\/agent-tools\/openclaw\/sessions\?/),
        expect.stringMatching(/^\/api\/agent-tools\/claude-code\/sessions\?/),
        expect.stringMatching(/^\/api\/agent-tools\/codex\/sessions\?/),
        expect.stringMatching(/^\/api\/agent-tools\/opencode\/sessions\?/),
      ]),
    )
    expect(urls.join('\n')).not.toMatch(/localhost:8078|127\.0\.0\.1|\/api\/v1/)
  })

  it('uses source pagination totals for aggregate totalCount', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [sessionFixture('openclaw-1', 'openclaw', { startedAt: '2026-05-10T00:00:00.000Z' })],
          pagination: { total: 10, limit: 100, offset: 0, hasMore: false },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [sessionFixture('claude-1', 'claude-code', { startedAt: '2026-05-10T00:01:00.000Z' })],
          pagination: { total: 20, limit: 100, offset: 0, hasMore: false },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [sessionFixture('codex-1', 'codex', { startedAt: '2026-05-10T00:02:00.000Z' })],
          pagination: { total: 30, limit: 100, offset: 0, hasMore: false },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [],
          pagination: { total: 0, limit: 100, offset: 0, hasMore: false },
        }),
      })

    let latest: AggregateHookResult | undefined

    function Consumer() {
      latest = useAggregateSessions({ limit: '100' })
      return null
    }

    render(<Consumer />)

    await waitFor(() => expect(latest?.loading).toBe(false))

    expect(latest?.sessions).toHaveLength(3)
    expect(latest?.totalCount).toBe(60)
  })

  it('reports hasMore when any source has another page', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [],
          pagination: { total: 101, limit: 100, offset: 0, hasMore: true },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [],
          pagination: { total: 1, limit: 100, offset: 0, hasMore: false },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [],
          pagination: { total: 0, limit: 100, offset: 0, hasMore: false },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [],
          pagination: { total: 0, limit: 100, offset: 0, hasMore: false },
        }),
      })

    let latest: AggregateHookResult | undefined

    function Consumer() {
      latest = useAggregateSessions({ limit: '100' })
      return null
    }

    render(<Consumer />)

    await waitFor(() => expect(latest?.loading).toBe(false))

    expect(latest?.hasMore).toBe(true)
    expect(latest?.paginationBySource.openclaw?.hasMore).toBe(true)
  })

  it('loads only sources with more pages, dedupes by session id, and sorts by freshness', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [
            sessionFixture('shared', 'openclaw', { startedAt: '2026-05-10T00:00:00.000Z' }),
            sessionFixture('old-openclaw', 'openclaw', { startedAt: '2026-05-10T00:01:00.000Z' }),
          ],
          pagination: { total: 4, limit: 2, offset: 0, hasMore: true },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [
            sessionFixture('claude-only', 'claude-code', {
              startedAt: '2026-05-10T00:02:00.000Z',
              endedAt: '2026-05-10T00:03:00.000Z',
            }),
          ],
          pagination: { total: 1, limit: 2, offset: 0, hasMore: false },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [
            sessionFixture('codex-old', 'codex', { startedAt: '2026-05-10T00:04:00.000Z' }),
          ],
          pagination: { total: 3, limit: 1, offset: 0, hasMore: true },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [],
          pagination: { total: 0, limit: 2, offset: 0, hasMore: false },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [
            sessionFixture('openclaw-new', 'openclaw', {
              startedAt: '2026-05-10T00:05:00.000Z',
              updatedAt: '2026-05-10T00:20:00.000Z',
            }),
            sessionFixture('shared', 'openclaw', {
              startedAt: '2026-05-10T00:06:00.000Z',
              updatedAt: '2026-05-10T00:30:00.000Z',
            }),
          ],
          pagination: { total: 4, limit: 2, offset: 2, hasMore: false },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [
            sessionFixture('codex-new', 'codex', {
              startedAt: '2026-05-10T00:07:00.000Z',
              endedAt: '2026-05-10T00:25:00.000Z',
            }),
          ],
          pagination: { total: 3, limit: 1, offset: 1, hasMore: true },
        }),
      })

    let latest: AggregateHookResult | undefined

    function Consumer() {
      latest = useAggregateSessions({ limit: '100' })
      return null
    }

    render(<Consumer />)

    await waitFor(() => expect(latest?.loading).toBe(false))

    await act(async () => {
      await latest?.loadMore()
    })

    await waitFor(() => expect(latest?.isLoadingMore).toBe(false))

    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    const nextPageUrls = urls.slice(4)
    expect(nextPageUrls).toHaveLength(2)
    expect(nextPageUrls).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/api/agent-tools/openclaw/sessions?'),
        expect.stringContaining('/api/agent-tools/codex/sessions?'),
      ]),
    )
    expect(nextPageUrls).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('/api/agent-tools/claude-code/sessions?'),
        expect.stringContaining('/api/agent-tools/opencode/sessions?'),
      ]),
    )
    expect(nextPageUrls).toEqual(
      expect.arrayContaining([
        expect.stringContaining('offset=2'),
        expect.stringContaining('offset=1'),
      ]),
    )

    expect(latest?.totalCount).toBe(8)
    expect(latest?.hasMore).toBe(true)
    expect(latest?.sessions.map((session) => session.id)).toEqual([
      'shared',
      'codex-new',
      'openclaw-new',
      'codex-old',
      'claude-only',
      'old-openclaw',
    ])
  })
})

// ============================================================================
// useSessionTurns
// ============================================================================

function turnFixture(id: string, index: number): TraceTurn {
  return {
    id,
    sessionId: 'session-1',
    index,
    userMessage: null,
    assistantMessages: [],
    activities: [],
    startedAt: null,
    endedAt: null,
    durationMs: null,
  }
}

describe('useSessionTurns', () => {
  it('loads more turns through BFF pagination and appends without duplicates', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          turns: [turnFixture('turn-1', 0)],
          pagination: { total: 2, limit: 1, offset: 0, hasMore: true },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          turns: [turnFixture('turn-1', 0), turnFixture('turn-2', 1)],
          pagination: { total: 2, limit: 1, offset: 1, hasMore: false },
        }),
      })

    let latest: SessionTurnsHookResult | undefined

    function Consumer() {
      latest = useSessionTurns('codex', 'session-1', { limit: 1 })
      return null
    }

    render(<Consumer />)

    await waitFor(() => expect(latest?.loading).toBe(false))

    await act(async () => {
      await latest?.loadMore()
    })

    await waitFor(() => expect(latest?.isLoadingMore).toBe(false))

    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls).toHaveLength(2)
    expect(urls[0]).toMatch(/^\/api\/agent-tools\/codex\/sessions\/session-1\/turns\?/)
    expect(urls[0]).toContain('limit=1')
    expect(urls[1]).toContain('/api/agent-tools/codex/sessions/session-1/turns?')
    expect(urls[1]).toContain('offset=1')
    expect(urls[1]).toContain('limit=1')
    expect(latest?.turns.map((turn) => turn.id)).toEqual(['turn-1', 'turn-2'])
    expect(latest?.pagination?.hasMore).toBe(false)
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
