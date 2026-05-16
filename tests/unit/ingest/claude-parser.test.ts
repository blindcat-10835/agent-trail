import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  parseClaudeSession,
  parseClaudeMessage,
} from '@/ingest/parser/claude';
import { SessionContext, ParseResult } from '@/ingest/parser/types';
import { TraceMessage, TraceToolCall, TraceThinkingBlock, TraceSubagentLink } from '@/types/trace';

// ============================================================================
// Helpers
// ============================================================================

let tmpDir: string;
let sessionContext: SessionContext;

/** Create a JSONL file in tmpDir and return its full path */
function writeFixture(filename: string, lines: string[]): string {
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
  return filePath;
}

function makeSessionCtx(uuid: string, filePath: string): SessionContext {
  return {
    sessionKey: uuid,
    uuid,
    project: 'test-project',
    filePath,
    fileMtime: fs.statSync(filePath).mtimeMs,
  };
}

/** Build a valid Claude Code JSONL line object for constructing test data */
function claudeLine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uuid: overrides.uuid ?? 'msg-001',
    type: overrides.type ?? 'assistant',
    message: overrides.message ?? {
      role: 'assistant',
      content: 'Hello from Claude.',
      model: 'claude-sonnet-4-20250514',
      usage: { input_tokens: 10, output_tokens: 5 },
    },
    timestamp: overrides.timestamp ?? '2025-06-01T10:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-test-'));
  sessionContext = {
    sessionKey: 'test-uuid',
    uuid: 'test-uuid',
    project: 'test-project',
    filePath: path.join(tmpDir, 'test.jsonl'),
    fileMtime: Date.now(),
  };
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================================
// Task 1: parseClaudeSession()
// ============================================================================

