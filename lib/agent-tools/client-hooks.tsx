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
