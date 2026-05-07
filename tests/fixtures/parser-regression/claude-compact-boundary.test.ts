import { describe, it, expect, afterEach } from 'vitest';
import { parseClaudeSession } from '@/ingest/parser/claude';
import { createTempFixture, cleanupTempFixture } from '@/tests/helpers/temp-fixture';

describe('Claude parser — compact boundary handling', () => {
  let tempPath: string | null = null;

  afterEach(() => {
    if (tempPath) {
      cleanupTempFixture(tempPath);
      tempPath = null;
    }
  });

  it('emits system messages for compact events between user/assistant messages', async () => {
    const content = [
      '{"uuid":"msg-1","type":"assistant","message":{"role":"assistant","content":"Long response that fills context"}}',
      '{"uuid":"compact-1","type":"compact","message":{"role":"system","content":"[compact] Session compacted, retaining summary"},"timestamp":"2025-01-01T00:05:00Z"}',
      '{"uuid":"msg-3","type":"user","message":{"role":"user","content":"Question after compact"}}',
      '{"uuid":"msg-4","type":"assistant","message":{"role":"assistant","content":"Response after compact window"}}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseClaudeSession(tempPath, 'test-project');

    // Should have 4 messages (2 regular + 1 compact/system + 2 after)
    expect(result.messages.length).toBe(4);
    // System message from compact should exist
    const systemMessages = result.messages.filter(m => m.role === 'system');
    expect(systemMessages.length).toBeGreaterThanOrEqual(1);
    expect(systemMessages[0].content).toContain('compacted');
    // Subsequent user/assistant messages are NOT swallowed
    const userMessages = result.messages.filter(m => m.role === 'user');
    expect(userMessages.length).toBe(1);
    expect(userMessages[0].content).toBe('Question after compact');
    const assistantMessages = result.messages.filter(m => m.role === 'assistant');
    expect(assistantMessages.length).toBe(2);
  });

  it('handles multiple compact events throughout a session', async () => {
    const content = [
      '{"uuid":"a-1","type":"user","message":{"role":"user","content":"Start"}}',
      '{"uuid":"a-2","type":"assistant","message":{"role":"assistant","content":"Response 1"}}',
      '{"uuid":"c-1","type":"compact","message":{"role":"system","content":"[compact] First compaction"}}',
      '{"uuid":"a-3","type":"user","message":{"role":"user","content":"Middle"}}',
      '{"uuid":"c-2","type":"compact","message":{"role":"system","content":"[compact] Second compaction"}}',
      '{"uuid":"a-4","type":"user","message":{"role":"user","content":"End"}}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseClaudeSession(tempPath, 'test-project');

    // All 6 lines produce messages
    expect(result.messages.length).toBe(6);
    // 2 compact events → 2 system messages
    const systemMessages = result.messages.filter(m => m.role === 'system');
    expect(systemMessages.length).toBe(2);
    // Compact events don't swallow messages
    expect(result.messages.filter(m => m.role === 'user').length).toBe(3);
  });

  it('handles compact event without consuming preceding messages', async () => {
    const content = [
      '{"uuid":"m-1","type":"user","message":{"role":"user","content":"Critical context before compact"}}',
      '{"uuid":"m-2","type":"assistant","message":{"role":"assistant","content":"Assistant reply with context-dependent answer"}}',
      '{"uuid":"c-1","type":"compact","message":{"role":"system","content":"[compact] Context window compacted"},"timestamp":"2025-01-01T01:00:00Z"}',
      '{"uuid":"m-3","type":"user","message":{"role":"user","content":"Follow up question"}}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseClaudeSession(tempPath, 'test-project');

    // Pre-compact messages are preserved
    expect(result.messages.filter(m => m.role === 'user').length).toBe(2);
    expect(result.messages.filter(m => m.role === 'assistant').length).toBe(1);
    // System message for compact
    expect(result.messages.filter(m => m.role === 'system').length).toBe(1);
    // Total: 4 messages
    expect(result.messages.length).toBe(4);
    // Session marks isTruncated
    expect(result.session.metrics.isTruncated).toBe(true);
  });

  it('handles truncatedUuids in compact event metadata', async () => {
    const content = [
      '{"uuid":"keep-me-1","type":"user","message":{"role":"user","content":"Important question"}}',
      '{"uuid":"trunc-1","type":"assistant","message":{"role":"assistant","content":"Very long response getting truncated"}}',
      '{"uuid":"trunc-2","type":"assistant","message":{"role":"assistant","content":"More truncated content"}}',
      '{"uuid":"compact-event","type":"compact","compact":{"truncatedUuids":["trunc-1","trunc-2"]},"timestamp":"2025-01-01T02:00:00Z"}',
      '{"uuid":"keep-me-2","type":"user","message":{"role":"user","content":"Post-compact question"}}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseClaudeSession(tempPath, 'test-project');

    // System message for compact with truncated UUID info
    const systemMessages = result.messages.filter(m => m.role === 'system');
    expect(systemMessages.length).toBeGreaterThanOrEqual(1);
    // Compact content references truncated UUIDs
    expect(systemMessages[0].content).toContain('trunc-1');
    expect(systemMessages[0].content).toContain('trunc-2');
    // isTruncated is set when compact boundaries exist
    expect(result.session.metrics.isTruncated).toBe(true);
  });

  it('handles compact event with no preceding user/assistant (edge case)', async () => {
    // Compact is the first event in the session (unlikely but should not crash)
    const content = [
      '{"uuid":"c-first","type":"compact","message":{"role":"system","content":"[compact] Early compaction"}}',
      '{"uuid":"m-first","type":"user","message":{"role":"user","content":"Actual first message"}}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseClaudeSession(tempPath, 'test-project');

    // Should not crash
    expect(result.session).toBeDefined();
    // Compact produces a system message
    const systemMessages = result.messages.filter(m => m.role === 'system');
    expect(systemMessages.length).toBe(1);
    // User message still parsed
    expect(result.messages.filter(m => m.role === 'user').length).toBe(1);
  });

  it('compact boundary does not lose message ordering (system message at correct position)', async () => {
    const content = [
      '{"uuid":"pre-1","type":"user","message":{"role":"user","content":"Before compact"}}',
      '{"uuid":"pre-2","type":"assistant","message":{"role":"assistant","content":"Pre-compact reply"}}',
      '{"uuid":"comp-1","type":"compact","message":{"role":"system","content":"[compact] Compaction at midpoint"}}',
      '{"uuid":"post-1","type":"user","message":{"role":"user","content":"After compact"}}',
      '{"uuid":"post-2","type":"assistant","message":{"role":"assistant","content":"Post-compact reply"}}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseClaudeSession(tempPath, 'test-project');

    // Verify ordering: messages appear in file order
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].content).toBe('Before compact');
    expect(result.messages[1].role).toBe('assistant');
    expect(result.messages[1].content).toBe('Pre-compact reply');
    expect(result.messages[2].role).toBe('system');
    expect(result.messages[2].content).toContain('compacted');
    expect(result.messages[3].role).toBe('user');
    expect(result.messages[3].content).toBe('After compact');
    expect(result.messages[4].role).toBe('assistant');
    expect(result.messages[4].content).toBe('Post-compact reply');
  });
});
