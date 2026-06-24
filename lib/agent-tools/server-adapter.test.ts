import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildSourceScopedSessionParams,
  fetchIngest,
  getSourceScopedSession,
  requireSourceScopedSession,
  sanitizeError,
  SessionValidationError,
} from './server-adapter'
import type { TraceSession } from '@/types/trace'

function session(source: TraceSession['source']): TraceSession {
  return {
    id: 'session-1',
    source,
    project: 'default',
    startedAt: '2026-05-07T00:00:00.000Z',
    endedAt: null,
    status: 'idle',
    metrics: {
      messageCount: 1,
      userMessageCount: 1,
      totalTokens: 0,
      hasToolCalls: false,
      parserMalformedLines: 0,
      isTruncated: false,
    },
    turns: [],
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildSourceScopedSessionParams', () => {
  it('forces adapter-owned source after caller query params', () => {
    const params = buildSourceScopedSessionParams('openclaw', {
      source: 'codex',
      status: 'idle',
      limit: '250',
    })

    expect(params.get('source')).toBe('openclaw')
    expect(params.get('status')).toBe('idle')
    expect(params.get('limit')).toBe('100')
  })
})

describe('sanitizeError', () => {
  it('maps an ingest timeout to a 504 "still indexing" response', () => {
    const result = sanitizeError(new Error('Ingest service request timed out'))
    expect(result.code).toBe(504)
    expect(result.error).toMatch(/still indexing/i)
  })

  it('maps any other ingest failure to a 502 "unreachable" response', () => {
    const result = sanitizeError(new Error('ECONNREFUSED'))
    expect(result.code).toBe(502)
    expect(result.error).toBe('Ingest service unreachable')
  })

  it('passes through validation error codes', () => {
    const result = sanitizeError(new SessionValidationError('bad id', 400))
    expect(result.code).toBe(400)
    expect(result.error).toBe('bad id')
  })
})

describe('source-scoped session helpers', () => {
  it('returns the session when it belongs to the requested source', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(session('codex'))))

    await expect(getSourceScopedSession('session-1', 'codex')).resolves.toMatchObject({
      id: 'session-1',
      source: 'codex',
    })
  })

  it('returns null when the session belongs to a different source', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(session('codex'))))

    await expect(getSourceScopedSession('session-1', 'openclaw')).resolves.toBeNull()
  })

  it('throws a 404 validation error before child-resource fetches for wrong-source sessions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(session('codex'))))

    await expect(requireSourceScopedSession('session-1', 'openclaw')).rejects.toMatchObject({
      code: 404,
    } satisfies Partial<SessionValidationError>)
  })
})

describe('fetchIngest', () => {
  it('rejects successful upstream responses with empty bodies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })))

    await expect(fetchIngest('/health')).rejects.toThrow('empty response body')
  })

  it('rejects successful upstream responses with invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 200 })))

    await expect(fetchIngest('/health')).rejects.toThrow('invalid JSON')
  })

  it('uses JSON error messages from non-2xx upstream responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'Upstream failed' }, 500)))

    await expect(fetchIngest('/health')).rejects.toThrow('Upstream failed')
  })
})
