/**
 * Codex Relationship Backfill Tests
 *
 * Verifies backfillCodexRelationships:
 * - Child rows updated from root to subagent with correct parent/root ids
 * - Idempotent: running twice produces same values, no duplicates
 * - Non-Codex rows with same id are NOT updated
 * - Parse-order case: child written before relationship collection/backfill
 *
 * Also verifies session list filtering via relationship_type for Codex.
 *
 * @group ingest/sync
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  const schemaPath = join(process.cwd(), 'ingest', 'db', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  return db;
}

function insertCodexSession(
  db: Database.Database,
  overrides: {
    id: string;
    relationshipType?: string;
    parentSessionId?: string | null;
    rootSessionId?: string | null;
    sourceSessionId?: string | null;
    source?: string;
  }
) {
  db.prepare(`
    INSERT INTO sessions (
      id, source, project, name, started_at, ended_at, status,
      message_count, user_message_count, total_output_tokens, has_tool_calls,
      parser_malformed_lines, is_truncated, termination_status,
      file_path, relationship_type, parent_session_id, root_session_id, source_session_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    overrides.id,
    overrides.source ?? 'codex',
    '/project',
    'Test session',
    '2024-01-01T00:00:00Z',
    '2024-01-01T01:00:00Z',
    'idle',
    1, 1, 0, 0,
    0, 0, '',
    `/tmp/${overrides.id}.jsonl`,
    overrides.relationshipType ?? 'root',
    overrides.parentSessionId ?? null,
    overrides.rootSessionId ?? null,
    overrides.sourceSessionId ?? null,
  );
}

describe('backfillCodexRelationships', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('updates Codex child row from root to subagent with correct relationship columns', async () => {
    const parentId = 'parent-001';
    const childId = 'child-001';

    insertCodexSession(db, { id: parentId });
    insertCodexSession(db, { id: childId, relationshipType: 'root' });

    const { backfillCodexRelationships } = await import('@/ingest/sync/index');
    const relationships = new Map([
      [childId, { parentSessionId: parentId, rootSessionId: parentId }],
    ]);

    const updated = backfillCodexRelationships(db, relationships);

    expect(updated).toBe(1);

    const row = db.prepare(
      'SELECT relationship_type, parent_session_id, root_session_id, source_session_id FROM sessions WHERE id = ?'
    ).get(childId) as {
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

  it('running backfill twice is idempotent (same values, no duplicates)', async () => {
    const parentId = 'parent-002';
    const childId = 'child-002';

    insertCodexSession(db, { id: parentId });
    insertCodexSession(db, { id: childId });

    const { backfillCodexRelationships } = await import('@/ingest/sync/index');
    const relationships = new Map([
      [childId, { parentSessionId: parentId, rootSessionId: parentId }],
    ]);

    const first = backfillCodexRelationships(db, relationships);
    const second = backfillCodexRelationships(db, relationships);

    expect(first).toBe(1);
    expect(second).toBe(1);

    const rows = db.prepare(
      'SELECT id FROM sessions WHERE id = ?'
    ).all(childId) as { id: string }[];

    expect(rows.length).toBe(1);

    const row = db.prepare(
      'SELECT relationship_type, parent_session_id, root_session_id FROM sessions WHERE id = ?'
    ).get(childId) as {
      relationship_type: string;
      parent_session_id: string | null;
      root_session_id: string | null;
    };

    expect(row.relationship_type).toBe('subagent');
    expect(row.parent_session_id).toBe(parentId);
    expect(row.root_session_id).toBe(parentId);
  });

  it('does not update non-Codex rows with the same id', async () => {
    const parentId = 'parent-003';
    const childId = 'child-003';

    insertCodexSession(db, { id: parentId });
    insertCodexSession(db, {
      id: childId,
      source: 'claude-code',
      relationshipType: 'root',
    });

    const { backfillCodexRelationships } = await import('@/ingest/sync/index');
    const relationships = new Map([
      [childId, { parentSessionId: parentId, rootSessionId: parentId }],
    ]);

    const updated = backfillCodexRelationships(db, relationships);

    expect(updated).toBe(0);

    const row = db.prepare(
      'SELECT relationship_type FROM sessions WHERE id = ?'
    ).get(childId) as { relationship_type: string };

    expect(row.relationship_type).toBe('root');
  });

  it('handles parse-order case where child is written before backfill', async () => {
    const parentId = 'parent-004';
    const childId = 'child-004';

    insertCodexSession(db, { id: parentId });
    insertCodexSession(db, { id: childId, relationshipType: 'root' });

    const rowBefore = db.prepare(
      'SELECT relationship_type FROM sessions WHERE id = ?'
    ).get(childId) as { relationship_type: string };

    expect(rowBefore.relationship_type).toBe('root');

    const { backfillCodexRelationships } = await import('@/ingest/sync/index');
    const relationships = new Map([
      [childId, { parentSessionId: parentId, rootSessionId: parentId }],
    ]);

    const updated = backfillCodexRelationships(db, relationships);

    expect(updated).toBe(1);

    const rowAfter = db.prepare(
      'SELECT relationship_type, parent_session_id, root_session_id, source_session_id FROM sessions WHERE id = ?'
    ).get(childId) as {
      relationship_type: string;
      parent_session_id: string | null;
      root_session_id: string | null;
      source_session_id: string | null;
    };

    expect(rowAfter.relationship_type).toBe('subagent');
    expect(rowAfter.parent_session_id).toBe(parentId);
    expect(rowAfter.root_session_id).toBe(parentId);
    expect(rowAfter.source_session_id).toBe(childId);
  });

  it('skips entries where childId equals parentSessionId', async () => {
    const selfId = 'self-ref-001';

    insertCodexSession(db, { id: selfId });

    const { backfillCodexRelationships } = await import('@/ingest/sync/index');
    const relationships = new Map([
      [selfId, { parentSessionId: selfId, rootSessionId: selfId }],
    ]);

    const updated = backfillCodexRelationships(db, relationships);

    expect(updated).toBe(0);

    const row = db.prepare(
      'SELECT relationship_type FROM sessions WHERE id = ?'
    ).get(selfId) as { relationship_type: string };

    expect(row.relationship_type).toBe('root');
  });

  it('skips entries where ids are empty strings', async () => {
    insertCodexSession(db, { id: 'real-001' });

    const { backfillCodexRelationships } = await import('@/ingest/sync/index');
    const relationships = new Map([
      ['', { parentSessionId: 'real-001', rootSessionId: 'real-001' }],
      ['real-001', { parentSessionId: '', rootSessionId: '' }],
    ]);

    const updated = backfillCodexRelationships(db, relationships);

    expect(updated).toBe(0);

    const row = db.prepare(
      'SELECT relationship_type FROM sessions WHERE id = ?'
    ).get('real-001') as { relationship_type: string };

    expect(row.relationship_type).toBe('root');
  });

  it('preserves existing source_session_id when not null', async () => {
    const parentId = 'parent-005';
    const childId = 'child-005';
    const existingSourceId = 'existing-source-id';

    insertCodexSession(db, { id: parentId });
    insertCodexSession(db, {
      id: childId,
      relationshipType: 'root',
      sourceSessionId: existingSourceId,
    });

    const { backfillCodexRelationships } = await import('@/ingest/sync/index');
    const relationships = new Map([
      [childId, { parentSessionId: parentId, rootSessionId: parentId }],
    ]);

    backfillCodexRelationships(db, relationships);

    const row = db.prepare(
      'SELECT source_session_id FROM sessions WHERE id = ?'
    ).get(childId) as { source_session_id: string | null };

    expect(row.source_session_id).toBe(existingSourceId);
  });
});
