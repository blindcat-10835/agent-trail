/**
 * Agent Tool Server Adapter — Base Interface & Shared Fetch Utility
 *
 * Defines the contract for per-tool server adapters that proxy requests
 * to the ingest service (localhost:8078). These adapters encapsulate
 * ingest API mapping, input validation, and error sanitization.
 *
 * **Server-only boundary:** This file uses `fetch` to the ingest service
 * and is NEVER imported by 'use client' components.
 *
 * Per D-07: BFF proxy — frontend components never call ingest directly.
 * Per D-08: Unified per-tool routing — shared adapter interface across all 3 tools.
 *
 * @see .planning/research/ARCHITECTURE.md §Adapter 与 Provider 接口
 */

import type { TraceSession } from '@/types/trace'
import type { SourceToolId } from './types'

// ============================================================================
// Configuration
// ============================================================================

/** Base URL of the ingest service (configurable via env for deployment) */
const INGEST_BASE = process.env.INGEST_URL || 'http://localhost:8078'

/**
 * Session ID validation regex.
 * Must match `/^[a-zA-Z0-9:\-_.]{1,256}$/` before proxying to ingest.
 * Rejects with 400 if invalid (per threat model T-04-04).
 */
const SESSION_ID_RE = /^[a-zA-Z0-9:\-_.]{1,256}$/

/** Maximum sessions per page (per threat model T-04-06: cap at 100) */
const MAX_LIMIT = 100

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validation error with HTTP status code.
 * Caught by route handlers and converted to sanitized error responses.
 */
export class SessionValidationError extends Error {
  constructor(
    message: string,
    public code: number = 400,
  ) {
    super(message)
    this.name = 'SessionValidationError'
  }
}

/**
 * Validate a sessionId before proxying to ingest.
 *
 * @throws {SessionValidationError} if sessionId doesn't match the allowed pattern
 * @param sessionId - Raw session ID from URL params
 */
export function validateSessionId(sessionId: string): void {
  if (!SESSION_ID_RE.test(sessionId)) {
    throw new SessionValidationError(
      `Invalid session ID: "${sessionId}". ` +
        `Must match pattern: ${SESSION_ID_RE}`,
      400,
    )
  }
}

/**
 * Parse and cap the `limit` query parameter.
 * Defaults to 50; capped at MAX_LIMIT (100) per threat model T-04-06.
 *
 * @param raw - Raw limit string from query params
 * @returns Parsed and capped numeric limit
 */
export function sanitizeLimit(raw: string | undefined): number {
  const parsed = parseInt(raw || '50', 10)
  if (isNaN(parsed) || parsed < 1) return 50
  return Math.min(parsed, MAX_LIMIT)
}

/**
 * Build source-scoped session query params.
 *
 * Caller-provided `source` is intentionally ignored so URL query params cannot
 * override the adapter-owned source boundary.
 */
export function buildSourceScopedSessionParams(
  source: SourceToolId,
  query: Record<string, string>,
): URLSearchParams {
  const sanitizedQuery = { ...query }
  delete sanitizedQuery.source

  return new URLSearchParams({
    ...sanitizedQuery,
    source,
    limit: String(sanitizeLimit(query.limit)),
  })
}

/**
 * Fetch a session only if it belongs to the requested source.
 */
