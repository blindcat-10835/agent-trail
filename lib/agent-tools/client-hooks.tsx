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
import type { TraceTurn, AgentInfo } from '@/types/trace'
import type {
  OverviewAggregates,
  DailyTokensResponse,
  TopModelsResponse,
  TopProjectsResponse,
  StarredResponse,
  TimelineResponse,
  CapabilitiesResponse,
  AutomationsResponse,
  AutomationSummary,
  TimeWindow,
} from '@/types/overview'

export const SESSION_REFRESH_EVENT = 'agent-tracing-dashboard:sessions-refresh'

export function notifySessionsRefresh(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(SESSION_REFRESH_EVENT))
}

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

// ============================================================================
// Sync Helper
// ============================================================================

/**
 * Options for syncToolSessions.
 */
export interface SyncToolOptions {
  /** Force re-parse even when file hash is unchanged. */
  force?: boolean
}

/**
 * Per-source sync helper.
 *
 * Calls the BFF sync route for the specified tool source. Returns the raw
 * ingest sync result so callers can decide how to surface error details.
 *
 * Usage pattern (sync-first refresh):
 * ```ts
 * const syncResult = await syncToolSessions(toolId, { force: false })
 * // then trigger refetch / notifySessionsRefresh()
 * ```
 *
 * Per D-10: Only calls BFF proxy routes — never calls ingest directly.
 *
 * @param toolId - Source tool to sync (not 'all' — use /api/sync for aggregate)
 * @param options - Optional force flag to bypass file-hash caching
 * @returns Raw sync result from the BFF, or throws on network/validation error
 */
