/**
 * Sources API Routes
 *
 * REST API endpoints for source discovery, sync triggering, and ingest status.
 * Provides OpenClaw source management in Phase 2, with Claude Code/Codex in Phase 3.
 *
 * @module ingest/api/sources
 */

import { Hono } from 'hono';
import { discoverOpenClawSources, getSourceConfig } from '../sync/sources';
import { syncSource } from '../sync';

export const sourcesRoutes = new Hono();

// ============================================================================
// GET /api/v1/sources - List all discovered sources
// ============================================================================

sourcesRoutes.get('/api/v1/sources', async (c) => {
  try {
    const openclawSources = await discoverOpenClawSources();

    const sources = openclawSources.map(s => ({
      type: s.type,
      path: s.path,
      sessionCount: s.sessionCount,
      lastSyncAt: s.lastSyncAt || null,
      error: s.error || null,
      // Source health status taxonomy per FOUND-05/DATA-03:
      healthStatus: s.error ? 'error' : (s.sessionCount > 0 ? 'configured' : 'empty'),
      // 'configured' = path exists, sessions found
      // 'empty' = path exists, no sessions
      // 'error' = discovery or parse error occurred
      // Phase 3 will add 'indexing', 'parser-warning'
    }));

    return c.json({
      sources,
      total: sources.length
    });
  } catch (err) {
    return c.json({
      error: 'Failed to discover sources',
      message: err instanceof Error ? err.message : 'Unknown error'
    }, 500);
  }
});

// ============================================================================
// GET /api/v1/sources/:type - Get sources by type
// ============================================================================

sourcesRoutes.get('/api/v1/sources/:type', async (c) => {
  const type = c.req.param('type');

  if (type !== 'openclaw') {
    return c.json({
      error: 'Unsupported source type',
      message: `Type '${type}' not supported in Phase 2`
    }, 400);
  }

  try {
    const sources = await discoverOpenClawSources();

    return c.json({
      type,
      sources: sources.map(s => ({
        path: s.path,
        sessionCount: s.sessionCount,
        lastSyncAt: s.lastSyncAt || null,
        error: s.error || null
      }))
    });
  } catch (err) {
    return c.json({
      error: 'Failed to discover sources',
      message: err instanceof Error ? err.message : 'Unknown error'
    }, 500);
  }
});

// ============================================================================
// POST /api/v1/sources/:type/sync - Trigger sync for source type
// ============================================================================

sourcesRoutes.post('/api/v1/sources/:type/sync', async (c) => {
  const type = c.req.param('type');

  if (type !== 'openclaw') {
    return c.json({
      error: 'Unsupported source type',
      message: `Type '${type}' not supported in Phase 2`
    }, 400);
  }

  try {
    const result = await syncSource('openclaw');

    return c.json({
      type,
      syncResult: {
        sessionsInserted: result.sessionsInserted,
        sessionsUpdated: result.sessionsUpdated,
        messagesInserted: result.messagesInserted,
        errors: result.errors
      },
      status: 'completed'
    });
  } catch (err) {
    return c.json({
      error: 'Sync failed',
      message: err instanceof Error ? err.message : 'Unknown error'
    }, 500);
  }
});

// ============================================================================
// GET /api/v1/events - SSE skeleton endpoint (Phase 6 will implement real push)
// ============================================================================

sourcesRoutes.get('/api/v1/events', async (c) => {
  // Return SSE-compatible headers but no real events yet
  return c.newResponse(null, 200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
});
