/**
 * OpenCode Sync Integration Tests
 *
 * Tests the full sync pipeline: discover → sync → canonical DB verification.
 * Uses temporary opencode.db and canonical DB instances.
 */

import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import {
  createOpencodeTestDB,
  type TestOpencodeSession,
  type TestOpencodeFixture,
} from '../parser/opencode-test-db.js';
import { syncSource } from './index.js';
import { getDatabase, closeDatabase, openDatabase, initSchema } from '../db/index.js';

const fixtures: TestOpencodeFixture[] = [];
const canonicalDirs: string[] = [];

function track(fixture: TestOpencodeFixture): TestOpencodeFixture {
  fixtures.push(fixture);
  return fixture;
}

afterAll(() => {
  for (const f of fixtures) f.cleanup();
  for (const d of canonicalDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
  closeDatabase();
});

function makeSession(overrides: Partial<TestOpencodeSession> = {}): TestOpencodeSession {
  const id = randomUUID();
  return {
    id,
    slug: 'test-session',
    directory: '/test/project',
    timeCreated: '2026-05-17T10:00:00Z',
    timeUpdated: '2026-05-17T11:00:00Z',
    ...overrides,
  };
}

let parentSessionId: string;
let childSessionId: string;
let fixture: TestOpencodeFixture;

function createCanonicalDB(): void {
  const tmpDir = mkdtempSync(join(tmpdir(), 'canonical-test-'));
  canonicalDirs.push(tmpDir);
  const dbPath = join(tmpDir, 'canonical.db');

  mkdirSync(join(tmpDir), { recursive: true });
  closeDatabase();
  openDatabase({ path: dbPath });
  initSchema();
}

describe('syncOpencodeSource', () => {
  beforeAll(() => {
    parentSessionId = randomUUID();
    childSessionId = randomUUID();

    fixture = track(createOpencodeTestDB([
      makeSession({
        id: parentSessionId,
        title: 'Parent session',
        directory: '/test/project',
        messages: [
          {
            sessionId: parentSessionId,
            role: 'user',
            timeCreated: '2026-05-17T10:00:00Z',
            parts: [],
          },
          {
            sessionId: parentSessionId,
            role: 'assistant',
            timeCreated: '2026-05-17T10:00:01Z',
            parts: [
              {
                messageId: 'auto',
                sessionId: parentSessionId,
                type: 'text',
                data: { type: 'text', text: 'I will help you' },
                timeCreated: '2026-05-17T10:00:02Z',
              },
            ],
          },
        ],
      }),
      makeSession({
        id: childSessionId,
        parentId: parentSessionId,
        title: 'Subagent session',
        directory: '/test/project',
        messages: [
          {
            sessionId: childSessionId,
            role: 'user',
            timeCreated: '2026-05-17T10:01:00Z',
            parts: [],
          },
          {
            sessionId: childSessionId,
            role: 'assistant',
            timeCreated: '2026-05-17T10:01:01Z',
            parts: [
              {
                messageId: 'auto',
                sessionId: childSessionId,
                type: 'text',
                data: { type: 'text', text: 'Subagent response' },
                timeCreated: '2026-05-17T10:01:02Z',
              },
            ],
          },
        ],
      }),
    ]));

    process.env.OPENCODE_DB_PATH = fixture.dbPath;
  });

  afterAll(() => {
    delete process.env.OPENCODE_DB_PATH;
  });

  beforeEach(() => {
    createCanonicalDB();
  });

  it('syncs opencode sessions into canonical DB', async () => {
    const result = await syncSource('opencode');

    expect(result.errors).toHaveLength(0);
    expect(result.sessionsInserted).toBe(2);

    const database = getDatabase();
    const parent = database.prepare(
      'SELECT * FROM sessions WHERE id = ?'
    ).get(`opencode:${parentSessionId}`) as Record<string, unknown> | undefined;
    expect(parent).toBeDefined();
    expect(parent!.source).toBe('opencode');
    expect(parent!.name).toBe('Parent session');
    expect(parent!.relationship_type).toBe('root');

    const child = database.prepare(
      'SELECT * FROM sessions WHERE id = ?'
    ).get(`opencode:${childSessionId}`) as Record<string, unknown> | undefined;
    expect(child).toBeDefined();
    expect(child!.source).toBe('opencode');
    expect(child!.name).toBe('Subagent session');
    expect(child!.parent_session_id).toBe(`opencode:${parentSessionId}`);
    expect(child!.relationship_type).toBe('subagent');

    const messages = database.prepare(
      'SELECT COUNT(*) as cnt FROM messages WHERE session_id = ?'
    ).get(`opencode:${parentSessionId}`) as { cnt: number };
    expect(messages.cnt).toBe(2);
  });

  it('is idempotent on re-sync', async () => {
    const first = await syncSource('opencode');
    expect(first.errors).toHaveLength(0);
    expect(first.sessionsInserted).toBe(2);

    const second = await syncSource('opencode');
    expect(second.errors).toHaveLength(0);

    const database = getDatabase();
    const totalSessions = database.prepare(
      "SELECT COUNT(*) as cnt FROM sessions WHERE source = 'opencode'"
    ).get() as { cnt: number };
    expect(totalSessions.cnt).toBe(2);

    const totalMessages = database.prepare(
      "SELECT COUNT(*) as cnt FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE source = 'opencode')"
    ).get() as { cnt: number };
    expect(totalMessages.cnt).toBe(4);
  });

  it('verifies subagent parent-child relationship', async () => {
    const result = await syncSource('opencode');
    expect(result.errors).toHaveLength(0);
    expect(result.sessionsInserted).toBe(2);

    const database = getDatabase();
    const child = database.prepare(
      'SELECT parent_session_id, relationship_type FROM sessions WHERE id = ?'
    ).get(`opencode:${childSessionId}`) as {
      parent_session_id: string | null;
      relationship_type: string | null;
    } | undefined;

    expect(child).toBeDefined();
    expect(child!.parent_session_id).toBe(`opencode:${parentSessionId}`);
    expect(child!.relationship_type).toBe('subagent');
  });
});
