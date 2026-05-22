import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  appendSessionDeltaToDatabase,
  PARSER_CACHE_VERSION,
  readFileSnapshotWithIdentity,
  type CursorDecision,
  type IngestFileCursor,
} from '@/ingest/sync';
import type { IncrementalParseDelta } from '@/ingest/parser/types';

describe('incremental sync append writer', () => {
  let db: Database.Database;
  let tempDir: string;
  let filePath: string;

  beforeEach(() => {
    db = createTestDb();
    tempDir = mkdtempSync(join(tmpdir(), 'sync-incremental-write-'));
    filePath = join(tempDir, 'session.jsonl');
    writeFileSync(filePath, '{"type":"seed"}\n{"type":"append"}\n');
    seedSession(db, 'append-session', filePath);
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('appends messages and remains idempotent when the same delta is replayed', () => {
    const delta = makeDelta();
    const decision = makeDecision(delta);

    const first = appendSessionDeltaToDatabase(delta, db, filePath, decision);
    const second = appendSessionDeltaToDatabase(delta, db, filePath, decision);

    expect(first.errors).toEqual([]);
    expect(second.errors).toEqual([]);
    expect(rowCount('messages')).toBe(3);
    expect(rowCount('tool_calls')).toBe(1);
    expect(rowCount('tool_result_events')).toBe(1);
    expect(rowCount('subagent_links')).toBe(1);
    expect(cursorRow().last_indexed_offset).toBe(delta.cursorUpdate.lastIndexedOffset);
    expect(sessionRow().message_count).toBe(3);
    expect(sessionRow().total_input_tokens).toBe(2);
    expect(sessionRow().total_output_tokens).toBe(4);
    expect(sessionRow().total_tokens).toBe(6);
  });

  it('applies parser token deltas that are not attached to inserted messages idempotently', () => {
    const size = statSync(filePath).size;
    const delta = makeDelta({
      messages: [],
      toolCalls: [],
      toolResultEvents: [],
      subagentLinks: [],
      metricsDelta: {
        messageCount: 0,
        userMessageCount: 0,
        totalInputTokens: 1200,
        totalOutputTokens: 34,
        totalCacheReadTokens: 300,
        totalCacheWriteTokens: 0,
        totalReasoningTokens: 21,
        totalTokens: 1234,
        hasToolCalls: false,
        parserMalformedLines: 0,
      },
      cursorUpdate: {
        lastIndexedOffset: size,
        lastIndexedLine: 2,
        lastMessageOrdinal: 0,
        lastTurnIndex: 0,
      },
    });

    const first = appendSessionDeltaToDatabase(delta, db, filePath, makeDecision(delta));
    const second = appendSessionDeltaToDatabase(delta, db, filePath, makeDecision(delta));

    expect(first.errors).toEqual([]);
    expect(second.errors).toEqual([]);
    expect(sessionRow()).toMatchObject({
      message_count: 1,
      total_input_tokens: 1200,
      total_output_tokens: 34,
      total_cache_read_tokens: 300,
      total_reasoning_tokens: 21,
      total_tokens: 1234,
    });
  });

  it('does not overwrite an existing project when an append delta has no project patch', () => {
    db.prepare(`UPDATE sessions SET project = ? WHERE id = ?`)
      .run('/Users/example/Work/project-with-hyphen', 'append-session');
    const delta = makeDelta({
      sessionPatch: {
        endedAt: '2026-05-15T00:00:02.000Z',
        status: 'idle',
      },
    });

    const result = appendSessionDeltaToDatabase(delta, db, filePath, makeDecision(delta));

    const row = db.prepare(`
      SELECT project
      FROM sessions
      WHERE id = ?
    `).get('append-session') as { project: string };
    expect(result.errors).toEqual([]);
    expect(row.project).toBe('/Users/example/Work/project-with-hyphen');
  });

  it('inserts a result event under an existing tool call', () => {
    seedExistingToolCall(db, 'append-session', 'call-existing');
    const delta = makeDelta({
      messages: [],
      toolCalls: [],
      toolResultEvents: [
        {
          toolId: 'call-existing',
          event: {
            type: 'result_event',
            content: 'existing result',
            isPartial: false,
            timestamp: '2026-05-15T00:00:03.000Z',
          },
        },
      ],
      subagentLinks: [],
      cursorUpdate: {
        lastIndexedOffset: statSync(filePath).size,
        lastIndexedLine: 2,
        lastMessageOrdinal: 0,
        lastTurnIndex: 0,
      },
    });

    const result = appendSessionDeltaToDatabase(delta, db, filePath, makeDecision(delta));

    const event = db.prepare(`
      SELECT tre.content, tc.tool_id
      FROM tool_result_events tre
      JOIN tool_calls tc ON tc.id = tre.tool_call_id
    `).get() as { content: string; tool_id: string };
    expect(result.errors).toEqual([]);
    expect(event).toEqual({ content: 'existing result', tool_id: 'call-existing' });
  });

  it('does not advance the cursor when the append transaction fails', () => {
    const before = cursorRow().last_indexed_offset;
    const delta = makeDelta({
      toolResultEvents: [
        {
          toolId: 'missing-call',
          event: {
            type: 'result_event',
            content: 'cannot attach',
            isPartial: false,
          },
        },
      ],
      subagentLinks: [],
      cursorUpdate: {
        lastIndexedOffset: statSync(filePath).size,
        lastIndexedLine: 2,
        lastMessageOrdinal: 1,
        lastTurnIndex: 1,
      },
    });

    const result = appendSessionDeltaToDatabase(delta, db, filePath, makeDecision(delta));

    expect(result.errors.length).toBeGreaterThan(0);
    expect(cursorRow().last_indexed_offset).toBe(before);
    expect(rowCount('messages')).toBe(1);
  });

  function createTestDb(): Database.Database {
    const database = new Database(':memory:');
    database.pragma('journal_mode = WAL');
    const schema = readFileSync(join(process.cwd(), 'ingest', 'db', 'schema.sql'), 'utf-8');
    database.exec(schema);
    return database;
  }

  function seedSession(database: Database.Database, sessionId: string, sourceFile: string) {
    const snapshot = readFileSnapshotWithIdentity(sourceFile)!;
    database.prepare(`
      INSERT INTO sessions (
        id, source, project, status, message_count, user_message_count,
        total_output_tokens, total_input_tokens, has_tool_calls, file_path,
        file_size, file_mtime, last_sync_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      'codex',
      'test',
      'idle',
      1,
      1,
      0,
      0,
      0,
      sourceFile,
      snapshot.size,
      snapshot.mtimeIso,
      '2026-05-15T00:00:00.000Z'
    );
    database.prepare(`
      INSERT INTO messages (
        id, session_id, ordinal, role, content, source_file, turn_id, turn_index, is_real_user_input
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`${sessionId}:0`, sessionId, 0, 'user', 'seed', sourceFile, 'turn-0', 0, 1);
    database.prepare(`
      INSERT INTO ingest_file_cursors (
        source_type, file_path, session_id, file_size, file_mtime, file_inode,
        file_device, parser_version, last_indexed_offset, last_indexed_line,
        last_message_ordinal, last_turn_index, last_success_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'codex',
      sourceFile,
      sessionId,
      snapshot.size,
      snapshot.mtimeIso,
      snapshot.inode,
      snapshot.device,
      PARSER_CACHE_VERSION,
      16,
      1,
      0,
      0,
      '2026-05-15T00:00:00.000Z'
    );
  }

  function seedExistingToolCall(database: Database.Database, sessionId: string, toolId: string) {
    database.prepare(`
      INSERT INTO tool_calls (
        session_id, message_ordinal, tool_id, name, category, input_json, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, 0, toolId, 'bash', 'Bash', '{}', 'pending');
  }

  function makeDelta(overrides: Partial<IncrementalParseDelta> = {}): IncrementalParseDelta {
    const size = statSync(filePath).size;
    return {
      sessionId: 'append-session',
      sourceType: 'codex',
      messages: [
        {
          id: 'append-session:1',
          ordinal: 1,
          role: 'user',
          content: 'next request',
          timestamp: '2026-05-15T00:00:01.000Z',
          turnId: 'turn-1',
          turnIndex: 1,
          isRealUserInput: true,
          tokenUsage: { inputTokens: 2, outputTokens: 0 },
          sourceMetadata: { sourceType: 'codex', sourceFile: filePath, sourceLine: 2 },
        },
        {
          id: 'append-session:2',
          ordinal: 2,
          role: 'assistant',
          content: '',
          timestamp: '2026-05-15T00:00:02.000Z',
          turnId: 'turn-1',
          turnIndex: 1,
          isRealUserInput: false,
          tokenUsage: { inputTokens: 0, outputTokens: 4 },
          sourceMetadata: { sourceType: 'codex', sourceFile: filePath, sourceLine: 3 },
        },
      ],
      toolCalls: [
        {
          type: 'tool_call',
          id: 'call-append',
          name: 'spawn_agent',
          category: 'Agent',
          inputJson: '{}',
          resultEvents: [
            {
              type: 'result_event',
              content: 'spawned child',
              isPartial: false,
              timestamp: '2026-05-15T00:00:02.500Z',
            },
          ],
          status: 'success',
          messageOrdinal: 2,
          sourceLine: 3,
        },
      ],
      toolResultEvents: [],
      subagentLinks: [
        {
          type: 'subagent_link',
          subagentSessionId: 'child-append',
          subagentSource: 'codex',
          relationship: 'spawned',
          messageOrdinal: 2,
        },
      ],
      sessionPatch: {
        project: 'test',
        endedAt: '2026-05-15T00:00:02.000Z',
        status: 'idle',
      },
      metricsDelta: {
        messageCount: 2,
        userMessageCount: 1,
        totalInputTokens: 2,
        totalOutputTokens: 4,
        hasToolCalls: true,
        parserMalformedLines: 0,
      },
      cursorUpdate: {
        lastIndexedOffset: size,
        lastIndexedLine: 2,
        lastMessageOrdinal: 2,
        lastTurnIndex: 1,
      },
      errors: [],
      warnings: [],
      ...overrides,
    };
  }

  function makeDecision(
    delta: IncrementalParseDelta
  ): Extract<CursorDecision, { type: 'incremental_append' }> {
    const snapshot = readFileSnapshotWithIdentity(filePath)!;
    return {
      type: 'incremental_append',
      cursor: {
        sourceType: 'codex',
        filePath,
        sessionId: delta.sessionId,
        fileSize: 16,
        fileMtime: snapshot.mtimeIso,
        fileInode: snapshot.inode,
        fileDevice: snapshot.device,
        parserVersion: PARSER_CACHE_VERSION,
        lastIndexedOffset: 16,
        lastIndexedLine: 1,
        lastMessageOrdinal: 0,
        lastTurnIndex: 0,
        lastSuccessAt: '2026-05-15T00:00:00.000Z',
        lastFallbackReason: null,
      } satisfies IngestFileCursor,
      snapshot,
      startOffset: 16,
      endOffset: delta.cursorUpdate.lastIndexedOffset,
      startLine: 1,
      startOrdinal: 1,
      startTurnIndex: 0,
    };
  }

  function rowCount(table: string): number {
    return (db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }).count;
  }

  function cursorRow() {
    return db.prepare(`
      SELECT last_indexed_offset
      FROM ingest_file_cursors
      WHERE source_type = 'codex' AND file_path = ?
    `).get(filePath) as { last_indexed_offset: number };
  }

  function sessionRow() {
    return db.prepare(`
      SELECT
        message_count,
        total_input_tokens,
        total_output_tokens,
        total_cache_read_tokens,
        total_cache_write_tokens,
        total_reasoning_tokens,
        total_tokens
      FROM sessions
      WHERE id = ?
    `).get('append-session') as {
      message_count: number;
      total_input_tokens: number;
      total_output_tokens: number;
      total_cache_read_tokens: number;
      total_cache_write_tokens: number;
      total_reasoning_tokens: number;
      total_tokens: number;
    };
  }
});
