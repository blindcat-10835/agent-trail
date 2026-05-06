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
  fetchIngest,
  validateSessionId,
  sanitizeLimit,
  type AgentToolServerAdapter,
  type SessionListResult,
} from '../server-adapter'
import type { TraceSession } from '@/types/trace'

/**
 * Create a Claude Code ingest adapter.
 *
 * All listSessions queries automatically include `source=claude-code`
 * to filter sessions by the Claude Code source.
 */
export function createClaudeCodeAdapter(): AgentToolServerAdapter {
  return {
    toolId: 'claude-code',

    async health() {
      return fetchIngest('/health')
    },

    async listSessions(query) {
      const limit = sanitizeLimit(query.limit)
      const params = new URLSearchParams({
        source: 'claude-code',
        ...query,
        limit: String(limit),
      })
      return fetchIngest<SessionListResult>(
        `/api/v1/sessions?${params}`,
        { next: { revalidate: 30 } },
      )
    },

    async getSession(sessionId) {
      validateSessionId(sessionId)
      return fetchIngest<TraceSession>(
        `/api/v1/sessions/${encodeURIComponent(sessionId)}`,
        { cache: 'no-store' },
      )
    },

    async getSessionMessages(sessionId) {
      validateSessionId(sessionId)
      return fetchIngest(
        `/api/v1/sessions/${encodeURIComponent(sessionId)}/messages`,
        { cache: 'no-store' },
      )
    },

    async getSessionTurns(sessionId) {
      validateSessionId(sessionId)
      return fetchIngest(
        `/api/v1/sessions/${encodeURIComponent(sessionId)}/turns`,
        { cache: 'no-store' },
      )
    },
  }
}

/**
 * Singleton instance — created once, reused across all Claude Code API route requests.
 */
export const claudeCodeAdapter = createClaudeCodeAdapter()
