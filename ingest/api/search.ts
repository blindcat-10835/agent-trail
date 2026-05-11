/**
 * In-Session Search Routes
 *
 * FTS5-based full-text search within a session's messages.
 * Falls back to LIKE queries if FTS5 is unavailable or query fails.
 *
 * @module ingest/api/search
 */

import { Hono } from 'hono';
import { getDatabase } from '../db';

export const searchRoutes = new Hono();

// ============================================================================
// GET /api/v1/sessions/:id/search?q=query
// ============================================================================

searchRoutes.get('/api/v1/sessions/:id/search', (c) => {
  const sessionId = c.req.param('id');
  const query = c.req.query('q');

  // Validate session ID format (T-10-09: prevent path traversal)
  if (!/^[a-zA-Z0-9:\-_.]{1,256}$/.test(sessionId)) {
    return c.json({ error: 'Invalid session ID format' }, 400);
  }

  if (!query || query.trim().length === 0) {
    return c.json({ error: 'Search query (q) is required' }, 400);
  }

  const db = getDatabase();

  // Sanitize query: strip FTS5 special characters (T-10-08)
  const sanitizedQuery = query.replace(/["'*+\-():!^&|]/g, '').trim();

  if (sanitizedQuery.length === 0) {
    return c.json({ error: 'Search query is empty after sanitization' }, 400);
  }

  try {
    // Try FTS5 first
    const results = db.prepare(`
      SELECT m.id, m.ordinal, m.role, m.turn_index, m.content,
             snippet(fts_messages_content, -1, '>>>', '<<<', '...', 32) as snippet
      FROM fts_messages_content fts
      JOIN messages m ON m.rowid = fts.rowid
      WHERE fts_messages_content MATCH ? AND m.session_id = ?
      ORDER BY m.ordinal ASC
    `).all(sanitizedQuery, sessionId);

    return c.json({
      sessionId,
      query,
      results: results.map((r: any) => ({
        id: r.id,
        ordinal: r.ordinal,
        role: r.role,
        turnIndex: r.turn_index,
        snippet: r.snippet || r.content.substring(0, 200),
      })),
    });
  } catch {
    // Fallback to LIKE if FTS5 query fails (T-10-08)
    const likeResults = db.prepare(`
      SELECT id, ordinal, role, turn_index, content
      FROM messages
      WHERE session_id = ? AND content LIKE ?
      ORDER BY ordinal ASC
    `).all(sessionId, `%${sanitizedQuery}%`);

    return c.json({
      sessionId,
      query,
      results: likeResults.map((r: any) => ({
        id: r.id,
        ordinal: r.ordinal,
        role: r.role,
        turnIndex: r.turn_index,
        snippet: r.content.substring(0, 200),
      })),
    });
  }
});