export async function syncToolSessions(
  toolId: string,
  options?: SyncToolOptions,
): Promise<{ type?: string; syncResult?: unknown; status?: string; error?: string }> {
  const query = options?.force ? '?force=true' : ''
  const res = await fetch(`/api/agent-tools/${toolId}/sync${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(
      typeof body.error === 'string' ? body.error : `Sync failed: ${res.status}`,
    )
  }
  return res.json() as Promise<{ type?: string; syncResult?: unknown; status?: string; error?: string }>
}

/**
 * Aggregate sync helper.
 *
 * Calls the BFF aggregate sync route (POST /api/sync) to trigger ingest sync
 * for all source types. Returns the per-source results array.
 *
 * Per D-10: Only calls BFF proxy routes — never calls ingest directly.
 *
 * @param options - Optional force flag to bypass file-hash caching
 * @returns Aggregate sync result per source, or throws on network error
 */
export async function syncAllSessions(
  options?: SyncToolOptions,
): Promise<{ results: unknown[]; force?: boolean }> {
  const query = options?.force ? '?force=true' : ''
  const res = await fetch(`/api/sync${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(
      typeof body.error === 'string' ? body.error : `Aggregate sync failed: ${res.status}`,
    )
  }
  return res.json() as Promise<{ results: unknown[]; force?: boolean }>
}

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
  const text = await res.text()
  let body: unknown = {}

  if (text.trim() !== '') {
    try {
      body = JSON.parse(text)
    } catch {
      throw new Error(`Invalid JSON from ${path}`)
    }
  } else if (res.ok) {
    throw new Error(`Empty response from ${path}`)
  }

  if (!res.ok) {
    const error =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
        ? body.error
        : `Request failed: ${res.status}`
    throw new Error(error)
  }
  return body as T
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
  options?: { enabled?: boolean },
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
  const [groupCounts, setGroupCounts] = useState<{
    agent?: Array<{ label: string; count: number }>
    project?: Array<{ label: string; count: number }>
  } | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [currentOffset, setCurrentOffset] = useState(0)
  const queryKey = JSON.stringify(query ?? {})
  const enabled = options?.enabled ?? true

  const fetchSessions = useCallback(async () => {
    if (!enabled) {
      setSessions([])
      setPagination(null)
      setGroupCounts(null)
      setLoading(false)
      setError(null)
      setCurrentOffset(0)
      return
    }
    setIsLoadingMore(false)
    try {
      const parsedQuery = JSON.parse(queryKey) as Record<string, string>
      const data = await fetchToolApi<{
        sessions: TraceSession[]
        pagination: { total: number; limit: number; offset: number; hasMore: boolean }
        groupCounts?: {
          agent?: Array<{ label: string; count: number }>
          project?: Array<{ label: string; count: number }>
        }
      }>(toolId, '/sessions', { limit: '100', ...parsedQuery, groupBy: 'agent,project' })
      setSessions(data.sessions)
      setPagination(data.pagination)
      if (data.groupCounts) setGroupCounts(data.groupCounts)
      setCurrentOffset(data.pagination.offset + data.pagination.limit)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [toolId, queryKey, enabled])

  const loadMore = useCallback(async () => {
    if (!enabled || isLoadingMore) return
    const parsedQuery = JSON.parse(queryKey) as Record<string, string>
    const nextOffset = currentOffset
    setIsLoadingMore(true)
    try {
      const data = await fetchToolApi<{
        sessions: TraceSession[]
        pagination: { total: number; limit: number; offset: number; hasMore: boolean }
        groupCounts?: {
          agent?: Array<{ label: string; count: number }>
          project?: Array<{ label: string; count: number }>
        }
      }>(toolId, '/sessions', { ...parsedQuery, offset: String(nextOffset), limit: String(pagination?.limit ?? 100), groupBy: 'agent,project' })
      setSessions(prev => [...prev, ...data.sessions])
      setPagination(data.pagination)
      if (data.groupCounts) setGroupCounts(data.groupCounts)
      setCurrentOffset(nextOffset + data.pagination.limit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more sessions')
    } finally {
      setIsLoadingMore(false)
    }
  }, [toolId, queryKey, currentOffset, isLoadingMore, pagination, enabled])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- effect intentionally starts an async BFF fetch
    fetchSessions()
  }, [fetchSessions])

  useEffect(() => {
    function handleRefresh() {
      setLoading(true)
      setError(null)
      void fetchSessions()
    }

    window.addEventListener(SESSION_REFRESH_EVENT, handleRefresh)
    return () => window.removeEventListener(SESSION_REFRESH_EVENT, handleRefresh)
  }, [fetchSessions])

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    void fetchSessions()
  }, [fetchSessions])

  return { sessions, pagination, groupCounts, loading, error, isLoadingMore, loadMore, refetch }
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
 * Hook: Fetch agents for a tool from ingest via BFF proxy.
 *
 * Returns aggregated agent statistics (session count, last active, status,
 * tool call count) grouped by agent_name.
 *
 * @param toolId - Current tool from AgentToolProvider
 * @returns { agents, loading, error }
 */
export function useToolAgents(toolId: AgentToolId) {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchToolApi<{ agents: AgentInfo[] }>(toolId, '/agents')
      .then((data) => {
        setAgents(data.agents)
        setError(null)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load agents'),
      )
      .finally(() => setLoading(false))
  }, [toolId])

  return { agents, loading, error }
}

