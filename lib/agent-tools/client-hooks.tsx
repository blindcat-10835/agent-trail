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

export const DEFAULT_SESSIONS_RAIL_QUERY: Record<string, string> = {
  limit: '100',
  sort: 'updated_at',
  order: 'desc',
}

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
  let body: unknown = {}
  let parsedFromJson = false

  if (typeof res.text === 'function') {
    const text = await res.text()
    if (text.trim() !== '') {
      try {
        body = JSON.parse(text)
      } catch {
        throw new Error(`Invalid JSON from ${path}`)
      }
    } else if (res.ok) {
      throw new Error(`Empty response from ${path}`)
    }
  } else {
    try {
      body = await res.json()
      parsedFromJson = true
    } catch {
      throw new Error(`Invalid JSON from ${path}`)
    }
  }

  if (!parsedFromJson && typeof res.text !== 'function' && res.ok) {
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

const toolApiCache = new Map<string, unknown>()
const toolApiInflight = new Map<string, Promise<unknown>>()

function buildToolApiCacheKey(
  toolId: string,
  path: string,
  query?: Record<string, string>,
): string {
  const params = new URLSearchParams()
  for (const key of Object.keys(query ?? {}).sort()) {
    const value = query?.[key]
    if (value !== undefined) params.set(key, value)
  }
  const queryKey = params.toString()
  return queryKey ? `${toolId}${path}?${queryKey}` : `${toolId}${path}`
}

function getCachedToolApi<T>(cacheKey: string): T | undefined {
  return toolApiCache.has(cacheKey)
    ? toolApiCache.get(cacheKey) as T
    : undefined
}

function fetchCachedToolApi<T>(
  cacheKey: string,
  toolId: string,
  path: string,
  query?: Record<string, string>,
): Promise<T> {
  const pending = toolApiInflight.get(cacheKey)
  if (pending) return pending as Promise<T>

  const request = fetchToolApi<T>(toolId, path, query)
    .then((data) => {
      toolApiCache.set(cacheKey, data)
      return data
    })
    .finally(() => {
      toolApiInflight.delete(cacheKey)
    })

  toolApiInflight.set(cacheKey, request)
  return request
}

function prefetchToolApi<T>(
  toolId: string,
  path: string,
  query?: Record<string, string>,
): Promise<T | undefined> {
  const cacheKey = buildToolApiCacheKey(toolId, path, query)
  const cached = getCachedToolApi<T>(cacheKey)
  if (cached !== undefined) return Promise.resolve(cached)

  return fetchCachedToolApi<T>(cacheKey, toolId, path, query)
    .catch(() => undefined)
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

function useCachedToolApi<T>(
  toolId: string,
  path: string,
  query: Record<string, string> | undefined,
  emptyData: T,
  fallbackError: string,
) {
  const cacheKey = buildToolApiCacheKey(toolId, path, query)
  const [state, setState] = useState<{
    cacheKey: string
    data: T
    loading: boolean
    error: string | null
  }>(() => {
    const cached = getCachedToolApi<T>(cacheKey)
    return {
      cacheKey,
      data: cached ?? emptyData,
      loading: cached === undefined,
      error: null,
    }
  })

  useEffect(() => {
    let cancelled = false
    const cached = getCachedToolApi<T>(cacheKey)

    // eslint-disable-next-line react-hooks/set-state-in-effect -- query changes need to synchronously expose cached or empty state before async revalidation completes
    setState((prev) => ({
      cacheKey,
      data: cached ?? (prev.cacheKey === cacheKey ? prev.data : emptyData),
      loading: cached === undefined,
      error: null,
    }))

    fetchCachedToolApi<T>(cacheKey, toolId, path, query)
      .then((data) => {
        if (cancelled) return
        setState({
          cacheKey,
          data,
          loading: false,
          error: null,
        })
      })
      .catch((err) => {
        if (cancelled) return
        setState((prev) => ({
          cacheKey,
          data: prev.cacheKey === cacheKey ? prev.data : emptyData,
          loading: false,
          error: cached === undefined ? errorMessage(err, fallbackError) : null,
        }))
      })

    return () => {
      cancelled = true
    }
    // cacheKey fully represents path + query; avoiding query identity prevents
    // repeated background requests when callers pass equivalent object literals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, toolId, path, emptyData, fallbackError])

  return state.cacheKey === cacheKey
    ? state
    : { cacheKey, data: emptyData, loading: true, error: null }
}

const EMPTY_AGENTS: AgentInfo[] = []
const EMPTY_DAILY_TOKENS: DailyTokensResponse['days'] = []
const EMPTY_MODELS: TopModelsResponse['models'] = []
const EMPTY_PROJECTS: TopProjectsResponse['projects'] = []
const EMPTY_STARRED: StarredResponse['starred'] = []
const EMPTY_TIMELINE: TimelineResponse['timeline'] = []
const EMPTY_AUTOMATIONS: AutomationSummary[] = []
const EMPTY_AGENTS_RESPONSE: { agents: AgentInfo[] } = { agents: EMPTY_AGENTS }
const EMPTY_DAILY_TOKENS_RESPONSE: DailyTokensResponse = { days: EMPTY_DAILY_TOKENS }
const EMPTY_MODELS_RESPONSE: TopModelsResponse = { models: EMPTY_MODELS }
const EMPTY_PROJECTS_RESPONSE: TopProjectsResponse = { projects: EMPTY_PROJECTS }
const EMPTY_STARRED_RESPONSE: StarredResponse = { starred: EMPTY_STARRED }
const EMPTY_TIMELINE_RESPONSE: TimelineResponse = { timeline: EMPTY_TIMELINE }
const EMPTY_AUTOMATIONS_RESPONSE: AutomationsResponse = { automations: EMPTY_AUTOMATIONS }

type SessionsGroupCounts = {
  agent?: Array<{ label: string; count: number }>
  project?: Array<{ label: string; count: number }>
}

type SessionsResponse = {
  sessions: TraceSession[]
  pagination: SourcePagination
  groupCounts?: SessionsGroupCounts
}

type FetchMode = 'cache-first' | 'network'

function buildSessionsQuery(query?: Record<string, string>): Record<string, string> {
  return { limit: '100', ...query, groupBy: 'agent,project' }
}

function getCachedSessionsResponse(
  toolId: string,
  query?: Record<string, string>,
): SessionsResponse | undefined {
  return getCachedToolApi<SessionsResponse>(
    buildToolApiCacheKey(toolId, '/sessions', buildSessionsQuery(query)),
  )
}

function fetchSessionsResponse(
  toolId: string,
  query?: Record<string, string>,
): Promise<SessionsResponse> {
  const requestQuery = buildSessionsQuery(query)
  return fetchCachedToolApi<SessionsResponse>(
    buildToolApiCacheKey(toolId, '/sessions', requestQuery),
    toolId,
    '/sessions',
    requestQuery,
  )
}

function prefetchToolSessions(
  toolId: SourceToolId,
  query?: Record<string, string>,
): Promise<SessionsResponse | undefined> {
  return prefetchToolApi<SessionsResponse>(toolId, '/sessions', buildSessionsQuery(query))
}

export function prefetchSessionsRailData(
  toolId: AgentToolId,
  query: Record<string, string> = DEFAULT_SESSIONS_RAIL_QUERY,
): Promise<unknown[]> {
  if (toolId === 'all') {
    return Promise.all(TOOL_IDS.map((sourceToolId) => prefetchToolSessions(sourceToolId, query)))
  }

  return Promise.all([prefetchToolSessions(toolId, query)])
}

export function clearToolApiCacheForTests(): void {
  toolApiCache.clear()
  toolApiInflight.clear()
}

function dailyTokensQuery(window: TimeWindow): Record<string, string> {
  return window === 'all'
    ? { window: 'all' }
    : { days: String(window === 'today' ? 1 : window === '7d' ? 7 : 30) }
}

export function prefetchOverviewData(
  toolId: AgentToolId,
  window: TimeWindow = '30d',
  options?: { modelSortBy?: string; projectSortBy?: string },
): Promise<unknown[]> {
  const modelSortBy = options?.modelSortBy ?? 'tokens'
  const projectSortBy = options?.projectSortBy ?? 'tokens'

  return Promise.all([
    prefetchToolApi<OverviewAggregates>(toolId, '/overview/aggregates', { window }),
    prefetchToolApi<DailyTokensResponse>(toolId, '/overview/daily-tokens', dailyTokensQuery(window)),
    prefetchToolApi<TopModelsResponse>(toolId, '/overview/top-models', { window, limit: '10', sortBy: modelSortBy }),
    prefetchToolApi<TopProjectsResponse>(toolId, '/overview/top-projects', { window, limit: '10', sortBy: projectSortBy }),
    prefetchToolApi<StarredResponse>(toolId, '/overview/starred', { limit: '20' }),
    prefetchToolApi<TimelineResponse>(toolId, '/overview/timeline', { limit: '50' }),
    prefetchToolApi<CapabilitiesResponse>(toolId, '/overview/capabilities'),
    prefetchToolApi<AutomationsResponse>(toolId, '/overview/automations'),
    toolId === 'all'
      ? Promise.resolve(undefined)
      : prefetchToolApi<{ agents: AgentInfo[] }>(toolId, '/agents'),
  ])
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
  const queryKey = JSON.stringify(query ?? {})
  const enabled = options?.enabled ?? true
  const initialCached = enabled ? getCachedSessionsResponse(toolId, query) : undefined
  const [sessions, setSessions] = useState<TraceSession[]>(() => initialCached?.sessions ?? [])
  const [pagination, setPagination] = useState<SourcePagination | null>(() => initialCached?.pagination ?? null)
  const [loading, setLoading] = useState(() => enabled && initialCached === undefined)
  const [error, setError] = useState<string | null>(null)
  const [groupCounts, setGroupCounts] = useState<SessionsGroupCounts | null>(() => initialCached?.groupCounts ?? null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [currentOffset, setCurrentOffset] = useState(() =>
    initialCached ? initialCached.pagination.offset + initialCached.pagination.limit : 0,
  )

  const applySessionsResponse = useCallback((data: SessionsResponse) => {
    setSessions(data.sessions)
    setPagination(data.pagination)
    setGroupCounts(data.groupCounts ?? null)
    setCurrentOffset(data.pagination.offset + data.pagination.limit)
    setError(null)
  }, [])

  const fetchSessions = useCallback(async (mode: FetchMode = 'network') => {
    const parsedQuery = JSON.parse(queryKey) as Record<string, string>

    if (!enabled) {
      setSessions([])
      setPagination(null)
      setGroupCounts(null)
      setLoading(false)
      setError(null)
      setCurrentOffset(0)
      return
    }

    if (mode === 'cache-first') {
      const cached = getCachedSessionsResponse(toolId, parsedQuery)
      if (cached) {
        applySessionsResponse(cached)
        setLoading(false)
        setIsLoadingMore(false)
        return
      }
    }

    setLoading(true)
    setIsLoadingMore(false)
    try {
      const data = await fetchSessionsResponse(toolId, parsedQuery)
      applySessionsResponse(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [toolId, queryKey, enabled, applySessionsResponse])

  const loadMore = useCallback(async () => {
    if (!enabled || isLoadingMore) return
    const parsedQuery = JSON.parse(queryKey) as Record<string, string>
    const nextOffset = currentOffset
    setIsLoadingMore(true)
    try {
      const data = await fetchSessionsResponse(toolId, {
        ...parsedQuery,
        offset: String(nextOffset),
        limit: String(pagination?.limit ?? 100),
      })
      setSessions(prev => [...prev, ...data.sessions])
      setPagination(data.pagination)
      setGroupCounts(data.groupCounts ?? null)
      setCurrentOffset(nextOffset + data.pagination.limit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more sessions')
    } finally {
      setIsLoadingMore(false)
    }
  }, [toolId, queryKey, currentOffset, isLoadingMore, pagination, enabled])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- effect intentionally starts an async BFF fetch
    fetchSessions('cache-first')
  }, [fetchSessions])

  useEffect(() => {
    function handleRefresh() {
      setLoading(true)
      setError(null)
      void fetchSessions('network')
    }

    window.addEventListener(SESSION_REFRESH_EVENT, handleRefresh)
    return () => window.removeEventListener(SESSION_REFRESH_EVENT, handleRefresh)
  }, [fetchSessions])

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    void fetchSessions('network')
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
  const { data, loading, error } = useCachedToolApi<{ agents: AgentInfo[] }>(
    toolId,
    '/agents',
    undefined,
    EMPTY_AGENTS_RESPONSE,
    'Failed to load agents',
  )

  return { agents: data.agents, loading, error }
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
  _groupCounts: SessionsGroupCounts | undefined
  pagination: SourcePagination | null
  status: AggregateSourceStatus
}

function loadedAggregateResult(toolId: SourceToolId, data: SessionsResponse): AggregateToolResult {
  return {
    toolId,
    sessions: data.sessions,
    _groupCounts: data.groupCounts,
    pagination: data.pagination,
    status: {
      toolId,
      status: 'loaded',
      count: data.sessions.length,
      total: data.pagination.total,
    },
  }
}

function failedAggregateResult(toolId: SourceToolId, err?: unknown): AggregateToolResult {
  return {
    toolId,
    sessions: [],
    _groupCounts: undefined,
    pagination: null,
    status: {
      toolId,
      status: 'error',
      count: 0,
      total: 0,
      error: err instanceof Error ? err.message : 'Failed to load source',
    },
  }
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

  const applyAggregateResults = useCallback((results: AggregateToolResult[]) => {
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
  }, [])

  const fetchAggregateSessions = useCallback((mode: FetchMode = 'network') => {
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

    const parsedQuery = JSON.parse(queryKey) as Record<string, string>

    if (mode === 'cache-first') {
      const cachedResults: AggregateToolResult[] = []
      for (const toolId of TOOL_IDS) {
        const cached = getCachedSessionsResponse(toolId, parsedQuery)
        if (!cached) break
        cachedResults.push(loadedAggregateResult(toolId, cached))
      }

      if (cachedResults.length === TOOL_IDS.length) {
        setIsLoadingMore(false)
        applyAggregateResults(cachedResults)
        return
      }
    }

    setLoading(true)
    setError(null)
    setIsLoadingMore(false)
    Promise.all(
      TOOL_IDS.map((toolId) =>
        fetchSessionsResponse(toolId, parsedQuery)
          .then((data) => loadedAggregateResult(toolId, data))
          .catch((err) => failedAggregateResult(toolId, err)),
      ),
    )
      .then(applyAggregateResults)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed')
        setLoading(false)
      })
  }, [queryKey, enabled, applyAggregateResults])

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
          fetchSessionsResponse(toolId, {
            ...parsedQuery,
            limit: String(p.limit),
            offset: String(p.offset + p.limit),
          })
            .then((data) => loadedAggregateResult(toolId, data))
            .catch((err) => failedAggregateResult(toolId, err)),
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
    fetchAggregateSessions('cache-first')
  }, [fetchAggregateSessions])

  useEffect(() => {
    function handleRefresh() {
      fetchAggregateSessions('network')
    }

    window.addEventListener(SESSION_REFRESH_EVENT, handleRefresh)
    return () => window.removeEventListener(SESSION_REFRESH_EVENT, handleRefresh)
  }, [fetchAggregateSessions])

  const refetch = useCallback(() => {
    fetchAggregateSessions('network')
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
  const { data, loading, error } = useCachedToolApi<OverviewAggregates | null>(
    toolId,
    '/overview/aggregates',
    { window },
    null,
    'Failed to load aggregates',
  )

  return { aggregates: data, loading, error }
}

/**
 * Hook: Fetch daily token usage for a tool via BFF proxy.
 *
 * Returns zero-filled day buckets for bounded recent windows, or all recorded
 * token days for the all-time window. Re-fetches when toolId or window changes.
 *
 * @param toolId - Current tool from AgentToolProvider
 * @param window - Time window for daily token usage
 * @returns { dailyTokens, loading, error }
 */
export function useDailyTokens(toolId: AgentToolId, window: TimeWindow = '30d') {
  const { data, loading, error } = useCachedToolApi<DailyTokensResponse>(
    toolId,
    '/overview/daily-tokens',
    dailyTokensQuery(window),
    EMPTY_DAILY_TOKENS_RESPONSE,
    'Failed to load daily tokens',
  )

  return { dailyTokens: data.days, loading, error }
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
  const { data, loading, error } = useCachedToolApi<TopModelsResponse>(
    toolId,
    '/overview/top-models',
    { window, limit: '10', sortBy },
    EMPTY_MODELS_RESPONSE,
    'Failed to load models',
  )

  return { models: data.models, loading, error }
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
  const { data, loading, error } = useCachedToolApi<TopProjectsResponse>(
    toolId,
    '/overview/top-projects',
    { window, limit: '10', sortBy },
    EMPTY_PROJECTS_RESPONSE,
    'Failed to load projects',
  )

  return { projects: data.projects, loading, error }
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
  const { data, loading, error } = useCachedToolApi<StarredResponse>(
    toolId,
    '/overview/starred',
    { limit: '20' },
    EMPTY_STARRED_RESPONSE,
    'Failed to load starred sessions',
  )

  return { starred: data.starred, loading, error }
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
  const { data, loading, error } = useCachedToolApi<TimelineResponse>(
    toolId,
    '/overview/timeline',
    { limit: '50' },
    EMPTY_TIMELINE_RESPONSE,
    'Failed to load timeline',
  )

  return { timeline: data.timeline, loading, error }
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
  const { data, loading, error } = useCachedToolApi<CapabilitiesResponse | null>(
    toolId,
    '/overview/capabilities',
    undefined,
    null,
    'Failed to load capabilities',
  )

  return { capabilities: data, loading, error }
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
  const { data, loading, error } = useCachedToolApi<AutomationsResponse>(
    toolId,
    '/overview/automations',
    undefined,
    EMPTY_AUTOMATIONS_RESPONSE,
    'Failed to load automations',
  )

  return { automations: data.automations, loading, error }
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
