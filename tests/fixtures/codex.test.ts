import { describe, it, expect } from 'vitest';
import { parseCodexSession, parseCodexMessage } from '../../ingest/parser/codex';
import { SessionContext } from '../../ingest/parser/types';
import { TraceToolCall, TraceSubagentLink } from '../../types/trace';
import * as path from 'path';
import * as fs from 'fs';

const FIXTURE_DIR = path.join(__dirname, 'codex');

describe('Codex Parser', () => {
  it('parses basic Codex session with turn_context and response_items', async () => {
    const fixturePath = path.join(FIXTURE_DIR, 'basic-session.jsonl');
    if (!fs.existsSync(fixturePath)) {
      const content = [
        JSON.stringify({ type: 'session_meta', session_meta: { session_id: 'codex-sess-1', cwd: '/project', model: 'gpt-4' } }),
        JSON.stringify({ type: 'turn_context', turn_context: { turn_id: 'turn-1', model: 'gpt-4', started_at: '2024-01-01T00:00:00Z' } }),
        JSON.stringify({ type: 'response_item', response_item: { type: 'input_text', input_text: 'What is TypeScript?', token_count: 5 } }),
        JSON.stringify({ type: 'response_item', response_item: { type: 'text', text: 'TypeScript is a typed superset of JavaScript.', token_count: 12 } }),
      ].join('\n');
      fs.writeFileSync(fixturePath, content);
    }

    const result = await parseCodexSession(fixturePath, 'test-project');

    expect(result.session.source).toBe('codex');
    expect(result.messages.length).toBe(2);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].content).toBe('What is TypeScript?');
    expect(result.messages[1].role).toBe('assistant');
    expect(result.messages[1].content).toBe('TypeScript is a typed superset of JavaScript.');
    expect(result.errors.length).toBe(0);
  });

  it('correctly maps response_item types to canonical roles', async () => {
    const fixturePath = path.join(FIXTURE_DIR, 'response-mapping.jsonl');
    if (!fs.existsSync(fixturePath)) {
      const content = [
        JSON.stringify({ type: 'session_meta', session_meta: { session_id: 's1' } }),
        JSON.stringify({ type: 'turn_context', turn_context: { turn_id: 't1', model: 'gpt-4' } }),
        JSON.stringify({ type: 'response_item', response_item: { type: 'input_text', input_text: 'User question' } }),
        JSON.stringify({ type: 'response_item', response_item: { type: 'text', text: 'Assistant answer' } }),
      ].join('\n');
      fs.writeFileSync(fixturePath, content);
    }

    const result = await parseCodexSession(fixturePath, 'test-project');

    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].content).toBe('User question');
    expect(result.messages[1].role).toBe('assistant');
    expect(result.messages[1].content).toBe('Assistant answer');
  });

  it('extracts function_call response_items as TraceToolCall activities', async () => {
    const fixturePath = path.join(FIXTURE_DIR, 'function-call.jsonl');
    if (!fs.existsSync(fixturePath)) {
      const content = [
        JSON.stringify({ type: 'session_meta', session_meta: { session_id: 's1' } }),
        JSON.stringify({ type: 'turn_context', turn_context: { turn_id: 't1', model: 'gpt-4' } }),
        JSON.stringify({ type: 'response_item', response_item: { type: 'function_call', call_id: 'call_01', name: 'read_file', arguments: '{"path":"/src/index.ts"}', token_count: 8 } }),
        JSON.stringify({ type: 'event_msg', event_msg: { type: 'function_call_output', call_id: 'call_01', content: 'export const x = 1;', status: 'completed' } }),
      ].join('\n');
      fs.writeFileSync(fixturePath, content);
    }

    const result = await parseCodexSession(fixturePath, 'test-project');

    expect(result.activities.length).toBeGreaterThanOrEqual(1);
    const toolCall = result.activities.find(a => a.type === 'tool_call') as TraceToolCall;
    expect(toolCall).toBeDefined();
    expect(toolCall.name).toBe('read_file');
    expect(toolCall.inputJson).toContain('/src/index.ts');
  });

  it('deduplicates streaming messages by token_count, keeping highest count', async () => {
    const fixturePath = path.join(FIXTURE_DIR, 'token-dedup.jsonl');
    if (!fs.existsSync(fixturePath)) {
      // Use identical content for dedup to trigger (key = text:<content>)
      const content = [
        JSON.stringify({ type: 'session_meta', session_meta: { session_id: 's1' } }),
        JSON.stringify({ type: 'turn_context', turn_context: { turn_id: 't1', model: 'gpt-4' } }),
        JSON.stringify({ type: 'response_item', response_item: { type: 'text', text: 'streaming response', token_count: 3 } }),
        JSON.stringify({ type: 'response_item', response_item: { type: 'text', text: 'streaming response', token_count: 5 } }),
        JSON.stringify({ type: 'response_item', response_item: { type: 'text', text: 'streaming response', token_count: 2 } }),
      ].join('\n');
      fs.writeFileSync(fixturePath, content);
    }

    const result = await parseCodexSession(fixturePath, 'test-project');

    // Only one assistant message (highest token_count wins)
    const assistantMessages = result.messages.filter(m => m.role === 'assistant');
    expect(assistantMessages.length).toBe(1);
    expect(assistantMessages[0].content).toBe('streaming response');
    // The dedup replaced lower token_count, so the surviving version had token_count 5
    expect(result.warnings.some(w => w.includes('lower token_count'))).toBe(true);
  });

  it('creates TraceSubagentLink for spawn_agent events', async () => {
    const fixturePath = path.join(FIXTURE_DIR, 'spawn-agent.jsonl');
    if (!fs.existsSync(fixturePath)) {
      const content = [
        JSON.stringify({ type: 'session_meta', session_meta: { session_id: 's1' } }),
        JSON.stringify({ type: 'turn_context', turn_context: { turn_id: 't1', model: 'gpt-4' } }),
        JSON.stringify({ type: 'spawn_agent', spawn_agent: { session_id: 'child-sess-1', type: 'spawned' } }),
      ].join('\n');
      fs.writeFileSync(fixturePath, content);
    }

    const result = await parseCodexSession(fixturePath, 'test-project');

    const subagentLink = result.activities.find(a => a.type === 'subagent_link') as TraceSubagentLink;
    expect(subagentLink).toBeDefined();
    expect(subagentLink.subagentSessionId).toBe('child-sess-1');
    expect(subagentLink.relationship).toBe('spawned');
  });

  it('uses turn_context model for subsequent response_items', async () => {
    const fixturePath = path.join(FIXTURE_DIR, 'turn-context-model.jsonl');
    if (!fs.existsSync(fixturePath)) {
      const content = [
        JSON.stringify({ type: 'session_meta', session_meta: { session_id: 's1' } }),
        JSON.stringify({ type: 'turn_context', turn_context: { turn_id: 't1', model: 'gpt-4-turbo' } }),
        JSON.stringify({ type: 'response_item', response_item: { type: 'text', text: 'Response with model from turn_context' } }),
      ].join('\n');
      fs.writeFileSync(fixturePath, content);
    }

    const result = await parseCodexSession(fixturePath, 'test-project');

    expect(result.messages[0].model).toBe('gpt-4-turbo');
  });

  it('recovers from malformed JSON lines', async () => {
    const fixturePath = path.join(FIXTURE_DIR, 'malformed.jsonl');
    if (!fs.existsSync(fixturePath)) {
      const content = [
        JSON.stringify({ type: 'session_meta', session_meta: { session_id: 's1' } }),
        'garbage line {{{',
        JSON.stringify({ type: 'response_item', response_item: { type: 'text', text: 'Valid after garbage' } }),
      ].join('\n');
      fs.writeFileSync(fixturePath, content);
    }

    const result = await parseCodexSession(fixturePath, 'test-project');

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].line).toBe(2);
    expect(result.messages.length).toBe(1);
  });

  it('parseCodexMessage returns TraceMessage for response_item lines only', () => {
    const context: SessionContext = {
      sessionKey: 'test',
      uuid: 'test-uuid',
      project: 'test',
      filePath: '/fake.jsonl',
      fileMtime: Date.now(),
    };

    const validLine = JSON.stringify({ type: 'response_item', response_item: { type: 'text', text: 'Hello' } });
    expect(parseCodexMessage(validLine, context)).not.toBeNull();

    const nonResponseItem = JSON.stringify({ type: 'session_meta', session_meta: {} });
    expect(parseCodexMessage(nonResponseItem, context)).toBeNull();

    const functionCall = JSON.stringify({ type: 'response_item', response_item: { type: 'function_call', name: 'test' } });
    expect(parseCodexMessage(functionCall, context)).toBeNull(); // function_calls are activities, not messages
  });
});