/**
 * Hook: Fetch and merge sessions from ALL tools.
 *
 * Used by the aggregate landing page (/) to show a cross-source session
 * list. Fetches sessions from all 3 tools in parallel via the BFF proxy,
 * merges them into a single array, and sorts by freshest known timestamp.
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

type SourcePagination = { total: number; limit: number; offset: number; hasMore: boolean }

interface AggregateToolResult {
  toolId: SourceToolId
  sessions: TraceSession[]
  _groupCounts: {
    agent?: Array<{ label: string; count: number }>
    project?: Array<{ label: string; count: number }>
  } | undefined
  pagination: SourcePagination | null
  status: AggregateSourceStatus
}

export function useAggregateSessions(
  query?: Record<string, string>,
  options?: { enabled?: boolean },
) {
  const [sessions, setSessions] = useState<TraceSession[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [sources, setSources] = useState<AggregateSourceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groupCounts, setGroupCounts] = useState<{
    agent: Array<{ label: string; count: number }>
    project: Array<{ label: string; count: number }>
  } | null>(null)
  const [paginationBySource, setPaginationBySource] = useState<
    Partial<Record<SourceToolId, SourcePagination>>
  >({})
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const queryKey = JSON.stringify(query ?? {})
  const enabled = options?.enabled ?? true

  const fetchAggregateSessions = useCallback(() => {
    if (!enabled) {
      setSessions([])
      setTotalCount(0)
      setSources([])
      setLoading(false)
      setError(null)
      setGroupCounts(null)
      setPaginationBySource({})
      setIsLoadingMore(false)
      return
    }
    setLoading(true)
    setError(null)
    setIsLoadingMore(false)
    const parsedQuery = JSON.parse(queryKey) as Record<string, string>
    Promise.all(
      TOOL_IDS.map((toolId) =>
        fetchToolApi<{
          sessions: TraceSession[]
          pagination: { total: number; limit: number; offset: number; hasMore: boolean }
          groupCounts?: {
            agent?: Array<{ label: string; count: number }>
            project?: Array<{ label: string; count: number }>
          }
        }>(
          toolId,
          '/sessions',
          { limit: '100', ...parsedQuery, groupBy: 'agent,project' },
        )
          .then((d): AggregateToolResult => ({
            toolId,
            sessions: d.sessions,
            _groupCounts: d.groupCounts,
            pagination: d.pagination,
            status: {
              toolId,
              status: 'loaded' as const,
              count: d.sessions.length,
              total: d.pagination.total,
            },
          }))
          .catch((err): AggregateToolResult => ({
            toolId,
            sessions: [],
            _groupCounts: undefined,
            pagination: null,
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
        const merged = results.flatMap((result) => result.sessions).sort(compareSessionsByFreshness)
        const sourceStatuses = results.map((result) => result.status)
        const allSourcesFailed = sourceStatuses.every((source) => source.status === 'error')

        const newPaginationBySource: Partial<Record<SourceToolId, SourcePagination>> = {}
        for (const result of results) {
          if (result.pagination) {
            newPaginationBySource[result.toolId] = result.pagination
          }
        }

        setSessions(merged)
        setSources(sourceStatuses)
        setTotalCount(sourceStatuses.reduce((sum, source) => sum + source.total, 0))
        setError(allSourcesFailed ? 'All ingest sources unreachable' : null)
        setPaginationBySource(newPaginationBySource)

        const mergedAgent = new Map<string, number>()
        const mergedProject = new Map<string, number>()

        for (const result of results) {
          const gc = result._groupCounts
          if (gc?.agent) {
            for (const item of gc.agent) {
              mergedAgent.set(item.label, (mergedAgent.get(item.label) || 0) + item.count)
            }
          }
          if (gc?.project) {
            for (const item of gc.project) {
              mergedProject.set(item.label, (mergedProject.get(item.label) || 0) + item.count)
            }
          }
        }

        setGroupCounts(
          mergedAgent.size > 0 || mergedProject.size > 0
            ? {
                agent: Array.from(mergedAgent.entries())
                  .map(([label, count]) => ({ label, count }))
                  .sort((a, b) => b.count - a.count),
                project: Array.from(mergedProject.entries())
                  .map(([label, count]) => ({ label, count }))
                  .sort((a, b) => b.count - a.count),
              }
            : null,
        )
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed')
        setLoading(false)
      })
  }, [queryKey, enabled])

  const hasMore = Object.values(paginationBySource).some((p) => p?.hasMore === true)

  const loadMore = useCallback(async () => {
    if (!enabled || isLoadingMore) return
    const sourcesToFetch = (Object.entries(paginationBySource) as [SourceToolId, SourcePagination][])
      .filter(([, p]) => p.hasMore)

    if (sourcesToFetch.length === 0) return

    setIsLoadingMore(true)
    const parsedQuery = JSON.parse(queryKey) as Record<string, string>

    try {
      const results = await Promise.all(
        sourcesToFetch.map(([toolId, p]) =>
          fetchToolApi<{
            sessions: TraceSession[]
            pagination: { total: number; limit: number; offset: number; hasMore: boolean }
            groupCounts?: {
              agent?: Array<{ label: string; count: number }>
              project?: Array<{ label: string; count: number }>
            }
          }>(
            toolId,
            '/sessions',
            {
              ...parsedQuery,
              limit: String(p.limit),
              offset: String(p.offset + p.limit),
              groupBy: 'agent,project',
            },
          )
            .then((d): AggregateToolResult => ({
              toolId,
              sessions: d.sessions,
              _groupCounts: d.groupCounts,
              pagination: d.pagination,
              status: {
                toolId,
                status: 'loaded' as const,
                count: d.sessions.length,
                total: d.pagination.total,
              },
            }))
            .catch((): AggregateToolResult => ({
              toolId,
              sessions: [],
              _groupCounts: undefined,
              pagination: null,
              status: {
                toolId,
                status: 'error' as const,
                count: 0,
                total: 0,
              },
            })),
        ),
      )

      setSessions((prev) => {
        const map = new Map<string, TraceSession>()
        for (const s of prev) map.set(s.id, s)
        for (const result of results) {
          for (const s of result.sessions) map.set(s.id, s)
        }
        return Array.from(map.values()).sort(compareSessionsByFreshness)
      })

      setPaginationBySource((prev) => {
        const next = { ...prev }
        for (const result of results) {
          if (result.pagination) {
            next[result.toolId] = result.pagination
          }
        }
        return next
      })

      setSources((prev) => {
        const map = new Map(prev.map((s) => [s.toolId, s]))
        for (const result of results) {
          if (result.status.status === 'loaded') {
            map.set(result.toolId, result.status)
          }
        }
        return Array.from(map.values())
      })

      setTotalCount((prev) => {
        const base = prev
        let delta = 0
        for (const result of results) {
          if (result.pagination && result.status.status === 'loaded') {
            const oldP = paginationBySource[result.toolId]
            if (oldP) delta += result.pagination.total - oldP.total
          }
        }
        return base + delta
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more sessions')
    } finally {
      setIsLoadingMore(false)
    }
  }, [queryKey, isLoadingMore, paginationBySource, enabled])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- query/source changes should show aggregate loading immediately
    fetchAggregateSessions()
  }, [fetchAggregateSessions])

  useEffect(() => {
    function handleRefresh() {
      fetchAggregateSessions()
    }

    window.addEventListener(SESSION_REFRESH_EVENT, handleRefresh)
    return () => window.removeEventListener(SESSION_REFRESH_EVENT, handleRefresh)
  }, [fetchAggregateSessions])

  const refetch = useCallback(() => {
    fetchAggregateSessions()
  }, [fetchAggregateSessions])

  return {
    sessions,
    totalCount,
    groupCounts,
    sources,
    loading,
    error,
    paginationBySource,
    hasMore,
    isLoadingMore,
    loadMore,
    refetch,
  }
}

function compareSessionsByFreshness(a: TraceSession, b: TraceSession): number {
  return getSessionFreshnessMs(b) - getSessionFreshnessMs(a)
}

function getSessionFreshnessMs(session: TraceSession): number {
  const dynamicSession = session as TraceSession & {
    updatedAt?: string | null
  }
  return Math.max(
    toTime(dynamicSession.updatedAt),
    toTime(session.endedAt),
    toTime(session.startedAt),
  )
}

function toTime(value: string | null | undefined): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
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
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const queryKey = JSON.stringify({ sessionId, ...query })
  const buildParams = useCallback(() => {
    const parsedQuery = JSON.parse(queryKey) as { offset?: number; limit?: number }
    const params: Record<string, string> = {}
    if (parsedQuery.offset !== undefined) params.offset = String(parsedQuery.offset)
    if (parsedQuery.limit !== undefined) params.limit = String(parsedQuery.limit)
    return params
  }, [queryKey])

  /* eslint-disable react-hooks/set-state-in-effect -- session/query changes should synchronously reset async hook state */
  useEffect(() => {
    if (!sessionId) {
      setTurns([])
      setPagination(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setIsLoadingMore(false)
    setError(null)

    fetchToolApi<{
      turns: TraceTurn[]
      pagination: {
        total: number
        limit: number
        offset: number
        hasMore: boolean
      }
    }>(toolId, `/sessions/${sessionId}/turns`, buildParams())
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
  }, [toolId, sessionId, buildParams])
  /* eslint-enable react-hooks/set-state-in-effect */

  const refetch = useCallback(() => {
    if (!sessionId) return
    setLoading(true)
    setIsLoadingMore(false)
    setError(null)

    fetchToolApi<{
      turns: TraceTurn[]
      pagination: {
        total: number
        limit: number
        offset: number
        hasMore: boolean
      }
    }>(toolId, `/sessions/${sessionId}/turns`, buildParams())
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
  }, [toolId, sessionId, buildParams])

  const loadMore = useCallback(async () => {
    if (!sessionId || isLoadingMore || !pagination?.hasMore) return

    const nextOffset = pagination.offset + pagination.limit
    const parsedQuery = JSON.parse(queryKey) as { limit?: number }
    const nextLimit = pagination.limit || parsedQuery.limit || 100
    setIsLoadingMore(true)
    setError(null)

    try {
      const data = await fetchToolApi<{
        turns: TraceTurn[]
        pagination: {
          total: number
          limit: number
          offset: number
          hasMore: boolean
        }
      }>(toolId, `/sessions/${sessionId}/turns`, {
        offset: String(nextOffset),
        limit: String(nextLimit),
      })

      setTurns((prev) => {
        const seen = new Set(prev.map((turn) => turn.id))
        const appended = data.turns.filter((turn) => !seen.has(turn.id))
        return [...prev, ...appended]
      })
      setPagination(data.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more turns')
    } finally {
      setIsLoadingMore(false)
    }
  }, [toolId, sessionId, isLoadingMore, pagination, queryKey])

  return { turns, pagination, loading, error, isLoadingMore, loadMore, refetch }
}

// ============================================================================
// Overview Data Hooks
// ============================================================================

/**
 * Hook: Fetch overview aggregates for a tool via BFF proxy.
 *
 * Returns session/turn/project counts and token totals filtered by time window.
 * Re-fetches when toolId or window changes.
 *
 * @param toolId - Current tool from AgentToolProvider
 * @param window - Time window for filtering (today, 7d, 30d)
 * @returns { aggregates, loading, error }
 */
export function useOverviewAggregates(toolId: AgentToolId, window: TimeWindow) {
  const [aggregates, setAggregates] = useState<OverviewAggregates | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchToolApi<OverviewAggregates>(toolId, '/overview/aggregates', { window })
      .then((data) => {
        setAggregates(data)
        setError(null)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load aggregates'),
      )
      .finally(() => setLoading(false))
  }, [toolId, window])

  return { aggregates, loading, error }
}

/**
 * Hook: Fetch daily token usage for a tool via BFF proxy.
 *
 * Returns zero-filled day buckets for the requested recent day count.
 * Re-fetches when toolId or days changes.
 *
 * @param toolId - Current tool from AgentToolProvider
 * @param days - Number of recent days to load
 * @returns { dailyTokens, loading, error }
 */
export function useDailyTokens(toolId: AgentToolId, days: number = 30) {
  const requestKey = `${toolId}:${days}`
  const [state, setState] = useState<{
    requestKey: string
    dailyTokens: DailyTokensResponse['days']
    loading: boolean
    error: string | null
  }>({
    requestKey,
    dailyTokens: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    fetchToolApi<DailyTokensResponse>(toolId, '/overview/daily-tokens', { days: String(days) })
      .then((data) => {
        if (cancelled) return
        setState({
          requestKey,
          dailyTokens: data.days,
          loading: false,
          error: null,
        })
      })
      .catch((err) => {
        if (cancelled) return
        setState((prev) => ({
          requestKey,
          dailyTokens: prev.requestKey === requestKey ? prev.dailyTokens : [],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load daily tokens',
        }))
      })

    return () => {
      cancelled = true
    }
  }, [toolId, days, requestKey])

  const stale = state.requestKey !== requestKey

  return {
    dailyTokens: stale ? [] : state.dailyTokens,
    loading: stale || state.loading,
    error: stale ? null : state.error,
  }
}

/**
 * Hook: Fetch top models ranking for a tool via BFF proxy.
 *
 * Returns models sorted by token usage with share percentages.
 * Re-fetches when toolId or window changes.
 *
 * @param toolId - Current tool from AgentToolProvider
 * @param window - Time window for filtering
 * @returns { models, loading, error }
 */
export function useTopModels(toolId: AgentToolId, window: TimeWindow, sortBy: string = 'tokens') {
  const [models, setModels] = useState<TopModelsResponse['models']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchToolApi<TopModelsResponse>(toolId, '/overview/top-models', { window, limit: '10', sortBy })
      .then((data) => {
        setModels(data.models)
        setError(null)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load models'),
      )
      .finally(() => setLoading(false))
  }, [toolId, window, sortBy])

  return { models, loading, error }
}

