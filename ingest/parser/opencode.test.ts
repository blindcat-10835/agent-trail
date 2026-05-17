/**
 * OpenCode Parser Tests
 *
 * Tests the SQLite readonly parser that reads opencode sessions from
 * opencode.db and produces canonical ParseResult objects.
 */

import { describe, it, expect, afterAll } from 'vitest';
import {
  parseOpencodeSession,
  computeOpencodeSkipKey,
  type OpencodeSessionRow,
} from './opencode.js';
import {
  createOpencodeTestDB,
  createMissingTablesDB,
  type TestOpencodeSession,
  type TestOpencodeFixture,
} from './opencode-test-db.js';
import type {
  TraceToolCall,
  TraceThinkingBlock,
  TraceSystemEvent,
  TraceSubagentLink,
} from '@/types/trace';
import { randomUUID } from 'crypto';

const fixtures: TestOpencodeFixture[] = [];

function track(fixture: TestOpencodeFixture): TestOpencodeFixture {
  fixtures.push(fixture);
  return fixture;
}

afterAll(() => {
  for (const f of fixtures) f.cleanup();
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

describe('parseOpencodeSession', () => {
  it('parses minimal session with 1 user message + 1 assistant text part', async () => {
    const sessionId = randomUUID();

    const fixture = track(createOpencodeTestDB([
      makeSession({
        id: sessionId,
        messages: [
          {
            sessionId,
            role: 'user',
            timeCreated: '2026-05-17T10:00:00Z',
            parts: [],
          },
          {
            sessionId,
            role: 'assistant',
            timeCreated: '2026-05-17T10:00:01Z',
            parts: [
              {
                messageId: 'auto',
                sessionId,
                type: 'text',
                data: { type: 'text', text: 'Hello from assistant' },
                timeCreated: '2026-05-17T10:00:02Z',
              },
            ],
          },
        ],
      }),
    ]));

    const result = await parseOpencodeSession(fixture.dbPath, sessionId);

    expect(result.errors).toHaveLength(0);
    expect(result.session.id).toBe(`opencode:${sessionId}`);
    expect(result.session.source).toBe('opencode');
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[1].role).toBe('assistant');
    expect(result.messages[1].content).toBe('Hello from assistant');
    expect(result.session.metrics.messageCount).toBe(2);
    expect(result.session.metrics.userMessageCount).toBe(1);
  });

  it('maps tool parts to TraceToolCall with correct categories', async () => {
    const sessionId = randomUUID();

    const fixture = track(createOpencodeTestDB([
      makeSession({
        id: sessionId,
        messages: [
          {
            sessionId,
            role: 'user',
            timeCreated: '2026-05-17T10:00:00Z',
            parts: [],
          },
          {
            sessionId,
            role: 'assistant',
            timeCreated: '2026-05-17T10:00:01Z',
            parts: [
              {
                messageId: 'auto',
                sessionId,
                type: 'tool',
                data: { type: 'tool', name: 'bash', id: 'call-1', input: { command: 'ls -la' }, output: 'file1.txt\nfile2.txt' },
                timeCreated: '2026-05-17T10:00:02Z',
              },
              {
                messageId: 'auto',
                sessionId,
                type: 'tool',
                data: { type: 'tool', name: 'read', id: 'call-2', input: { file_path: '/test/foo.ts' }, output: 'contents' },
                timeCreated: '2026-05-17T10:00:03Z',
              },
              {
                messageId: 'auto',
                sessionId,
                type: 'tool',
                data: { type: 'tool', name: 'edit', id: 'call-3', input: { file_path: '/test/foo.ts', old_string: 'x', new_string: 'y' } },
                timeCreated: '2026-05-17T10:00:04Z',
              },
              {
                messageId: 'auto',
                sessionId,
                type: 'tool',
                data: { type: 'tool', name: 'grep', id: 'call-4', input: { pattern: 'TODO' } },
                timeCreated: '2026-05-17T10:00:05Z',
              },
              {
                messageId: 'auto',
                sessionId,
                type: 'tool',
                data: { type: 'tool', name: 'glob', id: 'call-5', input: { pattern: '**/*.ts' } },
                timeCreated: '2026-05-17T10:00:06Z',
              },
              {
                messageId: 'auto',
                sessionId,
                type: 'tool',
                data: { type: 'tool', name: 'task', id: 'call-6', input: { prompt: 'do something' } },
                timeCreated: '2026-05-17T10:00:07Z',
              },
            ],
          },
        ],
      }),
    ]));

    const result = await parseOpencodeSession(fixture.dbPath, sessionId);

    expect(result.errors).toHaveLength(0);
    const toolCalls = result.activities.filter((a) => a.type === 'tool_call');
    expect(toolCalls).toHaveLength(6);

    const byName = (name: string) => toolCalls.find((tc): tc is TraceToolCall => tc.type === 'tool_call' && tc.name === name)!;

    expect(byName('bash').category).toBe('Bash');
    expect(byName('read').category).toBe('Read');
    expect(byName('edit').category).toBe('Edit');
    expect(byName('grep').category).toBe('Grep');
    expect(byName('glob').category).toBe('Grep');
    expect(byName('task').category).toBe('Task');
  });

  it('maps reasoning parts to TraceThinkingBlock', async () => {
    const sessionId = randomUUID();

    const fixture = track(createOpencodeTestDB([
      makeSession({
        id: sessionId,
        messages: [
          {
            sessionId,
            role: 'user',
            timeCreated: '2026-05-17T10:00:00Z',
            parts: [],
          },
          {
            sessionId,
            role: 'assistant',
            timeCreated: '2026-05-17T10:00:01Z',
            parts: [
              {
                messageId: 'auto',
                sessionId,
                type: 'reasoning',
                data: { type: 'reasoning', text: 'I should think about this...' },
                timeCreated: '2026-05-17T10:00:02Z',
              },
            ],
          },
        ],
      }),
    ]));

    const result = await parseOpencodeSession(fixture.dbPath, sessionId);

    const thinking = result.activities.filter((a) => a.type === 'thinking');
    expect(thinking).toHaveLength(1);
    expect((thinking[0] as TraceThinkingBlock).content).toBe('I should think about this...');
    expect((thinking[0] as TraceThinkingBlock).isRedacted).toBe(false);
  });

  it('maps patch parts to TraceToolCall category Edit', async () => {
    const sessionId = randomUUID();

    const fixture = track(createOpencodeTestDB([
      makeSession({
        id: sessionId,
        messages: [
          {
            sessionId,
            role: 'user',
            timeCreated: '2026-05-17T10:00:00Z',
            parts: [],
          },
          {
            sessionId,
            role: 'assistant',
            timeCreated: '2026-05-17T10:00:01Z',
            parts: [
              {
                messageId: 'auto',
                sessionId,
                type: 'patch',
                data: {
                  type: 'patch',
                  id: 'patch-1',
                  files: [
                    { path: '/test/foo.ts', content: 'new content' },
                  ],
                },
                timeCreated: '2026-05-17T10:00:02Z',
              },
            ],
          },
        ],
      }),
    ]));

    const result = await parseOpencodeSession(fixture.dbPath, sessionId);

    const patches = result.activities.filter(
      (a): a is TraceToolCall => a.type === 'tool_call' && a.name === 'patch',
    );
    expect(patches).toHaveLength(1);
    expect(patches[0].category).toBe('Edit');

    const input = JSON.parse(patches[0].inputJson);
    expect(input).toHaveLength(1);
    expect(input[0].path).toBe('/test/foo.ts');
  });

  it('maps step-start/step-finish to TraceSystemEvent', async () => {
    const sessionId = randomUUID();

    const fixture = track(createOpencodeTestDB([
      makeSession({
        id: sessionId,
        messages: [
          {
            sessionId,
            role: 'assistant',
            timeCreated: '2026-05-17T10:00:00Z',
            parts: [
              {
                messageId: 'auto',
                sessionId,
                type: 'step-start',
                data: { type: 'step-start', text: 'Starting step 1' },
                timeCreated: '2026-05-17T10:00:01Z',
              },
              {
                messageId: 'auto',
                sessionId,
                type: 'step-finish',
                data: { type: 'step-finish', text: 'Finished step 1' },
                timeCreated: '2026-05-17T10:00:02Z',
              },
            ],
          },
        ],
      }),
    ]));

    const result = await parseOpencodeSession(fixture.dbPath, sessionId);

    const events = result.activities.filter((a): a is TraceSystemEvent => a.type === 'system');
    expect(events).toHaveLength(2);
    expect(events[0].subtype).toBe('step-start');
    expect(events[1].subtype).toBe('step-finish');
  });

  it('maps parent_id to relationshipType subagent', async () => {
    const parentId = randomUUID();
    const childId = randomUUID();

    const fixture = track(createOpencodeTestDB([
      makeSession({ id: parentId }),
      makeSession({ id: childId, parentId: parentId }),
    ]));

    const result = await parseOpencodeSession(fixture.dbPath, childId);

    expect(result.session.parentSessionId).toBe(`opencode:${parentId}`);
    expect(result.session.relationshipType).toBe('subagent');
  });

  it('parses model JSON to provider/id format', async () => {
    const sessionId = randomUUID();

    const fixture = track(createOpencodeTestDB([
      makeSession({
        id: sessionId,
        model: { id: 'claude-sonnet-4-20250514', providerID: 'anthropic' },
        messages: [],
      }),
    ]));

    const result = await parseOpencodeSession(fixture.dbPath, sessionId);

    expect(result.session.model).toBe('anthropic/claude-sonnet-4-20250514');
  });

  it('preserves cost 0 with non-zero tokens', async () => {
    const sessionId = randomUUID();

    const fixture = track(createOpencodeTestDB([
      makeSession({
        id: sessionId,
        cost: 0,
        tokensInput: 500,
        tokensOutput: 200,
        tokensReasoning: 50,
        messages: [],
      }),
    ]));

    const result = await parseOpencodeSession(fixture.dbPath, sessionId);

    expect(result.session.metrics.inputTokens).toBe(500);
    expect(result.session.metrics.outputTokens).toBe(200);
    expect(result.session.metrics.reasoningTokens).toBe(50);
    expect(result.session.metrics.totalTokens).toBe(700);
  });

  it('returns error for non-existent session', async () => {
    const fixture = track(createOpencodeTestDB([makeSession()]));

    const result = await parseOpencodeSession(fixture.dbPath, 'non-existent-id');

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('Session not found');
    expect(result.session.status).toBe('error');
  });

  it('returns error for DB file not found', async () => {
    const result = await parseOpencodeSession(
      '/non/existent/path/opencode.db',
      'some-id',
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('Failed to open');
  });

  it('returns error for DB missing required tables', async () => {
    const fixture = track(createMissingTablesDB());

    const result = await parseOpencodeSession(fixture.dbPath, 'some-id');

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('missing tables');
  });

  it('maps subtask parts with session ID to TraceSubagentLink', async () => {
    const sessionId = randomUUID();
    const subSessionId = randomUUID();
    const msgId = randomUUID();

    const fixture = track(createOpencodeTestDB([
      makeSession({
        id: sessionId,
        messages: [
          {
            id: msgId,
            sessionId,
            role: 'assistant',
            parts: [
              {
                id: randomUUID(),
                messageId: msgId,
                sessionId,
                type: 'subtask',
                data: {
                  type: 'subtask',
                  sessionId: subSessionId,
                },
              },
            ],
          },
        ],
      }),
    ]));

    const result = await parseOpencodeSession(fixture.dbPath, sessionId);

    const links = result.activities.filter((a): a is TraceSubagentLink => a.type === 'subagent_link');
    expect(links).toHaveLength(1);
    expect(links[0].subagentSessionId).toBe(`opencode:${subSessionId}`);
    expect(links[0].subagentSource).toBe('opencode');
    expect(links[0].relationship).toBe('spawned');
  });

  it('maps subtask parts without session ID to TraceSystemEvent', async () => {
    const sessionId = randomUUID();
    const msgId = randomUUID();

    const fixture = track(createOpencodeTestDB([
      makeSession({
        id: sessionId,
        messages: [
          {
            id: msgId,
            sessionId,
            role: 'assistant',
            parts: [
              {
                id: randomUUID(),
                messageId: msgId,
                sessionId,
                type: 'subtask',
                data: { type: 'subtask', text: 'some subtask info' },
              },
            ],
          },
        ],
      }),
    ]));

    const result = await parseOpencodeSession(fixture.dbPath, sessionId);

    const events = result.activities.filter(
      (a): a is TraceSystemEvent => a.type === 'system' && a.subtype === 'subtask',
    );
    expect(events).toHaveLength(1);
  });

  it('maps file parts to attachment placeholder in content', async () => {
    const sessionId = randomUUID();
    const msgId = randomUUID();

    const fixture = track(createOpencodeTestDB([
      makeSession({
        id: sessionId,
        messages: [
          {
            id: msgId,
            sessionId,
            role: 'user',
            parts: [
              {
                id: randomUUID(),
                messageId: msgId,
                sessionId,
                type: 'file',
                data: { type: 'file', name: 'screenshot.png', path: '/tmp/screenshot.png' },
              },
            ],
          },
        ],
      }),
    ]));

    const result = await parseOpencodeSession(fixture.dbPath, sessionId);

    expect(result.messages[0].content).toContain('[Attachment: /tmp/screenshot.png]');
  });

  it('sets turn boundary on user messages', async () => {
    const sessionId = randomUUID();

    const fixture = track(createOpencodeTestDB([
      makeSession({
        id: sessionId,
        messages: [
          {
            sessionId,
            role: 'user',
            timeCreated: '2026-05-17T10:00:00Z',
            parts: [],
          },
          {
            sessionId,
            role: 'assistant',
            timeCreated: '2026-05-17T10:00:01Z',
            parts: [
              {
                messageId: 'auto',
                sessionId,
                type: 'text',
                data: { type: 'text', text: 'response 1' },
                timeCreated: '2026-05-17T10:00:02Z',
              },
            ],
          },
          {
            sessionId,
            role: 'user',
            timeCreated: '2026-05-17T10:00:03Z',
            parts: [],
          },
        ],
      }),
    ]));

    const result = await parseOpencodeSession(fixture.dbPath, sessionId);

    expect(result.messages[0].turnId).toBe('turn-0');
    expect(result.messages[0].turnIndex).toBe(0);
    expect(result.messages[1].turnId).toBe('turn-0');
    expect(result.messages[1].turnIndex).toBe(0);
    expect(result.messages[2].turnId).toBe('turn-1');
    expect(result.messages[2].turnIndex).toBe(1);
  });

  it('uses project worktree when project_id is set', async () => {
    const sessionId = randomUUID();
    const projectId = randomUUID();

    const fixture = track(
      createOpencodeTestDB(
        [
          makeSession({
            id: sessionId,
            projectId,
            directory: '/fallback/dir',
            messages: [],
          }),
        ],
        [{ id: projectId, worktree: '/my/project', name: 'my-project' }],
      ),
    );

    const result = await parseOpencodeSession(fixture.dbPath, sessionId);

    expect(result.session.project).toBe('/my/project');
  });

  it('uses projectOverride over project worktree', async () => {
    const sessionId = randomUUID();
    const projectId = randomUUID();

    const fixture = track(
      createOpencodeTestDB(
        [
          makeSession({
            id: sessionId,
            projectId,
            directory: '/fallback/dir',
            messages: [],
          }),
        ],
        [{ id: projectId, worktree: '/my/project', name: 'my-project' }],
      ),
    );

    const result = await parseOpencodeSession(
      fixture.dbPath,
      sessionId,
      '/override/path',
    );

    expect(result.session.project).toBe('/override/path');
  });

  it('uses session name from title fallback slug', async () => {
    const id1 = randomUUID();
    const id2 = randomUUID();

    const fixture = track(createOpencodeTestDB([
      makeSession({ id: id1, title: 'My Title', slug: 'my-slug', messages: [] }),
      makeSession({ id: id2, title: undefined, slug: 'slug-only', messages: [] }),
    ]));

    const r1 = await parseOpencodeSession(fixture.dbPath, id1);
    const r2 = await parseOpencodeSession(fixture.dbPath, id2);

    expect(r1.session.name).toBe('My Title');
    expect(r2.session.name).toBe('slug-only');
  });
});

describe('computeOpencodeSkipKey', () => {
  it('produces deterministic SHA-256 hash', () => {
    const session = {
      id: 'test-id',
      project_id: null,
      parent_id: null,
      slug: null,
      directory: null,
      title: null,
      version: null,
      agent: null,
      model: null,
      cost: 0,
      tokens_input: 0,
      tokens_output: 0,
      tokens_reasoning: 0,
      tokens_cache_read: 0,
      tokens_cache_write: 0,
      time_created: null,
      time_updated: '2026-05-17T01:00:00Z',
      time_archived: null,
      path: null,
      workspace_id: null,
    } satisfies OpencodeSessionRow;

    const key1 = computeOpencodeSkipKey(session, 10, 25);
    const key2 = computeOpencodeSkipKey(session, 10, 25);

    expect(key1).toBe(key2);
    expect(key1).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(key1)).toBe(true);
  });

  it('changes when message count changes', () => {
    const session = {
      id: 'test-id',
      project_id: null,
      parent_id: null,
      slug: null,
      directory: null,
      title: null,
      version: null,
      agent: null,
      model: null,
      cost: 0,
      tokens_input: 0,
      tokens_output: 0,
      tokens_reasoning: 0,
      tokens_cache_read: 0,
      tokens_cache_write: 0,
      time_created: null,
      time_updated: '2026-05-17T01:00:00Z',
      time_archived: null,
      path: null,
      workspace_id: null,
    } satisfies OpencodeSessionRow;

    const key1 = computeOpencodeSkipKey(session, 10, 25);
    const key2 = computeOpencodeSkipKey(session, 11, 25);

    expect(key1).not.toBe(key2);
  });
});
