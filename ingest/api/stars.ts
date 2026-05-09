/**
 * Stars API Routes
 *
 * REST API endpoints for starring/unstarring sessions.
 * Star state is persisted in the session_stars SQLite table.
 *
 * @module ingest/api/stars
 */

import { Hono } from 'hono';
import { getDatabase } from '../db';

export const starsRoutes = new Hono();

function isValidSessionId(id: string): boolean {
  return /^[a-zA-Z0-9:\-_.]{1,256}$/.test(id);
}

// GET /api/v1/sessions/starred - List starred session IDs
starsRoutes.get('/api/v1/sessions/starred', (c) => {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT session_id FROM session_stars ORDER BY starred_at DESC',
  ).all() as { session_id: string }[];
  return c.json({
    session_ids: rows.map((r) => r.session_id),
  });
});

// POST /api/v1/sessions/:id/star - Star a session
starsRoutes.post('/api/v1/sessions/:id/star', (c) => {
  const sessionId = c.req.param('id');
  if (!isValidSessionId(sessionId)) {
    return c.json({ error: 'Invalid session ID format' }, 400);
  }
  const db = getDatabase();
  db.prepare(
    'INSERT OR IGNORE INTO session_stars (session_id) VALUES (?)',
  ).run(sessionId);
  return c.json({ ok: true, session_id: sessionId });
});

// DELETE /api/v1/sessions/:id/star - Unstar a session
starsRoutes.delete('/api/v1/sessions/:id/star', (c) => {
  const sessionId = c.req.param('id');
  if (!isValidSessionId(sessionId)) {
    return c.json({ error: 'Invalid session ID format' }, 400);
  }
  const db = getDatabase();
  db.prepare('DELETE FROM session_stars WHERE session_id = ?').run(sessionId);
  return c.json({ ok: true, session_id: sessionId });
});
