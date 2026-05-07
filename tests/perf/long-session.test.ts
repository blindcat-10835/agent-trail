import { describe, it, expect } from 'vitest';
import { parseOpenClawSession } from '@/ingest/parser/openclaw';
import { createTempFixture, cleanupTempFixture } from '@/tests/helpers/temp-fixture';

const MESSAGE_COUNT = 1100;

/**
 * Performance smoke tests for parsing and processing large sessions.
 *
 * These tests verify that the parser scales to realistic session sizes
 * without excessive runtime or memory usage.
 */
describe('Long session performance', () => {
  it(`parses ${MESSAGE_COUNT}+ messages under 5 seconds`, async () => {
    // Generate synthetic JSONL lines
    const lines: string[] = [];
    for (let i = 0; i < MESSAGE_COUNT; i++) {
      lines.push(
        JSON.stringify({
          type: 'message',
          message: {
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${i}: ${'a'.repeat(200)}`, // realistic message size (~200 chars)
            model: i % 2 === 1 ? 'test-model' : undefined,
            usage:
              i % 2 === 1
                ? { input_tokens: 50, output_tokens: 100 }
                : undefined,
          },
          session: 'perf-test-session',
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
        })
      );
    }
    const tempPath = createTempFixture(lines.join('\n'));

    try {
      const start = performance.now();
      const result = await parseOpenClawSession(tempPath, 'perf-project');
      const elapsed = performance.now() - start;

      // Should complete in under 5 seconds (generous safety margin)
      expect(elapsed).toBeLessThan(5000);
      // All messages should be parsed
      expect(result.messages.length).toBeGreaterThanOrEqual(MESSAGE_COUNT);
      // No errors expected (all lines are valid)
      expect(result.errors.length).toBe(0);
      // Session metrics should reflect the message count
      expect(result.session.metrics.messageCount).toBe(MESSAGE_COUNT);
      // Token usage should be accumulated
      expect(result.session.metrics.totalTokens).toBeGreaterThan(0);
    } finally {
      cleanupTempFixture(tempPath);
    }
  }, 15000); // 15 second timeout for this test

  it('memory usage stays under 200MB for large session parse', async () => {
    // Force garbage collection if available
    if (typeof global.gc === 'function') {
      global.gc();
    }

    const memBefore = process.memoryUsage();

    // Generate synthetic data
    const lines: string[] = [];
    for (let i = 0; i < MESSAGE_COUNT; i++) {
      lines.push(
        JSON.stringify({
          type: 'message',
          message: {
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Line ${i}: ${'data-block '.repeat(10)}`, // ~130 chars per message
            model: i % 2 === 1 ? 'test-model' : undefined,
          },
          session: 'mem-test-session',
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
        })
      );
    }
    const tempPath = createTempFixture(lines.join('\n'));

    try {
      const result = await parseOpenClawSession(tempPath, 'mem-project');
      expect(result.messages.length).toBeGreaterThanOrEqual(MESSAGE_COUNT);

      // Force garbage collection if available
      if (typeof global.gc === 'function') {
        global.gc();
      }

      const memAfter = process.memoryUsage();
      const heapDelta = memAfter.heapUsed - memBefore.heapUsed;

      // Heap delta should be under 200MB
      const maxHeapBytes = 200 * 1024 * 1024; // 200MB
      expect(heapDelta).toBeLessThan(maxHeapBytes);

      // Also verify total heap is reasonable (not just the delta)
      // Node process shouldn't exceed ~512MB total
      expect(memAfter.heapUsed).toBeLessThan(512 * 1024 * 1024);
    } finally {
      cleanupTempFixture(tempPath);
    }
  }, 30000); // 30 second timeout for memory test

  it('parses varied message sizes without performance degradation', async () => {
    // Mix of small, medium, and large messages
    const lines: string[] = [];
    for (let i = 0; i < 500; i++) {
      const size =
        i % 3 === 0 ? 10 : i % 3 === 1 ? 200 : 2000; // small, medium, large
      lines.push(
        JSON.stringify({
          type: 'message',
          message: {
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Msg ${i}: ${'x'.repeat(size)}`,
            model: i % 2 === 1 ? 'test-model' : undefined,
          },
          session: 'varied-test',
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
        })
      );
    }
    const tempPath = createTempFixture(lines.join('\n'));

    try {
      const start = performance.now();
      const result = await parseOpenClawSession(tempPath, 'perf-project');
      const elapsed = performance.now() - start;

      // Even with varied message sizes, should complete quickly
      expect(elapsed).toBeLessThan(5000);
      expect(result.messages.length).toBe(500);
      expect(result.errors.length).toBe(0);
    } finally {
      cleanupTempFixture(tempPath);
    }
  }, 15000);
});