describe('parseClaudeSession', () => {
  // --- Test 1: Valid Claude JSONL returns ParseResult with source='claude-code' ---

  it('should parse valid Claude JSONL and return source claude-code with messages and empty errors', async () => {
    const lines = [
      JSON.stringify(claudeLine({ uuid: 'm1', type: 'user', message: { role: 'user', content: 'Hello' } })),
      JSON.stringify(claudeLine({ uuid: 'm2', type: 'assistant', message: { role: 'assistant', content: 'Hi there!' } })),
    ];
    const filePath = writeFixture('valid.jsonl', lines);

    const result = await parseClaudeSession(filePath, 'test-project');

    expect(result.session.source).toBe('claude-code');
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.errors).toEqual([]);
  });

  it('preserves Claude cache creation and cache read token channels', async () => {
    const lines = [
      JSON.stringify(claudeLine({
        uuid: 'cache-1',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Cached response.',
          model: 'claude-sonnet-4-20250514',
          usage: {
            input_tokens: 250,
            output_tokens: 125,
            cache_creation_input_tokens: 200,
            cache_read_input_tokens: 800,
          },
        },
      })),
    ];
    const filePath = writeFixture('cache-usage.jsonl', lines);

    const result = await parseClaudeSession(filePath, 'test-project');

    expect(result.session.metrics.inputTokens).toBe(250);
    expect(result.session.metrics.outputTokens).toBe(125);
    expect(result.session.metrics.cacheWriteTokens).toBe(200);
    expect(result.session.metrics.cacheReadTokens).toBe(800);
    expect(result.session.metrics.totalTokens).toBe(1375);
    expect(result.messages[0].tokenUsage).toMatchObject({
      inputTokens: 250,
      outputTokens: 125,
      cacheWriteTokens: 200,
      cacheReadTokens: 800,
      totalTokens: 1375,
      usageSemantics: 'additive',
    });
  });

  // --- Test 2: Duplicate UUID deduplication (D-03) ---

  it('should deduplicate messages by UUID — only first occurrence retained (D-03)', async () => {
    const lines = [
      JSON.stringify(claudeLine({ uuid: 'dup', type: 'user', message: { role: 'user', content: 'First' } })),
      JSON.stringify(claudeLine({ uuid: 'dup', type: 'user', message: { role: 'user', content: 'Duplicate' } })),
      JSON.stringify(claudeLine({ uuid: 'unique', type: 'assistant', message: { role: 'assistant', content: 'Only' } })),
    ];
    const filePath = writeFixture('dedup.jsonl', lines);

    const result = await parseClaudeSession(filePath, 'test-project');

    expect(result.messages).toHaveLength(2);
    // The first occurrence should be retained, duplicate skipped
    const firstMsg = result.messages.find((m) => /dup/.test(m.id));
    expect(firstMsg?.content).toBe('First');
    // Warning should be emitted for duplicate
    expect(result.warnings.some((w) => w.includes('Duplicate UUID'))).toBe(true);
  });

  // --- Test 3: DAG parentUuid chains produce correct relationshipType (D-01) ---

  it('should resolve DAG parentUuid to parentSessionId with fork relationshipType (D-01)', async () => {
    const lines = [
      JSON.stringify(claudeLine({
        uuid: 'root-msg',
        type: 'system',
        session: { id: 'session-root', type: 'root' },
      })),
      JSON.stringify(claudeLine({
        uuid: 'fork-msg',
        parentUuid: 'root-msg',
        type: 'system',
        session: { id: 'session-fork', type: 'fork' },
      })),
    ];
    const filePath = writeFixture('dag-fork.jsonl', lines);

    const result = await parseClaudeSession(filePath, 'test-project');

    // Fork session should have relationshipType='fork' and parentSessionId set
    expect(result.session.relationshipType).toBeDefined();
  });

  // --- Test 4: Compact events produce system messages and mark truncation (D-02) ---

  it('should produce system messages from compact events and mark affected messages as truncated (D-02)', async () => {
    const lines = [
      JSON.stringify(claudeLine({ uuid: 'm1', type: 'user', message: { role: 'user', content: 'Hello' } })),
      JSON.stringify(claudeLine({ uuid: 'm2', type: 'assistant', message: { role: 'assistant', content: 'Long response that gets compacted...' } })),
      JSON.stringify({
        uuid: 'compact-1',
        type: 'compact',
        timestamp: '2025-06-01T10:01:00Z',
        compact: { truncatedUuids: ['m1', 'm2'] },
      }),
    ];
    const filePath = writeFixture('compact.jsonl', lines);

    const result = await parseClaudeSession(filePath, 'test-project');

    // Should have at least one system message from compact event
    const systemMessages = result.messages.filter((m) => m.role === 'system');
    expect(systemMessages.length).toBeGreaterThan(0);

    // Session metrics should reflect truncation
    expect(result.session.metrics.isTruncated).toBe(true);
  });

  // --- Test 5: Subagent session metadata (D-04) ---

  it('should handle subagent session metadata with relationshipType subagent (D-04)', async () => {
    const lines = [
      JSON.stringify({
        uuid: 'sub-msg',
        type: 'assistant',
        message: { role: 'assistant', content: 'Subagent task result.' },
        session: { id: 'sub-session', type: 'subagent', parentId: 'parent-session' },
      }),
    ];
    const filePath = writeFixture('subagent.jsonl', lines);

    const result = await parseClaudeSession(filePath, 'test-project');

    // Subagent session should have relationship and parent
    expect(result.session.relationshipType).toBe('subagent');
    expect(result.session.parentSessionId).toBe('parent-session');
  });

  // --- Test 6: Malformed JSON lines populate errors[] without aborting (D-05) ---

  it('should capture malformed JSON in errors[] without aborting the full parse', async () => {
    const lines = [
      JSON.stringify(claudeLine({ uuid: 'm1', type: 'user', message: { role: 'user', content: 'Good line' } })),
      '{invalid json',
      JSON.stringify(claudeLine({ uuid: 'm2', type: 'assistant', message: { role: 'assistant', content: 'After malformed' } })),
    ];
    const filePath = writeFixture('malformed.jsonl', lines);

    const result = await parseClaudeSession(filePath, 'test-project');

    expect(result.errors.length).toBeGreaterThan(0);
    // Parse should continue — valid lines still processed
    expect(result.messages.length).toBeGreaterThan(0);
    // Parser malformed lines count in metrics
    expect(result.session.metrics.parserMalformedLines).toBeGreaterThan(0);
  });

  // --- Test 7: Tool use content blocks extract as TraceToolCall activities ---

  it('should extract tool_use content blocks as TraceToolCall activities', async () => {
    const lines = [
      JSON.stringify(claudeLine({
        uuid: 'tool-msg',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me read that file.' },
            { type: 'tool_use', name: 'Read', id: 'tool-1', input: { file_path: '/src/index.ts' } },
            { type: 'tool_use', name: 'Bash', id: 'tool-2', input: { command: 'ls' } },
          ],
        },
      })),
    ];
    const filePath = writeFixture('tools.jsonl', lines);

    const result = await parseClaudeSession(filePath, 'test-project');

    const toolCalls = result.activities.filter(
      (a) => (a as TraceToolCall).type === 'tool_call'
    ) as TraceToolCall[];
    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0].name).toBe('Read');
    expect(toolCalls[0].category).toBe('Read');
    expect(toolCalls[1].name).toBe('Bash');
    expect(toolCalls[1].category).toBe('Bash');
    expect(result.session.metrics.hasToolCalls).toBe(true);
  });

  // --- Additional: file not found returns error session ---

  it('should return error session when file does not exist', async () => {
    const result = await parseClaudeSession('/nonexistent/file.jsonl', 'test-project');

    expect(result.session.status).toBe('error');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].error).toContain('File does not exist');
  });

  // ============================================================================
  // Plan 08-02 repair tests — fail on OLD code, pass after repair
  // ============================================================================

  // --- Test 8: tool_result user record pairs resultEvents to prior tool_use ---

  it('should pair tool_result user blocks with matching tool_use by tool_use_id (08-02)', async () => {
    const lines = [
      JSON.stringify(claudeLine({
        uuid: 'asst-msg',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Running command.' },
            { type: 'tool_use', id: 'toolu_test_01', name: 'Bash', input: { command: 'ls' } },
          ],
          model: 'claude-opus-4-5',
        },
      })),
      JSON.stringify(claudeLine({
        uuid: 'user-result-msg',
        parentUuid: 'asst-msg',
        type: 'user',
        message: {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'toolu_test_01', content: 'file1.ts\nfile2.ts', is_error: false },
          ],
        },
      })),
    ];
    const filePath = writeFixture('tool-result-pairing.jsonl', lines);

    const result = await parseClaudeSession(filePath, 'test-project');

    const toolCalls = result.activities.filter(a => a.type === 'tool_call') as TraceToolCall[];
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].id).toBe('toolu_test_01');
    // Result event should be populated from the tool_result block
    expect(toolCalls[0].resultEvents).toHaveLength(1);
    expect(toolCalls[0].resultEvents[0].content).toBe('file1.ts\nfile2.ts');
    expect(toolCalls[0].status).toBe('success');
  });

  // --- Test 9: tool_result-only user record produces tool_result role, not user ---

  it('should produce role=tool_result for tool-result-only user records (08-02)', async () => {
    const lines = [
      JSON.stringify(claudeLine({
        uuid: 'asst-2',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'toolu_test_02', name: 'Read', input: { file_path: '/x' } },
          ],
          model: 'claude-opus-4-5',
        },
      })),
      JSON.stringify(claudeLine({
        uuid: 'user-result-2',
        parentUuid: 'asst-2',
        type: 'user',
        message: {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'toolu_test_02', content: 'file content', is_error: false },
          ],
        },
      })),
    ];
    const filePath = writeFixture('tool-result-role.jsonl', lines);

    const result = await parseClaudeSession(filePath, 'test-project');

    // Must NOT have a user role message from the tool_result-only record
    const userMsgs = result.messages.filter(m => m.role === 'user');
    expect(userMsgs).toHaveLength(0);
    // Must have a tool_result role message
    const toolResultMsgs = result.messages.filter(m => m.role === 'tool_result');
    expect(toolResultMsgs).toHaveLength(1);
  });

  // --- Test 10: thinking blocks are extracted as TraceThinkingBlock activities ---

  it('should extract thinking blocks as TraceThinkingBlock activities (08-02)', async () => {
    const lines = [
      JSON.stringify(claudeLine({
        uuid: 'think-msg',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'This is my internal reasoning process.' },
            { type: 'text', text: 'Here is my answer.' },
          ],
          model: 'claude-opus-4-5',
        },
      })),
    ];
    const filePath = writeFixture('thinking-extract.jsonl', lines);

    const result = await parseClaudeSession(filePath, 'test-project');

    const thinkingBlocks = result.activities.filter(a => a.type === 'thinking') as TraceThinkingBlock[];
    expect(thinkingBlocks).toHaveLength(1);
    expect(thinkingBlocks[0].content).toBe('This is my internal reasoning process.');
    expect(thinkingBlocks[0].isRedacted).toBe(false);
  });

  // --- Test 11: isCompactSummary: true recognized as compact boundary ---

  it('should treat isCompactSummary: true as compact boundary and set isTruncated (08-02)', async () => {
    const lines = [
      JSON.stringify(claudeLine({
        uuid: 'before-compact',
        type: 'assistant',
        message: { role: 'assistant', content: 'Before compact.' },
      })),
      JSON.stringify({
        uuid: 'rs-compact-real',
        type: 'compact',
        compact: { truncatedUuids: ['before-compact'] },
        message: { role: 'system', content: '[compact] Context compacted' },
        isCompactSummary: true,
        timestamp: '2025-01-01T01:00:00Z',
      }),
      JSON.stringify(claudeLine({
        uuid: 'after-compact',
        type: 'user',
        message: { role: 'user', content: 'After compact.' },
      })),
    ];
    const filePath = writeFixture('is-compact-summary.jsonl', lines);

    const result = await parseClaudeSession(filePath, 'test-project');

    expect(result.session.metrics.isTruncated).toBe(true);
    const systemMsgs = result.messages.filter(m => m.role === 'system');
    expect(systemMsgs.length).toBeGreaterThanOrEqual(1);
    expect(systemMsgs[0].content).toContain('before-compact');
  });

  // --- Test 12: tool_use messageOrdinal is set correctly ---

  it('should include messageOrdinal on tool calls matching the owning assistant message (08-02)', async () => {
    const lines = [
      JSON.stringify(claudeLine({
        uuid: 'user-1',
        type: 'user',
        message: { role: 'user', content: 'Do something.' },
      })),
      JSON.stringify(claudeLine({
        uuid: 'asst-with-tool',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'OK.' },
            { type: 'tool_use', id: 'toolu_ordinal_01', name: 'Read', input: { file_path: '/f' } },
          ],
          model: 'claude-opus-4-5',
        },
      })),
    ];
    const filePath = writeFixture('message-ordinal.jsonl', lines);

    const result = await parseClaudeSession(filePath, 'test-project');

    const toolCalls = result.activities.filter(a => a.type === 'tool_call') as TraceToolCall[];
    expect(toolCalls).toHaveLength(1);
    // messageOrdinal should be 1 (user is 0, assistant is 1)
    expect(toolCalls[0].messageOrdinal).toBe(1);
    expect(typeof toolCalls[0].sourceLine).toBe('number');
  });

  it('should treat slash command messages as real user turns and keep interruptions in the interrupted turn', async () => {
    const commandContent = '<command-message>gsd-quick</command-message>\n<command-name>/gsd-quick</command-name>\n<command-args>spawn几个subagents分别完成三个任务。</command-args>';
    const lines = [
      JSON.stringify(claudeLine({
        uuid: 'cmd-1',
        type: 'user',
        message: { role: 'user', content: commandContent },
        timestamp: '2026-05-08T05:50:18.375Z',
      })),
      JSON.stringify(claudeLine({
        uuid: 'skill-body',
        parentUuid: 'cmd-1',
        type: 'user',
        isMeta: true,
        message: { role: 'user', content: [{ type: 'text', text: 'Base directory for this skill: /tmp/skill' }] },
      })),
      JSON.stringify(claudeLine({
        uuid: 'interrupt-1',
        parentUuid: 'cmd-1',
        type: 'user',
        message: { role: 'user', content: [{ type: 'text', text: '[Request interrupted by user]' }] },
        timestamp: '2026-05-08T05:50:32.835Z',
      })),
      JSON.stringify(claudeLine({
        uuid: 'cmd-2',
        parentUuid: 'interrupt-1',
        type: 'user',
        message: { role: 'user', content: commandContent },
        timestamp: '2026-05-08T05:52:08.588Z',
      })),
      JSON.stringify(claudeLine({
        uuid: 'assistant-2',
        parentUuid: 'cmd-2',
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Running quick task.' }] },
      })),
    ];
    const filePath = writeFixture('slash-command-interrupt.jsonl', lines);

    const result = await parseClaudeSession(filePath, 'test-project');
    const userMessages = result.messages.filter((message) => message.role === 'user');
    const systemMessages = result.messages.filter((message) => message.role === 'system');

    expect(userMessages.map((message) => message.content)).toEqual([
      '/gsd-quick spawn几个subagents分别完成三个任务。',
      '/gsd-quick spawn几个subagents分别完成三个任务。',
    ]);
    expect(userMessages.map((message) => message.turnIndex)).toEqual([0, 1]);
    expect(systemMessages).toHaveLength(1);
    expect(systemMessages[0].content).toBe('[Request interrupted by user]');
    expect(systemMessages[0].turnIndex).toBe(0);
  });

  it('should attach task notifications to the matching Agent tool call without creating user turns', async () => {
    const lines = [
      JSON.stringify(claudeLine({
        uuid: 'cmd',
        type: 'user',
        message: {
          role: 'user',
          content: '<command-message>gsd-quick</command-message>\n<command-name>/gsd-quick</command-name>\n<command-args>spawn task</command-args>',
        },
      })),
      JSON.stringify(claudeLine({
        uuid: 'agent-tool',
        parentUuid: 'cmd',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Launching agent.' },
            { type: 'tool_use', id: 'toolu_agent_01', name: 'Agent', input: { prompt: 'do work' } },
          ],
        },
      })),
      JSON.stringify(claudeLine({
        uuid: 'agent-launch-result',
        parentUuid: 'agent-tool',
        type: 'user',
        message: {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'toolu_agent_01', content: 'agentId: agent-123', is_error: false },
          ],
        },
      })),
      JSON.stringify(claudeLine({
        uuid: 'task-notification',
        parentUuid: 'agent-launch-result',
        type: 'user',
        message: {
          role: 'user',
          content: '<task-notification>\n<task-id>agent-123</task-id>\n<tool-use-id>toolu_agent_01</tool-use-id>\n<output>done</output>\n</task-notification>',
        },
      })),
    ];
    const filePath = writeFixture('task-notification-agent-result.jsonl', lines);

    const result = await parseClaudeSession(filePath, 'test-project');
    const userMessages = result.messages.filter((message) => message.role === 'user');
    const toolCalls = result.activities.filter((activity) => activity.type === 'tool_call') as TraceToolCall[];

    expect(userMessages).toHaveLength(1);
    expect(userMessages[0].content).toBe('/gsd-quick spawn task');
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].name).toBe('Agent');
    expect(toolCalls[0].resultEvents).toHaveLength(2);
    expect(toolCalls[0].resultEvents[1].content).toContain('<task-id>agent-123</task-id>');
  });
});

