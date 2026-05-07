/**
 * Rate Limiter Middleware
 *
 * Sliding-window in-memory rate limiter for Hono.
 * Tracks request counts per IP with automatic window reset and periodic cleanup.
 *
 * Exports:
 *  - createRateLimitMiddleware(maxRequests, windowMs) — factory
 *  - rateLimiter — pre-configured singleton (100 req/min)
 */

import type { Context, Next } from 'hono';

// ============================================================================
// Types
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create a rate-limiting middleware.
 *
 * Uses a sliding window counter per client IP.
 * The IP is extracted from the `x-forwarded-for` header (first entry), falling
 * back to `127.0.0.1` when no header is present.
 *
 * @param maxRequests - Maximum requests allowed within the window
 * @param windowMs    - Time window in milliseconds
 * @returns Hono-compatible middleware function
 */
export function createRateLimitMiddleware(maxRequests: number, windowMs: number) {
  const store: Record<string, RateLimitEntry> = {};

  // Periodic cleanup of expired entries to prevent memory leaks
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const key of Object.keys(store)) {
      if (store[key].resetAt <= now) {
        delete store[key];
      }
    }
  }, Math.min(windowMs, 60_000)).unref();

  return async function rateLimitMiddleware(c: Context, next: Next) {
    // Bypass rate limiting for health/version endpoints
    if (c.req.path === '/health' || c.req.path === '/version') {
      return await next();
    }

    // Extract client IP from x-forwarded-for (first proxy IP), fallback to loopback
    const rawHeader = c.req.header('x-forwarded-for');
    const ip: string = rawHeader?.split(',')[0]?.trim() || '127.0.0.1';

    const now = Date.now();

    // Create or reset the rate-limit window for this IP
    if (!store[ip] || store[ip].resetAt <= now) {
      store[ip] = { count: 0, resetAt: now + windowMs };
    }

    store[ip].count++;

    if (store[ip].count > maxRequests) {
      const retryAfter = Math.ceil((store[ip].resetAt - now) / 1000);
      return c.json(
        {
          error: 'Too many requests',
          retryAfter,
        },
        429
      );
    }

    await next();
  };
}

/**
 * Pre-configured rate limiter: 100 requests per minute
 */
export const rateLimiter = createRateLimitMiddleware(100, 60_000);
