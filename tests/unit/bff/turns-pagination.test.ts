/**
 * Tests for BFF turns endpoint pagination (Phase 05-01, Task 1).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Import types at module level for compile-time verification
import type {
  TurnsQueryParams,
  TurnsListResult,
} from '@/lib/agent-tools/server-adapter'

// ============================================================================
// Test 1: Server adapter types (compile-time verification)
// ============================================================================

describe('server-adapter types', () => {
  it('TurnsQueryParams and TurnsListResult types compile and are usable', () => {
    // Compile-time type check: these assignments should compile without errors
    const params: TurnsQueryParams = { offset: 0, limit: 10 }
    expect(params.offset).toBe(0)
    expect(params.limit).toBe(10)

    const result: TurnsListResult = {
      sessionId: 'test',
      turns: [],
      pagination: { total: 0, limit: 10, offset: 0, hasMore: false },
    }
    expect(result.pagination.hasMore).toBe(false)
  })

  it('TurnsQueryParams allows undefined offset and limit', () => {
    const empty: TurnsQueryParams = {}
    expect(empty.offset).toBeUndefined()
    expect(empty.limit).toBeUndefined()
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

const mockSessionResponse = {
  id: 'test-session-valid',
  source: 'openclaw',
  project: 'default',
  startedAt: '2026-01-01T00:00:00.000Z',
  endedAt: null,
  status: 'active',
  metrics: {
    messageCount: 10,
    userMessageCount: 5,
    totalTokens: 1000,
    hasToolCalls: true,
    parserMalformedLines: 0,
    isTruncated: false,
  },
  turns: [],
}

const mockTurnsResponse = {
  sessionId: 'test-session-valid',
  turns: [{ id: 'turn-1', sessionId: 'test-session-valid', index: 0 }],
  pagination: { total: 1, limit: 10, offset: 0, hasMore: false },
}

describe('openclaw adapter getSessionTurns pagination', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('passes offset and limit query params to ingest', async () => {
    let turnsUrlCalled = false
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.includes('/turns')) {
        turnsUrlCalled = true
        expect(url).toContain('offset=10')
        expect(url).toContain('limit=20')
        return jsonResponse(mockTurnsResponse)
      }
      // Session lookup
      return jsonResponse(mockSessionResponse)
    })
    vi.stubGlobal('fetch', fetchSpy)

    const { openclawAdapter } = await import(
      '@/lib/agent-tools/openclaw/server-adapter'
    )

    const result = await openclawAdapter.getSessionTurns(
      'test-session-valid',
      { offset: 10, limit: 20 },
    )
    expect(result).toBeDefined()
    expect(result.turns).toHaveLength(1)
    expect(turnsUrlCalled).toBe(true)
  })

  it('defaults offset=0, limit=50 when no query params provided', async () => {
    let turnsUrlCalled = false
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.includes('/turns')) {
        turnsUrlCalled = true
        expect(url).toContain('offset=0')
        expect(url).toContain('limit=50')
        return jsonResponse(mockTurnsResponse)
      }
      return jsonResponse(mockSessionResponse)
    })
    vi.stubGlobal('fetch', fetchSpy)

    const { openclawAdapter } = await import(
      '@/lib/agent-tools/openclaw/server-adapter'
    )

    const result = await openclawAdapter.getSessionTurns('test-session-valid')
    expect(result).toBeDefined()
    expect(result.turns).toHaveLength(1)
    expect(turnsUrlCalled).toBe(true)
  })

  it('passes custom limit=100 to ingest (not capped by adapter, cap is in route)', async () => {
    let turnsUrlCalled = false
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.includes('/turns')) {
        turnsUrlCalled = true
        expect(url).toContain('limit=100')
        return jsonResponse(mockTurnsResponse)
      }
      return jsonResponse(mockSessionResponse)
    })
    vi.stubGlobal('fetch', fetchSpy)

    const { openclawAdapter } = await import(
      '@/lib/agent-tools/openclaw/server-adapter'
    )

    await openclawAdapter.getSessionTurns('test-session-valid', {
      offset: 0,
      limit: 100,
    })
    expect(turnsUrlCalled).toBe(true)
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

    const req = new Request(
      'http://localhost:3000/api/agent-tools/openclaw/sessions/test-session/turns?offset=-1&limit=10',
    )
    const res = await GET(
      req as unknown as NextRequest,
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
      req as unknown as NextRequest,
      { params: Promise.resolve({ tool: 'openclaw', sessionId: 'test-session' }) },
    )
    expect(res.status).toBe(200)
  })

  it('passes undefined offset/limit to adapter when no query params (adapter uses defaults)', async () => {
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
      req as unknown as NextRequest,
      { params: Promise.resolve({ tool: 'openclaw', sessionId: 'test-session' }) },
    )
    expect(capturedQuery).toBeDefined()
  })

  it('returns 400 for negative limit', async () => {
    vi.doMock('@/lib/agent-tools/openclaw/server-adapter', () => ({
      openclawAdapter: {
        getSessionTurns: vi.fn(async () => mockTurnsResponse),
      },
    }))
    vi.doMock('@/lib/agent-tools/claude-code/server-adapter', () => ({
      claudeCodeAdapter: { getSessionTurns: vi.fn() },
    }))
    vi.doMock('@/lib/agent-tools/codex/server-adapter', () => ({
      codexAdapter: { getSessionTurns: vi.fn() },
    }))
    vi.doMock('@/lib/agent-tools/registry', () => ({
      assertSourceToolId: vi.fn((id: string) => id),
    }))

    const { GET } = await import(
      '@/app/api/agent-tools/[tool]/sessions/[sessionId]/turns/route'
    )

    const req = new Request(
      'http://localhost:3000/api/agent-tools/openclaw/sessions/test-session/turns?limit=-5',
    )
    const res = await GET(
      req as unknown as NextRequest,
      { params: Promise.resolve({ tool: 'openclaw', sessionId: 'test-session' }) },
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('Invalid')
  })
})
