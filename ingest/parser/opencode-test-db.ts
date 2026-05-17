/**
 * OpenCode Test DB Helper
 *
 * Creates temporary SQLite databases with opencode schema for parser tests.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

export interface TestOpencodePart {
  id?: string;
  messageId?: string | 'auto';
  sessionId: string;
  type: string;
  data: Record<string, unknown>;
  timeCreated?: string;
}

export interface TestOpencodeMessage {
  id?: string;
  sessionId: string;
  role: string;
  data?: Record<string, unknown>;
  timeCreated?: string;
  parts?: TestOpencodePart[];
}

export interface TestOpencodeProject {
  id: string;
  worktree: string;
  name: string;
  vcs?: string;
}

export interface TestOpencodeSession {
  id: string;
  projectId?: string;
  parentId?: string;
  slug?: string;
  directory?: string;
  title?: string;
  version?: string;
  agent?: string;
  model?: { id: string; providerID: string };
  cost?: number;
  tokensInput?: number;
  tokensOutput?: number;
  tokensReasoning?: number;
  tokensCacheRead?: number;
  tokensCacheWrite?: number;
  timeCreated?: string;
  timeUpdated?: string;
  timeArchived?: string;
  path?: string;
  workspaceId?: string;
  messages?: TestOpencodeMessage[];
}

export interface TestOpencodeFixture {
  dbPath: string;
  cleanup: () => void;
}

const OPENCODE_SCHEMA = `
CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  parent_id TEXT,
  slug TEXT,
  directory TEXT,
  title TEXT,
  version TEXT,
  agent TEXT,
  model TEXT,
  cost REAL DEFAULT 0,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  tokens_reasoning INTEGER DEFAULT 0,
  tokens_cache_read INTEGER DEFAULT 0,
  tokens_cache_write INTEGER DEFAULT 0,
  time_created TEXT,
  time_updated TEXT,
  time_archived TEXT,
  path TEXT,
  workspace_id TEXT
);

CREATE TABLE IF NOT EXISTS message (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  time_created TEXT,
  time_updated TEXT,
  data TEXT,
  FOREIGN KEY (session_id) REFERENCES session(id)
);

CREATE TABLE IF NOT EXISTS part (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  time_created TEXT,
  time_updated TEXT,
  data TEXT,
  FOREIGN KEY (message_id) REFERENCES message(id),
  FOREIGN KEY (session_id) REFERENCES session(id)
);

CREATE TABLE IF NOT EXISTS project (
  id TEXT PRIMARY KEY,
  worktree TEXT,
  name TEXT,
  vcs TEXT
);
`;

export function createOpencodeTestDB(
  sessions: TestOpencodeSession[],
  projects?: TestOpencodeProject[],
): TestOpencodeFixture {
  const tmpDir = mkdtempSync(join(tmpdir(), 'opencode-test-'));
  const dbPath = join(tmpDir, `opencode-${randomUUID()}.db`);
  const sqlite = new Database(dbPath);

  sqlite.exec(OPENCODE_SCHEMA);

  if (projects) {
    const insertProject = sqlite.prepare(
      'INSERT INTO project (id, worktree, name, vcs) VALUES (?, ?, ?, ?)',
    );
    for (const p of projects) {
      insertProject.run(p.id, p.worktree, p.name, p.vcs ?? 'git');
    }
  }

  const insertSession = sqlite.prepare(`
    INSERT INTO session (id, project_id, parent_id, slug, directory, title, version,
      agent, model, cost, tokens_input, tokens_output, tokens_reasoning,
      tokens_cache_read, tokens_cache_write, time_created, time_updated,
      time_archived, path, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMessage = sqlite.prepare(
    'INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)',
  );

  const insertPart = sqlite.prepare(
    'INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?)',
  );

  for (const session of sessions) {
    insertSession.run(
      session.id,
      session.projectId ?? null,
      session.parentId ?? null,
      session.slug ?? 'test-slug',
      session.directory ?? '/test/dir',
      session.title ?? null,
      session.version ?? '1.0.0',
      session.agent ?? 'coder',
      session.model ? JSON.stringify(session.model) : null,
      session.cost ?? 0,
      session.tokensInput ?? 0,
      session.tokensOutput ?? 0,
      session.tokensReasoning ?? 0,
      session.tokensCacheRead ?? 0,
      session.tokensCacheWrite ?? 0,
      session.timeCreated ?? '2026-05-17T00:00:00Z',
      session.timeUpdated ?? '2026-05-17T01:00:00Z',
      session.timeArchived ?? null,
      session.path ?? '/test/path',
      session.workspaceId ?? null,
    );

    if (session.messages) {
      for (const msg of session.messages) {
        const msgId = msg.id ?? randomUUID();
        insertMessage.run(
          msgId,
          msg.sessionId,
          msg.timeCreated ?? '2026-05-17T00:00:00Z',
          msg.timeCreated ?? '2026-05-17T00:00:00Z',
          JSON.stringify({
            role: msg.role,
            ...msg.data,
          }),
        );

        if (msg.parts) {
          for (const part of msg.parts) {
            const partId = part.id ?? randomUUID();
            const partMsgId = part.messageId === 'auto' || !part.messageId ? msgId : part.messageId;
            insertPart.run(
              partId,
              partMsgId,
              part.sessionId,
              part.timeCreated ?? '2026-05-17T00:00:00Z',
              part.timeCreated ?? '2026-05-17T00:00:00Z',
              JSON.stringify(part.data),
            );
          }
        }
      }
    }
  }

  sqlite.close();

  return {
    dbPath,
    cleanup: () => {
      rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

export function createMissingTablesDB(): TestOpencodeFixture {
  const tmpDir = mkdtempSync(join(tmpdir(), 'opencode-test-'));
  const dbPath = join(tmpDir, `opencode-bad-${randomUUID()}.db`);
  const sqlite = new Database(dbPath);
  sqlite.exec('CREATE TABLE IF NOT EXISTS foo (id TEXT PRIMARY KEY)');
  sqlite.close();

  return {
    dbPath,
    cleanup: () => {
      rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}
