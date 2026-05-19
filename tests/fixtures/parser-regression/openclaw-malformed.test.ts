import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseOpenClawSession } from '@/ingest/parser/openclaw';
import { createTempFixture, cleanupTempFixture } from '@/tests/helpers/temp-fixture';

describe('OpenClaw parser — malformed lines', () => {
  let tempPath: string | null = null;

  afterEach(() => {
    if (tempPath) {
      cleanupTempFixture(tempPath);
      tempPath = null;
    }
  });

  it('handles JSONL lines with missing required fields (no role)', async () => {
    const malformedContent = [
      '{"type":"message","message":{"content":"orphan message without role"},"session":"test","timestamp":"2025-01-01T00:00:00Z"}',
      '{"type":"message","message":{"content":"another orphan"},"session":"test"}',
      '{"type":"message","message":{"role":"user","content":"valid message"},"session":"test","timestamp":"2025-01-01T00:00:01Z"}',
    ].join('\n');
    tempPath = createTempFixture(malformedContent);

    const result = await parseOpenClawSession(tempPath, 'test-project');

    // Should parse at least the valid line
    expect(result.messages.length).toBeGreaterThanOrEqual(1);
    // Should not crash
    expect(result.session).toBeDefined();
    // Missing roles are rejected as malformed so they cannot violate DB role checks.
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('normalizes OpenClaw toolResult role to canonical tool_result', async () => {
    const content = [
      '{"type":"message","message":{"role":"assistant","content":"calling tool"},"session":"test","timestamp":"2025-01-01T00:00:00Z"}',
      '{"type":"message","message":{"role":"toolResult","content":"tool output"},"session":"test","timestamp":"2025-01-01T00:00:01Z"}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseOpenClawSession(tempPath, 'test-project');

    expect(result.errors).toEqual([]);
    expect(result.messages.map((message) => message.role)).toEqual([
      'assistant',
      'tool_result',
    ]);
  });

  it('handles completely invalid JSON lines (not JSON at all)', async () => {
    const content = [
      'this is not json at all {{{',
      '{"type":"message","message":{"role":"user","content":"valid message"},"session":"test","timestamp":"2025-01-01T00:00:00Z"}',
      'also garbage here !!!',
      '{"type":"message","message":{"role":"assistant","content":"second valid"},"session":"test","timestamp":"2025-01-01T00:00:02Z"}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseOpenClawSession(tempPath, 'test-project');

    // Valid messages are parsed
    expect(result.messages.length).toBe(2);
    // Malformed lines produce errors
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    // Session metrics reflect malformed lines
    expect(result.session.metrics.parserMalformedLines).toBeGreaterThanOrEqual(2);
    // ParseResult is returned — no throw
    expect(result.session).toBeDefined();
    expect(result.session.status).not.toBe('error');
  });

  it('handles empty file', async () => {
    tempPath = createTempFixture('');

    const result = await parseOpenClawSession(tempPath, 'test-project');

    // No messages
    expect(result.messages.length).toBe(0);
    // No errors
    expect(result.errors.length).toBe(0);
    // Session exists with valid defaults
    expect(result.session).toBeDefined();
    expect(result.session.metrics.messageCount).toBe(0);
  });

  it('handles file with only blank lines', async () => {
    tempPath = createTempFixture('\n\n   \n\n');

    const result = await parseOpenClawSession(tempPath, 'test-project');

    expect(result.messages.length).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  it('handles lines with type !== message gracefully (skips with warning)', async () => {
    const content = [
      '{"type":"session","session":"test","timestamp":"2025-01-01T00:00:00Z","model":"test-model"}',
      '{"type":"message","message":{"role":"user","content":"actual message"},"session":"test","timestamp":"2025-01-01T00:00:01Z"}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseOpenClawSession(tempPath, 'test-project');

    // Non-message type is skipped
    expect(result.messages.length).toBe(1);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings[0]).toContain('Skipping non-message type');
  });

  it('handles missing message field on a message-type line', async () => {
    const content = [
      '{"type":"message","session":"test","timestamp":"2025-01-01T00:00:00Z"}',
      '{"type":"message","message":{"role":"user","content":"valid"},"session":"test","timestamp":"2025-01-01T00:00:01Z"}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseOpenClawSession(tempPath, 'test-project');

    // Missing message field → error recorded
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0].error).toContain('Missing message field');
    // Still parse valid lines
    expect(result.messages.length).toBe(1);
  });

  it('handles deeply nested malformed JSON without stack overflow', async () => {
    // Create a line that is valid JSON but excessively nested
    const nested = '{"type":"message","message":{"role":"user","content":"' + 'x'.repeat(5000) + '"}}';
    tempPath = createTempFixture(nested);

    const result = await parseOpenClawSession(tempPath, 'test-project');

    // Should not throw — should parse successfully
    expect(result.session).toBeDefined();
    expect(result.messages.length).toBe(1);
  });
});
