import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, statSync, writeFileSync, appendFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  decideCursorSync,
  findLastCompleteJsonlOffset,
  PARSER_CACHE_VERSION,
  readFileSnapshotWithIdentity,
  type IngestFileCursor,
  type SyncSourceType,
} from '@/ingest/sync';

const SOURCE: SyncSourceType = 'codex';

describe('ingest sync cursors', () => {
  let db: Database.Database;
  let tempDir: string;

  beforeEach(() => {
    db = new Database(':memory:');
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
    `);
    tempDir = mkdtempSync(join(tmpdir(), 'sync-cursor-'));
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('skips unchanged files without parser work', () => {
    const filePath = writeJsonl('unchanged.jsonl', '{"type":"event"}\n');
    const snapshot = readFileSnapshotWithIdentity(filePath);
    expect(snapshot).toBeDefined();
    seedCursor(filePath, {
      fileSize: snapshot!.size,
      fileMtime: snapshot!.mtimeIso,
      fileInode: snapshot!.inode,
      fileDevice: snapshot!.device,
      lastIndexedOffset: snapshot!.size,
      lastIndexedLine: 1,
      lastMessageOrdinal: 0,
      lastTurnIndex: 0,
    });

    const decision = decideCursorSync(SOURCE, filePath, snapshot, {}, db);

    expect(decision.type).toBe('skip_unchanged');
  });

  it('uses incremental append when identity is stable and new complete lines exist', () => {
    const initial = '{"type":"event","n":1}\n';
    const appended = '{"type":"event","n":2}\n';
    const filePath = writeJsonl('append.jsonl', initial);
    const initialSnapshot = readFileSnapshotWithIdentity(filePath)!;
    seedCursor(filePath, {
      fileSize: initialSnapshot.size,
      fileMtime: initialSnapshot.mtimeIso,
      fileInode: initialSnapshot.inode,
      fileDevice: initialSnapshot.device,
      lastIndexedOffset: Buffer.byteLength(initial),
      lastIndexedLine: 1,
      lastMessageOrdinal: 0,
      lastTurnIndex: 0,
    });
    appendFileSync(filePath, appended);
    const nextSnapshot = readFileSnapshotWithIdentity(filePath)!;

    const decision = decideCursorSync(SOURCE, filePath, nextSnapshot, {}, db);

    expect(decision.type).toBe('incremental_append');
    if (decision.type !== 'incremental_append') return;
    expect(decision.startOffset).toBe(Buffer.byteLength(initial));
    expect(decision.endOffset).toBe(Buffer.byteLength(initial + appended));
    expect(decision.startLine).toBe(1);
    expect(decision.startOrdinal).toBe(1);
    expect(decision.startTurnIndex).toBe(0);
  });

  it('falls back to full reparse when no cursor exists', () => {
    const filePath = writeJsonl('no-cursor.jsonl', '{"type":"event"}\n');
    const snapshot = readFileSnapshotWithIdentity(filePath)!;

    const decision = decideCursorSync(SOURCE, filePath, snapshot, {}, db);

    expect(decision).toMatchObject({ type: 'full_reparse', reason: 'no_cursor' });
  });

  it('falls back to full reparse when force is requested', () => {
    const filePath = writeJsonl('force.jsonl', '{"type":"event"}\n');
    const snapshot = readFileSnapshotWithIdentity(filePath)!;
    seedCursor(filePath, cursorFromSnapshot(snapshot));

    const decision = decideCursorSync(SOURCE, filePath, snapshot, { force: true }, db);

    expect(decision).toMatchObject({ type: 'full_reparse', reason: 'force' });
  });

  it('falls back to full reparse when the file was truncated', () => {
    const filePath = writeJsonl('truncated.jsonl', '{"type":"event"}\n');
    const snapshot = readFileSnapshotWithIdentity(filePath)!;
    seedCursor(filePath, {
      ...cursorFromSnapshot(snapshot),
      fileSize: snapshot.size + 10,
      lastIndexedOffset: snapshot.size + 10,
    });

    const decision = decideCursorSync(SOURCE, filePath, snapshot, {}, db);

    expect(decision).toMatchObject({ type: 'full_reparse', reason: 'truncated' });
  });

  it('falls back to full reparse when inode or device changes', () => {
    const filePath = writeJsonl('identity.jsonl', '{"type":"event"}\n');
    const snapshot = readFileSnapshotWithIdentity(filePath)!;
    seedCursor(filePath, {
      ...cursorFromSnapshot(snapshot),
      fileInode: snapshot.inode + 1,
    });

    const decision = decideCursorSync(SOURCE, filePath, snapshot, {}, db);

    expect(decision).toMatchObject({ type: 'full_reparse', reason: 'file_identity_changed' });
  });

  it('falls back to full reparse when parser version changes', () => {
    const filePath = writeJsonl('parser-version.jsonl', '{"type":"event"}\n');
    const snapshot = readFileSnapshotWithIdentity(filePath)!;
    seedCursor(filePath, {
      ...cursorFromSnapshot(snapshot),
      parserVersion: 'parser-v0',
    });

    const decision = decideCursorSync(SOURCE, filePath, snapshot, {}, db);

    expect(decision).toMatchObject({ type: 'full_reparse', reason: 'parser_version_changed' });
  });

  it('falls back to full reparse when snapshot is unavailable', () => {
    const decision = decideCursorSync(SOURCE, join(tempDir, 'missing.jsonl'), undefined, {}, db);

    expect(decision).toMatchObject({ type: 'full_reparse', reason: 'snapshot_unavailable' });
  });

  it('falls back to full reparse when cursor offsets are invalid', () => {
    const filePath = writeJsonl('invalid-offset.jsonl', '{"type":"event"}\n');
    const snapshot = readFileSnapshotWithIdentity(filePath)!;
    seedCursor(filePath, {
      ...cursorFromSnapshot(snapshot),
      lastIndexedOffset: -1,
    });

    const decision = decideCursorSync(SOURCE, filePath, snapshot, {}, db);

    expect(decision).toMatchObject({ type: 'full_reparse', reason: 'invalid_offset' });
  });

  it('does not advance the cursor for an appended partial line', () => {
    const initial = '{"type":"event","n":1}\n';
    const partial = '{"type":"event","n":2}';
    const filePath = writeJsonl('partial.jsonl', initial);
    const initialSnapshot = readFileSnapshotWithIdentity(filePath)!;
    seedCursor(filePath, {
      ...cursorFromSnapshot(initialSnapshot),
      lastIndexedOffset: Buffer.byteLength(initial),
      lastIndexedLine: 1,
      lastMessageOrdinal: 0,
      lastTurnIndex: 0,
    });
    appendFileSync(filePath, partial);
    const nextSnapshot = readFileSnapshotWithIdentity(filePath)!;

    const decision = decideCursorSync(SOURCE, filePath, nextSnapshot, {}, db);

    expect(decision).toMatchObject({ type: 'skip_unchanged', pendingPartialLine: true });
  });

  it('returns the last complete JSONL offset before a trailing partial line', () => {
    const initial = '{"type":"event","n":1}\n';
    const complete = '{"type":"event","n":2}\n';
    const partial = '{"type":"event","n":3}';
    const filePath = writeJsonl('complete-before-partial.jsonl', initial + complete + partial);

    const offset = findLastCompleteJsonlOffset(
      filePath,
      Buffer.byteLength(initial),
      statSync(filePath).size
    );

    expect(offset).toBe(Buffer.byteLength(initial + complete));
  });

  function writeJsonl(name: string, content: string): string {
    const filePath = join(tempDir, name);
    writeFileSync(filePath, content);
    return filePath;
  }

  function cursorFromSnapshot(snapshot: NonNullable<ReturnType<typeof readFileSnapshotWithIdentity>>) {
    return {
      fileSize: snapshot.size,
      fileMtime: snapshot.mtimeIso,
      fileInode: snapshot.inode,
      fileDevice: snapshot.device,
      lastIndexedOffset: snapshot.size,
      lastIndexedLine: 1,
      lastMessageOrdinal: 0,
      lastTurnIndex: 0,
    };
  }

  function seedCursor(filePath: string, overrides: Partial<IngestFileCursor>) {
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
        last_success_at,
        last_fallback_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      SOURCE,
      filePath,
      overrides.sessionId ?? 'cursor-test-session',
      overrides.fileSize ?? 0,
      overrides.fileMtime ?? null,
      overrides.fileInode ?? null,
      overrides.fileDevice ?? null,
      overrides.parserVersion ?? PARSER_CACHE_VERSION,
      overrides.lastIndexedOffset ?? 0,
      overrides.lastIndexedLine ?? 0,
      overrides.lastMessageOrdinal ?? -1,
      overrides.lastTurnIndex ?? -1,
      overrides.lastSuccessAt ?? '2026-05-15T00:00:00.000Z',
      overrides.lastFallbackReason ?? null
    );
  }
});