/**
 * Hook: Fetch top projects ranking for a tool via BFF proxy.
 *
 * Returns projects sorted by token usage with rank weights.
 * Re-fetches when toolId or window changes.
 *
 * @param toolId - Current tool from AgentToolProvider
 * @param window - Time window for filtering
 * @returns { projects, loading, error }
 */
export function useTopProjects(toolId: AgentToolId, window: TimeWindow, sortBy: string = 'tokens') {
  const [projects, setProjects] = useState<TopProjectsResponse['projects']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchToolApi<TopProjectsResponse>(toolId, '/overview/top-projects', { window, limit: '10', sortBy })
      .then((data) => {
        setProjects(data.projects)
        setError(null)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load projects'),
      )
      .finally(() => setLoading(false))
  }, [toolId, window, sortBy])

  return { projects, loading, error }
}

/**
 * Hook: Fetch starred sessions for a tool via BFF proxy.
 *
 * Returns recently starred sessions ordered by star time.
 *
 * @param toolId - Current tool from AgentToolProvider
 * @returns { starred, loading, error }
 */
export function useStarredSessions(toolId: AgentToolId) {
  const [starred, setStarred] = useState<StarredResponse['starred']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchToolApi<StarredResponse>(toolId, '/overview/starred', { limit: '20' })
      .then((data) => {
        setStarred(data.starred)
        setError(null)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load starred sessions'),
      )
      .finally(() => setLoading(false))
  }, [toolId])

  return { starred, loading, error }
}

