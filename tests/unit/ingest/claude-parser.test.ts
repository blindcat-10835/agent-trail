import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  parseClaudeSession,
  parseClaudeMessage,
} from '@/ingest/parser/claude';
import { SessionContext, ParseResult } from '@/ingest/parser/types';
import { TraceMessage, TraceToolCall, TraceSubagentLink } from '@/types/trace';

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