export async function getSourceScopedSession(
  sessionId: string,
  source: SourceToolId,
): Promise<TraceSession | null> {
  validateSessionId(sessionId)

  try {
    const session = await fetchIngest<TraceSession>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}`,
      { cache: 'no-store' },
    )
    return session.source === source ? session : null
  } catch (err) {
    if (err instanceof Error && err.message === 'Session not found') {
      return null
    }
    throw err
  }
}

/**
 * Require a source-owned session before proxying child resources.
 */
export async function requireSourceScopedSession(
  sessionId: string,
  source: SourceToolId,
): Promise<TraceSession> {
  const session = await getSourceScopedSession(sessionId, source)
  if (!session) {
    throw new SessionValidationError('Session not found', 404)
  }
  return session
}

// ============================================================================
// Error Sanitization
// ============================================================================

/**
 * Sanitize errors before sending to the frontend.
 *
 * Per threat model T-04-05: strips internal stack traces, file paths,
 * and ingest internals. Never exposes details of the internal service.
 *
 * @param err - The caught error from adapter/ingest operations
 * @returns A sanitized error response with HTTP status code
 */
export function sanitizeError(err: unknown): { error: string; code: number } {
  if (err instanceof SessionValidationError) {
    return { error: err.message, code: err.code }
  }
  if (err instanceof Error) {
    if (
      err.message.startsWith('Invalid source tool ID') ||
      err.message.startsWith('Invalid agent tool ID')
    ) {
      return { error: err.message, code: 400 }
    }
    // Never expose stack traces or internal paths to frontend
    return { error: 'Ingest service unreachable', code: 502 }
  }
  return { error: 'Unknown error', code: 500 }
}

// ============================================================================
// Ingest Fetch Utility
// ============================================================================

/**
 * Fetch utility for calling the ingest service.
 *
 * Wraps native fetch with INGEST_BASE prefix, JSON content-type header,
 * and proper error handling. Supports Next.js fetch caching options
 * (revalidate, cache) for SSR/incremental-static-regeneration scenarios.
 *
 * @param path - URL path relative to INGEST_BASE (e.g. '/api/v1/sessions')
 * @param options - fetch options including caching config
 * @returns Parsed JSON response body
 * @throws Error if the ingest service returns a non-2xx status
 */
export async function fetchIngest<T>(
  path: string,
  options?: {
    method?: string
    body?: unknown
    /** Next.js fetch cache strategy (ISR revalidation in seconds) */
    next?: { revalidate?: number; tags?: string[] }
    /** Next.js fetch cache mode */
    cache?: RequestCache
  },
): Promise<T> {
  const url = `${INGEST_BASE}${path}`
  const fetchOptions: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
    method: options?.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  }

  // Forward Next.js fetch caching options if provided
  if (options?.next) {
    fetchOptions.next = options.next
  }
  if (options?.cache) {
    fetchOptions.cache = options.cache
  }

  const res = await fetch(url, fetchOptions)

  if (!res.ok) {
    let body: Record<string, unknown> = {}
    try {
      body = (await res.json()) as Record<string, unknown>
    } catch {
      // Response body is not JSON — use status text
    }
    const errorMsg =
      typeof body.error === 'string'
        ? body.error
        : `Ingest returned ${res.status}`
    throw new Error(errorMsg)
  }

  return res.json() as T
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Standard session list response from the ingest service.
 * Matches the response shape of `GET /api/v1/sessions`.
 */
export interface SessionListResult {
  sessions: TraceSession[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

// ============================================================================
// Adapter Interface
// ============================================================================

/**
 * Server adapter interface for agent tool ingest API access.
 *
 * Each supported tool (openclaw, claude-code, codex) implements this interface.
 * The only tool-specific behavior is the `source` query param in `listSessions()`.
 *
 * Methods follow the ingest REST API shape:
 * - health() → GET /health
 * - listSessions() → GET /api/v1/sessions?source=TOOL&...
 * - getSession() → GET /api/v1/sessions/:id
 * - getSessionMessages() → GET /api/v1/sessions/:id/messages
 * - getSessionTurns() → GET /api/v1/sessions/:id/turns
 */
export interface AgentToolServerAdapter {
  /** Unique tool identifier matching the URL segment */
  readonly toolId: string

  /** Check ingest service health */
  health(): Promise<{ status: string; version?: string }>

  /**
   * List sessions for this tool from the ingest service.
   * Automatically injects `source=TOOL` into the query params.
   *
   * @param query - Query params forwarded to ingest (status, project, sort, etc.)
   */
  listSessions(query: Record<string, string>): Promise<SessionListResult>

  /**
   * Get a single session by ID.
   *
   * @param sessionId - Session ID (validated before proxying)
   */
  getSession(sessionId: string): Promise<TraceSession | null>

  /**
   * Get messages for a session.
   *
   * @param sessionId - Session ID (validated before proxying)
   */
  getSessionMessages(sessionId: string): Promise<unknown[]>

  /**
   * Get turns for a session.
   *
   * @param sessionId - Session ID (validated before proxying)
   */
  getSessionTurns(sessionId: string): Promise<unknown[]>
}
