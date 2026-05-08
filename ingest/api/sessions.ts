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
      message_count, user_message_count, total_output_tokens, has_tool_calls,
      parser_malformed_lines, is_truncated, termination_status,
      last_sync_at, file_mtime,
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
  const db = getDatabase();

  // Parse query parameters
  const source = c.req.query('source') as TraceSource | null;
  const project = c.req.query('project') || null;
  const status = c.req.query('status') as SessionStatus | null;
  const sort = c.req.query('sort') || 'updated_at'; // updated_at, started_at, or ended_at
  const order = c.req.query('order') || 'desc'; // asc or desc

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
      message_count, user_message_count, total_output_tokens, has_tool_calls,
      parser_malformed_lines, is_truncated, termination_status,
      last_sync_at, file_mtime,
      ${UPDATED_AT_EXPR} as updated_at
    FROM sessions
    ${whereClause}
    ORDER BY ${orderBy} ${orderDir}
    LIMIT ? OFFSET ?
  `).all(...params, cappedLimit, offset) as SessionRow[];

  return c.json({
    sessions: sessions.map(row => parseSessionRow(row)),
    pagination: {
      total: countResult.total,
      limit: cappedLimit,
      offset,
      hasMore: offset + cappedLimit < countResult.total
    }
  });
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
      message_count, user_message_count, total_output_tokens, has_tool_calls,
      parser_malformed_lines, is_truncated, termination_status,
      last_sync_at, file_mtime,
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
  message_count: number;
  user_message_count: number;
  total_output_tokens: number;
  has_tool_calls: number;
  parser_malformed_lines: number;
  is_truncated: number;
  termination_status: string | null;
  last_sync_at: string | null;
  file_mtime: string | null;
  updated_at: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

function parseSessionRow(row: SessionRow): TraceSession {
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
    metrics: {
      messageCount: row.message_count,
      userMessageCount: row.user_message_count,
      totalTokens: row.total_output_tokens,
      hasToolCalls: row.has_tool_calls === 1,
      terminationStatus: row.termination_status || undefined,
      parserMalformedLines: row.parser_malformed_lines,
      isTruncated: row.is_truncated === 1
    },
    turns: [] // Turns loaded separately via /sessions/:id/turns
  };
}
