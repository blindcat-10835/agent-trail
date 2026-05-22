/**
 * Tests for BFF SSE proxy:
 *   - app/api/agent-tools/[tool]/events/route.ts
 *
 * The shell can run in the synthetic "all" scope, so global SSE needs to work
 * for `/all/events` as well as concrete source tools.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const fetchMock = vi.fn()

function makeRequest(url: string): NextRequest {
  return new NextRequest(url)
}

function sseResponse(): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('event: connected\ndata: {}\n\n'))
    },
  })

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

describe('app/api/agent-tools/[tool]/events/route.ts', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(sseResponse())
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('allows the synthetic all scope to subscribe to global ingest events', async () => {
    const { GET } = await import('@/app/api/agent-tools/[tool]/events/route')

    const req = makeRequest('http://localhost/api/agent-tools/all/events')
    const res = await GET(req, { params: Promise.resolve({ tool: 'all' }) })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/v1/events')
    expect(String(url)).not.toContain('/api/v1/sessions/')
    expect(options.headers).toMatchObject({ Accept: 'text/event-stream' })
    expect(options.cache).toBe('no-store')
  })

  it('forwards sessionId to the ingest per-session event stream', async () => {
    const { GET } = await import('@/app/api/agent-tools/[tool]/events/route')

    const req = makeRequest('http://localhost/api/agent-tools/codex/events?sessionId=abc-123')
    await GET(req, { params: Promise.resolve({ tool: 'codex' }) })

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/v1/sessions/abc-123/events')
  })
})
