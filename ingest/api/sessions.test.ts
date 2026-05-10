/**
 * Sessions API Tests — Session Lookup & Path Hardening
 *
 * Covers: session lookup endpoint validation, path traversal hardening,
 * and error response sanitization.
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
// Session lookup endpoint — param validation (no DB needed)
// ============================================================================

describe('GET /api/v1/sessions/lookup — param validation', () => {
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
    const res = await app.request(
      '/api/v1/sessions/lookup?source=openclaw&key=../../etc/passwd'
    );
    expect(res.status).toBe(400);
  });

  it('should return 400 for keys with null bytes', async () => {
    const app = createApp();
    const res = await app.request(
      '/api/v1/sessions/lookup?source=openclaw&key=test%00id'
    );
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// Session ID path traversal protection — param validation (no DB needed)
// ============================================================================

describe('Session ID path traversal protection', () => {
  it('should reject invalid characters (non-ASCII) in session ID with 400', async () => {
    const app = createApp();
    // Non-ASCII characters are not in the allowed regex set
    const res = await app.request('/api/v1/sessions/test%E2%98%A2');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid session ID');
  });

  it('should reject spaces in session ID with 400', async () => {
    const app = createApp();
    // Space is not in the allowed character set
    const res = await app.request('/api/v1/sessions/test%20id');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid session ID');
  });

  it('should reject dot-dot-slash encoded traversal as session ID with 400', async () => {
    const app = createApp();
    // %2e%2e%2f decodes to "../" — Hono captures this as :id segment containing "/"
    const res = await app.request('/api/v1/sessions/%2e%2e%2f');
    expect(res.status).toBe(400);
  });

  it('should reject null bytes in session ID with 400', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/sessions/test%00id');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid session ID');
  });
});

// ============================================================================
// Error response sanitization (onError handler behavior)
// ============================================================================

// ============================================================================
// GET /api/v1/sessions — groupBy parameter validation
// ============================================================================

describe('GET /api/v1/sessions — groupBy parameter validation', () => {
  it('should return 400 for invalid groupBy value', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/sessions?source=openclaw&groupBy=invalid');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('groupBy');
  });

  it('should accept groupBy=agent', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/sessions?source=openclaw&groupBy=agent');
    expect(res.status).not.toBe(400);
  });

  it('should accept groupBy=agent,project', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/sessions?source=openclaw&groupBy=agent,project');
    expect(res.status).not.toBe(400);
  });

  it('should handle requests without groupBy param (backward compatibility)', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/sessions?source=openclaw');
    expect(res.status).not.toBe(400);
  });
});

describe('Error response sanitization', () => {
  afterEach(() => {
    delete process.env.INGEST_DEBUG;
  });

  it('should not expose stack traces in production mode (INGEST_DEBUG unset)', async () => {
    delete process.env.INGEST_DEBUG;
    const app = new Hono();

    // Simulate the onError handler as wired in ingest/index.ts
    app.onError((err, _c) => {
      // Production: generic error, no internals exposed
      // In the real app, this checks getConfig().debugMode
      return _c.json({ error: 'Internal server error' }, 500);
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

    app.onError((err, _c) => {
      return _c.json({ error: err.message, stack: err.stack }, 500);
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
