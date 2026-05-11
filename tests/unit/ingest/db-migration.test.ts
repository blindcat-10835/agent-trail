import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { closeDatabase, initSchema, openDatabase } from '@/ingest/db';

describe('ingest database migrations', () => {
  let dbPath: string | undefined;
  let openedByTest = false;

  afterEach(() => {
    if (openedByTest) {
      closeDatabase();
      openedByTest = false;
    }
    if (dbPath) {
      rmSync(dbPath, { force: true });
      rmSync(`${dbPath}-shm`, { force: true });
      rmSync(`${dbPath}-wal`, { force: true });
      dbPath = undefined;
    }
  });

  it('migrates v5 databases before creating turn_index-dependent indexes', () => {
    dbPath = join(tmpdir(), `ingest-v5-migration-${randomUUID()}.db`);
    const seed = new Database(dbPath);
    seed.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL CHECK(source IN ('openclaw', 'claude-code', 'codex')),
        project TEXT NOT NULL,
        name TEXT,
        started_at TEXT,
        ended_at TEXT,
        status TEXT NOT NULL CHECK(status IN ('active', 'idle', 'aborted', 'error', 'unknown')),
        root_session_id TEXT,
        parent_session_id TEXT,
        relationship_type TEXT CHECK(relationship_type IN ('root', 'subagent', 'fork', 'continuation')),
        message_count INTEGER NOT NULL DEFAULT 0,
        user_message_count INTEGER NOT NULL DEFAULT 0,
        total_output_tokens INTEGER,
        has_tool_calls INTEGER NOT NULL DEFAULT 0 CHECK(has_tool_calls IN (0, 1)),
        file_path TEXT NOT NULL,
        file_size INTEGER,
        file_mtime TEXT,
        file_hash TEXT,
        last_sync_at TEXT,
        cwd TEXT,
        git_branch TEXT,
        source_session_id TEXT,
        source_version TEXT,
        parser_malformed_lines INTEGER NOT NULL DEFAULT 0,
        is_truncated INTEGER NOT NULL DEFAULT 0 CHECK(is_truncated IN (0, 1)),
        termination_status TEXT
      );

      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool_result')),
        content TEXT NOT NULL,
        timestamp TEXT,
        model TEXT,
        has_tool_use INTEGER NOT NULL DEFAULT 0 CHECK(has_tool_use IN (0, 1)),
        token_usage_json TEXT,
        source_file TEXT NOT NULL,
        source_line INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      PRAGMA user_version = 5;
    `);
    seed.close();

    openDatabase({ path: dbPath });
    openedByTest = true;

    expect(() => initSchema()).not.toThrow();

    const db = new Database(dbPath, { readonly: true });
    const columns = db.prepare('PRAGMA table_info(messages)').all() as { name: string }[];
    const indexes = db.prepare('PRAGMA index_list(messages)').all() as { name: string }[];
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const version = db.pragma('user_version', { simple: true });
    db.close();

    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['turn_id', 'turn_index', 'is_real_user_input'])
    );
    expect(indexes.map((index) => index.name)).toContain('idx_messages_session_turn_index');
    expect(tables.map((table) => table.name)).toContain('subagent_links');
    expect(version).toBe(10);
  });
});
