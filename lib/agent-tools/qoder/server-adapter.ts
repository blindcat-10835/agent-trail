/**
 * Qoder Server Adapter
 *
 * Encapsulates ingest API access for Qoder sessions.
 * Injects `source=qoder` into session list queries.
 *
 * **Server-only:** Uses fetch to ingest service — never imported by client components.
 * Imported ONLY by API route handlers at `app/api/agent-tools/[tool]/...`.
 *
 * @see lib/agent-tools/server-adapter.ts for the base interface
 */

import {
  buildSourceScopedSessionParams,
  fetchIngest,
  getSourceScopedSession,
  requireSourceScopedSession,
  type AgentToolServerAdapter,
  type SessionListResult,
  type TurnsListResult,
} from '../server-adapter'
import type { TraceSession } from '@/types/trace'

const SOURCE = 'qoder'

/**
 * Create a Qoder ingest adapter.
 *
 * All listSessions queries automatically include `source=qoder`
 * to filter sessions by the Qoder source.
 */
export function createQoderAdapter(): AgentToolServerAdapter {
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

    async lookupSessionByKey(_key: string): Promise<TraceSession | null> {
      // No Gateway integration for Qoder
      return null
    },
  }
}

/**
 * Singleton instance — created once, reused across all Qoder API route requests.
 */
export const qoderAdapter = createQoderAdapter()
