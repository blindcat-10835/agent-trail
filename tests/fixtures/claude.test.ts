import { describe, it, expect } from 'vitest';
import { parseClaudeSession, parseClaudeMessage } from '../../ingest/parser/claude';
import { SessionContext, ParseResult } from '../../ingest/parser/types';
import { TraceSession, TraceMessage, TraceToolCall } from '../../types/trace';
import * as path from 'path';
import * as fs from 'fs';

const FIXTURE_DIR = path.join(__dirname, 'claude');

describe('Claude Code Parser', () => {
  it('parses a basic Claude session with user and assistant messages', async () => {
    const fixturePath = path.join(FIXTURE_DIR, 'basic-session.jsonl');
    if (!fs.existsSync(fixturePath)) {
      const content = [
        JSON.stringify({ uuid: 'msg-1', type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: '2024-01-01T00:00:00Z' }),
        JSON.stringify({ uuid: 'msg-2', type: 'assistant', message: { role: 'assistant', content: 'Hi there!', model: 'claude-3', usage: { input_tokens: 10, output_tokens: 5 } }, timestamp: '2024-01-01T00:00:01Z' }),
      ].join('\n');
      fs.writeFileSync(fixturePath, content);
    }

    const result = await parseClaudeSession(fixturePath, 'test-project');

    expect(result.session.source).toBe('claude-code');
    expect(result.messages.length).toBe(2);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].content).toBe('Hello');
    expect(result.messages[1].role).toBe('assistant');
    expect(result.messages[1].model).toBe('claude-3');
    expect(result.errors.length).toBe(0);
  });

  it('deduplicates streaming messages by UUID, keeping first occurrence', async () => {
    const fixturePath = path.join(FIXTURE_DIR, 'streaming-dedup.jsonl');
    if (!fs.existsSync(fixturePath)) {
      const content = [
        JSON.stringify({ uuid: 'msg-1', type: 'assistant', message: { role: 'assistant', content: 'partial response...' } }),
        JSON.stringify({ uuid: 'msg-1', type: 'assistant', message: { role: 'assistant', content: 'partial response... more' } }),
        JSON.stringify({ uuid: 'msg-1', type: 'assistant', message: { role: 'assistant', content: 'full response here' } }),
        JSON.stringify({ uuid: 'msg-2', type: 'user', message: { role: 'user', content: 'next question' } }),
      ].join('\n');
      fs.writeFileSync(fixturePath, content);
    }

    const result = await parseClaudeSession(fixturePath, 'test-project');

    // Only 2 unique messages (msg-1 first occurrence + msg-2)
    expect(result.messages.length).toBe(2);
    // First msg-1 retained, duplicates warned
    expect(result.messages[0].content).toBe('partial response...');
    expect(result.warnings.some(w => w.includes('Duplicate UUID'))).toBe(true);
  });

  it('resolves DAG parentUuid to parentSessionId', async () => {
    const fixturePath = path.join(FIXTURE_DIR, 'dag-fork.jsonl');
    if (!fs.existsSync(fixturePath)) {
      const content = [
        JSON.stringify({ uuid: 'root-1', type: 'assistant', message: { role: 'assistant', content: 'Root message' }, session: { id: 'sess-root', type: 'root' } }),
        JSON.stringify({ uuid: 'child-1', parentUuid: 'root-1', type: 'assistant', message: { role: 'assistant', content: 'Forked message' }, session: { id: 'sess-child', type: 'fork', parentId: 'sess-root' } }),
      ].join('\n');
      fs.writeFileSync(fixturePath, content);
    }

    const result = await parseClaudeSession(fixturePath, 'test-project');

    // Child session should reference parent via fork relationship
    expect(result.session.relationshipType).toBeDefined();
    expect(result.session.relationshipType).toBe('fork');
    expect(result.session.parentSessionId).toBe('sess-root');
  });

  it('handles compact boundaries by emitting system messages', async () => {
    const fixturePath = path.join(FIXTURE_DIR, 'compact-boundary.jsonl');
    if (!fs.existsSync(fixturePath)) {
      const content = [
        JSON.stringify({ uuid: 'msg-1', type: 'assistant', message: { role: 'assistant', content: 'Long response that will be compacted' } }),
        JSON.stringify({ uuid: 'compact-1', type: 'compact', message: { role: 'system', content: '[compact] Session compacted, retaining summary' }, timestamp: '2024-01-01T00:05:00Z' }),
        JSON.stringify({ uuid: 'msg-3', type: 'user', message: { role: 'user', content: 'Question after compact' } }),
      ].join('\n');
      fs.writeFileSync(fixturePath, content);
    }

    const result = await parseClaudeSession(fixturePath, 'test-project');

    // Should have 3 messages (including compact/system)
    expect(result.messages.length).toBe(3);
    // System message from compact should exist
    const systemMessages = result.messages.filter(m => m.role === 'system');
    expect(systemMessages.length).toBeGreaterThanOrEqual(1);
    expect(systemMessages[0].content).toContain('compacted');
  });

  it('maps subagent sessions with correct parentSessionId', async () => {
    const fixturePath = path.join(FIXTURE_DIR, 'subagent.jsonl');
    if (!fs.existsSync(fixturePath)) {
      const content = [
        JSON.stringify({ uuid: 'agent-1', type: 'assistant', message: { role: 'assistant', content: 'Spawning subagent...' }, session: { id: 'parent-sess', type: 'root' } }),
        JSON.stringify({ uuid: 'sub-1', type: 'assistant', message: { role: 'assistant', content: 'Subagent work' }, session: { id: 'child-sess', type: 'subagent', parentId: 'parent-sess' } }),
      ].join('\n');
      fs.writeFileSync(fixturePath, content);
    }

    const result = await parseClaudeSession(fixturePath, 'test-project');

    expect(result.session.parentSessionId).toBeDefined();
    expect(result.session.parentSessionId).toBe('parent-sess');
    expect(result.session.relationshipType).toBe('subagent');
  });

  it('recovers from malformed JSON lines without aborting', async () => {
    const fixturePath = path.join(FIXTURE_DIR, 'malformed.jsonl');
    if (!fs.existsSync(fixturePath)) {
      const content = [
        JSON.stringify({ uuid: 'msg-1', type: 'user', message: { role: 'user', content: 'Valid message' } }),
        'this is not valid json {{{',
        JSON.stringify({ uuid: 'msg-3', type: 'assistant', message: { role: 'assistant', content: 'Another valid message' } }),
      ].join('\n');
      fs.writeFileSync(fixturePath, content);
    }

    const result = await parseClaudeSession(fixturePath, 'test-project');

    expect(result.messages.length).toBe(2); // Both valid messages
    expect(result.errors.length).toBe(1);    // One malformed line
    expect(result.errors[0].line).toBe(2);
  });

  it('extracts tool calls from assistant messages with tool_use blocks', async () => {
    const fixturePath = path.join(FIXTURE_DIR, 'tool-calls.jsonl');
    if (!fs.existsSync(fixturePath)) {
      const content = [
        JSON.stringify({ uuid: 'tool-1', type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Let me check...' }, { type: 'tool_use', id: 'toolu_01', name: 'Bash', input: { command: 'ls' } }], model: 'claude-3' } }),
      ].join('\n');
      fs.writeFileSync(fixturePath, content);
    }

    const result = await parseClaudeSession(fixturePath, 'test-project');

    expect(result.activities.length).toBeGreaterThanOrEqual(1);
    const toolCall = result.activities.find(a => a.type === 'tool_call') as TraceToolCall;
    expect(toolCall).toBeDefined();
    expect(toolCall.name).toBe('Bash');
    expect(toolCall.inputJson).toContain('ls');
  });

  it('parseClaudeMessage returns TraceMessage for valid line, null for invalid', () => {
    const context: SessionContext = {
      sessionKey: 'test-key',
      uuid: 'test-uuid',
      project: 'test',
      filePath: '/fake/path.jsonl',
      fileMtime: Date.now(),
    };

    const validLine = JSON.stringify({ uuid: 'msg-1', type: 'user', message: { role: 'user', content: 'Hello' } });
    const result = parseClaudeMessage(validLine, context);
    expect(result).not.toBeNull();
    expect(result!.role).toBe('user');
    expect(result!.content).toBe('Hello');

    const invalidLine = 'not json';
    expect(parseClaudeMessage(invalidLine, context)).toBeNull();

    const noMessage = JSON.stringify({ uuid: 'msg-1', type: 'system' });
    expect(parseClaudeMessage(noMessage, context)).toBeNull();
  });
});
