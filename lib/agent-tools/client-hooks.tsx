'use client'

/**
 * Agent Tool Client Hooks
 *
 * React context provider and hooks for accessing the current agent tool
 * from within a [tool] layout. All consumer components use useAgentTool()
 * to read toolId, definition, capabilities, and build hrefs.
 *
 * Architecture: Client-safe split from server-adapter (server-only IO).
 * The provider only exposes compile-time definition data — no IO, no fetch.
 *
 * Data hooks (useToolSessions, useSessionDetail, etc.) use the BFF proxy
 * at /api/agent-tools/[tool]/... — they NEVER call ingest directly (per D-10).
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import type {
  AgentToolId,
  AgentToolDefinition,
  AgentToolCapabilities,
  AgentToolContextValue,
  SourceToolId,
} from './types'
import { getDefinition, TOOL_IDS } from './registry'
import type { TraceSession } from '@/types/trace'
import type { TraceTurn } from '@/types/trace'

/**
 * React context for agent tool data.
 * Defaults to null — components must be wrapped in AgentToolProvider.
 */
export const AgentToolContext = createContext<AgentToolContextValue | null>(null)

/**
 * Strip server-only fields from a tool definition before exposing to the client.
 *
 * Currently a pass-through (no server-only fields exist yet), but this is the
 * architectural boundary where IO-sensitive data would be removed in future phases.
 * Kept as a separate function for the provider to call rather than calling
 * getDefinition() directly.
 */
export function getClientToolDefinition(
  toolId: AgentToolId,
): AgentToolDefinition {
  return getDefinition(toolId)
}

/**
 * Provider that supplies agent tool context to the component tree.
 *
 * Wraps children in AgentToolContext.Provider with a computed value containing:
 * - toolId: current tool from URL segment
 * - definition: full AgentToolDefinition (capabilities, nav, UI profile)
 * - capabilities: convenience shortcut to definition.capabilities
 * - href: URL builder that prepends `/{toolId}` to any route
 *
 * @example
 * ```tsx
 * // In app/(tool-shell)/[tool]/layout.tsx
 * export default async function ToolLayout({ children, params }) {
 *   const { tool } = await params
 *   const toolId = assertAgentToolId(tool)
 *   return (
 *     <AgentToolProvider toolId={toolId}>
 *       <ShellFrame>{children}</ShellFrame>
 *     </AgentToolProvider>
 *   )
 * }
 * ```
 */
export function AgentToolProvider({
  toolId,
  children,
}: {
  toolId: AgentToolId
  children: ReactNode
}) {
  const definition = getClientToolDefinition(toolId)

  const value: AgentToolContextValue = {
    toolId,
    definition,
    capabilities: definition.capabilities,
    href: (route: string) => `/${toolId}${route}`,
  }

  return (
    <AgentToolContext.Provider value={value}>
      {children}
    </AgentToolContext.Provider>
  )
}

/**
 * Hook to access the current agent tool context.
 *
 * Must be called within a component tree wrapped by AgentToolProvider.
 * Throws a descriptive error if used outside the provider to catch
 * misconfiguration at development time.
 *
 * @returns AgentToolContextValue with toolId, definition, capabilities, href builder
 * @throws Error if called outside AgentToolProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { toolId, capabilities, href } = useAgentTool()
 *   return <a href={href('/dashboard')}>{toolId} Dashboard</a>
 * }
 * ```
 */
export function useAgentTool(): AgentToolContextValue {
  const ctx = useContext(AgentToolContext)
  if (ctx === null) {
    throw new Error(
      'useAgentTool() must be used within an AgentToolProvider. ' +
        'Wrap your layout in app/(tool-shell)/[tool]/layout.tsx with ' +
        '<AgentToolProvider toolId={...}>.',
    )
  }
  return ctx
}

/**
 * Type guard: checks if a value satisfies AgentToolCapabilities.
 * Useful for runtime validation when receiving capabilities from
 * external sources (e.g. API responses).
 */
export function isAgentToolCapabilities(
  value: unknown,
): value is AgentToolCapabilities {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.liveGateway === 'boolean' &&
    typeof v.sessions === 'boolean' &&
    typeof v.replay === 'boolean' &&
    typeof v.activity === 'boolean' &&
    typeof v.office === 'boolean' &&
    typeof v.workspace === 'boolean' &&
    typeof v.subagents === 'boolean' &&
    typeof v.cost === 'boolean' &&
    typeof v.approvals === 'boolean'
  )
}

