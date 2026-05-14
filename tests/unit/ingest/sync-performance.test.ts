import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const parseCodexSession = vi.fn();

vi.mock('@/ingest/parser/codex', () => ({
  parseCodexSession,
}));

function mockCodexParse(sessionId: string) {
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
    activities: [],
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
});
