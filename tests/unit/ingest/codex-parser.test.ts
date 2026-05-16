import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdtempSync, unlinkSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  parseCodexSession,
  parseCodexMessage,
} from '@/ingest/parser/codex';
import type { TraceToolCall } from '@/types/trace';

let tempDir: string;
let tempFile: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'codex-parser-test-'));
});

afterAll(() => {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function writeFixture(fileName: string, content: string): string {
  const filePath = join(tempDir, fileName);
  writeFileSync(filePath, content);
  return filePath;
}

describe('Codex parser — parseCodexSession()', () => {
  describe('Test 1: Valid Codex JSONL produces ParseResult', () => {
    it('should return ParseResult with source="codex", non-zero messages, empty errors', async () => {
      const jsonl = [
        '{"type":"session_meta","session_meta":{"session_id":"codex-test-001","model":"gpt-5"}}',
        '{"type":"turn_context","turn_context":{"turn_id":"turn-1","model":"gpt-5"}}',
        '{"type":"response_item","response_item":{"type":"input_text","input_text":"Hello Codex","token_count":2}}',
        '{"type":"response_item","response_item":{"type":"text","text":"Hello! How can I help?","token_count":5}}',
      ].join('\n');

      const filePath = writeFixture('valid-session.jsonl', jsonl);
      const result = await parseCodexSession(filePath, 'test-project');

      expect(result).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.session.source).toBe('codex');
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('Test 2: input_text → TraceMessage (user)', () => {
    it('should map input_text response_item to role="user"', async () => {
      const jsonl = [
        '{"type":"session_meta","session_meta":{"session_id":"codex-test-002","model":"gpt-5"}}',
        '{"type":"response_item","response_item":{"type":"input_text","input_text":"What is the weather?","token_count":4}}',
      ].join('\n');

      const filePath = writeFixture('input-text.jsonl', jsonl);
      const result = await parseCodexSession(filePath, 'test-project');

      expect(result.messages.length).toBe(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('What is the weather?');
    });
  });

  describe('Current Codex payload JSONL format', () => {
    it('should parse payload-based session_meta, turn_context, and message response items', async () => {
      const jsonl = [
        '{"timestamp":"2026-05-07T01:00:00.000Z","type":"session_meta","payload":{"id":"codex-payload-001","cwd":"/Users/alice/code/my-api","model_provider":"openai"}}',
        '{"timestamp":"2026-05-07T01:00:01.000Z","type":"turn_context","payload":{"cwd":"/Users/alice/code/my-api","model":"gpt-5-codex"}}',
        '{"timestamp":"2026-05-07T01:00:02.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Build the dashboard"}]}}',
        '{"timestamp":"2026-05-07T01:00:03.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"I will build it."}]}}',
      ].join('\n');

      const filePath = writeFixture('payload-format.jsonl', jsonl);
      const result = await parseCodexSession(filePath, '01');

      expect(result.session.id).toBe('codex-payload-001');
      expect(result.session.project).toBe('/Users/alice/code/my-api');
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('Build the dashboard');
      expect(result.messages[0].sourceMetadata.cwd).toBe('/Users/alice/code/my-api');
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[1].model).toBe('gpt-5-codex');
    });

    it('should use event_msg user_message as canonical user input and skip injected metadata', async () => {
      const jsonl = [
        '{"timestamp":"2026-05-08T14:52:18.211Z","type":"session_meta","payload":{"id":"codex-real-turn-001","cwd":"/repo","model_provider":"openai"}}',
        '{"timestamp":"2026-05-08T14:52:18.212Z","type":"event_msg","payload":{"type":"user_message","message":"<subagent_notification> {\\"agent_path\\":\\"child-thread\\",\\"status\\":{\\"completed\\":\\"done\\"}} </subagent_notification>","images":[]}}',
        '{"timestamp":"2026-05-08T14:52:18.219Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-a"}}',
        '{"timestamp":"2026-05-08T14:52:18.220Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"# AGENTS.md instructions for /repo\\n<environment_context>...</environment_context>"}]}}',
        '{"timestamp":"2026-05-08T14:52:18.221Z","type":"turn_context","payload":{"turn_id":"turn-a","cwd":"/repo","model":"gpt-5"}}',
        '{"timestamp":"2026-05-08T14:52:18.222Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"$gsd-debug reproduce this"}]}}',
        '{"timestamp":"2026-05-08T14:52:18.223Z","type":"event_msg","payload":{"type":"user_message","message":"$gsd-debug reproduce this","images":[]}}',
        '{"timestamp":"2026-05-08T14:52:19.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Investigating."}]}}',
        '{"timestamp":"2026-05-08T14:53:00.000Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-b"}}',
        '{"timestamp":"2026-05-08T14:53:00.001Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"<skill>large skill body</skill>"}]}}',
        '{"timestamp":"2026-05-08T14:53:00.002Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"continue"}]}}',
        '{"timestamp":"2026-05-08T14:53:00.003Z","type":"event_msg","payload":{"type":"user_message","message":"continue","images":[]}}',
      ].join('\n');

      const filePath = writeFixture('payload-event-user-message.jsonl', jsonl);
      const result = await parseCodexSession(filePath, 'fallback');
      const userMessages = result.messages.filter((message) => message.role === 'user');

      expect(userMessages.map((message) => message.content)).toEqual([
        '$gsd-debug reproduce this',
        'continue',
      ]);
      expect(userMessages.every((message) => message.isRealUserInput)).toBe(true);
      expect(userMessages.map((message) => message.turnId)).toEqual(['turn-a', 'turn-b']);
      expect(result.messages.map((message) => message.content).join('\n')).not.toContain('AGENTS.md');
      expect(result.messages.map((message) => message.content).join('\n')).not.toContain('<skill>');
      expect(result.messages.map((message) => message.content).join('\n')).not.toContain('subagent_notification');
    });

    it('captures session token totals from token_count event messages', async () => {
      const jsonl = [
        '{"timestamp":"2026-05-08T14:52:18.211Z","type":"session_meta","payload":{"id":"codex-token-001","cwd":"/repo","model_provider":"openai"}}',
        '{"timestamp":"2026-05-08T14:52:18.219Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-a"}}',
        '{"timestamp":"2026-05-08T14:52:18.221Z","type":"turn_context","payload":{"turn_id":"turn-a","cwd":"/repo","model":"gpt-5.5"}}',
        '{"timestamp":"2026-05-08T14:52:19.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Investigating."}]}}',
        '{"timestamp":"2026-05-08T14:52:19.100Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":1200,"cached_input_tokens":0,"output_tokens":34,"reasoning_output_tokens":21,"total_tokens":1234},"last_token_usage":{"input_tokens":1200,"cached_input_tokens":0,"output_tokens":34,"reasoning_output_tokens":21,"total_tokens":1234},"model_context_window":258400}}}',
      ].join('\n');

      const filePath = writeFixture('payload-token-usage.jsonl', jsonl);
      const result = await parseCodexSession(filePath, 'fallback');

      expect(result.session.metrics.inputTokens).toBe(1200);
      expect(result.session.metrics.outputTokens).toBe(34);
      expect(result.session.metrics.cacheReadTokens).toBe(0);
      expect(result.session.metrics.reasoningTokens).toBe(21);
      expect(result.session.metrics.totalTokens).toBe(1234);
    });

    it('treats Codex cached input and reasoning as overlap breakdowns', async () => {
      const jsonl = [
        '{"timestamp":"2026-05-08T14:52:18.211Z","type":"session_meta","payload":{"id":"codex-overlap-001","cwd":"/repo","model_provider":"openai"}}',
        '{"timestamp":"2026-05-08T14:52:18.221Z","type":"turn_context","payload":{"turn_id":"turn-a","cwd":"/repo","model":"gpt-5.5"}}',
        '{"timestamp":"2026-05-08T14:52:19.100Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":1200,"cached_input_tokens":300,"output_tokens":400,"reasoning_output_tokens":125,"total_tokens":1600},"last_token_usage":{"input_tokens":1200,"cached_input_tokens":300,"output_tokens":400,"reasoning_output_tokens":125,"total_tokens":1600}}}}',
      ].join('\n');

      const filePath = writeFixture('payload-token-overlap.jsonl', jsonl);
      const result = await parseCodexSession(filePath, 'fallback');

      expect(result.session.metrics.inputTokens).toBe(1200);
      expect(result.session.metrics.outputTokens).toBe(400);
      expect(result.session.metrics.cacheReadTokens).toBe(300);
      expect(result.session.metrics.reasoningTokens).toBe(125);
      expect(result.session.metrics.totalTokens).toBe(1600);
    });

    it('should deduplicate image-wrapper response_item users against canonical event user messages', async () => {
      const jsonl = [
        '{"timestamp":"2026-05-08T14:52:18.211Z","type":"session_meta","payload":{"id":"codex-image-user-001","cwd":"/repo","model_provider":"openai"}}',
        '{"timestamp":"2026-05-08T14:52:18.219Z","type":"event_msg","payload":{"type":"task_started","turn_id":"turn-image"}}',
        '{"timestamp":"2026-05-08T14:52:18.220Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"<image name=[Image #1]>\\n</image>\\n$gsd-code-review check parsing"}]}}',
        '{"timestamp":"2026-05-08T14:52:18.221Z","type":"event_msg","payload":{"type":"user_message","message":"$gsd-code-review check parsing","images":["image-1"]}}',
        '{"timestamp":"2026-05-08T14:52:19.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Checking."}]}}',
      ].join('\n');

      const filePath = writeFixture('payload-event-user-image-wrapper.jsonl', jsonl);
      const result = await parseCodexSession(filePath, 'fallback');
      const userMessages = result.messages.filter((message) => message.role === 'user');

      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].content).toBe('$gsd-code-review check parsing');
      expect(userMessages[0].turnId).toBe('turn-image');
    });
  });

  describe('Test 3: text → TraceMessage (assistant)', () => {
    it('should map text response_item to role="assistant"', async () => {
      const jsonl = [
        '{"type":"session_meta","session_meta":{"session_id":"codex-test-003","model":"gpt-5"}}',
        '{"type":"response_item","response_item":{"type":"text","text":"The weather is sunny.","token_count":5}}',
      ].join('\n');

      const filePath = writeFixture('text-assistant.jsonl', jsonl);
      const result = await parseCodexSession(filePath, 'test-project');

      expect(result.messages.length).toBe(1);
      expect(result.messages[0].role).toBe('assistant');
      expect(result.messages[0].content).toBe('The weather is sunny.');
    });
  });

  describe('Test 4: function_call → TraceToolCall', () => {
    it('should map function_call response_item to TraceToolCall with correct name and input', async () => {
      const jsonl = [
        '{"type":"session_meta","session_meta":{"session_id":"codex-test-004","model":"gpt-5"}}',
        '{"type":"response_item","response_item":{"type":"function_call","call_id":"call-abc","name":"read_file","arguments":"{\\"path\\":\\"/src/index.ts\\"}","token_count":12}}',
      ].join('\n');

      const filePath = writeFixture('function-call.jsonl', jsonl);
      const result = await parseCodexSession(filePath, 'test-project');

      expect(result.activities.length).toBeGreaterThanOrEqual(1);
      const toolCall = result.activities[0];
      expect(toolCall.type).toBe('tool_call');
      if (toolCall.type === 'tool_call') {
        expect(toolCall.id).toBe('call-abc');
        expect(toolCall.name).toBe('read_file');
        expect(toolCall.inputJson).toBe('{"path":"/src/index.ts"}');
        expect(toolCall.status).toBe('pending');
      }
    });
  });

  describe('Test 5: function_call_output → TraceToolResultEvent', () => {
    it('should link function_call_output to the function call via call_id', async () => {
      const jsonl = [
        '{"type":"session_meta","session_meta":{"session_id":"codex-test-005","model":"gpt-5"}}',
        '{"type":"response_item","response_item":{"type":"function_call","call_id":"call-xyz","name":"bash","arguments":"{\\"command\\":\\"ls\\"}","token_count":8}}',
        '{"type":"event_msg","event_msg":{"type":"function_call_output","call_id":"call-xyz","content":"file1.ts\\nfile2.ts","status":"completed"},"timestamp":"2025-06-01T10:00:01Z"}',
      ].join('\n');

      const filePath = writeFixture('function-output.jsonl', jsonl);
      const result = await parseCodexSession(filePath, 'test-project');

      // Find the tool call with call-xyz
      const toolCalls = result.activities.filter(
        (a) => a.type === 'tool_call'
      );
      expect(toolCalls.length).toBeGreaterThanOrEqual(1);

      const toolCall = toolCalls.find(
        (tc) => tc.type === 'tool_call' && tc.id === 'call-xyz'
      );
      expect(toolCall).toBeDefined();
      if (toolCall && toolCall.type === 'tool_call') {
        expect(toolCall.resultEvents.length).toBe(1);
        expect(toolCall.resultEvents[0].content).toBe('file1.ts\nfile2.ts');
        expect(toolCall.resultEvents[0].isPartial).toBe(false);
      }
    });
  });

  describe('Test 6: Streaming dedup by token_count', () => {
    it('should keep only the highest token_count version of duplicate messages', async () => {
      const jsonl = [
        '{"type":"session_meta","session_meta":{"session_id":"codex-test-006","model":"gpt-5"}}',
        '{"type":"response_item","response_item":{"type":"text","text":"Hello","token_count":1}}',
        '{"type":"response_item","response_item":{"type":"text","text":"Hello","token_count":2}}',
        '{"type":"response_item","response_item":{"type":"text","text":"Hello","token_count":3}}',
        '{"type":"response_item","response_item":{"type":"text","text":"Hello","token_count":2}}',
      ].join('\n');

      const filePath = writeFixture('streaming-dedup.jsonl', jsonl);
      const result = await parseCodexSession(filePath, 'test-project');

      // Should only have 1 message (deduplicated — highest token_count kept)
      expect(result.messages.length).toBe(1);
      expect(result.messages[0].content).toBe('Hello');
    });
  });

  describe('Test 7: spawn_agent → TraceSubagentLink', () => {
    it('should create TraceSubagentLink from spawn_agent event', async () => {
      const jsonl = [
        '{"type":"session_meta","session_meta":{"session_id":"codex-test-007","model":"gpt-5"}}',
        '{"type":"spawn_agent","spawn_agent":{"session_id":"subagent-001","type":"spawned"}}',
      ].join('\n');

      const filePath = writeFixture('spawn-agent.jsonl', jsonl);
      const result = await parseCodexSession(filePath, 'test-project');

      expect(result.activities.length).toBeGreaterThanOrEqual(1);
      const subagentLink = result.activities.find(
        (a) => a.type === 'subagent_link'
      );
      expect(subagentLink).toBeDefined();
      if (subagentLink && subagentLink.type === 'subagent_link') {
        expect(subagentLink.subagentSessionId).toBe('subagent-001');
        expect(subagentLink.subagentSource).toBe('codex');
        expect(subagentLink.relationship).toBe('spawned');
      }
    });
  });

  describe('Test 8: turn_context provides model for subsequent response_items', () => {
    it('should apply turn_context model to messages in that turn', async () => {
      const jsonl = [
        '{"type":"session_meta","session_meta":{"session_id":"codex-test-008","model":"gpt-5"}}',
        '{"type":"turn_context","turn_context":{"turn_id":"turn-1","model":"gpt-5-mini"}}',
        '{"type":"response_item","response_item":{"type":"input_text","input_text":"Hi","token_count":1}}',
        '{"type":"response_item","response_item":{"type":"text","text":"Hello there","token_count":2}}',
      ].join('\n');

      const filePath = writeFixture('turn-context.jsonl', jsonl);
      const result = await parseCodexSession(filePath, 'test-project');

      expect(result.messages.length).toBe(2);
      // Both messages should have model from turn_context
      expect(result.messages[0].model).toBe('gpt-5-mini');
      expect(result.messages[1].model).toBe('gpt-5-mini');
    });
  });

  describe('Test 9: Malformed JSON lines populate errors[]', () => {
    it('should track parse errors without aborting', async () => {
      const jsonl = [
        '{"type":"session_meta","session_meta":{"session_id":"codex-test-009","model":"gpt-5"}}',
        'this is not valid json',
        '{"type":"response_item","response_item":{"type":"input_text","input_text":"Valid message","token_count":2}}',
        '{broken json here',
      ].join('\n');

      const filePath = writeFixture('malformed.jsonl', jsonl);
      const result = await parseCodexSession(filePath, 'test-project');

      // Should have the valid message
      expect(result.messages.length).toBe(1);
      expect(result.messages[0].content).toBe('Valid message');

      // Should have errors for malformed lines
      expect(result.errors.length).toBe(2);
      expect(result.errors[0].line).toBeGreaterThan(0);
      expect(result.errors[0].error).toBeTruthy();
    });
  });
});

describe('Codex parser — parseCodexMessage()', () => {
  describe('Test: parseCodexMessage on valid response_item', () => {
    it('should return TraceMessage with correct role', () => {
      const line =
        '{"type":"response_item","response_item":{"type":"input_text","input_text":"Test input","token_count":2}}';
      const context = {
        sessionKey: 'test-key',
        uuid: 'test-uuid',
        project: 'test-project',
        filePath: '/tmp/test.jsonl',
        fileMtime: Date.now(),
      };

      const result = parseCodexMessage(line, context);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.role).toBe('user');
        expect(result.content).toBe('Test input');
      }
    });
  });

  describe('Test: parseCodexMessage on malformed JSON', () => {
    it('should return null', () => {
      const line = 'not valid json';
      const context = {
        sessionKey: 'test-key',
        uuid: 'test-uuid',
        project: 'test-project',
        filePath: '/tmp/test.jsonl',
        fileMtime: Date.now(),
      };

      const result = parseCodexMessage(line, context);
      expect(result).toBeNull();
    });
  });

  describe('Test: parseCodexMessage on non-response_item line', () => {
    it('should return null gracefully', () => {
      const line =
        '{"type":"session_meta","session_meta":{"session_id":"test-123"}}';
      const context = {
        sessionKey: 'test-key',
        uuid: 'test-uuid',
        project: 'test-project',
        filePath: '/tmp/test.jsonl',
        fileMtime: Date.now(),
      };

      const result = parseCodexMessage(line, context);
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// Plan 08-02 repair tests — fail on OLD code, pass after repair
// ============================================================================

describe('Codex parser — 08-02 repair: function_call_output as response_item', () => {
  it('should pair function_call_output response_item to matching tool call (08-02)', async () => {
    // This shape: response_item.type = "function_call_output" (not event_msg)
    const jsonl = [
      '{"type":"session_meta","session_meta":{"session_id":"codex-rp-001","model":"gpt-5"}}',
      '{"type":"response_item","response_item":{"type":"function_call","call_id":"call-rp-01","name":"read_file","arguments":"{\\"path\\":\\"/x\\"}","token_count":10}}',
      '{"type":"response_item","response_item":{"type":"function_call_output","call_id":"call-rp-01","output":"file contents here","status":"completed"}}',
    ].join('\n');

    const filePath = writeFixture('fc-output-response-item.jsonl', jsonl);
    const result = await parseCodexSession(filePath, 'test-project');

    const toolCalls = result.activities.filter(a => a.type === 'tool_call') as TraceToolCall[];
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].id).toBe('call-rp-01');
    // Result event should come from the response_item function_call_output
    expect(toolCalls[0].resultEvents).toHaveLength(1);
    expect(toolCalls[0].resultEvents[0].content).toBe('file contents here');
    expect(toolCalls[0].status).toBe('success');
  });
});

describe('Codex parser — 08-02 repair: inputJson normalization', () => {
  it('should normalize arguments from input object field (not arguments string) (08-02)', async () => {
    // When Codex sends input as an object, not a stringified arguments field
    const jsonl = [
      '{"type":"session_meta","session_meta":{"session_id":"codex-rp-002","model":"gpt-5"}}',
      '{"type":"response_item","response_item":{"type":"function_call","call_id":"call-rp-02","name":"bash","input":{"command":"ls -la"},"token_count":8}}',
    ].join('\n');

    const filePath = writeFixture('fc-input-normalize.jsonl', jsonl);
    const result = await parseCodexSession(filePath, 'test-project');

    const toolCalls = result.activities.filter(a => a.type === 'tool_call') as TraceToolCall[];
    expect(toolCalls).toHaveLength(1);
    // inputJson should be JSON.stringify of the input object
    const parsed = JSON.parse(toolCalls[0].inputJson);
    expect(parsed.command).toBe('ls -la');
  });
});

describe('Codex parser — 08-02 repair: messageOrdinal on tool calls', () => {
  it('should set messageOrdinal on function_call tool calls (08-02)', async () => {
    const jsonl = [
      '{"type":"session_meta","session_meta":{"session_id":"codex-rp-003","model":"gpt-5"}}',
      '{"type":"response_item","response_item":{"type":"input_text","input_text":"Do something","token_count":2}}',
      '{"type":"response_item","response_item":{"type":"function_call","call_id":"call-rp-03","name":"read_file","arguments":"{}","token_count":5}}',
    ].join('\n');

    const filePath = writeFixture('fc-ordinal.jsonl', jsonl);
    const result = await parseCodexSession(filePath, 'test-project');

    const toolCalls = result.activities.filter(a => a.type === 'tool_call') as TraceToolCall[];
    expect(toolCalls).toHaveLength(1);
    // messageOrdinal should be defined (1, after the input_text at 0)
    expect(toolCalls[0].messageOrdinal).toBeDefined();
    expect(typeof toolCalls[0].messageOrdinal).toBe('number');
    expect(typeof toolCalls[0].sourceLine).toBe('number');
  });

  it('should not surface function_call placeholders as assistant-visible text', async () => {
    const jsonl = [
      '{"type":"session_meta","session_meta":{"session_id":"codex-rp-004","model":"gpt-5"}}',
      '{"type":"response_item","response_item":{"type":"input_text","input_text":"Run ls","token_count":2}}',
      '{"type":"response_item","response_item":{"type":"function_call","call_id":"call-rp-04","name":"exec_command","arguments":"{\\"cmd\\":\\"ls\\"}","token_count":5}}',
      '{"type":"response_item","response_item":{"type":"text","text":"Done.","token_count":1}}',
    ].join('\n');

    const filePath = writeFixture('fc-placeholder-hidden.jsonl', jsonl);
    const result = await parseCodexSession(filePath, 'test-project');

    const assistantContents = result.messages
      .filter((message) => message.role === 'assistant')
      .map((message) => message.content);
    expect(assistantContents).not.toContain('[function_call: exec_command]');
    expect(assistantContents).toContain('');
    expect(assistantContents).toContain('Done.');
  });
});

describe('Codex parser — 09-04 repair: patch tool category and subagent links', () => {
  it('should classify apply_patch custom tool calls as Edit and pair outputs', async () => {
    const jsonl = [
      '{"type":"session_meta","session_meta":{"session_id":"codex-0904-001","model":"gpt-5"}}',
      '{"type":"response_item","response_item":{"type":"custom_tool_call","call_id":"call-patch-01","name":"apply_patch","arguments":"*** Begin Patch\\n*** Update File: app.ts\\n@@\\n-old\\n+new\\n*** End Patch","token_count":12}}',
      '{"type":"event_msg","event_msg":{"type":"custom_tool_call_output","call_id":"call-patch-01","output":"Success. Updated the following files:\\nM app.ts","status":"completed"},"timestamp":"2026-05-10T00:00:01Z"}',
    ].join('\n');

    const filePath = writeFixture('apply-patch-category.jsonl', jsonl);
    const result = await parseCodexSession(filePath, 'test-project');
    const toolCalls = result.activities.filter(a => a.type === 'tool_call') as TraceToolCall[];

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].id).toBe('call-patch-01');
    expect(toolCalls[0].name).toBe('apply_patch');
    expect(toolCalls[0].category).toBe('Edit');
    expect(toolCalls[0].status).toBe('success');
    expect(toolCalls[0].resultEvents).toHaveLength(1);
    expect(toolCalls[0].resultEvents[0].content).toContain('Success');
  });

  it('should classify patch and file_edit style custom tools as Edit', async () => {
    const jsonl = [
      '{"type":"session_meta","session_meta":{"session_id":"codex-0904-002","model":"gpt-5"}}',
      '{"type":"response_item","response_item":{"type":"custom_tool_call","call_id":"call-patch-02","name":"patch","arguments":"{}","token_count":5}}',
      '{"type":"response_item","response_item":{"type":"custom_tool_call","call_id":"call-file-edit-01","name":"file_edit","arguments":"{}","token_count":6}}',
    ].join('\n');

    const filePath = writeFixture('patch-file-edit-category.jsonl', jsonl);
    const result = await parseCodexSession(filePath, 'test-project');
    const toolCalls = result.activities.filter(a => a.type === 'tool_call') as TraceToolCall[];

    expect(toolCalls.map((tool) => [tool.name, tool.category])).toEqual([
      ['patch', 'Edit'],
      ['file_edit', 'Edit'],
    ]);
  });

  it('should anchor collab_agent_spawn_end links to the spawning call ordinal', async () => {
    const jsonl = [
      '{"type":"session_meta","session_meta":{"session_id":"codex-0904-003","model":"gpt-5"}}',
      '{"type":"response_item","response_item":{"type":"function_call","call_id":"call-spawn-01","name":"spawn_agent","arguments":"{\\"task\\":\\"inspect parser\\"}","token_count":8}}',
      '{"type":"event_msg","event_msg":{"type":"collab_agent_spawn_end","call_id":"call-spawn-01","sender_thread_id":"codex-0904-003","new_thread_id":"child-thread-001","new_agent_nickname":"Parser helper","status":"completed"},"timestamp":"2026-05-10T00:00:02Z"}',
    ].join('\n');

    const filePath = writeFixture('collab-spawn-link-ordinal.jsonl', jsonl);
    const result = await parseCodexSession(filePath, 'test-project');
    const toolCall = result.activities.find(
      (activity): activity is TraceToolCall => activity.type === 'tool_call' && activity.id === 'call-spawn-01',
    );
    const subagentLink = result.activities.find((activity) => activity.type === 'subagent_link');

    expect(toolCall).toBeDefined();
    expect(subagentLink).toBeDefined();
    if (subagentLink && subagentLink.type === 'subagent_link') {
      expect(subagentLink.subagentSessionId).toBe('child-thread-001');
      expect(subagentLink.subagentSource).toBe('codex');
      expect(subagentLink.relationship).toBe('spawned');
      expect(subagentLink.messageOrdinal).toBe(toolCall?.messageOrdinal);
    }
  });

  it('should ignore collab_agent_spawn_end events without a child thread id', async () => {
    const jsonl = [
      '{"type":"session_meta","session_meta":{"session_id":"codex-0904-004","model":"gpt-5"}}',
      '{"type":"response_item","response_item":{"type":"function_call","call_id":"call-spawn-null","name":"spawn_agent","arguments":"{}","token_count":8}}',
      '{"type":"event_msg","event_msg":{"type":"collab_agent_spawn_end","call_id":"call-spawn-null","sender_thread_id":"codex-0904-004","new_thread_id":null,"new_agent_nickname":"Missing child","status":"failed"},"timestamp":"2026-05-10T00:00:03Z"}',
    ].join('\n');

    const filePath = writeFixture('collab-spawn-null-child.jsonl', jsonl);
    const result = await parseCodexSession(filePath, 'test-project');

    expect(result.activities.some((activity) => activity.type === 'subagent_link')).toBe(false);
  });
});
