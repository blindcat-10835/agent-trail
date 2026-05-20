import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import {
  decideCursorSync,
  PARSER_CACHE_VERSION,
  readFileSnapshotWithIdentity,
  type FileSnapshotWithIdentity,
  type SyncSourceType,
} from './index.js';

const tempDirs: string[] = [];
const databases: Database.Database[] = [];

afterEach(() => {
  while (databases.length > 0) {
    const db = databases.pop();
    if (db?.open) db.close();
  }

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function createDatabase(): Database.Database {
  const db = new Database(':memory:');
  databases.push(db);
  db.exec(`
    CREATE TABLE ingest_file_cursors (
      source_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      session_id TEXT,
      file_size INTEGER NOT NULL,
      file_mtime TEXT,
      file_inode INTEGER,
      file_device INTEGER,
      parser_version TEXT NOT NULL,
      last_indexed_offset INTEGER NOT NULL DEFAULT 0,
      last_indexed_line INTEGER NOT NULL DEFAULT 0,
      last_message_ordinal INTEGER NOT NULL DEFAULT -1,
      last_turn_index INTEGER NOT NULL DEFAULT -1,
      last_success_at TEXT,
      last_fallback_reason TEXT,
      PRIMARY KEY (source_type, file_path)
    );

    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      message_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL
    );
  `);
  return db;
}

function createJsonlFile(): { filePath: string; snapshot: FileSnapshotWithIdentity } {
  const dir = mkdtempSync(join(tmpdir(), 'cursor-test-'));
  tempDirs.push(dir);
  const filePath = join(dir, 'session-1.jsonl');
  writeFileSync(filePath, '{"type":"test"}\n', 'utf8');
  const snapshot = readFileSnapshotWithIdentity(filePath);
  if (!snapshot) throw new Error('Failed to stat temp file');
  return { filePath, snapshot };
}

function insertCursor(
  db: Database.Database,
  filePath: string,
  snapshot: FileSnapshotWithIdentity,
  sessionId: string | null,
  sourceType: SyncSourceType = 'claude-code'
): void {
  db.prepare(`
    INSERT INTO ingest_file_cursors (
      source_type, file_path, session_id, file_size, file_mtime,
      file_inode, file_device, parser_version, last_indexed_offset,
      last_indexed_line, last_message_ordinal, last_turn_index,
      last_success_at, last_fallback_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sourceType,
    filePath,
    sessionId,
    snapshot.size,
    snapshot.mtimeIso,
    snapshot.inode,
    snapshot.device,
    PARSER_CACHE_VERSION,
    snapshot.size,
    1,
    1,
    0,
    '2026-05-20T00:00:00.000Z',
    null
  );
}

describe('decideCursorSync', () => {
  it.each<SyncSourceType>(['claude-code', 'codex'])(
    'forces a full reparse when a %s cursor has no session id',
    (sourceType) => {
      const db = createDatabase();
      const { filePath, snapshot } = createJsonlFile();
      insertCursor(db, filePath, snapshot, null, sourceType);

      const decision = decideCursorSync(sourceType, filePath, snapshot, {}, db);

      expect(decision).toMatchObject({
        type: 'full_reparse',
        reason: 'missing_cursor_session',
      });
    }
  );

  it('forces a full reparse when stored message rows are incomplete', () => {
    const db = createDatabase();
    const { filePath, snapshot } = createJsonlFile();
    db.prepare('INSERT INTO sessions (id, message_count) VALUES (?, ?)').run('session-1', 2);
    insertCursor(db, filePath, snapshot, 'session-1');

    const decision = decideCursorSync('claude-code', filePath, snapshot, {}, db);

    expect(decision).toMatchObject({
      type: 'full_reparse',
      reason: 'derived_rows_missing',
    });
  });

  it('skips unchanged files when the cursor and derived rows are complete', () => {
    const db = createDatabase();
    const { filePath, snapshot } = createJsonlFile();
    db.prepare('INSERT INTO sessions (id, message_count) VALUES (?, ?)').run('session-1', 2);
    db.prepare('INSERT INTO messages (id, session_id) VALUES (?, ?)').run('msg-1', 'session-1');
    db.prepare('INSERT INTO messages (id, session_id) VALUES (?, ?)').run('msg-2', 'session-1');
    insertCursor(db, filePath, snapshot, 'session-1');

    const decision = decideCursorSync('claude-code', filePath, snapshot, {}, db);

    expect(decision).toMatchObject({ type: 'skip_unchanged' });
  });
});
