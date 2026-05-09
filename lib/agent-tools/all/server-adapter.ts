/**
 * All Sources Server Adapter
 *
 * Cross-source adapter that fetches from ingest without source scoping.
 * Used when the shell is in "ALL" aggregate mode — session detail, turns,
 * and messages are fetched directly by ID regardless of which tool owns them.
 *
 * **Server-only:** Uses fetch to ingest service — never imported by client components.
 */

import {
  fetchIngest,
  sanitizeLimit,
  sanitizeError,
  validateSessionId,
  type AgentToolServerAdapter,
  type SessionListResult,
  type TurnsListResult,
  type TurnsQueryParams,
} from '../server-adapter'
import type { TraceSession } from '@/types/trace'

export function createAllAdapter(): AgentToolServerAdapter {
  return {
    toolId: 'all',

    async health() {
      return fetchIngest('/health')
    },

    async listSessions(query) {
      const params = new URLSearchParams({
        ...query,
        limit: String(sanitizeLimit(query.limit)),
      })
      return fetchIngest<SessionListResult>(
        `/api/v1/sessions?${params}`,
        { cache: 'no-store' },
      )
    },

    async getSession(sessionId) {
      validateSessionId(sessionId)
      try {
        return await fetchIngest<TraceSession>(
          `/api/v1/sessions/${encodeURIComponent(sessionId)}`,
          { cache: 'no-store' },
        )
      } catch (err) {
        if (err instanceof Error && err.message === 'Session not found') {
          return null
        }
        throw err
      }
    },

    async getSessionMessages(sessionId) {
      validateSessionId(sessionId)
      return fetchIngest(
        `/api/v1/sessions/${encodeURIComponent(sessionId)}/messages`,
        { cache: 'no-store' },
      )
    },

    async getSessionTurns(sessionId, query) {
      validateSessionId(sessionId)
      const offset = query?.offset ?? 0
      const limit = query?.limit ?? 50
      const params = `offset=${offset}&limit=${limit}`
      return fetchIngest<TurnsListResult>(
        `/api/v1/sessions/${encodeURIComponent(sessionId)}/turns?${params}`,
        { cache: 'no-store' },
      )
    },

    async lookupSessionByKey(): Promise<TraceSession | null> {
      return null
    },
  }
}

export const allAdapter = createAllAdapter()
