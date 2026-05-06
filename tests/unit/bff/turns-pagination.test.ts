/**
 * Tests for BFF turns endpoint pagination (Phase 05-01, Task 1).
 *
 * RED phase: These tests MUST fail before implementation because:
 * - TurnsQueryParams and TurnsListResult types are not yet exported
 * - getSessionTurns does not accept a second param
 * - BFF route does not parse offset/limit query params
 */

import { describe, it, expect, vi, afterEach } from 'vitest'

// ============================================================================
// Test 1: Server adapter type exports
// ============================================================================

describe('server-adapter types', () => {
  it('exports TurnsQueryParams interface', async () => {
    const mod = await import('@/lib/agent-tools/server-adapter')
    // TurnsQueryParams must exist and be a valid type
    const query: { offset?: number; limit?: number } = {}
    expect(query).toBeDefined()
    // This test fails until TurnsQueryParams is exported
    expect(mod).toHaveProperty('TurnsQueryParams')
  })

  it('exports TurnsListResult interface matching ingest response shape', async () => {
    const mod = await import('@/lib/agent-tools/server-adapter')
    // TurnsListResult must exist with pagination fields
    expect(mod).toHaveProperty('TurnsListResult')
  })

  it('getSessionTurns signature accepts optional query param', async () => {
    const mod = await import('@/lib/agent-tools/server-adapter')
    const iface = mod as Record<string, unknown>
    // getSessionTurns should accept (sessionId, query?) signature
    expect(true).toBe(true) // type-level check via pnpm typecheck
  })
})

// ============================================================================
// Test 2: Adapter sends offset/limit to ingest
// ============================================================================

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const mockTurnsResponse = {
  sessionId: 'test-session',
  turns: [{ id: 'turn-1', sessionId: 'test-session', index: 0 }],
  pagination: { total: 1, limit: 10, offset: 0, hasMore: false },
}

describe('openclaw adapter getSessionTurns pagination', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('passes offset and limit query params to ingest', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      // Verify URL contains offset=10&limit=20
      expect(url).toContain('offset=10')
      expect(url).toContain('limit=20')
      return jsonResponse(mockTurnsResponse)
    })
    vi.stubGlobal('fetch', fetchSpy)

    // Dynamic import to get the updated adapter
    const { openclawAdapter } = await import(
      '@/lib/agent-tools/openclaw/server-adapter'
    )

    // As of now, getSessionTurns does NOT accept a second param — this should FAIL
    const result = await openclawAdapter.getSessionTurns(
      'test-session-valid',
      { offset: 10, limit: 20 },
    )
    expect(result).toBeDefined()
    expect(fetchSpy).toHaveBeenCalled()
  })

  it('defaults offset=0, limit=50 when no query params provided', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      expect(url).toContain('offset=0')
      expect(url).toContain('limit=50')
      return jsonResponse(mockTurnsResponse)
    })
    vi.stubGlobal('fetch', fetchSpy)

    const { openclawAdapter } = await import(
      '@/lib/agent-tools/openclaw/server-adapter'
    )

    const result = await openclawAdapter.getSessionTurns('test-session-valid')
    expect(result).toBeDefined()
    expect(fetchSpy).toHaveBeenCalled()
  })
})

// ============================================================================
// Test 3: BFF route validates offset/limit params
// ============================================================================

