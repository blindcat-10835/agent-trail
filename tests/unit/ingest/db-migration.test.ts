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
    const sessionColumns = db.prepare('PRAGMA table_info(sessions)').all() as { name: string }[];
    const sessionIndexes = db.prepare('PRAGMA index_list(sessions)').all() as { name: string }[];
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
    expect(tables.map((table) => table.name)).toContain('ingest_file_cursors');
    expect(sessionColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'total_cache_read_tokens',
        'total_cache_write_tokens',
        'total_reasoning_tokens',
        'total_tokens',
      ])
    );
    expect(sessionIndexes.map((index) => index.name)).toContain('idx_sessions_source_started_at');
    expect(sessionIndexes.map((index) => index.name)).toContain('idx_sessions_source_agent_name');
    expect(version).toBe(15);
  });

  it('initializes ingest file cursor schema idempotently', () => {
    dbPath = join(tmpdir(), `ingest-cursor-schema-${randomUUID()}.db`);
    openDatabase({ path: dbPath });
    openedByTest = true;

    expect(() => initSchema()).not.toThrow();
    expect(() => initSchema()).not.toThrow();

    const db = new Database(dbPath, { readonly: true });
    const columns = db
      .prepare('PRAGMA table_info(ingest_file_cursors)')
      .all() as { name: string }[];
    const indexes = db
      .prepare('PRAGMA index_list(ingest_file_cursors)')
      .all() as { name: string }[];
    const sessionIndexes = db
      .prepare('PRAGMA index_list(sessions)')
      .all() as { name: string }[];
    const version = db.pragma('user_version', { simple: true });
    db.close();

    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'source_type',
        'file_path',
        'session_id',
        'file_size',
        'file_mtime',
        'file_inode',
        'file_device',
        'parser_version',
        'last_indexed_offset',
        'last_indexed_line',
        'last_message_ordinal',
        'last_turn_index',
        'last_success_at',
        'last_fallback_reason',
      ])
    );
    expect(indexes.map((index) => index.name)).toContain('idx_ingest_file_cursors_session_id');
    expect(sessionIndexes.map((index) => index.name)).toContain('idx_sessions_source_started_at');
    expect(sessionIndexes.map((index) => index.name)).toContain('idx_sessions_source_agent_name');
    expect(version).toBe(15);
  });

  it('enforces append writer idempotency constraints', () => {
    dbPath = join(tmpdir(), `ingest-append-constraints-${randomUUID()}.db`);
    openDatabase({ path: dbPath });
    openedByTest = true;
    initSchema();

    const db = new Database(dbPath);
    db.prepare(`
      INSERT INTO sessions (
        id, source, project, status, message_count, user_message_count,
        has_tool_calls, file_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('session-constraints', 'codex', 'test', 'idle', 0, 0, 1, '/tmp/session.jsonl');
    db.prepare(`
      INSERT INTO tool_calls (
        session_id, message_ordinal, tool_id, name, category, input_json, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('session-constraints', 1, 'call-1', 'bash', 'Bash', '{}', 'pending');
    expect(() => {
      db.prepare(`
        INSERT INTO tool_calls (
          session_id, message_ordinal, tool_id, name, category, input_json, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('session-constraints', 1, 'call-1', 'bash', 'Bash', '{}', 'pending');
    }).toThrow();

    const toolCallId = (
      db.prepare('SELECT id FROM tool_calls WHERE session_id = ? AND tool_id = ?')
        .get('session-constraints', 'call-1') as { id: number }
    ).id;
    db.prepare(`
      INSERT INTO tool_result_events (tool_call_id, timestamp, content, is_partial)
      VALUES (?, ?, ?, ?)
    `).run(toolCallId, null, 'same output', 0);
    expect(() => {
      db.prepare(`
        INSERT INTO tool_result_events (tool_call_id, timestamp, content, is_partial)
        VALUES (?, ?, ?, ?)
      `).run(toolCallId, null, 'same output', 0);
    }).toThrow();

    db.prepare(`
      INSERT INTO subagent_links (
        session_id, subagent_session_id, subagent_source, relationship, message_ordinal
      ) VALUES (?, ?, ?, ?, ?)
    `).run('session-constraints', 'child-1', 'codex', 'spawned', null);
    expect(() => {
      db.prepare(`
        INSERT INTO subagent_links (
          session_id, subagent_session_id, subagent_source, relationship, message_ordinal
        ) VALUES (?, ?, ?, ?, ?)
      `).run('session-constraints', 'child-1', 'codex', 'spawned', null);
    }).toThrow();
    db.close();
  });

  // ====================================================================
  // Phase 18: Qoder source CHECK widening (merged into migration v15)
  // ====================================================================

  it('accepts source = qoder after migration (positive INSERT)', () => {
    dbPath = join(tmpdir(), `ingest-qoder-positive-${randomUUID()}.db`);
    openDatabase({ path: dbPath });
    openedByTest = true;
    initSchema();

    const db = new Database(dbPath);
    db.prepare(`
      INSERT INTO sessions (
        id, source, project, status, message_count, user_message_count,
        has_tool_calls, file_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('qoder:positive-1', 'qoder', 'demo', 'active', 0, 0, 0, '/tmp/qoder.db');

    const row = db.prepare(
      `SELECT id, source FROM sessions WHERE id = 'qoder:positive-1'`
    ).get() as { id: string; source: string } | undefined;
    expect(row).toBeDefined();
    expect(row?.source).toBe('qoder');

    // Subagent link with subagent_source='qoder' must also succeed.
    db.prepare(`
      INSERT INTO subagent_links (
        session_id, subagent_session_id, subagent_source, relationship, message_ordinal
      ) VALUES (?, ?, ?, ?, ?)
    `).run('qoder:positive-1', 'qoder:child-1', 'qoder', 'spawned', null);
    const linkRow = db.prepare(
      `SELECT subagent_source FROM subagent_links WHERE session_id = 'qoder:positive-1'`
    ).get() as { subagent_source: string } | undefined;
    expect(linkRow?.subagent_source).toBe('qoder');

    // ingest_file_cursors with source_type='qoder' must also succeed.
    db.prepare(`
      INSERT INTO ingest_file_cursors (
        source_type, file_path, parser_version, file_size
      ) VALUES (?, ?, ?, ?)
    `).run('qoder', '/tmp/qoder/local.db', 'qoder@1.0.0', 1024);
    const cursorRow = db.prepare(
      `SELECT source_type FROM ingest_file_cursors WHERE source_type = 'qoder'`
    ).get() as { source_type: string } | undefined;
    expect(cursorRow?.source_type).toBe('qoder');

    db.close();
  });

  it('rejects unknown source values (qoder-typo) — CHECK still enforced', () => {
    dbPath = join(tmpdir(), `ingest-qoder-negative-${randomUUID()}.db`);
    openDatabase({ path: dbPath });
    openedByTest = true;
    initSchema();

    const db = new Database(dbPath);
    expect(() => {
      db.prepare(`
        INSERT INTO sessions (
          id, source, project, status, message_count, user_message_count,
          has_tool_calls, file_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('qoder-typo:1', 'qoder-typo', 'demo', 'active', 0, 0, 0, '/tmp/x.db');
    }).toThrow(/CHECK/i);

    expect(() => {
      db.prepare(`
        INSERT INTO subagent_links (
          session_id, subagent_session_id, subagent_source, relationship
        ) VALUES (?, ?, ?, ?)
      `).run('parent-x', 'child-x', 'qoder-typo', 'spawned');
    }).toThrow(/CHECK/i);

    db.close();
  });

  it('preserves rows of pre-existing sources across the v15 migration', () => {
    // Build a synthetic v13 DB by initialising the schema (which lands at v15)
    // with rows pre-inserted, then resetting user_version back to 13 and
    // re-running migrations so the v15 replacement-table step fires against
    // populated tables.
    //
    // Note on file_hash assertions: earlier (pre-v15) migrations contain
    // their own NULL-flush steps targeting source IN ('claude-code','codex')
    // that re-fire on every run from v<13. We therefore assert file_hash
    // preservation only for an openclaw row whose agent_name AND name are
    // already set, total_input_tokens > 0, and project / file_path do not
    // match any stale-metadata gate (the only openclaw flush is gated on
    // agent_name IS NULL; several earlier flushes are gated on name IS NULL
    // or total_input_tokens = 0). Row identity and source columns must
    // survive for ALL pre-existing sources.
    dbPath = join(tmpdir(), `ingest-qoder-preservation-${randomUUID()}.db`);
    openDatabase({ path: dbPath });
    openedByTest = true;
    initSchema();

    const dbWrite = new Database(dbPath);
    dbWrite.prepare(`
      INSERT INTO sessions (
        id, source, project, status, message_count, user_message_count,
        has_tool_calls, file_path, file_hash, agent_name, name, total_input_tokens
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('codex:keep-1', 'codex', 'p1', 'idle', 5, 2, 1, '/tmp/codex.jsonl', 'codex-hash-1', null, 'codex keep 1', 100);
    dbWrite.prepare(`
      INSERT INTO sessions (
        id, source, project, status, message_count, user_message_count,
        has_tool_calls, file_path, file_hash, agent_name, name, total_input_tokens
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('claude-code:keep-2', 'claude-code', 'p2', 'active', 3, 1, 0, '/tmp/cc.jsonl', 'cc-hash-2', null, 'cc keep 2', 100);
    dbWrite.prepare(`
      INSERT INTO sessions (
        id, source, project, status, message_count, user_message_count,
        has_tool_calls, file_path, file_hash, agent_name, name, total_input_tokens
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('openclaw:keep-3', 'openclaw', 'p3', 'idle', 7, 3, 1, '/tmp/ow.jsonl', 'ow-hash-3', 'preset-agent', 'ow keep 3', 100);
    dbWrite.prepare(`
      INSERT INTO subagent_links (
        session_id, subagent_session_id, subagent_source, relationship
      ) VALUES (?, ?, ?, ?)
    `).run('codex:keep-1', 'codex:child-keep', 'codex', 'spawned');
    dbWrite.prepare(`
      INSERT INTO ingest_file_cursors (
        source_type, file_path, parser_version, file_size
      ) VALUES (?, ?, ?, ?)
    `).run('codex', '/tmp/codex.jsonl', 'codex@1', 999);
    // Sanity probe: confirm pre-migration state has the rows we expect.
    const preLinks = dbWrite.prepare('SELECT COUNT(*) as c FROM subagent_links').get() as { c: number };
    const preCursors = dbWrite.prepare('SELECT COUNT(*) as c FROM ingest_file_cursors').get() as { c: number };
    expect(preLinks.c).toBeGreaterThan(0);
    expect(preCursors.c).toBeGreaterThan(0);
    // Force a re-run of migrations including the v15 replacement step.
    dbWrite.pragma('user_version = 13');
    dbWrite.close();

    // closeDatabase() is required because runMigrations() uses the
    // module-level `db` handle opened by initSchema() above. Reopen via the
    // public API and rerun runMigrations indirectly through initSchema.
    closeDatabase();
    openedByTest = false;
    openDatabase({ path: dbPath });
    openedByTest = true;
    expect(() => initSchema()).not.toThrow();

    const dbRead = new Database(dbPath, { readonly: true });
    const sessionRows = dbRead.prepare(
      `SELECT id, source, file_hash FROM sessions ORDER BY id`
    ).all() as { id: string; source: string; file_hash: string | null }[];
    const linkRows = dbRead.prepare(
      `SELECT session_id, subagent_source FROM subagent_links`
    ).all() as { session_id: string; subagent_source: string }[];
    const cursorRows = dbRead.prepare(
      `SELECT source_type, file_path FROM ingest_file_cursors`
    ).all() as { source_type: string; file_path: string }[];
    const version = dbRead.pragma('user_version', { simple: true });
    dbRead.close();

    expect(version).toBe(15);
    // All three pre-existing rows survive the rebuild.
    const ids = sessionRows.map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining(['codex:keep-1', 'claude-code:keep-2', 'openclaw:keep-3'])
    );
    const codexRow = sessionRows.find((r) => r.id === 'codex:keep-1');
    const ccRow = sessionRows.find((r) => r.id === 'claude-code:keep-2');
    const owRow = sessionRows.find((r) => r.id === 'openclaw:keep-3');
    expect(codexRow?.source).toBe('codex');
    expect(ccRow?.source).toBe('claude-code');
    expect(owRow?.source).toBe('openclaw');
    // openclaw row with agent_name preset survives untouched (no flush
    // applies to it). This is the canonical "file_hash preserved across
    // v15 rebuild" assertion that is robust against unrelated earlier
    // pre-v15 NULL-flush steps.
    expect(owRow?.file_hash).toBe('ow-hash-3');
    // Subagent_links rows preserved through the rebuild.
    expect(linkRows.map((r) => r.session_id)).toContain('codex:keep-1');
    expect(linkRows.map((r) => r.subagent_source)).toContain('codex');
    // ingest_file_cursors rows preserved through the rebuild.
    expect(cursorRows.map((r) => r.source_type)).toContain('codex');
  });

  it('NULL-flushes file_hash for qoder rows only — other sources untouched (D-04)', () => {
    dbPath = join(tmpdir(), `ingest-qoder-flush-${randomUUID()}.db`);
    openDatabase({ path: dbPath });
    openedByTest = true;
    initSchema();

    const dbWrite = new Database(dbPath);
    // Insert one row per source with a non-NULL file_hash (allowed because
    // initSchema already brought us to v15 with the widened CHECK). Use
    // openclaw with agent_name preset as the witness for "other sources
    // untouched" — it is the only source whose file_hash is not flushed by
    // any pre-v15 cumulative NULL-flush step in runMigrations().
    dbWrite.prepare(`
      INSERT INTO sessions (
        id, source, project, status, message_count, user_message_count,
        has_tool_calls, file_path, file_hash, agent_name, name, total_input_tokens
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('qoder:flush-1', 'qoder', 'demo', 'idle', 0, 0, 0, '/tmp/q.db', 'qoder-fp-PRE', null, 'qoder flush witness', 100);
    dbWrite.prepare(`
      INSERT INTO sessions (
        id, source, project, status, message_count, user_message_count,
        has_tool_calls, file_path, file_hash, agent_name, name, total_input_tokens
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('openclaw:flush-witness', 'openclaw', 'demo', 'idle', 0, 0, 0, '/tmp/ow.jsonl', 'ow-fp-PRE', 'preset-agent', 'ow flush witness', 100);
    // Reset user_version so re-running migrations re-applies v15 (including
    // the own-source NULL-flush step).
    dbWrite.pragma('user_version = 13');
    dbWrite.close();

    closeDatabase();
    openedByTest = false;
    openDatabase({ path: dbPath });
    openedByTest = true;
    expect(() => initSchema()).not.toThrow();

    const dbRead = new Database(dbPath, { readonly: true });
    const qoderRow = dbRead.prepare(
      `SELECT file_hash FROM sessions WHERE id = 'qoder:flush-1'`
    ).get() as { file_hash: string | null } | undefined;
    const owRow = dbRead.prepare(
      `SELECT file_hash FROM sessions WHERE id = 'openclaw:flush-witness'`
    ).get() as { file_hash: string | null } | undefined;
    dbRead.close();

    // qoder row: file_hash NULL'd by the v15 own-source flush step.
    expect(qoderRow?.file_hash).toBeNull();
    // openclaw row: untouched by the v15 step (D-04: own-source-only flush).
    expect(owRow?.file_hash).toBe('ow-fp-PRE');
  });
});
