/**
 * SSE Event Routes
 *
 * Server-Sent Events (SSE) endpoints for real-time invalidation notifications.
 * Provides global event stream (/api/v1/events) and per-session event stream
 * (/api/v1/sessions/:id/events).
 *
 * Events notify the frontend to re-fetch data; individual turn/message data
 * is NOT pushed inline (v1 uses batch sync + SSE invalidation).
 *
 * @module ingest/api/routes/events
 */
import { Hono } from 'hono';
import { sseManager } from '../../src/sse.js';
import { getDatabase } from '../../db/index.js';

export const eventsRoutes = new Hono();

// Session ID validation regex — same pattern used in sessions.ts
const SESSION_ID_REGEX = /^[a-zA-Z0-9:\-_.]{1,256}$/;

/**
 * GET /api/v1/events — Global event stream
 *
 * Subscribes clients to all global SSE events: session_created,
 * session_updated, session_removed, sync_complete.
 */
eventsRoutes.get('/api/v1/events', (c) => {
  const { stream, close } = sseManager.subscribe();

  // Clean up subscriber when the client disconnects
  c.req.raw.signal?.addEventListener('abort', close);

  return c.newResponse(stream, 200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering if behind proxy
  });
});

/**
 * GET /api/v1/sessions/:id/events — Per-session event stream
 *
 * Subscribes clients to events for a specific session: turn_added,
 * session_updated. Validates session ID format and existence before
 * subscribing (per threat model T-06-02-01).
 */
eventsRoutes.get('/api/v1/sessions/:id/events', (c) => {
  const sessionId = c.req.param('id');

  // Validate session ID format to prevent injection/path traversal
  if (!SESSION_ID_REGEX.test(sessionId)) {
    return c.json({ error: 'Invalid session ID format' }, 400);
  }

  // Verify session exists before subscribing
  const db = getDatabase();
  const exists = db
    .prepare('SELECT id FROM sessions WHERE id = ?')
    .get(sessionId) as { id: string } | undefined;

  if (!exists) {
    return c.json({ error: 'Session not found', sessionId }, 404);
  }

  const { stream, close } = sseManager.subscribe(sessionId);

  // Clean up subscriber when the client disconnects
  c.req.raw.signal?.addEventListener('abort', close);

  return c.newResponse(stream, 200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
});
