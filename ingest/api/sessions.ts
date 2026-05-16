/**
 * Sessions API Routes
 *
 * REST API endpoints for session listing and detail retrieval.
 * Provides filtering by source, project, status with pagination and sorting.
 *
 * @module ingest/api/sessions
 */

import { Hono } from 'hono';
import { getDatabase } from '../db';
import { TraceSession, SessionStatus, TraceSource } from '@/types/trace';

export const sessionsRoutes = new Hono();

const UPDATED_AT_EXPR =
  "MAX(COALESCE(ended_at, ''), COALESCE(started_at, ''), COALESCE(file_mtime, ''))";

// ============================================================================
// GET /api/v1/sessions/lookup - Look up session by external key
// (must be BEFORE the /:id wildcard route so Hono matches it first)
// ============================================================================

sessionsRoutes.get('/api/v1/sessions/lookup', (c) => {
  const source = c.req.query('source') as string;
  const key = c.req.query('key') as string;

  // Validate required params BEFORE accessing the database
  if (!source || !key) {
    return c.json({
      error: 'source and key query parameters are required'
    }, 400);
  }

  // Validate source (whitelisted values only)
  if (!['openclaw', 'claude-code', 'codex'].includes(source)) {
    return c.json({
      error: 'Invalid source parameter'
    }, 400);
  }

  // Validate key format (prevent injection, path traversal)
  if (!/^[a-zA-Z0-9:\-_.]{1,256}$/.test(key)) {
    return c.json({
      error: 'Invalid key format'
    }, 400);
  }

  const db = getDatabase();

  // Attempt lookup: first try exact ID match, then try source_session_id
  const session = db.prepare(`
    SELECT
      id, source, project, name, started_at, ended_at, status,
      root_session_id, parent_session_id, relationship_type, source_session_id,
      message_count, user_message_count, total_output_tokens, total_input_tokens,
      total_cache_read_tokens, total_cache_write_tokens, total_reasoning_tokens, total_tokens,
      has_tool_calls, parser_malformed_lines, is_truncated, termination_status,
      last_sync_at, file_mtime, cwd, git_branch, agent_name,
      ${UPDATED_AT_EXPR} as updated_at
    FROM sessions
    WHERE source = ? AND (id = ? OR source_session_id = ?)
    LIMIT 1
  `).get(source, key, key) as SessionRow | undefined;

  if (!session) {
    return c.json({
      error: 'Session not found for key',
      source,
      key
    }, 404);
  }

  return c.json(parseSessionRow(session));
});

// ============================================================================
// GET /api/v1/sessions - List sessions
// ============================================================================