// ============================================================================
// BFF Proxy Data Hooks
// ============================================================================
// Per D-10: These hooks only call the BFF proxy at /api/agent-tools/[tool]/...
// They NEVER call ingest directly. They do NOT read Gateway store.

/**
 * Shared fetch utility for BFF proxy calls.
 * All data hooks route through this function — never call ingest directly.
 */
async function fetchToolApi<T>(
  toolId: string,
  path: string,
  query?: Record<string, string>,
): Promise<T> {
  const params = query ? '?' + new URLSearchParams(query).toString() : ''
  const res = await fetch(`/api/agent-tools/${toolId}${path}${params}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.json() as T
}

/**
 * Hook: Fetch sessions for a tool from ingest via BFF proxy.
 *
 * Returns live sessions, pagination metadata, loading state, and a refetch
 * function for retry. All query params are forwarded to the ingest API via
 * the BFF proxy — frontend never calls ingest directly.
 *
 * @param toolId - Current tool from AgentToolProvider
 * @param query - Optional filter/sort/pagination params forwarded to ingest
 * @returns { sessions, pagination, loading, error, refetch }
 */
export function useToolSessions(
  toolId: AgentToolId,
  query?: Record<string, string>,
) {
  const [sessions, setSessions] = useState<TraceSession[]>([])
  const [pagination, setPagination] = useState<{
    total: number
    limit: number
    offset: number
    hasMore: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const queryKey = JSON.stringify(query ?? {})

  const fetchSessions = useCallback(async () => {
    try {
      const parsedQuery = JSON.parse(queryKey) as Record<string, string>
      const data = await fetchToolApi<{
        sessions: TraceSession[]
        pagination: { total: number; limit: number; offset: number; hasMore: boolean }
      }>(toolId, '/sessions', { limit: '50', ...parsedQuery })
      setSessions(data.sessions)
      setPagination(data.pagination)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [toolId, queryKey])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- effect intentionally starts an async BFF fetch
    fetchSessions()
  }, [fetchSessions])

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    void fetchSessions()
  }, [fetchSessions])

  return { sessions, pagination, loading, error, refetch }
}

/**
 * Hook: Fetch single session detail from ingest via BFF proxy.
 *
 * Returns null when sessionId is null/undefined (no-op). Fetches fresh
 * detail data on every sessionId change.
 *
 * @param toolId - Current tool from AgentToolProvider
 * @param sessionId - Session ID to fetch, or null for no-op
 * @returns { session, loading, error }
 */
export function useSessionDetail(
  toolId: AgentToolId,
  sessionId: string | null,
) {
  const [session, setSession] = useState<TraceSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- selection change should show detail loading immediately
    setLoading(true)
    setError(null)
    fetchToolApi<TraceSession>(toolId, `/sessions/${sessionId}`)
      .then(setSession)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load session'),
      )
      .finally(() => setLoading(false))
  }, [toolId, sessionId])

  return { session: sessionId ? session : null, loading, error }
}

/**
 * Hook: Fetch ingest source health status.
 *
 * Calls the BFF health endpoint to determine if the ingest service
 * is reachable for the given tool's source. Returns a simple
 * connection status string for use in status indicators.
 *
 * @param toolId - Current tool from AgentToolProvider
 * @returns 'connected' | 'error' | 'loading'
 */
export function useSourceStatus(toolId: AgentToolId) {
  const [status, setStatus] = useState<'connected' | 'error' | 'loading'>(
    'loading',
  )

  useEffect(() => {
    fetchToolApi<{ status: string }>(toolId, '/health')
      .then(() => setStatus('connected'))
      .catch(() => setStatus('error'))
  }, [toolId])

  return status
}

/**
 * Hook: Fetch and merge sessions from ALL tools.
 *
 * Used by the aggregate landing page (/) to show a cross-source session
 * list. Fetches sessions from all 3 tools in parallel via the BFF proxy,
 * merges them into a single array, and sorts by startedAt descending.
 *
 * If any tool's fetch fails, the merged list still renders with source status
 * metadata so the UI can tell users which source is missing.
 *
 * @param query - Optional filter/sort/pagination params forwarded to each tool
 * @returns { sessions, totalCount, sources, loading, error }
 */
export interface AggregateSourceStatus {
  toolId: SourceToolId
  status: 'loaded' | 'error'
  count: number
  total: number
  error?: string
}

export function useAggregateSessions(query?: Record<string, string>) {
  const [sessions, setSessions] = useState<TraceSession[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [sources, setSources] = useState<AggregateSourceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const queryKey = JSON.stringify(query ?? {})

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- query/source changes should show aggregate loading immediately
    setLoading(true)
    setError(null)
    const parsedQuery = JSON.parse(queryKey) as Record<string, string>
    Promise.all(
      TOOL_IDS.map((toolId) =>
        fetchToolApi<{
          sessions: TraceSession[]
          pagination: { total: number; limit: number; offset: number; hasMore: boolean }
        }>(
          toolId,
          '/sessions',
          { limit: '50', ...parsedQuery },
        )
          .then((d) => ({
            toolId,
            sessions: d.sessions,
            status: {
              toolId,
              status: 'loaded' as const,
              count: d.sessions.length,
              total: d.pagination.total,
            },
          }))
          .catch((err) => ({
            toolId,
            sessions: [],
            status: {
              toolId,
              status: 'error' as const,
              count: 0,
              total: 0,
              error: err instanceof Error ? err.message : 'Failed to load source',
            },
          })),
      ),
    )
      .then((results) => {
        const merged = results.flatMap((result) => result.sessions).sort((a, b) => {
          const da = a.startedAt ? new Date(a.startedAt).getTime() : 0
          const db = b.startedAt ? new Date(b.startedAt).getTime() : 0
          return db - da
        })
        const sourceStatuses = results.map((result) => result.status)
        const allSourcesFailed = sourceStatuses.every((source) => source.status === 'error')

        setSessions(merged)
        setSources(sourceStatuses)
        setTotalCount(sourceStatuses.reduce((sum, source) => sum + source.total, 0))
        setError(allSourcesFailed ? 'All ingest sources unreachable' : null)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed')
        setLoading(false)
      })
  }, [queryKey])

  return { sessions, totalCount, sources, loading, error }
}

/**
 * Hook: Fetch paginated turns for a session from ingest via BFF proxy.
 *
 * Returns turns array, pagination metadata, loading state, error state,
 * and a refetch function for retry. Pagination params (offset, limit)
 * are forwarded to the ingest API via the BFF proxy.
 *
 * No-op when sessionId is null/undefined (returns empty state).
 *
 * @param toolId - Current tool from AgentToolProvider
 * @param sessionId - Session ID to fetch turns for, or null for no-op
 * @param query - Optional pagination params ({ offset, limit })
 * @returns { turns, pagination, loading, error, refetch }
 */
export function useSessionTurns(
  toolId: AgentToolId,
  sessionId: string | null,
  query?: { offset?: number; limit?: number },
) {
  const [turns, setTurns] = useState<TraceTurn[]>([])
  const [pagination, setPagination] = useState<{
    total: number
    limit: number
    offset: number
    hasMore: boolean
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const queryKey = JSON.stringify({ sessionId, ...query })

  useEffect(() => {
    if (!sessionId) {
      setTurns([])
      setPagination(null)
      setLoading(false)
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    const params: Record<string, string> = {}
    if (query?.offset !== undefined) params.offset = String(query.offset)
    if (query?.limit !== undefined) params.limit = String(query.limit)

    fetchToolApi<{
      turns: TraceTurn[]
      pagination: {
        total: number
        limit: number
        offset: number
        hasMore: boolean
      }
    }>(toolId, `/sessions/${sessionId}/turns`, params)
      .then((data) => {
        setTurns(data.turns)
        setPagination(data.pagination)
      })
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : 'Failed to load turns',
        ),
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId, queryKey])

  const refetch = useCallback(() => {
    if (!sessionId) return
    setLoading(true)
    setError(null)
    const params: Record<string, string> = {}
    if (query?.offset !== undefined) params.offset = String(query.offset)
    if (query?.limit !== undefined) params.limit = String(query.limit)

    fetchToolApi<{
      turns: TraceTurn[]
      pagination: {
        total: number
        limit: number
        offset: number
        hasMore: boolean
      }
    }>(toolId, `/sessions/${sessionId}/turns`, params)
      .then((data) => {
        setTurns(data.turns)
        setPagination(data.pagination)
      })
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : 'Failed to load turns',
        ),
      )
      .finally(() => setLoading(false))
  }, [toolId, sessionId, query?.offset, query?.limit])

  return { turns, pagination, loading, error, refetch }
}

// ============================================================================
// SSE Hook: useSSE
// ============================================================================

/**
 * SSE event payload received from the ingest service via BFF proxy.
 */
export interface SSEEvent {
  event: string
  data: Record<string, unknown>
}

/**
 * Hook: Subscribe to Server-Sent Events from the ingest service via BFF proxy.
 *
 * Opens an EventSource connection to `/api/agent-tools/[tool]/events` and
 * auto-reconnects with exponential backoff on disconnect.
 *
 * When `sessionId` is provided, subscribes to per-session events instead
 * of the global event stream.
 *
 * @param toolId - Current tool from AgentToolProvider
 * @param sessionId - Optional session ID for per-session event subscription
 * @param onEvent - Optional callback invoked on each SSE event received
 * @returns { connected: boolean } — whether the SSE connection is currently open
 */
export function useSSE(
  toolId: AgentToolId,
  sessionId?: string,
  onEvent?: (event: SSEEvent) => void,
) {
  const [connected, setConnected] = useState(false)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let es: EventSource | null = null
    let retries = 0
    const maxRetries = 10

    function connect() {
      if (!mountedRef.current) return

      const url = sessionId
        ? `/api/agent-tools/${toolId}/events?sessionId=${encodeURIComponent(sessionId)}`
        : `/api/agent-tools/${toolId}/events`

      es = new EventSource(url)

      es.onopen = () => {
        if (!mountedRef.current) return
        setConnected(true)
        retries = 0
      }

      es.onmessage = (msg) => {
        try {
          const event: SSEEvent = {
            event: msg.type || 'message',
            data: JSON.parse(msg.data),
          }
          onEvent?.(event)
        } catch {
          // Ignore parse errors on malformed SSE data
        }
      }

      // Handle named events via addEventListener for structured event types
      const eventTypes = [
        'session_created',
        'session_updated',
        'session_removed',
        'sync_complete',
        'turn_added',
      ]
      for (const eventType of eventTypes) {
        es.addEventListener(eventType, ((msg: MessageEvent) => {
          try {
            onEvent?.({ event: eventType, data: JSON.parse(msg.data) })
          } catch {
            // Ignore parse errors
          }
        }) as EventListener)
      }

      es.onerror = () => {
        if (!mountedRef.current) return
        setConnected(false)
        es?.close()
        es = null
        if (retries < maxRetries) {
          retries++
          // Exponential backoff: 3s, 6s, 9s, 12s, 15s max
          const backoff = 3000 * Math.min(retries, 5)
          reconnectTimerRef.current = setTimeout(connect, backoff)
        }
      }
    }

    connect()

    return () => {
      mountedRef.current = false
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      es?.close()
    }
  }, [toolId, sessionId])

  return { connected }
}

// ============================================================================
// Ingest Status Hook: useIngestStatus
// ============================================================================

/**
 * Ingest service connection status.
 */
export type IngestStatus = 'connected' | 'disconnected' | 'reconnecting' | 'loading'

/**
 * Hook: Monitor ingest service connection status via BFF health endpoint.
 *
 * Polls the BFF health endpoint periodically to determine if the ingest
 * service is reachable. Shows reconnecting state on first failure, then
 * disconnected on subsequent failures. Re-checks every 30s when connected,
 * or with exponential backoff when disconnected.
 *
 * @param toolId - Current tool from AgentToolProvider
 * @returns IngestStatus — the current ingest connection state
 */
export function useIngestStatus(toolId: AgentToolId): IngestStatus {
  const [status, setStatus] = useState<IngestStatus>('loading')

  useEffect(() => {
    let attempts = 0
    let timer: ReturnType<typeof setTimeout>
    let mounted = true

    function check() {
      if (!mounted) return

      fetchToolApi<{ status: string; version?: string }>(toolId, '/health')
        .then((data) => {
          if (!mounted) return
          if (data.status === 'ok') {
            setStatus('connected')
          } else {
            setStatus('disconnected')
          }
          attempts = 0
          // Re-check every 30s when healthy
          timer = setTimeout(check, 30000)
        })
        .catch(() => {
          if (!mounted) return
          attempts++
          if (attempts <= 1) {
            setStatus('reconnecting')
          } else {
            setStatus('disconnected')
          }
          // Exponential backoff when unhealthy: 3s, 6s, 9s, max 15s
          timer = setTimeout(check, 3000 * Math.min(attempts, 5))
        })
    }

    check()

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [toolId])

  return status
}
