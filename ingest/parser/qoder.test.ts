import { afterAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { parseQoderSession } from './qoder.js';

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createQoderFixture(): { dbPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'qoder-parser-test-'));
  tempDirs.push(root);

  const cacheRoot = join(root, 'cache');
  const dbDir = join(cacheRoot, 'db');
  mkdirSync(dbDir, { recursive: true });

  writeFileSync(
    join(cacheRoot, 'status.json'),
    JSON.stringify({
      user_type: 'personal_professional_plus',
    }),
  );

  const dbPath = join(dbDir, 'local.db');
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE chat_session (
      session_id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      session_title TEXT,
      project_id TEXT,
      project_uri TEXT,
      project_name TEXT,
      gmt_create INTEGER,
      gmt_modified INTEGER,
      org_id TEXT,
      session_type TEXT,
      mode TEXT,
      version INTEGER,
      preferred_model_info TEXT,
      stop_reason TEXT,
      extra TEXT,
      parent_session_id TEXT,
      parent_tool_call_id TEXT
    );

    CREATE TABLE chat_record (
      request_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      chat_task TEXT,
      chat_context TEXT,
      system_role_content TEXT,
      question TEXT,
      answer TEXT,
      like_status INTEGER,
      gmt_create INTEGER,
      gmt_modified INTEGER,
      finish_status INTEGER,
      filter_status TEXT,
      error_result TEXT,
      code_language TEXT,
      extra TEXT,
      session_type TEXT,
      summary TEXT,
      intention_type TEXT,
      reasoning_content TEXT,
      mode TEXT,
      chat_prompt TEXT,
      parent_session_id TEXT,
      parent_tool_call_id TEXT
    );

    CREATE TABLE chat_message (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      request_id TEXT,
      role TEXT NOT NULL,
      content TEXT,
      summary TEXT,
      summary_modified INTEGER,
      summary_trigger INTEGER,
      tool_result TEXT,
      token_info TEXT,
      model_info TEXT,
      extra TEXT,
      gmt_create INTEGER
    );
  `);

  db.prepare(`
    INSERT INTO chat_session (
      session_id, user_id, session_title, project_id, project_uri, project_name,
      gmt_create, gmt_modified, session_type, mode, version, preferred_model_info,
      stop_reason, extra, parent_session_id, parent_tool_call_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'root-session',
    'user-1',
    'Root session',
    'project-1',
    'file:///tmp/project',
    'project',
    Date.parse('2026-05-21T00:00:00.000Z'),
    Date.parse('2026-05-21T00:01:00.000Z'),
    'assistant',
    'agent',
    1,
    '{"model_key":"ultimate"}',
    'success',
    '{}',
    null,
    null,
  );

  db.prepare(`
    INSERT INTO chat_record (
      request_id, session_id, chat_task, gmt_create, gmt_modified, extra, session_type, mode
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'request-1',
    'root-session',
    'chat',
    Date.parse('2026-05-21T00:00:00.000Z'),
    Date.parse('2026-05-21T00:01:00.000Z'),
    '{"modelConfig":{"key":"ultimate"},"ideModelConfigOverride":{"max_input_tokens":200000}}',
    'assistant',
    'agent',
  );

  db.prepare(`
    INSERT INTO chat_message (
      id, session_id, request_id, role, content, token_info, model_info, extra, gmt_create
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'root-user',
    'root-session',
    'request-1',
    'user',
    'Please help',
    null,
    null,
    '{}',
    Date.parse('2026-05-21T00:00:00.000Z'),
  );

  db.prepare(`
    INSERT INTO chat_message (
      id, session_id, request_id, role, content, token_info, model_info, extra, gmt_create
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'root-assistant',
    'root-session',
    'request-1',
    'assistant',
    'Sure',
    '{"prompt_tokens":1200,"completion_tokens":300,"cached_tokens":100,"max_input_tokens":200000}',
    '{"model_key":"ultimate"}',
    '{}',
    Date.parse('2026-05-21T00:00:05.000Z'),
  );

  db.prepare(`
    INSERT INTO chat_session (
      session_id, user_id, session_title, project_id, project_uri, project_name,
      gmt_create, gmt_modified, session_type, mode, version, preferred_model_info,
      stop_reason, extra, parent_session_id, parent_tool_call_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'child-session',
    'user-1',
    'Child session',
    'project-1',
    'file:///tmp/project',
    'project',
    Date.parse('2026-05-21T00:00:10.000Z'),
    Date.parse('2026-05-21T00:00:20.000Z'),
    'agent_sub_search',
    'agent_sub',
    1,
    '{"model_key":"ultimate"}',
    'success',
    '{}',
    'root-session',
    'tool-call-1',
  );

  db.prepare(`
    INSERT INTO chat_record (
      request_id, session_id, chat_task, gmt_create, gmt_modified, extra, session_type, mode
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'request-2',
    'child-session',
    'chat',
    Date.parse('2026-05-21T00:00:10.000Z'),
    Date.parse('2026-05-21T00:00:20.000Z'),
    '{"modelConfig":{"key":"ultimate"},"ideModelConfigOverride":{"max_input_tokens":200000}}',
    'agent_sub_search',
    'agent_sub',
  );

  db.prepare(`
    INSERT INTO chat_message (
      id, session_id, request_id, role, content, token_info, model_info, extra, gmt_create
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'child-user',
    'child-session',
    'request-2',
    'user',
    'Search this',
    null,
    null,
    '{}',
    Date.parse('2026-05-21T00:00:10.000Z'),
  );

  db.prepare(`
    INSERT INTO chat_message (
      id, session_id, request_id, role, content, token_info, model_info, extra, gmt_create
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'child-assistant',
    'child-session',
    'request-2',
    'assistant',
    'Found it',
    '{"prompt_tokens":400,"completion_tokens":100,"cached_tokens":20,"max_input_tokens":200000}',
    '{"model_key":"ultimate"}',
    '{}',
    Date.parse('2026-05-21T00:00:15.000Z'),
  );

  db.close();
  return { dbPath };
}

describe('parseQoderSession cost estimation', () => {
  it('estimates root-session cost from Qoder Credits pricing rules', async () => {
    const fixture = createQoderFixture();

    const result = await parseQoderSession(fixture.dbPath, 'root-session');

    expect(result.errors).toHaveLength(0);
    expect(result.session.sourceCostUsd).toBe(0.048);
    expect(result.session.costSource).toBe('qoder-credit-estimate');
    expect(result.session.costPricingStatus).toBe('priced');
  });

  it('keeps subagent sessions costless to avoid double-counting parent request billing', async () => {
    const fixture = createQoderFixture();

    const result = await parseQoderSession(fixture.dbPath, 'child-session');

    expect(result.errors).toHaveLength(0);
    expect(result.session.relationshipType).toBe('subagent');
    expect(result.session.sourceCostUsd).toBeNull();
    expect(result.session.costSource).toBeNull();
  });
});
