/**
 * Ingest Service Main Entry Point
 *
 * Starts HTTP API server with health/version endpoints,
 * initializes SQLite database, manages graceful shutdown.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { loadConfig } from './config/index.js';
import { openDatabase, initSchema, closeDatabase } from './db/index.js';
import { sourcesRoutes } from './api/sources.js';
import { sessionsRoutes } from './api/sessions.js';
import { turnsRoutes } from './api/turns.js';
import { eventsRoutes } from './api/routes/events.js';
import { createWatcher } from './src/watcher.js';
import { sseManager } from './src/sse.js';
import {
  discoverOpenClawSources,
  discoverClaudeSources,
  discoverCodexSources,
} from './sync/sources.js';
import type { ServiceContext, HealthStatus, VersionInfo } from './types.js';
import type { TraceSource } from '../types/trace.js';
import type { SyncSourceType } from './sync/index.js';

// ============================================================================
// Module State
// ============================================================================

const app = new Hono();
let context: ServiceContext | null = null;

/**
 * Get the active service context (lazy accessor for routes)
 */
export function getServiceContext(): ServiceContext | null {
  return context;
}

// ============================================================================
// API Routes
// ============================================================================

/**
 * GET /health - Health check endpoint
 */
app.get('/health', (c) => {
  const health: HealthStatus = {
    status: context ? 'ok' : 'error',
    version: '0.1.0',
    uptime: process.uptime(),
    database: context?.db ? 'connected' : 'disconnected',
  };

  return c.json(health);
});

/**
 * GET /version - Version information endpoint
 */
app.get('/version', (c) => {
  const version: VersionInfo = {
    version: '0.1.0',
    name: 'agent-tracing-dashboard-ingest',
    sources: ['openclaw', 'claude-code', 'codex'] as TraceSource[],
  };

  return c.json(version);
});

// Mount sources API routes
app.route('/', sourcesRoutes);

// Mount sessions and turns API routes
app.route('/', sessionsRoutes);
app.route('/', turnsRoutes);

// Mount SSE event routes (global + per-session streams)
app.route('/', eventsRoutes);

// ============================================================================
// Service Lifecycle
// ============================================================================

/**
 * Start ingest service
 */
export async function start(): Promise<void> {
  try {
    // Load configuration
    const config = loadConfig();

    // Open database
    console.log(`Opening database: ${config.dbPath}`);
    const db = openDatabase({ path: config.dbPath });

    // Initialize schema
    console.log('Initializing database schema...');
    initSchema();

    // Discover source directories for watcher
    console.log('Discovering source directories...');
    const openClawSources = await discoverOpenClawSources();
    const claudeSources = await discoverClaudeSources();
    const codexSources = await discoverCodexSources();

    const sourceDirs = new Map<SyncSourceType, string[]>();
    sourceDirs.set('openclaw', openClawSources.filter((s) => !s.error && s.path).map((s) => s.path));
    sourceDirs.set('claude-code', claudeSources.filter((s) => !s.error && s.path).map((s) => s.path));
    sourceDirs.set('codex', codexSources.filter((s) => !s.error && s.path).map((s) => s.path));

    // Start file watcher
    console.log('Starting file watcher...');
    const watcher = createWatcher({
      sourceDirs,
      debounceMs: config.debounceMs,
      resyncIntervalMs: config.resyncIntervalMs,
      fileExtensions: ['.jsonl', '.json', '.md'],
      onSyncTrigger: async (sourceType) => {
        try {
          const { syncSource } = await import('./sync/index.js');
          await syncSource(sourceType);
        } catch (err) {
          console.error(`[watcher] Sync failed for ${sourceType}:`, err);
        }
      },
    });
    await watcher.start();

    // Start HTTP server
    const server = serve({
      fetch: app.fetch,
      port: config.port,
    });

    // Store context
    context = { config, db, server, sseManager, watcher };

    console.log(`Ingest service started on port ${config.port}`);
    console.log(`Health check: http://localhost:${config.port}/health`);
    console.log(`Version info: http://localhost:${config.port}/version`);
  } catch (err) {
    console.error('Failed to start ingest service:', err);
    throw err;
  }
}

/**
 * Stop ingest service
 */
export async function stop(): Promise<void> {
  try {
    if (context?.watcher) {
      console.log('Stopping file watcher...');
      await context.watcher.stop();
    }

    if (context?.server) {
      console.log('Stopping HTTP server...');
      context.server.close();
      context.server = null;
    }

    closeDatabase();
    context = null;

    console.log('Ingest service stopped');
  } catch (err) {
    console.error('Error during shutdown:', err);
    throw err;
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start ingest service:', err);
    process.exit(1);
  });

  // Graceful shutdown handlers
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    try {
      await stop();
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    try {
      await stop();
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
}
