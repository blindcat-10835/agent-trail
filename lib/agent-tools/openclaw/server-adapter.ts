/**
 * OpenClaw Server Adapter
 *
 * Encapsulates ingest API access for OpenClaw sessions.
 * Injects `source=openclaw` into session list queries.
 *
 * **Server-only:** Uses fetch to ingest service — never imported by client components.
 * Imported ONLY by API route handlers at `app/api/agent-tools/[tool]/...`.
 *
 * @see lib/agent-tools/server-adapter.ts for the base interface
 */

import type { TraceSession } from '@/types/trace'
import {
  buildSourceScopedSessionParams,
  fetchIngest,
  getSourceScopedSession,
  requireSourceScopedSession,
  type AgentToolServerAdapter,
  type SessionListResult,
  type TurnsListResult,
} from '../server-adapter'

const SOURCE = 'openclaw'

/**
 * Create an OpenClaw ingest adapter.
 *
 * All listSessions queries automatically include `source=openclaw`
 * to filter sessions by the OpenClaw source.
 */
export function createOpenClawAdapter(): AgentToolServerAdapter {
  return {
    toolId: SOURCE,

    async health() {
      return fetchIngest('/health')
    },

    async listSessions(query) {
      const params = buildSourceScopedSessionParams(SOURCE, query)
      return fetchIngest<SessionListResult>(
        `/api/v1/sessions?${params}`,
        { cache: 'no-store' },
      )
    },

    async getSession(sessionId) {
      return getSourceScopedSession(sessionId, SOURCE)
    },

    async getSessionMessages(sessionId) {
      await requireSourceScopedSession(sessionId, SOURCE)
      return fetchIngest(
        `/api/v1/sessions/${encodeURIComponent(sessionId)}/messages`,
        { cache: 'no-store' },
      )
    },

    async getSessionTurns(sessionId, query) {
      await requireSourceScopedSession(sessionId, SOURCE)
      const offset = query?.offset ?? 0
      const limit = query?.limit ?? 50
      const params = `offset=${offset}&limit=${limit}`
      return fetchIngest<TurnsListResult>(
        `/api/v1/sessions/${encodeURIComponent(sessionId)}/turns?${params}`,
        { cache: 'no-store' },
      )
    },

    async lookupSessionByKey(key: string): Promise<TraceSession | null> {
      try {
        const result = await fetchIngest<TraceSession>(
          `/api/v1/sessions/lookup?source=${SOURCE}&key=${encodeURIComponent(key)}`,
          { cache: 'no-store' },
        )
        return result
      } catch (err) {
        // 404 "Session not found" → return null (best-effort matching)
        if (err instanceof Error && err.message.includes('Session not found')) {
          return null
        }
        throw err
      }
    },
  }
}

/**
 * Singleton instance — created once, reused across all OpenClaw API route requests.
 */
export const openclawAdapter = createOpenClawAdapter()