sessionsRoutes.get('/api/v1/sessions', (c) => {
  // Parse query parameters
  const source = c.req.query('source') as TraceSource | null;
  const project = c.req.query('project') || null;
  const status = c.req.query('status') as SessionStatus | null;
  const sort = c.req.query('sort') || 'updated_at'; // updated_at, started_at, or ended_at
  const order = c.req.query('order') || 'desc'; // asc or desc
  const includeChildren = c.req.query('includeChildren') === 'true';

  // Parse and validate limit/offset (T-02-14: reject negative values)
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  if (isNaN(limit) || limit < 0) {
    return c.json({ error: 'Invalid limit parameter, must be non-negative integer' }, 400);
  }
  if (isNaN(offset) || offset < 0) {
    return c.json({ error: 'Invalid offset parameter, must be non-negative integer' }, 400);
  }

  // Cap limit to prevent resource exhaustion (T-02-14)
  const cappedLimit = Math.min(limit, 1000);

  // Validate sort parameter (only allow safe column names)
  if (sort !== 'started_at' && sort !== 'ended_at' && sort !== 'updated_at') {
    return c.json({ error: 'Invalid sort parameter. Must be "updated_at", "started_at", or "ended_at"' }, 400);
  }

  // Validate order parameter
  if (order !== 'asc' && order !== 'desc') {
    return c.json({ error: 'Invalid order parameter. Must be "asc" or "desc"' }, 400);
  }

  // Parse and validate groupBy (allow agent, project, or both)
  const groupByRaw = c.req.query('groupBy');
  const validGroupByValues = ['agent', 'project'];
  let groupByDimensions: string[] = [];
  if (groupByRaw) {
    const requested = groupByRaw.split(',').map(d => d.trim()).filter(Boolean);
    if (requested.length === 0 || requested.some(d => !validGroupByValues.includes(d))) {
      return c.json({ error: 'Invalid groupBy parameter. Must be "agent", "project", or comma-separated combination' }, 400);
    }
    groupByDimensions = [...new Set(requested)];
  }

  const db = getDatabase();

  // Build query conditions
  const conditions: string[] = [];
  const params: any[] = [];

  if (source) {
    conditions.push('source = ?');
    params.push(source);
  }

  if (project) {
    conditions.push('project = ?');
    params.push(project);
  }

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (!includeChildren) {
    conditions.push('(relationship_type IS NULL OR relationship_type = ?)');
    params.push('root');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = db.prepare(`
    SELECT COUNT(*) as total
    FROM sessions
    ${whereClause}
  `).get(...params) as { total: number };

  // Get sessions
  const orderBy =
    sort === 'updated_at'
      ? UPDATED_AT_EXPR
      : sort === 'ended_at'
        ? 'ended_at'
        : 'started_at';
  const orderDir = order === 'asc' ? 'ASC' : 'DESC';

  const sessions = db.prepare(`
    SELECT
      id, source, project, name, started_at, ended_at, status,
      root_session_id, parent_session_id, relationship_type, source_session_id,
      message_count, user_message_count, total_output_tokens, total_input_tokens,
      total_cache_read_tokens, total_cache_write_tokens, total_reasoning_tokens, total_tokens,
      has_tool_calls, parser_malformed_lines, is_truncated, termination_status,
      last_sync_at, file_mtime, cwd, git_branch, agent_name,
      ${UPDATED_AT_EXPR} as updated_at
    FROM sessions
    ${whereClause}
    ORDER BY ${orderBy} ${orderDir}
    LIMIT ? OFFSET ?
  `).all(...params, cappedLimit, offset) as SessionRow[];

  const groupCounts: { agent?: Array<{ label: string; count: number }>; project?: Array<{ label: string; count: number }> } = {};

  if (groupByDimensions.includes('agent')) {
    const agentRows = db.prepare(`
      SELECT COALESCE(agent_name, source) as label, COUNT(*) as count
      FROM sessions
      ${whereClause}
      GROUP BY label
      ORDER BY count DESC
    `).all(...params) as Array<{ label: string; count: number }>;
    groupCounts.agent = agentRows;
  }

  if (groupByDimensions.includes('project')) {
    const projectRows = db.prepare(`
      SELECT COALESCE(NULLIF(project, 'default'), '-') as label, COUNT(*) as count
      FROM sessions
      ${whereClause}
      GROUP BY label
      ORDER BY count DESC
    `).all(...params) as Array<{ label: string; count: number }>;
    groupCounts.project = projectRows;
  }

  const responseBody: {
    sessions: ReturnType<typeof parseSessionRow>[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
    groupCounts?: { agent?: Array<{ label: string; count: number }>; project?: Array<{ label: string; count: number }> };
  } = {
    sessions: sessions.map(row => parseSessionRow(row)),
    pagination: {
      total: countResult.total,
      limit: cappedLimit,
      offset,
      hasMore: offset + cappedLimit < countResult.total
    }
  };

  if (Object.keys(groupCounts).length > 0) {
    responseBody.groupCounts = groupCounts;
  }

  return c.json(responseBody);
});

// ============================================================================
// GET /api/v1/sessions/:id - Get session by ID
// ============================================================================

sessionsRoutes.get('/api/v1/sessions/:id', (c) => {
  const sessionId = c.req.param('id');

  // Validate session ID format BEFORE DB access (T-02-13: prevent injection via format check)
  if (!/^[a-zA-Z0-9:\-_.]{1,256}$/.test(sessionId)) {
    return c.json({ error: 'Invalid session ID format', sessionId }, 400);
  }

  const db = getDatabase();

  const session = db.prepare(`
    SELECT
      id, source, project, name, started_at, ended_at, status,
      root_session_id, parent_session_id, relationship_type, source_session_id,
      message_count, user_message_count, total_output_tokens, total_input_tokens,
      total_cache_read_tokens, total_cache_write_tokens, total_reasoning_tokens, total_tokens,
      has_tool_calls, parser_malformed_lines, is_truncated, termination_status,
      last_sync_at, file_mtime, cwd, git_branch, agent_name,
      ${UPDATED_AT_EXPR} as updated_at
    FROM sessions
    WHERE id = ?
  `).get(sessionId) as SessionRow | undefined;

  if (!session) {
    return c.json({
      error: 'Session not found',
      sessionId
    }, 404);
  }

  return c.json(parseSessionRow(session));
});

// ============================================================================
// Types
// ============================================================================

interface SessionRow {
  id: string;
  source: string;
  project: string;
  name: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: string;
  root_session_id: string | null;
  parent_session_id: string | null;
  relationship_type: string | null;
  source_session_id: string | null;
  message_count: number;
  user_message_count: number;
  total_output_tokens: number;
  total_input_tokens: number;
  total_cache_read_tokens?: number;
  total_cache_write_tokens?: number;
  total_reasoning_tokens?: number;
  total_tokens?: number;
  has_tool_calls: number;
  parser_malformed_lines: number;
  is_truncated: number;
  termination_status: string | null;
  last_sync_at: string | null;
  file_mtime: string | null;
  updated_at: string | null;
  cwd: string | null;
  git_branch: string | null;
  agent_name: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

function parseSessionRow(row: SessionRow): TraceSession {
  const inputTokens = row.total_input_tokens || 0;
  const outputTokens = row.total_output_tokens || 0;
  const cacheReadTokens = row.total_cache_read_tokens || 0;
  const cacheWriteTokens = row.total_cache_write_tokens || 0;
  const reasoningTokens = row.total_reasoning_tokens || 0;
  const totalTokens = row.total_tokens || inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens + reasoningTokens;

  return {
    id: row.id,
    source: row.source as TraceSource,
    project: row.project,
    name: row.name || undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    updatedAt: row.updated_at || undefined,
    lastSyncAt: row.last_sync_at || undefined,
    status: row.status as SessionStatus,
    rootSessionId: row.root_session_id || undefined,
    parentSessionId: row.parent_session_id || undefined,
    relationshipType: (row.relationship_type as TraceSession['relationshipType']) || undefined,
    sourceSessionId: row.source_session_id || undefined,
    cwd: row.cwd || undefined,
    gitBranch: row.git_branch || undefined,
    agentName: row.agent_name || undefined,
    metrics: {
      messageCount: row.message_count,
      userMessageCount: row.user_message_count,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      reasoningTokens,
      totalTokens,
      hasToolCalls: row.has_tool_calls === 1,
      terminationStatus: row.termination_status || undefined,
      parserMalformedLines: row.parser_malformed_lines,
      isTruncated: row.is_truncated === 1
    },
    turns: [], // Turns loaded separately via /sessions/:id/turns
    // Phase 10 enrichment fields
    displayTitle: row.name || `${row.project} — ${row.started_at?.split('T')[0] || 'unknown'}`,
    durationMs: row.started_at && row.ended_at
      ? new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()
      : null,
    totalTurns: row.user_message_count,
    inputTokens,
    outputTokens,
    estimatedCost: null, // Placeholder per CONTEXT.md decision
  };
}