/**
 * Hook: Fetch activity timeline for a tool via BFF proxy.
 *
 * Returns mixed timeline events (session started/completed/error, sync errors).
 *
 * @param toolId - Current tool from AgentToolProvider
 * @returns { timeline, loading, error }
 */
export function useTimeline(toolId: AgentToolId) {
  const [timeline, setTimeline] = useState<TimelineResponse['timeline']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchToolApi<TimelineResponse>(toolId, '/overview/timeline', { limit: '50' })
      .then((data) => {
        setTimeline(data.timeline)
        setError(null)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load timeline'),
      )
      .finally(() => setLoading(false))
  }, [toolId])

  return { timeline, loading, error }
}

/**
 * Hook: Fetch source capabilities metadata via BFF proxy.
 *
 * Returns per-source capability flags and available source list.
 *
 * @param toolId - Current tool from AgentToolProvider
 * @returns { capabilities, loading, error }
 */
export function useOverviewCapabilities(toolId: AgentToolId) {
  const [capabilities, setCapabilities] = useState<CapabilitiesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchToolApi<CapabilitiesResponse>(toolId, '/overview/capabilities')
      .then((data) => {
        setCapabilities(data)
        setError(null)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load capabilities'),
      )
      .finally(() => setLoading(false))
  }, [toolId])

  return { capabilities, loading, error }
}

/**
 * Hook: Fetch automation summaries for a tool via BFF proxy.
 *
 * Returns automation sessions (agent-named sessions with no user input)
 * grouped by agent_name with session count, last active, and status.
 *
 * @param toolId - Current tool from AgentToolProvider
 * @returns { automations, loading, error }
 */
export function useOverviewAutomations(toolId: AgentToolId) {
  const [automations, setAutomations] = useState<AutomationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchToolApi<AutomationsResponse>(toolId, '/overview/automations')
      .then((data) => {
        setAutomations(data.automations)
        setError(null)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load automations'),
      )
      .finally(() => setLoading(false))
  }, [toolId])

  return { automations, loading, error }
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
