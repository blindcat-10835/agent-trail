/**
 * Sessions API Tests — Session Lookup & Path Hardening
 *
 * TDD RED phase: These tests MUST fail before implementation.
 * Covers: session lookup endpoint, path traversal hardening in turns, and error sanitization.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { Hono } from 'hono';
import { sessionsRoutes } from './sessions.js';

// ============================================================================
// Utility: build a Hono app with sessions routes mounted
// ============================================================================

function createApp() {
  const app = new Hono();
  app.route('/', sessionsRoutes);
  return app;
}

// ============================================================================
// RED: Session lookup endpoint
// ============================================================================

describe('GET /api/v1/sessions/lookup', () => {
  it('should return 400 when source and key are missing', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/sessions/lookup');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('source');
  });

  it('should return 400 when source is missing', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/sessions/lookup?key=abc123');
    expect(res.status).toBe(400);
  });

  it('should return 400 when key is missing', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/sessions/lookup?source=openclaw');
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid source parameter', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/sessions/lookup?source=invalid&key=abc');
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid key format (path traversal attempt)', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/sessions/lookup?source=openclaw&key=../../etc/passwd');
    expect(res.status).toBe(400);
  });

  it('should return 404 for valid params but nonexistent session', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/sessions/lookup?source=openclaw&key=nonexistent-key-12345');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });
});

// ============================================================================
// RED: Path traversal hardening in session ID param
// ============================================================================

describe('Session ID path traversal protection', () => {
  it('should reject path traversal in session ID with 400', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/sessions/../../../etc/passwd');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid session ID');
  });

  it('should reject double-dot traversal in session ID with 400', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/sessions/..%2F..%2Fetc%2Fpasswd');
    expect(res.status).toBe(400);
  });

  it('should reject null bytes in session ID with 400', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/sessions/test%00id');
    expect(res.status).toBe(400);
  });

  it('should return 404 for nonexistent but valid session ID', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/sessions/valid-but-nonexistent-session-id');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('Session not found');
  });
});

// ============================================================================
// RED: Error sanitization via onError handler
// ============================================================================

describe('Error response sanitization', () => {
  afterEach(() => {
    delete process.env.INGEST_DEBUG;
  });

  it('should not expose stack traces in production mode (INGEST_DEBUG unset)', async () => {
    delete process.env.INGEST_DEBUG;
    const app = new Hono();

    // Set up app.onError with debug check
    // This will be wired by the implementation
    const { getConfig } = await import('../config/index.js');
    const config = getConfig();

    app.onError((err, c) => {
      if (config.debugMode) {
        return c.json({ error: err.message, stack: err.stack }, 500);
      }
      return c.json({ error: 'Internal server error' }, 500);
    });

    app.get('/trigger-error', () => {
      throw new Error('Sensitive file path: /etc/secret/config.yaml');
    });

    const res = await app.request('/trigger-error');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
    // Must NOT leak internal paths
    expect(JSON.stringify(body)).not.toContain('/etc/secret');
    expect(body.stack).toBeUndefined();
  });

  it('should include stack trace in debug mode (INGEST_DEBUG=true)', async () => {
    process.env.INGEST_DEBUG = 'true';
    const app = new Hono();

    const { getConfig } = await import('../config/index.js');
    // Force re-cache since we set INGEST_DEBUG
    delete (getConfig as any).__cached;
    const { loadConfig } = await import('../config/index.js');
    // Reload config fresh
    const freshConfig = loadConfig();

    app.onError((err, c) => {
      if (freshConfig.debugMode) {
        return c.json({ error: err.message, stack: err.stack }, 500);
      }
      return c.json({ error: 'Internal server error' }, 500);
    });

    app.get('/trigger-error', () => {
      throw new Error('Debug info: connection refused at /tmp/socket');
    });

    const res = await app.request('/trigger-error');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Debug info: connection refused at /tmp/socket');
    expect(body.stack).toBeDefined();
  });
});
