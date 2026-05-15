import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const parseCodexSession = vi.fn();

vi.mock('@/ingest/parser/codex', () => ({
  parseCodexSession,
}));

function mockCodexParse(
  sessionId: string,
  activities: Array<Record<string, unknown>> = []
) {
  parseCodexSession.mockResolvedValue({
    session: {
      id: sessionId,
      source: 'codex',
      project: 'test',
      startedAt: '2026-05-14T00:00:00.000Z',
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
    activities,
    errors: [],
    warnings: [],
  });
}

async function createCodexFile(root: string, name: string, content = '{"type":"test"}\n') {
  const filePath = path.join(root, '2026', '05', '14', name);
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, content);
  return filePath;
}

describe('sync performance behavior', () => {
  let tempDir: string;
  let dbPath: string;
  let codexRoot: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'sync-performance-'));
    dbPath = path.join(tempDir, 'ingest.db');
    codexRoot = path.join(tempDir, 'codex-sessions');
    process.env.INGEST_DB_PATH = dbPath;
    process.env.CODEX_SESSIONS_DIR = codexRoot;
    mockCodexParse('codex-test-session');
  });

  afterEach(async () => {
    try {
      const { closeDatabase } = await import('@/ingest/db');
      closeDatabase();
    } catch {
      // Database may not be open if a test failed early.
    }
    delete process.env.INGEST_DB_PATH;
    delete process.env.CODEX_SESSIONS_DIR;
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  it('syncPaths parses only matching changed session files', async () => {
    const filePath = await createCodexFile(codexRoot, 'changed.jsonl');
    const ignored = await createCodexFile(codexRoot, 'notes.md');
    const { openDatabase, initSchema } = await import('@/ingest/db');
    const { syncPaths } = await import('@/ingest/sync/index');
    openDatabase({ path: dbPath });
    initSchema();

    const result = await syncPaths('codex', [filePath, ignored]);

    expect(parseCodexSession).toHaveBeenCalledTimes(1);
    expect(parseCodexSession.mock.calls[0][0]).toBe(filePath);
    expect(result.metrics?.filesConsidered).toBe(1);
    expect(result.metrics?.filesParsed).toBe(1);
  });

  it('pre-parse skip avoids parser work for unchanged files', async () => {
    const filePath = await createCodexFile(codexRoot, 'unchanged.jsonl', '{"stable":true}\n');
    const stats = fs.statSync(filePath);
    const { openDatabase, initSchema, getDatabase } = await import('@/ingest/db');
    const { syncPaths } = await import('@/ingest/sync/index');
    openDatabase({ path: dbPath });
    initSchema();

    getDatabase().prepare(`
      INSERT INTO sessions (
        id, source, project, status, message_count, user_message_count,
        has_tool_calls, file_path, file_size, file_mtime, file_hash, last_sync_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'codex-test-session',
      'codex',
      'test',
      'idle',
      0,
      0,
      0,
      filePath,
      stats.size,
      new Date(stats.mtimeMs).toISOString(),
      'parser-v7-turn-activity-placement:codex:anyhash',
      '2026-05-14T00:00:01.000Z'
    );

    const result = await syncPaths('codex', [filePath]);

    expect(parseCodexSession).not.toHaveBeenCalled();
    expect(result.metrics?.filesConsidered).toBe(1);
    expect(result.metrics?.filesSkippedBeforeParse).toBe(1);
    expect(result.metrics?.filesParsed).toBe(0);
  });

  it('force=true bypasses pre-parse skip', async () => {
    const filePath = await createCodexFile(codexRoot, 'force.jsonl', '{"stable":true}\n');
    const stats = fs.statSync(filePath);
    const { openDatabase, initSchema, getDatabase } = await import('@/ingest/db');
    const { syncPaths } = await import('@/ingest/sync/index');
    openDatabase({ path: dbPath });
    initSchema();

    getDatabase().prepare(`
      INSERT INTO sessions (
        id, source, project, status, message_count, user_message_count,
        has_tool_calls, file_path, file_size, file_mtime, file_hash, last_sync_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'force-session',
      'codex',
      'test',
      'idle',
      0,
      0,
      0,
      filePath,
      stats.size,
      new Date(stats.mtimeMs).toISOString(),
      'parser-v7-turn-activity-placement:codex:anyhash',
      '2026-05-14T00:00:01.000Z'
    );

    await syncPaths('codex', [filePath], { force: true });

    expect(parseCodexSession).toHaveBeenCalledTimes(1);
  });

  it('computeFileHash does not use whole-file readFileSync', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'ingest', 'sync', 'index.ts'), 'utf-8');
    const functionBody = source.match(/export function computeFileHash[\s\S]*?\n}/)?.[0] ?? '';

    expect(functionBody).not.toContain('readFileSync');
    expect(functionBody).toContain('readSync');
  });

  it('regular Codex full sync does not run a source-wide relationship scan before skip/parse', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'ingest', 'sync', 'index.ts'), 'utf-8');
    const functionBody = source.match(/async function syncCodexSource[\s\S]*?\n}\n\n\/\*\*/)?.[0] ?? '';

    expect(functionBody).not.toContain('collectCodexRelationships(sources)');
    expect(functionBody).toContain('relationshipsByChild: CodexRelationshipsByChild = new Map()');
  });

  it('session display name extraction avoids full-message string transforms', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'ingest', 'sync', 'index.ts'), 'utf-8');
    const start = source.indexOf('function deriveDisplayNameFromUserMessage');
    const end = source.indexOf('/**\n * Extract project path', start);
    const functionSection = source.slice(start, end);

    expect(functionSection).toContain('boundedTrimmedPreview(content)');
    expect(functionSection).not.toContain('content.trim()');
    expect(functionSection).not.toContain('[\\s\\S]');
    expect(functionSection).not.toContain(".split('\\n')");
  });

  it('derives a session name from a bounded preview of a large user message', async () => {
    const filePath = await createCodexFile(codexRoot, 'large-user-message.jsonl');
    parseCodexSession.mockResolvedValueOnce({
      session: {
        id: 'large-user-message-session',
        source: 'codex',
        project: 'test',
        startedAt: '2026-05-14T00:00:00.000Z',
        endedAt: null,
        status: 'idle',
        metrics: {
          messageCount: 1,
          userMessageCount: 1,
          totalTokens: 0,
          hasToolCalls: false,
          parserMalformedLines: 0,
          isTruncated: false,
        },
        turns: [],
      },
      messages: [
        {
          id: 'msg-1',
          ordinal: 0,
          role: 'user',
          content: `## My request for Codex:\n请总结这个项目\n${'x'.repeat(1024 * 1024)}`,
          timestamp: '2026-05-14T00:00:00.000Z',
          sourceMetadata: {},
        },
      ],
      activities: [],
      errors: [],
      warnings: [],
    });
    const { openDatabase, initSchema, getDatabase } = await import('@/ingest/db');
    const { syncPaths } = await import('@/ingest/sync/index');
    openDatabase({ path: dbPath });
    initSchema();

    const result = await syncPaths('codex', [filePath]);

    expect(result.errors).toEqual([]);
    const row = getDatabase().prepare('SELECT name FROM sessions WHERE id = ?').get('large-user-message-session') as {
      name: string;
    };
    expect(row.name).toBe('请总结这个项目');
  });

  it('regular Codex full sync can repair stored relationship links without parsing unchanged files', async () => {
    const childFilePath = await createCodexFile(codexRoot, 'child.jsonl', '{"stable":true}\n');
    const childStats = fs.statSync(childFilePath);
    const parentId = 'stored-parent-session';
    const childId = 'stored-child-session';

    const { openDatabase, initSchema, getDatabase } = await import('@/ingest/db');
    const { syncSource } = await import('@/ingest/sync/index');
    openDatabase({ path: dbPath });
    initSchema();

    const insertSession = getDatabase().prepare(`
      INSERT INTO sessions (
        id, source, project, status, message_count, user_message_count,
        has_tool_calls, file_path, file_size, file_mtime, file_hash,
        parser_malformed_lines, is_truncated, relationship_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertSession.run(
      parentId,
      'codex',
      'test',
      'idle',
      0,
      0,
      0,
      path.join(codexRoot, '2026', '05', '14', 'parent.jsonl'),
      0,
      '2026-05-14T00:00:00.000Z',
      'parser-v7-turn-activity-placement:codex:parent',
      0,
      0,
      'root'
    );
    insertSession.run(
      childId,
      'codex',
      'test',
      'idle',
      0,
      0,
      0,
      childFilePath,
      childStats.size,
      new Date(childStats.mtimeMs).toISOString(),
      'parser-v7-turn-activity-placement:codex:child',
      0,
      0,
      'root'
    );
    getDatabase().prepare(`
      INSERT INTO subagent_links (
        session_id, subagent_session_id, subagent_source, relationship, message_ordinal
      ) VALUES (?, ?, ?, ?, ?)
    `).run(parentId, childId, 'codex', 'spawned', 1);

    const result = await syncSource('codex');

    expect(result.errors).toEqual([]);
    expect(parseCodexSession).not.toHaveBeenCalled();
    const row = getDatabase().prepare(`
      SELECT relationship_type, parent_session_id, root_session_id
      FROM sessions
      WHERE id = ?
    `).get(childId) as {
      relationship_type: string;
      parent_session_id: string | null;
      root_session_id: string | null;
    };

    expect(row.relationship_type).toBe('subagent');
    expect(row.parent_session_id).toBe(parentId);
    expect(row.root_session_id).toBe(parentId);
  });

  it('path-scoped Codex sync backfills child relationships found in the parsed parent', async () => {
    const parentFilePath = await createCodexFile(codexRoot, 'parent.jsonl');
    const parentId = 'parent-session';
    const childId = 'child-session';
    mockCodexParse(parentId, [
      {
        type: 'subagent_link',
        subagentSessionId: childId,
        subagentSource: 'codex',
        relationship: 'spawned',
      },
    ]);

    const { openDatabase, initSchema, getDatabase } = await import('@/ingest/db');
    const { syncPaths } = await import('@/ingest/sync/index');
    openDatabase({ path: dbPath });
    initSchema();

    getDatabase().prepare(`
      INSERT INTO sessions (
        id, source, project, status, message_count, user_message_count,
        has_tool_calls, file_path, parser_malformed_lines, is_truncated, relationship_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      childId,
      'codex',
      'test',
      'idle',
      0,
      0,
      0,
      path.join(codexRoot, '2026', '05', '14', 'child.jsonl'),
      0,
      0,
      'root'
    );

    const result = await syncPaths('codex', [parentFilePath]);

    expect(result.errors).toEqual([]);
    const row = getDatabase().prepare(`
      SELECT relationship_type, parent_session_id, root_session_id, source_session_id
      FROM sessions
      WHERE id = ?
    `).get(childId) as {
      relationship_type: string;
      parent_session_id: string | null;
      root_session_id: string | null;
      source_session_id: string | null;
    };

    expect(row.relationship_type).toBe('subagent');
    expect(row.parent_session_id).toBe(parentId);
    expect(row.root_session_id).toBe(parentId);
    expect(row.source_session_id).toBe(childId);
  });
});
