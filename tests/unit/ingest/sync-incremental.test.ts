import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { PARSER_CACHE_VERSION } from '@/ingest/sync';

const parseCodexSession = vi.fn();
const parseCodexSessionAppend = vi.fn();
const parseClaudeSession = vi.fn();
const parseClaudeSessionAppend = vi.fn();

vi.mock('@/ingest/parser/codex', () => ({
  parseCodexSession,
  parseCodexSessionAppend,
}));

vi.mock('@/ingest/parser/claude', () => ({
  parseClaudeSession,
  parseClaudeSessionAppend,
}));

describe('sync incremental parser selection', () => {
  let tempDir: string;
  let dbPath: string;
  let codexRoot: string;
  let claudeRoot: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'sync-incremental-'));
    dbPath = path.join(tempDir, 'ingest.db');
    codexRoot = path.join(tempDir, 'codex-sessions');
    claudeRoot = path.join(tempDir, 'claude-projects');
    process.env.INGEST_DB_PATH = dbPath;
    process.env.CODEX_SESSIONS_DIR = codexRoot;
    process.env.CLAUDE_PROJECTS_DIR = claudeRoot;
    mockFullParsers();
    mockAppendParsers();
  });

  afterEach(async () => {
    try {
      const { closeDatabase } = await import('@/ingest/db');
      closeDatabase();
    } catch {
      // Database may not be open if setup fails early.
    }
    delete process.env.INGEST_DB_PATH;
    delete process.env.CODEX_SESSIONS_DIR;
    delete process.env.CLAUDE_PROJECTS_DIR;
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  it('uses the Codex append parser for a safe append cursor', async () => {
    const filePath = await createSessionFile(codexRoot, 'codex-safe.jsonl');
    const initialSize = fs.statSync(filePath).size;
    const { openDatabase, initSchema, getDatabase } = await import('@/ingest/db');
    const { syncPaths } = await import('@/ingest/sync/index');
    openDatabase({ path: dbPath });
    initSchema();
    seedSession(getDatabase(), 'codex', 'codex-safe-session', filePath);
    seedCursor(getDatabase(), 'codex', 'codex-safe-session', filePath, initialSize);
    fs.appendFileSync(filePath, '{"type":"response_item","response_item":{"type":"text","text":"new"}}\n');

    const result = await syncPaths('codex', [filePath]);

    expect(parseCodexSessionAppend).toHaveBeenCalledTimes(1);
    expect(parseCodexSession).not.toHaveBeenCalled();
    expect(result.metrics?.filesParsedIncrementally).toBe(1);
    expect(result.metrics?.filesParsedFully).toBe(0);
  });

  it('falls back to full Codex parse when cursor state is unsafe', async () => {
    const filePath = await createSessionFile(codexRoot, 'codex-unsafe.jsonl');
    const { openDatabase, initSchema } = await import('@/ingest/db');
    const { syncPaths } = await import('@/ingest/sync/index');
    openDatabase({ path: dbPath });
    initSchema();

    const result = await syncPaths('codex', [filePath]);

    expect(parseCodexSession).toHaveBeenCalledTimes(1);
    expect(parseCodexSessionAppend).not.toHaveBeenCalled();
    expect(result.metrics?.filesParsedFully).toBe(1);
  });

  it('uses the Claude append parser for a safe append cursor', async () => {
    const filePath = await createSessionFile(claudeRoot, 'claude-safe.jsonl');
    const initialSize = fs.statSync(filePath).size;
    const { openDatabase, initSchema, getDatabase } = await import('@/ingest/db');
    const { syncPaths } = await import('@/ingest/sync/index');
    openDatabase({ path: dbPath });
    initSchema();
    seedSession(getDatabase(), 'claude-code', 'claude-safe-session', filePath);
    seedCursor(getDatabase(), 'claude-code', 'claude-safe-session', filePath, initialSize);
    fs.appendFileSync(filePath, '{"uuid":"assistant-2","type":"assistant","message":{"role":"assistant","content":"new"}}\n');

    const result = await syncPaths('claude-code', [filePath]);

    expect(parseClaudeSessionAppend).toHaveBeenCalledTimes(1);
    expect(parseClaudeSession).not.toHaveBeenCalled();
    expect(result.metrics?.filesParsedIncrementally).toBe(1);
  });

  function mockFullParsers() {
    parseCodexSession.mockResolvedValue(makeParseResult('codex', 'codex-full-session'));
    parseClaudeSession.mockResolvedValue(makeParseResult('claude-code', 'claude-full-session'));
  }

  function mockAppendParsers() {
    parseCodexSessionAppend.mockResolvedValue(makeDelta('codex-safe-session', 'codex'));
    parseClaudeSessionAppend.mockResolvedValue(makeDelta('claude-safe-session', 'claude-code'));
  }

  async function createSessionFile(root: string, name: string) {
    const filePath = path.join(root, '2026', '05', '15', name);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, '{"type":"session_meta","payload":{"id":"seed"}}\n');
    return filePath;
  }

  function seedSession(
    db: import('better-sqlite3').Database,
    source: 'codex' | 'claude-code',
    sessionId: string,
    filePath: string
  ) {
    const stats = fs.statSync(filePath);
    db.prepare(`
      INSERT INTO sessions (
        id, source, project, status, message_count, user_message_count,
        has_tool_calls, file_path, file_size, file_mtime, file_hash, last_sync_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      source,
      'test',
      'idle',
      1,
      1,
      1,
      filePath,
      stats.size,
      new Date(stats.mtimeMs).toISOString(),
      `${PARSER_CACHE_VERSION}:${source}:seed`,
      '2026-05-15T00:00:00.000Z'
    );
    db.prepare(`
      INSERT INTO messages (
        id, session_id, ordinal, role, content, source_file, turn_id, turn_index, model
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `${sessionId}-message-0`,
      sessionId,
      0,
      'user',
      'seed',
      filePath,
      'turn-0',
      0,
      'gpt-5'
    );
    db.prepare(`
      INSERT INTO tool_calls (
        session_id, message_ordinal, tool_id, name, category, input_json, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, 0, 'call-known', 'bash', 'Bash', '{}', 'pending');
  }

  function seedCursor(
    db: import('better-sqlite3').Database,
    source: 'codex' | 'claude-code',
    sessionId: string,
    filePath: string,
    indexedSize: number
  ) {
    const stats = fs.statSync(filePath);
    db.prepare(`
      INSERT INTO ingest_file_cursors (
        source_type,
        file_path,
        session_id,
        file_size,
        file_mtime,
        file_inode,
        file_device,
        parser_version,
        last_indexed_offset,
        last_indexed_line,
        last_message_ordinal,
        last_turn_index,
        last_success_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      source,
      filePath,
      sessionId,
      indexedSize,
      new Date(stats.mtimeMs).toISOString(),
      stats.ino,
      stats.dev,
      PARSER_CACHE_VERSION,
      indexedSize,
      1,
      0,
      0,
      '2026-05-15T00:00:00.000Z'
    );
  }

  function makeParseResult(source: 'codex' | 'claude-code', sessionId: string) {
    return {
      session: {
        id: sessionId,
        source,
        project: 'test',
        startedAt: '2026-05-15T00:00:00.000Z',
        endedAt: null,
        status: 'idle',
        metrics: {
          messageCount: 0,
          userMessageCount: 0,
          totalTokens: 0,
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
    };
  }

  function makeDelta(sessionId: string, sourceType: 'codex' | 'claude-code') {
    return {
      sessionId,
      sourceType,
      messages: [],
      toolCalls: [],
      toolResultEvents: [],
      subagentLinks: [],
      sessionPatch: {},
      metricsDelta: {
        messageCount: 0,
        userMessageCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        hasToolCalls: false,
        parserMalformedLines: 0,
      },
      cursorUpdate: {
        lastIndexedOffset: 0,
        lastIndexedLine: 0,
        lastMessageOrdinal: 0,
        lastTurnIndex: 0,
      },
      errors: [],
      warnings: [],
    };
  }
});
