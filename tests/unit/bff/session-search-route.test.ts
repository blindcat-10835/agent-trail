import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const fetchIngestMock = vi.fn()

vi.mock('@/lib/agent-tools/server-adapter', () => ({
  fetchIngest: (...args: unknown[]) => fetchIngestMock(...args),
  sanitizeLimit: (raw: string | undefined, fallback = 50) => {
    const parsed = parseInt(raw || String(fallback), 10)
    if (Number.isNaN(parsed) || parsed < 1) return fallback
    return Math.min(parsed, 100)
  },
  validateSessionId: vi.fn(),
  buildSourceScopedSessionParams: (source: string, query: Record<string, string>) =>
    new URLSearchParams({ ...query, source }),
  getSourceScopedSession: vi.fn(),
  requireSourceScopedSession: vi.fn(),
  sanitizeError: (err: unknown) => {
    if (err instanceof Error && err.message.startsWith('Invalid agent tool ID')) {
      return { error: err.message, code: 400 }
    }
    return { error: 'Ingest service unreachable', code: 502 }
  },
}))

function makeRequest(url: string): NextRequest {
  const request = new Request(url, { method: 'GET' }) as unknown as NextRequest & {
    nextUrl?: URL
  }
  request.nextUrl = new URL(url) as unknown as NextRequest['nextUrl']
  return request
}

describe('app/api/agent-tools/[tool]/sessions/search/route.ts', () => {
  beforeEach(() => {
    fetchIngestMock.mockResolvedValue({
      query: 'gree',
      results: [],
      pagination: { limit: 20, returned: 0, hasMore: false },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('allows the synthetic all scope without injecting a source filter', async () => {
    const { GET } = await import('@/app/api/agent-tools/[tool]/sessions/search/route')

    const req = makeRequest('http://localhost/api/agent-tools/all/sessions/search?q=gree&limit=250')
    const res = await GET(req, { params: Promise.resolve({ tool: 'all' }) })

    expect(res.status).toBe(200)
    expect(fetchIngestMock).toHaveBeenCalledWith(
      '/api/v1/sessions/search?q=gree&limit=100',
      { cache: 'no-store' },
    )
  })

  it('injects the source filter for concrete tool scopes', async () => {
    const { GET } = await import('@/app/api/agent-tools/[tool]/sessions/search/route')

    const req = makeRequest(
      'http://localhost/api/agent-tools/codex/sessions/search?q=gree&includeChildren=true',
    )
    const res = await GET(req, { params: Promise.resolve({ tool: 'codex' }) })

    expect(res.status).toBe(200)
    expect(fetchIngestMock).toHaveBeenCalledWith(
      '/api/v1/sessions/search?q=gree&includeChildren=true&source=codex',
      { cache: 'no-store' },
    )
  })

  it('returns 400 when q is missing', async () => {
    const { GET } = await import('@/app/api/agent-tools/[tool]/sessions/search/route')

    const req = makeRequest('http://localhost/api/agent-tools/all/sessions/search')
    const res = await GET(req, { params: Promise.resolve({ tool: 'all' }) })

    expect(res.status).toBe(400)
    expect(fetchIngestMock).not.toHaveBeenCalled()
  })

  it('still rejects unknown tool IDs', async () => {
    const { GET } = await import('@/app/api/agent-tools/[tool]/sessions/search/route')

    const req = makeRequest('http://localhost/api/agent-tools/unknown/sessions/search?q=gree')
    const res = await GET(req, { params: Promise.resolve({ tool: 'unknown' }) })

    expect(res.status).toBe(400)
    const body = await res.json() as Record<string, unknown>
    expect(String(body.error)).toContain('unknown')
  })
})
