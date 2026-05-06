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

import {
  buildSourceScopedSessionParams,
  fetchIngest,
  getSourceScopedSession,
  requireSourceScopedSession,
  type AgentToolServerAdapter,
  type SessionListResult,
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
        { next: { revalidate: 30 } },
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

    async getSessionTurns(sessionId) {
      await requireSourceScopedSession(sessionId, SOURCE)
      return fetchIngest(
        `/api/v1/sessions/${encodeURIComponent(sessionId)}/turns`,
        { cache: 'no-store' },
      )
    },
  }
}

/**
 * Singleton instance — created once, reused across all OpenClaw API route requests.
 */
export const openclawAdapter = createOpenClawAdapter()
