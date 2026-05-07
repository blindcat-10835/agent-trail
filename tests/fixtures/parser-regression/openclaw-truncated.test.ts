import { describe, it, expect, afterEach } from 'vitest';
import { parseOpenClawSession } from '@/ingest/parser/openclaw';
import { createTempFixture, cleanupTempFixture } from '@/tests/helpers/temp-fixture';

describe('OpenClaw parser — truncated files', () => {
  let tempPath: string | null = null;

  afterEach(() => {
    if (tempPath) {
      cleanupTempFixture(tempPath);
      tempPath = null;
    }
  });

  it('handles file truncated mid-JSON object without crashing', async () => {
    // File ends with an incomplete JSON object (no closing brace)
    const content = [
      '{"type":"message","message":{"role":"user","content":"first message"},"session":"test","timestamp":"2025-01-01T00:00:00Z"}',
      '{"type":"message","message":{"role":"assistant","content":"second message"},"session":"test","timestamp":"2025-01-01T00:00:01Z"}',
      '{"type":"message","message":{"role":"user","content":"this line is trunc', // intentionally incomplete
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseOpenClawSession(tempPath, 'test-project');

    // Should not throw — must return a ParseResult
    expect(result.session).toBeDefined();
    // First two valid lines are parsed
    expect(result.messages.length).toBeGreaterThanOrEqual(1);
    // Truncated line produces an error (JSON parse failure)
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    // Session metrics reflect the error
    expect(result.session.metrics.parserMalformedLines).toBeGreaterThanOrEqual(1);
  });

  it('handles file ending with a zero-length line gracefully', async () => {
    const content = [
      '{"type":"message","message":{"role":"user","content":"only message"},"session":"test","timestamp":"2025-01-01T00:00:00Z"}',
      '', // empty line at end
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseOpenClawSession(tempPath, 'test-project');

    // Empty line should be skipped (trimmed)
    expect(result.messages.length).toBe(1);
    expect(result.errors.length).toBe(0);
  });

  it('handles file with only a partial JSON line', async () => {
    tempPath = createTempFixture('{"type":"message","message":{"role":"user","content":"hello');

    const result = await parseOpenClawSession(tempPath, 'test-project');

    // Should not throw
    expect(result.session).toBeDefined();
    // No valid messages, but partial line generates an error
    expect(result.messages.length).toBe(0);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    // Session is still valid (not error status from file-not-found)
    expect(result.session.status).not.toBe('error');
  });

  it('handles truncated file ending mid-line with multiple previous valid lines', async () => {
    // Simulate a large session file that gets truncated during write
    const lines: string[] = [];
    for (let i = 0; i < 50; i++) {
      lines.push(JSON.stringify({
        type: 'message',
        message: {
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'data '.repeat(10)}`,
        },
        session: 'test-session',
        timestamp: `2025-01-01T00:${String(i).padStart(2, '0')}:00Z`,
      }));
    }
    // Add a completely broken last line
    lines.push('{"type":"message","message":{"role":"user","content":"this is truncated');
    tempPath = createTempFixture(lines.join('\n'));

    const result = await parseOpenClawSession(tempPath, 'test-project');

    // All 50 valid lines should be parsed
    expect(result.messages.length).toBe(50);
    // Last truncated line is an error
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    // No crash
    expect(result.session).toBeDefined();
  });

  it('handles file ending with only whitespace after last valid line', async () => {
    const content = [
      '{"type":"message","message":{"role":"user","content":"last valid"},"session":"test","timestamp":"2025-01-01T00:00:00Z"}',
      '   ',
      '\t',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseOpenClawSession(tempPath, 'test-project');

    // Whitespace-only lines are skipped
    expect(result.messages.length).toBe(1);
    expect(result.errors.length).toBe(0);
  });
});
