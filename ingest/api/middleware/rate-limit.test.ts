/**
 * Rate Limiter Middleware Tests
 *
 * TDD RED phase: Tests MUST fail before implementation.
 * Tests cover: basic pass-through, 429 on limit breach, window reset,
 * per-IP isolation, config via parameters, and health endpoint bypass.
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createRateLimitMiddleware, rateLimiter } from './rate-limit.js';

/**
 * Helper: Create a minimal Hono app with the rate limiter middleware
 */
function createApp(maxRequests: number, windowMs: number) {
  const app = new Hono();
  const rl = createRateLimitMiddleware(maxRequests, windowMs);
  app.use('*', rl);
  app.get('/test', (c) => c.json({ ok: true }));
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.get('/version', (c) => c.json({ version: '1.0.0' }));
  return app;
}

describe('Rate Limiter Middleware', () => {
  describe('Basic pass-through', () => {
    it('should allow first request through normally', async () => {
      const app = createApp(5, 60000);
      const res = await app.request('/test');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    });

    it('should allow requests up to the limit', async () => {
      const app = createApp(5, 60000);
      for (let i = 0; i < 5; i++) {
        const res = await app.request('/test');
        expect(res.status).toBe(200);
      }
    });
  });

  describe('Rate limit enforcement', () => {
    it('should return 429 on exceeding the limit', async () => {
      const app = createApp(3, 60000);
      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const res = await app.request('/test');
        expect(res.status).toBe(200);
      }
      // 4th request should be rate limited
      const res = await app.request('/test');
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe('Too many requests');
      expect(typeof body.retryAfter).toBe('number');
      expect(body.retryAfter).toBeGreaterThan(0);
    });

    it('should reset after the window expires', async () => {
      // Use a very short window (100ms) for testing
      const app = createApp(2, 100);
      // Exhaust the limit
      await app.request('/test');
      await app.request('/test');
      const rateLimited = await app.request('/test');
      expect(rateLimited.status).toBe(429);

      // Wait for the window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should succeed again
      const res = await app.request('/test');
      expect(res.status).toBe(200);
    });
  });

  describe('Per-IP isolation', () => {
    it('should track limits independently per IP', async () => {
      const app = createApp(2, 60000);

      // Exhaust limit for IP 1.2.3.4
      for (let i = 0; i < 2; i++) {
        const res = await app.request('/test', {
          headers: { 'x-forwarded-for': '1.2.3.4' },
        });
        expect(res.status).toBe(200);
      }
      const limited1 = await app.request('/test', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      });
      expect(limited1.status).toBe(429);

      // IP 5.6.7.8 should still have its own limit
      for (let i = 0; i < 2; i++) {
        const res = await app.request('/test', {
          headers: { 'x-forwarded-for': '5.6.7.8' },
        });
        expect(res.status).toBe(200);
      }
      const limited2 = await app.request('/test', {
        headers: { 'x-forwarded-for': '5.6.7.8' },
      });
      expect(limited2.status).toBe(429);
    });

    it('should use x-forwarded-for first IP when multiple are present', async () => {
      const app = createApp(1, 60000);

      // First request with proxy chain
      const res1 = await app.request('/test', {
        headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2, 10.0.0.3' },
      });
      expect(res1.status).toBe(200);

      // Same first IP via proxy chain = same bucket
      const res2 = await app.request('/test', {
        headers: { 'x-forwarded-for': '10.0.0.1, 192.168.1.1' },
      });
      expect(res2.status).toBe(429);
    });

    it('should default to 127.0.0.1 when no x-forwarded-for header', async () => {
      const app = createApp(1, 60000);
      const res1 = await app.request('/test');
      expect(res1.status).toBe(200);

      // Second request from same default IP should be limited
      const res2 = await app.request('/test');
      expect(res2.status).toBe(429);
    });
  });

  describe('Health endpoint bypass', () => {
    it('should allow health endpoint to bypass rate limiting', async () => {
      const app = createApp(2, 60000);

      // Exhaust limit
      await app.request('/test');
      await app.request('/test');

      const limited = await app.request('/test');
      expect(limited.status).toBe(429);

      // Health should still work
      const health = await app.request('/health');
      expect(health.status).toBe(200);
    });

    it('should allow version endpoint to bypass rate limiting', async () => {
      const app = createApp(2, 60000);

      // Exhaust limit
      await app.request('/test');
      await app.request('/test');

      const limited = await app.request('/test');
      expect(limited.status).toBe(429);

      // Version should still work
      const version = await app.request('/version');
      expect(version.status).toBe(200);
    });
  });
});

describe('createRateLimitMiddleware exports', () => {
  it('should export createRateLimitMiddleware as a function', () => {
    expect(typeof createRateLimitMiddleware).toBe('function');
  });

  it('should accept maxRequests and windowMs parameters', () => {
    const middleware = createRateLimitMiddleware(50, 30000);
    expect(typeof middleware).toBe('function');
  });

  it('should export a pre-configured rateLimiter singleton', () => {
    expect(typeof rateLimiter).toBe('function');
  });
});
