/**
 * Claude Code Server Adapter
 *
 * Encapsulates ingest API access for Claude Code sessions.
 * Injects `source=claude-code` into session list queries.
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

const SOURCE = 'claude-code'

/**
 * Create a Claude Code ingest adapter.
 *
 * All listSessions queries automatically include `source=claude-code`
 * to filter sessions by the Claude Code source.
 */
export function createClaudeCodeAdapter(): AgentToolServerAdapter {
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
      // No Gateway integration for Claude Code (per Phase 6 scope)
      return null
    },
  }
}

/**
 * Singleton instance — created once, reused across all Claude Code API route requests.
 */
export const claudeCodeAdapter = createClaudeCodeAdapter()
