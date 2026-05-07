import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOpenClawAdapter } from './server-adapter'

function sessionData() {
  return {
    id: 'oc-session-abc',
    source: 'openclaw' as const,
    project: 'default',
    startedAt: '2026-05-07T00:00:00.000Z',
    endedAt: null,
    status: 'idle' as const,
    metrics: {
      messageCount: 5,
      userMessageCount: 3,
      totalTokens: 0,
      hasToolCalls: true,
      parserMalformedLines: 0,
      isTruncated: false,
    },
    turns: [],
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OpenClaw adapter — lookupSessionByKey', () => {
  it('calls the ingest lookup endpoint with source=openclaw and encoded key', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(sessionData()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const adapter = createOpenClawAdapter()
    const result = await adapter.lookupSessionByKey('gw-key/with=special&chars')

    expect(result).toMatchObject({ id: 'oc-session-abc', source: 'openclaw' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = (fetchMock.mock.calls[0] as unknown[])[0] as string
    expect(url).toContain('/api/v1/sessions/lookup')
    expect(url).toContain('source=openclaw')
    expect(url).toContain('key=gw-key%2Fwith%3Dspecial%26chars')
  })

  it('returns null when ingest returns 404 (session not found)', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'Session not found for key' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const adapter = createOpenClawAdapter()
    const result = await adapter.lookupSessionByKey('nonexistent-key')

    expect(result).toBeNull()
  })

  it('throws on non-404 ingest errors (e.g. 502)', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const adapter = createOpenClawAdapter()
    await expect(adapter.lookupSessionByKey('any-key')).rejects.toThrow()
  })
})
