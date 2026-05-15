/**
 * Tests for BFF health route:
 *   - app/api/agent-tools/[tool]/health/route.ts
 *
 * The shell can run in the synthetic "all" scope, so the health endpoint must
 * accept AgentToolId rather than only concrete ingest sources.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const fetchIngestMock = vi.fn()

vi.mock('@/lib/agent-tools/server-adapter', () => ({
  fetchIngest: (...args: unknown[]) => fetchIngestMock(...args),
  sanitizeLimit: (raw: string | undefined) => Number(raw ?? 50),
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
  return new Request(url, { method: 'GET' }) as unknown as NextRequest
}

describe('app/api/agent-tools/[tool]/health/route.ts', () => {
  beforeEach(() => {
    fetchIngestMock.mockResolvedValue({ status: 'ok', version: 'test' })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('allows the synthetic all scope to check ingest health', async () => {
    const { GET } = await import('@/app/api/agent-tools/[tool]/health/route')

    const req = makeRequest('http://localhost/api/agent-tools/all/health')
    const res = await GET(req, { params: Promise.resolve({ tool: 'all' }) })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok', version: 'test' })
    expect(fetchIngestMock).toHaveBeenCalledTimes(1)
    expect(fetchIngestMock).toHaveBeenCalledWith('/health')
  })

  it('still rejects unknown tool IDs', async () => {
    const { GET } = await import('@/app/api/agent-tools/[tool]/health/route')

    const req = makeRequest('http://localhost/api/agent-tools/unknown/health')
    const res = await GET(req, { params: Promise.resolve({ tool: 'unknown' }) })

    expect(res.status).toBe(400)
    const body = await res.json() as Record<string, unknown>
    expect(String(body.error)).toContain('unknown')
  })
})