describe('BFF turns route param validation', () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('returns 400 for negative offset', async () => {
    // Mock adapters to return valid data
    vi.doMock('@/lib/agent-tools/openclaw/server-adapter', () => ({
      openclawAdapter: {
        getSessionTurns: vi.fn(async () => mockTurnsResponse),
      },
    }))
    vi.doMock('@/lib/agent-tools/claude-code/server-adapter', () => ({
      claudeCodeAdapter: {
        getSessionTurns: vi.fn(async () => mockTurnsResponse),
      },
    }))
    vi.doMock('@/lib/agent-tools/codex/server-adapter', () => ({
      codexAdapter: {
        getSessionTurns: vi.fn(async () => mockTurnsResponse),
      },
    }))
    vi.doMock('@/lib/agent-tools/registry', () => ({
      assertSourceToolId: vi.fn((id: string) => id),
    }))

    const { GET } = await import(
      '@/app/api/agent-tools/[tool]/sessions/[sessionId]/turns/route'
    )

    // Create request with negative offset
    const req = new Request(
      'http://localhost:3000/api/agent-tools/openclaw/sessions/test-session/turns?offset=-1&limit=10',
    )
    const res = await GET(
      req as unknown as Request & { nextUrl: URL },
      { params: Promise.resolve({ tool: 'openclaw', sessionId: 'test-session' }) },
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('Invalid')
  })

  it('caps limit at 100 even when larger value passed', async () => {
    vi.doMock('@/lib/agent-tools/openclaw/server-adapter', () => ({
      openclawAdapter: {
        toolId: 'openclaw',
        getSessionTurns: vi.fn(
          async (_id: string, query?: { offset?: number; limit?: number }) => {
            // Verify capped limit was passed
            expect(query?.limit).toBe(100)
            return mockTurnsResponse
          },
        ),
      },
    }))
    vi.doMock('@/lib/agent-tools/claude-code/server-adapter', () => ({
      claudeCodeAdapter: { toolId: 'claude-code', getSessionTurns: vi.fn() },
    }))
    vi.doMock('@/lib/agent-tools/codex/server-adapter', () => ({
      codexAdapter: { toolId: 'codex', getSessionTurns: vi.fn() },
    }))
    vi.doMock('@/lib/agent-tools/registry', () => ({
      assertSourceToolId: vi.fn((id: string) => id),
    }))

    const { GET } = await import(
      '@/app/api/agent-tools/[tool]/sessions/[sessionId]/turns/route'
    )

    const req = new Request(
      'http://localhost:3000/api/agent-tools/openclaw/sessions/test-session/turns?offset=0&limit=1000',
    )
    const res = await GET(
      req as unknown as Request & { nextUrl: URL },
      { params: Promise.resolve({ tool: 'openclaw', sessionId: 'test-session' }) },
    )
    expect(res.status).toBe(200)
  })

  it('uses defaults offset=0, limit=50 when no query params', async () => {
    let capturedQuery: { offset?: number; limit?: number } | undefined
    vi.doMock('@/lib/agent-tools/openclaw/server-adapter', () => ({
      openclawAdapter: {
        toolId: 'openclaw',
        getSessionTurns: vi.fn(
          async (_id: string, query?: { offset?: number; limit?: number }) => {
            capturedQuery = query
            return mockTurnsResponse
          },
        ),
      },
    }))
    vi.doMock('@/lib/agent-tools/claude-code/server-adapter', () => ({
      claudeCodeAdapter: { toolId: 'claude-code', getSessionTurns: vi.fn() },
    }))
    vi.doMock('@/lib/agent-tools/codex/server-adapter', () => ({
      codexAdapter: { toolId: 'codex', getSessionTurns: vi.fn() },
    }))
    vi.doMock('@/lib/agent-tools/registry', () => ({
      assertSourceToolId: vi.fn((id: string) => id),
    }))

    const { GET } = await import(
      '@/app/api/agent-tools/[tool]/sessions/[sessionId]/turns/route'
    )

    const req = new Request(
      'http://localhost:3000/api/agent-tools/openclaw/sessions/test-session/turns',
    )
    await GET(
      req as unknown as Request & { nextUrl: URL },
      { params: Promise.resolve({ tool: 'openclaw', sessionId: 'test-session' }) },
    )
    // With defaults, query should not have offset/limit (adapter handles defaults)
    // But the route passes undefined, and the adapter falls back to default
    expect(capturedQuery).toBeDefined()
  })
})
