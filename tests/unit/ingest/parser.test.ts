import { describe, it, expect } from 'vitest';
import { parseOpenClawSession } from '@/ingest/parser/openclaw';
import { cleanupTempFixture, createTempFixture } from '@/tests/helpers/temp-fixture';

describe('OpenClaw parser unit tests', () => {
  describe('parseOpenClawSession', () => {
    it('should parse well-formed JSONL', () => {
      // TODO: Implement test with fixture (Plan 02-02)
      // Verify: ParseResult has correct session, messages, activities
    });

    it('should handle malformed lines', () => {
      // TODO: Implement test with fixture (Plan 02-02)
      // Verify: ParseResult.errors contains malformed line info
    });

    it('should extract tool calls', () => {
      // TODO: Implement test with fixture (Plan 02-02)
      // Verify: activities includes TraceToolCall objects
    });

    it('should normalize real OpenClaw camelCase token usage and source cost', async () => {
      const tempPath = createTempFixture([
        JSON.stringify({
          type: 'message',
          timestamp: '2026-05-25T00:00:00.000Z',
          message: {
            role: 'assistant',
            content: 'response one',
            model: 'test-model',
            usage: {
              input: 100,
              output: 20,
              cacheRead: 300,
              cacheWrite: 40,
              totalTokens: 460,
              cost: {
                input: 0.001,
                output: 0.002,
                cacheRead: 0.003,
                cacheWrite: 0,
                total: 0.006,
              },
            },
          },
        }),
        JSON.stringify({
          type: 'message',
          timestamp: '2026-05-25T00:00:01.000Z',
          message: {
            role: 'assistant',
            content: 'response two',
            model: 'test-model',
            usage: {
              input: 50,
              output: 10,
              cacheRead: 70,
              cacheWrite: 0,
              totalTokens: 130,
              cost: { total: 0.004 },
            },
          },
        }),
      ].join('\n'));

      try {
        const result = await parseOpenClawSession(tempPath, 'test-project');

        expect(result.errors).toEqual([]);
        expect(result.messages[0].tokenUsage).toEqual({
          inputTokens: 100,
          outputTokens: 20,
          cacheReadTokens: 300,
          cacheWriteTokens: 40,
          reasoningTokens: 0,
          totalTokens: 460,
          usageSemantics: 'additive',
        });
        expect(result.session.metrics).toMatchObject({
          inputTokens: 150,
          outputTokens: 30,
          cacheReadTokens: 370,
          cacheWriteTokens: 40,
          reasoningTokens: 0,
          totalTokens: 590,
        });
        expect(result.session.sourceCostUsd).toBeCloseTo(0.01);
        expect(result.session.costSource).toBe('source-reported');
        expect(result.session.costPricingStatus).toBe('priced');
      } finally {
        cleanupTempFixture(tempPath);
      }
    });

    it('should keep legacy snake_case token usage compatibility', async () => {
      const tempPath = createTempFixture(JSON.stringify({
        type: 'message',
        timestamp: '2026-05-25T00:00:00.000Z',
        message: {
          role: 'assistant',
          content: 'legacy response',
          usage: {
            input_tokens: 12,
            output_tokens: 34,
          },
        },
      }));

      try {
        const result = await parseOpenClawSession(tempPath, 'test-project');

        expect(result.messages[0].tokenUsage).toMatchObject({
          inputTokens: 12,
          outputTokens: 34,
          totalTokens: 46,
        });
        expect(result.session.metrics.totalTokens).toBe(46);
      } finally {
        cleanupTempFixture(tempPath);
      }
    });

    it('should normalize numeric OpenClaw message timestamps to ISO strings', async () => {
      const tempPath = createTempFixture(JSON.stringify({
        type: 'message',
        timestamp: '2026-05-25T00:00:00.000Z',
        message: {
          role: 'assistant',
          content: 'timestamped response',
          timestamp: 1772450399816,
          usage: {
            input: 1,
            output: 2,
            totalTokens: 3,
          },
        },
      }));

      try {
        const result = await parseOpenClawSession(tempPath, 'test-project');

        expect(result.messages[0].timestamp).toBe('2026-03-02T11:19:59.816Z');
      } finally {
        cleanupTempFixture(tempPath);
      }
    });
  });

  describe('session context extraction', () => {
    it('should extract agent name and UUID from path', () => {
      // TODO: Implement test (Plan 02-02)
      // Verify: SessionContext has correct agentName, uuid
    });

    it('should handle missing agent directory', () => {
      // TODO: Implement test (Plan 02-02)
      // Verify: Falls back to UUID extraction from filename
    });
  });
});
