/**
 * Agents API Routes
 *
 * REST API endpoint for listing agents aggregated from session data.
 * Groups sessions by agent_name and returns summary statistics.
 */

import { Hono } from 'hono'
import { getDatabase } from '../db'
import type { SessionStatus } from '../../types/trace'

export const agentsRoutes = new Hono()

interface AgentRow {
  name: string
  session_count: number
  last_active_at: string | null
  latest_status: string
  tool_call_count: number
}

function parseAgentRow(row: AgentRow) {
  return {
    name: row.name,
    sessionCount: row.session_count,
    lastActiveAt: row.last_active_at,
    latestStatus: row.latest_status as SessionStatus,
    toolCallCount: row.tool_call_count,
  }
}

agentsRoutes.get('/api/v1/agents', (c) => {
  const source = c.req.query('source') as string

  if (!source) {
    return c.json({ error: 'source query parameter is required' }, 400)
  }

  if (!['openclaw', 'claude-code', 'codex'].includes(source)) {
    return c.json({ error: 'Invalid source parameter' }, 400)
  }

  const db = getDatabase()

  const rows = db.prepare(`
    SELECT
      s.agent_name AS name,
      COUNT(DISTINCT s.id) AS session_count,
      MAX(s.started_at) AS last_active_at,
      (
        SELECT s2.status
        FROM sessions s2
        WHERE s2.source = s.source
          AND s2.agent_name = s.agent_name
        ORDER BY COALESCE(s2.ended_at, s2.started_at) DESC
        LIMIT 1
      ) AS latest_status,
      COALESCE(
        (SELECT COUNT(*) FROM tool_calls tc WHERE tc.session_id IN (
          SELECT s3.id FROM sessions s3 WHERE s3.source = s.source AND s3.agent_name = s.agent_name
        )),
        0
      ) AS tool_call_count
    FROM sessions s
    WHERE s.source = ? AND s.agent_name IS NOT NULL
    GROUP BY s.agent_name
    ORDER BY last_active_at DESC
  `).all(source) as AgentRow[]

  return c.json({ agents: rows.map(parseAgentRow) })
})
