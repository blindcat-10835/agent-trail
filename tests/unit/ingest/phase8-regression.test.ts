/**
 * Phase 8 Regression Tests
 *
 * End-to-end regression assertions for the user-reported failures fixed in Phase 8.
 * Uses small temporary JSONL files and in-memory SQLite databases.
 * Does NOT rely on local real sessions — runs in CI without any env variables.
 *
 * Covers:
 * - messages.id is non-null (606dac00 target regression)
 * - Claude tool_result pairs with tool_use and populates resultEvents
 * - Codex function_call_output populates resultEvents
 * - Codex custom_tool_call/output produces structured tool call
 * - Session remains discoverable after force sync (effac644 target regression)
 * - assembleTurns returns tool activities from DB (tool calls not lost in parser memory)
 *
 * @group ingest/regression/phase8
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { writeSessionToDatabase } from '@/ingest/sync/index';
import { parseClaudeSession } from '@/ingest/parser/claude';
import { parseCodexSession } from '@/ingest/parser/codex';
import { assembleTurns, getTurnCount } from '@/ingest/turns/assembler';
import type { TraceToolCall } from '@/types/trace';

// ============================================================================
// Helpers
// ============================================================================

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase8-reg-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  const schemaPath = path.join(process.cwd(), 'ingest', 'db', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  return db;
}

function writeJsonl(filename: string, lines: object[]): string {
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, lines.map(l => JSON.stringify(l)).join('\n') + '\n', 'utf-8');
  return filePath;
}

// ============================================================================
// Regression 1: messages.id IS NOT NULL after sync
// (Target session: 606dac00 - reported null message IDs causing key=null in UI)
// ============================================================================

describe('Regression: messages.id non-null (606dac00 class)', () => {
  it('all messages have non-null id after parsing Claude JSONL and sync', async () => {
    const sessionId = 'reg-null-id-claude-001';
    const filePath = writeJsonl('claude-null-id.jsonl', [
      {
        uuid: 'msg-001',
        type: 'user',
        message: { role: 'user', content: 'Run a command' },
        timestamp: '2024-01-01T00:00:00Z',
      },
      {
        uuid: 'msg-002',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Sure, running now.' },
            { type: 'tool_use', id: 'toolu_reg01', name: 'Bash', input: { command: 'ls' } },
          ],
          model: 'claude-sonnet-4',
          usage: { input_tokens: 50, output_tokens: 20 },
        },
        timestamp: '2024-01-01T00:00:01Z',
      },
      {
        uuid: 'msg-003',
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_reg01',
              content: 'file1.ts\nfile2.ts',
            },
          ],
        },
        timestamp: '2024-01-01T00:00:02Z',
      },
    ]);

    const db = createTestDb();
    const parseResult = await parseClaudeSession(filePath, sessionId);

    expect(parseResult.errors).toEqual([]);

    const syncResult = writeSessionToDatabase(parseResult, db);
    expect(syncResult.errors).toEqual([]);

    // Core regression: messages.id must never be NULL
    const rows = db
      .prepare('SELECT id, ordinal FROM messages WHERE session_id = ?')
      .all(parseResult.session.id) as { id: string | null; ordinal: number }[];

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.id).not.toBeNull();
      expect(row.id).not.toBe('');
      expect(typeof row.id).toBe('string');
    }

    // Also verify count(*) = count(id) (the specific SQL assertion from the plan)
    const countRow = db
      .prepare(
        'SELECT COUNT(*) as total, COUNT(id) as with_id FROM messages WHERE session_id = ?'
      )
      .get(parseResult.session.id) as { total: number; with_id: number };

    expect(countRow.with_id).toBe(countRow.total);
    expect(countRow.total).toBeGreaterThan(0);
  });

  it('all messages have non-null id after parsing Codex JSONL and sync', async () => {
    const sessionId = 'reg-null-id-codex-001';
    const filePath = writeJsonl('codex-null-id.jsonl', [
      {
        type: 'session_meta',
        session_meta: { session_id: sessionId, cwd: '/project' },
        timestamp: '2024-01-01T00:00:00Z',
      },
      {
        type: 'turn_context',
        turn_context: { turn_id: 'turn-001', model: 'codex-v2', started_at: '2024-01-01T00:00:01Z' },
        timestamp: '2024-01-01T00:00:01Z',
      },
      {
        type: 'response_item',
        response_item: { type: 'input_text', input_text: 'Build the feature', token_count: 5 },
        timestamp: '2024-01-01T00:00:02Z',
      },
      {
        type: 'response_item',
        response_item: {
          type: 'function_call',
          call_id: 'call-reg001',
          name: 'run_command',
          arguments: JSON.stringify({ command: 'npm build' }),
          token_count: 10,
        },
        timestamp: '2024-01-01T00:00:03Z',
      },
      {
        type: 'event_msg',
        event_msg: {
          type: 'function_call_output',
          call_id: 'call-reg001',
          content: 'Build successful.',
        },
        timestamp: '2024-01-01T00:00:04Z',
      },
      {
        type: 'response_item',
        response_item: { type: 'text', text: 'Done!', token_count: 3 },
        timestamp: '2024-01-01T00:00:05Z',
      },
    ]);

    const db = createTestDb();
    const parseResult = await parseCodexSession(filePath, sessionId);

    expect(parseResult.errors).toEqual([]);

    const syncResult = writeSessionToDatabase(parseResult, db);
    expect(syncResult.errors).toEqual([]);

    // Core regression: messages.id must never be NULL
    const countRow = db
      .prepare(
        'SELECT COUNT(*) as total, COUNT(id) as with_id FROM messages WHERE session_id = ?'
      )
      .get(parseResult.session.id) as { total: number; with_id: number };

    expect(countRow.with_id).toBe(countRow.total);
    expect(countRow.total).toBeGreaterThan(0);
  });
});

// ============================================================================
// Regression: real user turn boundaries
// ============================================================================

describe('Regression: real user turn boundaries', () => {
  it('Claude local-command metadata does not create user turns', async () => {
    const filePath = writeJsonl('4c1348c8-9a68-4088-81b8-cf41fb86a048.jsonl', [
      {
        parentUuid: null,
        type: 'user',
        message: {
          role: 'user',
          content: '<local-command-caveat>Caveat: generated by local command</local-command-caveat>',
        },
        isMeta: true,
        uuid: 'meta-caveat',
        timestamp: '2024-01-01T00:00:00Z',
        cwd: '/repo',
        sessionId: '4c1348c8-9a68-4088-81b8-cf41fb86a048',
      },
      {
        parentUuid: 'meta-caveat',
        type: 'user',
        message: {
          role: 'user',
          content: '<command-name>/effort</command-name>\n<command-args></command-args>',
        },
        uuid: 'meta-command',
        timestamp: '2024-01-01T00:00:01Z',
        cwd: '/repo',
        sessionId: '4c1348c8-9a68-4088-81b8-cf41fb86a048',
      },
      {
        parentUuid: 'meta-command',
        type: 'user',
        message: {
          role: 'user',
          content: '<local-command-stdout>Set effort level</local-command-stdout>',
        },
        uuid: 'meta-stdout',
        timestamp: '2024-01-01T00:00:02Z',
        cwd: '/repo',
        sessionId: '4c1348c8-9a68-4088-81b8-cf41fb86a048',
      },
      {
        parentUuid: 'meta-stdout',
        type: 'user',
        message: { role: 'user', content: '真正的用户输入' },
        uuid: 'real-user-1',
        timestamp: '2024-01-01T00:00:03Z',
        cwd: '/repo',
        sessionId: '4c1348c8-9a68-4088-81b8-cf41fb86a048',
      },
      {
        parentUuid: 'real-user-1',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: '收到。' }],
          model: 'claude-sonnet-4',
        },
        uuid: 'assistant-1',
        timestamp: '2024-01-01T00:00:04Z',
        cwd: '/repo',
        sessionId: '4c1348c8-9a68-4088-81b8-cf41fb86a048',
      },
    ]);

    const parseResult = await parseClaudeSession(filePath, '/repo');
    const userMessages = parseResult.messages.filter((message) => message.role === 'user');

    expect(userMessages).toHaveLength(1);
    expect(userMessages[0].content).toBe('真正的用户输入');
    expect(parseResult.session.metrics.userMessageCount).toBe(1);

    const db = createTestDb();
    const syncResult = writeSessionToDatabase(parseResult, db, filePath);
    expect(syncResult.errors).toEqual([]);

    const turns = await assembleTurns(parseResult.session.id, db);
    expect(turns).toHaveLength(1);
    expect(turns[0].userMessage?.content).toBe('真正的用户输入');
    expect(getTurnCount(parseResult.session.id, db)).toBe(1);
  });

  it('Codex event_msg user_message drives turn assembly instead of injected context', async () => {
    const sessionId = '019e0805-4edc-78e0-b4e3-428896b54e66';
    const filePath = writeJsonl(`${sessionId}.jsonl`, [
      {
        type: 'session_meta',
        payload: { id: sessionId, cwd: '/repo' },
        timestamp: '2024-01-01T00:00:00Z',
      },
      {
        type: 'event_msg',
        payload: { type: 'task_started', turn_id: 'turn-1' },
        timestamp: '2024-01-01T00:00:01Z',
      },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: '# AGENTS.md instructions for /repo' }],
        },
        timestamp: '2024-01-01T00:00:02Z',
      },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: '$gsd-code-review check parsing' }],
        },
        timestamp: '2024-01-01T00:00:03Z',
      },
      {
        type: 'event_msg',
        payload: { type: 'user_message', message: '$gsd-code-review check parsing', images: [] },
        timestamp: '2024-01-01T00:00:04Z',
      },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'I will inspect it.' }],
        },
        timestamp: '2024-01-01T00:00:05Z',
      },
      {
        type: 'event_msg',
        payload: { type: 'task_started', turn_id: 'turn-2' },
        timestamp: '2024-01-01T00:01:00Z',
      },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: '<skill>large skill payload</skill>' }],
        },
        timestamp: '2024-01-01T00:01:01Z',
      },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'continue' }],
        },
        timestamp: '2024-01-01T00:01:02Z',
      },
      {
        type: 'event_msg',
        payload: { type: 'user_message', message: 'continue', images: [] },
        timestamp: '2024-01-01T00:01:03Z',
      },
      {
        type: 'response_item',
        payload: {
          type: 'function_call',
          call_id: 'call-turn-2',
          name: 'exec_command',
          arguments: JSON.stringify({ cmd: 'rg turn' }),
        },
        timestamp: '2024-01-01T00:01:04Z',
      },
      {
        type: 'event_msg',
        payload: {
          type: 'function_call_output',
          call_id: 'call-turn-2',
          output: 'match',
          status: 'completed',
        },
        timestamp: '2024-01-01T00:01:05Z',
      },
    ]);

    const parseResult = await parseCodexSession(filePath, '/repo');
    const db = createTestDb();
    const syncResult = writeSessionToDatabase(parseResult, db, filePath);
    expect(syncResult.errors).toEqual([]);

    const turns = await assembleTurns(parseResult.session.id, db);
    expect(turns).toHaveLength(2);
    expect(getTurnCount(parseResult.session.id, db)).toBe(2);
    expect(turns.map((turn) => turn.userMessage?.content)).toEqual([
      '$gsd-code-review check parsing',
      'continue',
    ]);
    expect(turns[0].userMessage?.content).not.toContain('AGENTS.md');
    expect(turns[1].userMessage?.content).not.toContain('<skill>');

    const turn2ToolCalls = turns[1].activities.filter((activity) => activity.type === 'tool_call');
    expect(turn2ToolCalls).toHaveLength(1);
  });
});

// ============================================================================
// Regression: session relationships
// ============================================================================

describe('Regression: session relationships are persisted', () => {
  it('writeSessionToDatabase persists subagent relationship metadata', async () => {
    const parentSessionId = 'parent-codex-session';
    const childSessionId = 'child-codex-session';
    const db = createTestDb();

    writeSessionToDatabase({
      session: {
        id: parentSessionId,
        source: 'codex',
        project: '/repo',
        startedAt: '2024-01-01T00:00:00Z',
        endedAt: '2024-01-01T00:00:01Z',
        status: 'idle',
        relationshipType: 'root',
        metrics: {
          messageCount: 0,
          userMessageCount: 0,
          hasToolCalls: false,
          parserMalformedLines: 0,
          isTruncated: false,
        },
        turns: [],
      },
      messages: [],
      activities: [],
      errors: [],
      warnings: [],
    }, db);

    writeSessionToDatabase({
      session: {
        id: childSessionId,
        source: 'codex',
        project: '/repo',
        startedAt: '2024-01-01T00:00:02Z',
        endedAt: '2024-01-01T00:00:03Z',
        status: 'idle',
        rootSessionId: parentSessionId,
        parentSessionId,
        relationshipType: 'subagent',
        sourceSessionId: childSessionId,
        metrics: {
          messageCount: 0,
          userMessageCount: 0,
          hasToolCalls: false,
          parserMalformedLines: 0,
          isTruncated: false,
        },
        turns: [],
      },
      messages: [],
      activities: [],
      errors: [],
      warnings: [],
    }, db);

    const child = db.prepare(`
      SELECT parent_session_id, root_session_id, relationship_type, source_session_id
      FROM sessions
      WHERE id = ?
    `).get(childSessionId) as {
      parent_session_id: string | null;
      root_session_id: string | null;
      relationship_type: string | null;
      source_session_id: string | null;
    };

    expect(child.parent_session_id).toBe(parentSessionId);
    expect(child.root_session_id).toBe(parentSessionId);
    expect(child.relationship_type).toBe('subagent');
    expect(child.source_session_id).toBe(childSessionId);
  });
});

// ============================================================================
// Regression 2: Claude tool_result pairing
// tool_calls and tool_result_events are populated after force sync
// ============================================================================

describe('Regression: Claude tool_result pairing populates tool_calls and tool_result_events', () => {
  it('tool_use in assistant + tool_result in user produces tool_call with result events', async () => {
    const sessionId = 'reg-claude-tool-result-001';
    const filePath = writeJsonl('claude-tool-result.jsonl', [
      {
        uuid: 'msg-u01',
        type: 'user',
        message: { role: 'user', content: 'Read the file.' },
        timestamp: '2024-01-01T00:00:00Z',
      },
      {
        uuid: 'msg-a01',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'toolu_read01', name: 'Read', input: { file_path: '/src/main.ts' } },
          ],
          model: 'claude-sonnet-4',
          usage: { input_tokens: 30, output_tokens: 10 },
        },
        timestamp: '2024-01-01T00:00:01Z',
      },
      {
        uuid: 'msg-tr01',
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_read01',
              content: 'const x = 1;',
            },
          ],
        },
        timestamp: '2024-01-01T00:00:02Z',
      },
    ]);

    const db = createTestDb();
    const parseResult = await parseClaudeSession(filePath, sessionId);

    // Parser should extract the tool call
    const toolCalls = parseResult.activities.filter(a => a.type === 'tool_call') as TraceToolCall[];
    expect(toolCalls.length).toBe(1);
    expect(toolCalls[0].id).toBe('toolu_read01');
    expect(toolCalls[0].name).toBe('Read');

    // Tool result should be paired in parser
    expect(toolCalls[0].resultEvents.length).toBe(1);
    expect(toolCalls[0].resultEvents[0].content).toBe('const x = 1;');

    // Sync to DB
    const syncResult = writeSessionToDatabase(parseResult, db);
    expect(syncResult.toolCallsInserted).toBe(1);
    expect(syncResult.toolResultEventsInserted).toBe(1);

    // DB verification
    const tcRows = db
      .prepare('SELECT tool_id, name, status FROM tool_calls WHERE session_id = ?')
      .all(parseResult.session.id) as { tool_id: string; name: string; status: string }[];

    expect(tcRows.length).toBe(1);
    expect(tcRows[0].tool_id).toBe('toolu_read01');
    expect(tcRows[0].name).toBe('Read');

    const evtRows = db
      .prepare(
        'SELECT content FROM tool_result_events WHERE tool_call_id IN (SELECT id FROM tool_calls WHERE session_id = ?)'
      )
      .all(parseResult.session.id) as { content: string }[];

    expect(evtRows.length).toBe(1);
    expect(evtRows[0].content).toBe('const x = 1;');
  });

  it('force sync re-populates tool_calls and tool_result_events after reparse', async () => {
    const sessionId = 'reg-claude-force-sync-001';
    const filePath = writeJsonl('claude-force-sync.jsonl', [
      {
        uuid: 'u01',
        type: 'user',
        message: { role: 'user', content: 'Do something.' },
        timestamp: '2024-01-01T00:00:00Z',
      },
      {
        uuid: 'a01',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'toolu_fs01', name: 'Bash', input: { command: 'echo hi' } },
          ],
          model: 'claude-sonnet-4',
          usage: { input_tokens: 20, output_tokens: 5 },
        },
        timestamp: '2024-01-01T00:00:01Z',
      },
      {
        uuid: 'tr01',
        type: 'user',
        message: {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'toolu_fs01', content: 'hi' },
          ],
        },
        timestamp: '2024-01-01T00:00:02Z',
      },
    ]);

    const db = createTestDb();
    const parseResult = await parseClaudeSession(filePath, sessionId);

    // Initial sync
    const firstSync = writeSessionToDatabase(parseResult, db);
    expect(firstSync.toolCallsInserted).toBe(1);

    // Force sync — should replace all derived rows
    const secondSync = writeSessionToDatabase(parseResult, db, undefined, { force: true });
    expect(secondSync.errors).toEqual([]);
    expect(secondSync.toolCallsInserted).toBe(1);

    // Verify tool_calls count is exactly 1 (no duplicates from force re-write)
    const tcCount = (
      db.prepare('SELECT COUNT(*) as c FROM tool_calls WHERE session_id = ?')
        .get(parseResult.session.id) as { c: number }
    ).c;
    expect(tcCount).toBe(1);

    // Verify tool_result_events count is exactly 1
    const evtCount = (
      db.prepare(
        'SELECT COUNT(*) as c FROM tool_result_events WHERE tool_call_id IN (SELECT id FROM tool_calls WHERE session_id = ?)'
      ).get(parseResult.session.id) as { c: number }
    ).c;
    expect(evtCount).toBe(1);
  });
});

// ============================================================================
// Regression 3: Codex function_call_output produces tool_calls and result events
// ============================================================================

describe('Regression: Codex function_call_output populates tool_calls and tool_result_events', () => {
  it('Codex function_call + event_msg function_call_output produces tool call with result', async () => {
    const sessionId = 'reg-codex-function-output-001';
    const filePath = writeJsonl('codex-function-output.jsonl', [
      {
        type: 'session_meta',
        session_meta: { session_id: sessionId, cwd: '/workspace' },
        timestamp: '2024-01-01T00:00:00Z',
      },
      {
        type: 'turn_context',
        turn_context: { turn_id: 'turn-fn001', model: 'codex-v2', started_at: '2024-01-01T00:00:01Z' },
        timestamp: '2024-01-01T00:00:01Z',
      },
      {
        type: 'response_item',
        response_item: { type: 'input_text', input_text: 'Create a file', token_count: 4 },
        timestamp: '2024-01-01T00:00:02Z',
      },
      {
        type: 'response_item',
        response_item: {
          type: 'function_call',
          call_id: 'call-fn001',
          name: 'create_file',
          arguments: JSON.stringify({ path: '/src/new.ts', content: 'export {};' }),
          token_count: 15,
        },
        timestamp: '2024-01-01T00:00:03Z',
      },
      {
        type: 'event_msg',
        event_msg: {
          type: 'function_call_output',
          call_id: 'call-fn001',
          content: 'File created at /src/new.ts',
        },
        timestamp: '2024-01-01T00:00:04Z',
      },
      {
        type: 'response_item',
        response_item: { type: 'text', text: 'File created successfully.', token_count: 5 },
        timestamp: '2024-01-01T00:00:05Z',
      },
    ]);

    const db = createTestDb();
    const parseResult = await parseCodexSession(filePath, sessionId);

    expect(parseResult.errors).toEqual([]);

    // Parser should produce a tool call activity
    const toolCalls = parseResult.activities.filter(a => a.type === 'tool_call') as TraceToolCall[];
    expect(toolCalls.length).toBeGreaterThanOrEqual(1);

    const fnCall = toolCalls.find(tc => tc.name === 'create_file');
    expect(fnCall).toBeDefined();
    expect(fnCall!.resultEvents.length).toBeGreaterThanOrEqual(1);
    expect(fnCall!.resultEvents[0].content).toBe('File created at /src/new.ts');

    // Sync and verify DB
    const syncResult = writeSessionToDatabase(parseResult, db);
    expect(syncResult.toolCallsInserted).toBeGreaterThanOrEqual(1);
    expect(syncResult.toolResultEventsInserted).toBeGreaterThanOrEqual(1);

    // DB-level assertion: tool_calls count > 0 and result events count > 0
    const tcCount = (
      db.prepare('SELECT COUNT(*) as c FROM tool_calls WHERE session_id = ?')
        .get(parseResult.session.id) as { c: number }
    ).c;
    expect(tcCount).toBeGreaterThan(0);

    const evtCount = (
      db.prepare(
        'SELECT COUNT(*) as c FROM tool_result_events WHERE tool_call_id IN (SELECT id FROM tool_calls WHERE session_id = ?)'
      ).get(parseResult.session.id) as { c: number }
    ).c;
    expect(evtCount).toBeGreaterThan(0);
  });

  it('Codex function_call_output as response_item (not event_msg) pairs correctly', async () => {
    const sessionId = 'reg-codex-function-output-ri-001';
    const filePath = writeJsonl('codex-function-output-ri.jsonl', [
      {
        type: 'session_meta',
        session_meta: { session_id: sessionId, cwd: '/workspace' },
        timestamp: '2024-01-01T00:00:00Z',
      },
      {
        type: 'turn_context',
        turn_context: { turn_id: 'turn-ri001', model: 'codex-v2', started_at: '2024-01-01T00:00:01Z' },
        timestamp: '2024-01-01T00:00:01Z',
      },
      {
        type: 'response_item',
        response_item: { type: 'input_text', input_text: 'List files', token_count: 3 },
        timestamp: '2024-01-01T00:00:02Z',
      },
      {
        type: 'response_item',
        response_item: {
          type: 'function_call',
          call_id: 'call-ri001',
          name: 'list_files',
          arguments: JSON.stringify({ path: '.' }),
          token_count: 8,
        },
        timestamp: '2024-01-01T00:00:03Z',
      },
      // function_call_output as response_item (not event_msg) — some Codex versions emit this
      {
        type: 'response_item',
        response_item: {
          type: 'function_call_output',
          call_id: 'call-ri001',
          output: 'main.ts\nutils.ts',
        },
        timestamp: '2024-01-01T00:00:04Z',
      },
    ]);

    const db = createTestDb();
    const parseResult = await parseCodexSession(filePath, sessionId);

    const toolCalls = parseResult.activities.filter(a => a.type === 'tool_call') as TraceToolCall[];
    const fnCall = toolCalls.find(tc => tc.name === 'list_files');
    expect(fnCall).toBeDefined();
    expect(fnCall!.resultEvents.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Regression 4: Codex custom_tool_call produces structured tool call
// ============================================================================

describe('Regression: Codex custom_tool_call produces structured tool call', () => {
  it('custom_tool_call + custom_tool_call_output produces tool call with result', async () => {
    const sessionId = 'reg-codex-custom-tool-001';
    const filePath = writeJsonl('codex-custom-tool.jsonl', [
      {
        type: 'session_meta',
        session_meta: { session_id: sessionId, cwd: '/workspace' },
        timestamp: '2024-01-01T00:00:00Z',
      },
      {
        type: 'turn_context',
        turn_context: { turn_id: 'turn-ct001', model: 'codex-v2', started_at: '2024-01-01T00:00:01Z' },
        timestamp: '2024-01-01T00:00:01Z',
      },
      {
        type: 'response_item',
        response_item: { type: 'input_text', input_text: 'Search for pattern', token_count: 4 },
        timestamp: '2024-01-01T00:00:02Z',
      },
      {
        type: 'response_item',
        response_item: {
          type: 'custom_tool_call',
          call_id: 'cct-001',
          name: 'grep_files',
          arguments: JSON.stringify({ pattern: 'TODO', path: '.' }),
          token_count: 12,
        },
        timestamp: '2024-01-01T00:00:03Z',
      },
      {
        type: 'event_msg',
        event_msg: {
          type: 'custom_tool_call_output',
          call_id: 'cct-001',
          content: 'src/main.ts:42: // TODO: fix this',
        },
        timestamp: '2024-01-01T00:00:04Z',
      },
      {
        type: 'response_item',
        response_item: { type: 'text', text: 'Found TODOs.', token_count: 3 },
        timestamp: '2024-01-01T00:00:05Z',
      },
    ]);

    const db = createTestDb();
    const parseResult = await parseCodexSession(filePath, sessionId);

    expect(parseResult.errors).toEqual([]);

    // Parser must produce a tool_call activity for custom_tool_call
    const toolCalls = parseResult.activities.filter(a => a.type === 'tool_call') as TraceToolCall[];
    expect(toolCalls.length).toBeGreaterThanOrEqual(1);

    const customCall = toolCalls.find(tc => tc.name === 'grep_files');
    expect(customCall).toBeDefined();
    expect(customCall!.resultEvents.length).toBeGreaterThanOrEqual(1);
    expect(customCall!.resultEvents[0].content).toContain('TODO');

    // Sync and verify DB
    const syncResult = writeSessionToDatabase(parseResult, db);
    expect(syncResult.toolCallsInserted).toBeGreaterThanOrEqual(1);
    expect(syncResult.toolResultEventsInserted).toBeGreaterThanOrEqual(1);

    // DB-level: tool_calls > 0, result_events > 0
    const tcCount = (
      db.prepare('SELECT COUNT(*) as c FROM tool_calls WHERE session_id = ?')
        .get(parseResult.session.id) as { c: number }
    ).c;
    expect(tcCount).toBeGreaterThan(0);

    const evtCount = (
      db.prepare(
        'SELECT COUNT(*) as c FROM tool_result_events WHERE tool_call_id IN (SELECT id FROM tool_calls WHERE session_id = ?)'
      ).get(parseResult.session.id) as { c: number }
    ).c;
    expect(evtCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// Regression 5: Session discoverable after force sync (effac644 class)
// Verifies sessions table has correct row after force reparse
// ============================================================================

describe('Regression: session discoverable after force sync (effac644 class)', () => {
  it('session exists in sessions table with correct id after initial sync', async () => {
    const sessionId = 'reg-discover-001';
    const filePath = writeJsonl('discover.jsonl', [
      {
        uuid: 'u01',
        type: 'user',
        message: { role: 'user', content: 'Hello' },
        timestamp: '2024-01-01T00:00:00Z',
      },
      {
        uuid: 'a01',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Hi there!',
          model: 'claude-sonnet-4',
          usage: { input_tokens: 10, output_tokens: 5 },
        },
        timestamp: '2024-01-01T00:00:01Z',
      },
    ]);

    const db = createTestDb();
    const parseResult = await parseClaudeSession(filePath, sessionId);
    writeSessionToDatabase(parseResult, db);

    // Session must be discoverable by id
    const row = db
      .prepare('SELECT id, source FROM sessions WHERE id = ?')
      .get(parseResult.session.id) as { id: string; source: string } | undefined;

    expect(row).toBeDefined();
    expect(row!.id).toBe(parseResult.session.id);
    expect(row!.source).toBe('claude-code');
  });

  it('session remains discoverable after force sync (effac644 pattern)', async () => {
    const sessionId = 'reg-discover-force-001';
    const filePath = writeJsonl('discover-force.jsonl', [
      {
        uuid: 'u01',
        type: 'user',
        message: { role: 'user', content: 'Plan the architecture' },
        timestamp: '2024-01-01T00:00:00Z',
      },
      {
        uuid: 'a01',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Here is my plan...',
          model: 'claude-sonnet-4',
          usage: { input_tokens: 20, output_tokens: 100 },
        },
        timestamp: '2024-01-01T00:00:01Z',
      },
    ]);

    const db = createTestDb();
    const parseResult = await parseClaudeSession(filePath, sessionId);

    // Initial sync
    writeSessionToDatabase(parseResult, db);

    // Verify session exists before force sync
    const beforeRow = db
      .prepare('SELECT id FROM sessions WHERE id = ?')
      .get(parseResult.session.id) as { id: string } | undefined;
    expect(beforeRow).toBeDefined();

    // Force sync
    writeSessionToDatabase(parseResult, db, undefined, { force: true });

    // Verify session still discoverable after force sync
    const afterRow = db
      .prepare('SELECT id, source FROM sessions WHERE id = ?')
      .get(parseResult.session.id) as { id: string; source: string } | undefined;

    expect(afterRow).toBeDefined();
    expect(afterRow!.id).toBe(parseResult.session.id);
    expect(afterRow!.source).toBe('claude-code');

    // Messages still present
    const msgCount = (
      db.prepare('SELECT COUNT(*) as c FROM messages WHERE session_id = ?')
        .get(parseResult.session.id) as { c: number }
    ).c;
    expect(msgCount).toBeGreaterThan(0);
  });

  it('sessions table count matches what would be returned by sessions list query', async () => {
    const sessionId = 'reg-discover-list-001';
    const filePath = writeJsonl('discover-list.jsonl', [
      {
        uuid: 'u01',
        type: 'user',
        message: { role: 'user', content: 'List tasks' },
        timestamp: '2024-01-01T00:00:00Z',
      },
    ]);

    const db = createTestDb();
    const parseResult = await parseClaudeSession(filePath, sessionId);
    writeSessionToDatabase(parseResult, db);

    // Simulate a basic sessions list query
    const sessions = db
      .prepare('SELECT id, source, name, status FROM sessions ORDER BY started_at DESC')
      .all() as { id: string; source: string; name: string; status: string }[];

    const foundSession = sessions.find(s => s.id === parseResult.session.id);
    expect(foundSession).toBeDefined();
    expect(foundSession!.source).toBe('claude-code');
  });
});

// ============================================================================
// Regression 6: assembleTurns surfaces tool activities from DB
// (Verifies the tool activities are not lost in parser memory)
// ============================================================================

describe('Regression: assembleTurns surfaces tool_calls from DB', () => {
  it('Claude session tool activities appear in assembled turns', async () => {
    const { assembleTurns } = await import('@/ingest/turns/assembler');
    const sessionId = 'reg-assemble-claude-001';
    const filePath = writeJsonl('assemble-claude.jsonl', [
      {
        uuid: 'u01',
        type: 'user',
        message: { role: 'user', content: 'Run grep' },
        timestamp: '2024-01-01T00:00:00Z',
      },
      {
        uuid: 'a01',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'toolu_grep01', name: 'Grep', input: { pattern: 'TODO', path: '.' } },
          ],
          model: 'claude-sonnet-4',
          usage: { input_tokens: 30, output_tokens: 15 },
        },
        timestamp: '2024-01-01T00:00:01Z',
      },
      {
        uuid: 'tr01',
        type: 'user',
        message: {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'toolu_grep01', content: 'src/main.ts:10: // TODO' },
          ],
        },
        timestamp: '2024-01-01T00:00:02Z',
      },
    ]);

    const db = createTestDb();
    const parseResult = await parseClaudeSession(filePath, sessionId);

    writeSessionToDatabase(parseResult, db);

    const turns = await assembleTurns(parseResult.session.id, db);
    expect(turns.length).toBeGreaterThan(0);

    const allToolActivities = turns.flatMap(t => t.activities.filter(a => a.type === 'tool_call'));
    expect(allToolActivities.length).toBeGreaterThanOrEqual(1);

    const grepCall = allToolActivities.find(a => (a as TraceToolCall).name === 'Grep') as TraceToolCall | undefined;
    expect(grepCall).toBeDefined();
    expect(grepCall!.resultEvents.length).toBeGreaterThanOrEqual(1);
    expect(grepCall!.resultEvents[0].content).toContain('TODO');
  });

  it('Codex session tool activities appear in assembled turns', async () => {
    const { assembleTurns } = await import('@/ingest/turns/assembler');
    const sessionId = 'reg-assemble-codex-001';
    const filePath = writeJsonl('assemble-codex.jsonl', [
      {
        type: 'session_meta',
        session_meta: { session_id: sessionId, cwd: '/proj' },
        timestamp: '2024-01-01T00:00:00Z',
      },
      {
        type: 'turn_context',
        turn_context: { turn_id: 'turn-asm001', model: 'codex-v2', started_at: '2024-01-01T00:00:01Z' },
        timestamp: '2024-01-01T00:00:01Z',
      },
      {
        type: 'response_item',
        response_item: { type: 'input_text', input_text: 'Do the thing', token_count: 4 },
        timestamp: '2024-01-01T00:00:02Z',
      },
      {
        type: 'response_item',
        response_item: {
          type: 'function_call',
          call_id: 'call-asm001',
          name: 'run_tests',
          arguments: JSON.stringify({ suite: 'unit' }),
          token_count: 10,
        },
        timestamp: '2024-01-01T00:00:03Z',
      },
      {
        type: 'event_msg',
        event_msg: { type: 'function_call_output', call_id: 'call-asm001', content: '5 tests passed' },
        timestamp: '2024-01-01T00:00:04Z',
      },
    ]);

    const db = createTestDb();
    const parseResult = await parseCodexSession(filePath, sessionId);

    writeSessionToDatabase(parseResult, db);

    const turns = await assembleTurns(parseResult.session.id, db);
    expect(turns.length).toBeGreaterThan(0);

    const allToolActivities = turns.flatMap(t => t.activities.filter(a => a.type === 'tool_call'));
    expect(allToolActivities.length).toBeGreaterThanOrEqual(1);

    const testCall = allToolActivities.find(a => (a as TraceToolCall).name === 'run_tests') as TraceToolCall | undefined;
    expect(testCall).toBeDefined();
    expect(testCall!.resultEvents.length).toBeGreaterThanOrEqual(1);
    expect(testCall!.resultEvents[0].content).toBe('5 tests passed');
  });
});