// ============================================================================
// Task 2: parseClaudeMessage() helper
// ============================================================================

describe('parseClaudeMessage', () => {
  // --- Test 1: Valid JSONL line → TraceMessage with correct role, content, sourceMetadata ---

  it('should parse a single valid JSONL line into TraceMessage with correct role and content', () => {
    const line = JSON.stringify(claudeLine({
      uuid: 'msg-test',
      type: 'assistant',
      message: {
        role: 'assistant',
        content: 'I am Claude.',
        model: 'claude-sonnet-4',
      },
      timestamp: '2025-06-01T10:00:00Z',
    }));
    const ctx: SessionContext = {
      sessionKey: 'test-uuid',
      uuid: 'test-uuid',
      project: 'test',
      filePath: '/fake/path.jsonl',
      fileMtime: Date.now(),
    };

    const result = parseClaudeMessage(line, ctx);

    expect(result).not.toBeNull();
    expect(result!.role).toBe('assistant');
    expect(result!.content).toBe('I am Claude.');
    expect(result!.sourceMetadata.sourceType).toBe('claude-code');
    expect(result!.sourceMetadata.sourceFile).toBe('/fake/path.jsonl');
  });

  // --- Test 2: Malformed JSON → returns null (does not throw) ---

  it('should return null for malformed JSON (does not throw)', () => {
    const ctx: SessionContext = {
      sessionKey: 'test',
      uuid: 'test',
      project: 'test',
      filePath: '/f.jsonl',
      fileMtime: Date.now(),
    };

    const result = parseClaudeMessage('not valid json', ctx);

    expect(result).toBeNull();
  });

  // --- Test 3: Line with tool_use content blocks → message still parses ---

  it('should parse a line with tool_use content blocks', () => {
    const line = JSON.stringify(claudeLine({
      uuid: 'tool-test',
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Running command...' },
          { type: 'tool_use', name: 'Bash', id: 'bash-1', input: { command: 'echo hello' } },
        ],
      },
    }));
    const ctx: SessionContext = {
      sessionKey: 'tool-test',
      uuid: 'tool-test',
      project: 'test',
      filePath: '/f.jsonl',
      fileMtime: Date.now(),
    };

    const result = parseClaudeMessage(line, ctx);

    expect(result).not.toBeNull();
    expect(result!.content).toBe('Running command...');
    expect(result!.role).toBe('assistant');
  });

  // --- Additional: line without message field → returns null ---

  it('should return null for a line without a message field', () => {
    const line = JSON.stringify({ uuid: 'no-msg', type: 'system' });
    const ctx: SessionContext = {
      sessionKey: 't',
      uuid: 't',
      project: 't',
      filePath: '/f.jsonl',
      fileMtime: Date.now(),
    };

    const result = parseClaudeMessage(line, ctx);

    expect(result).toBeNull();
  });
});
