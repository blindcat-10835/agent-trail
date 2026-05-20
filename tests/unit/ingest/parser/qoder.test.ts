/**
 * Qoder Parser Unit Tests
 *
 * Tests against the synthetic SQLite fixture (build-fixture.ts).
 * Validates canonical mapping for:
 *   - Session ID prefix (qoder:<raw>)
 *   - 7 tool categories
 *   - ERROR tool status and errorMsg
 *   - Token attribution (SPEC §8: totalTokens = prompt + completion ONLY)
 *   - Subagent link (TraceSubagentLink with subagentSource:'qoder')
 *   - Malformed JSON warning
 *   - Fingerprint determinism
 *   - Privacy static check
 *
 * @module tests/unit/ingest/parser/qoder.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  parseQoderSession,
  inferQoderToolCategory,
  computeQoderSessionFingerprint,
} from '@/ingest/parser/qoder';
import {
  buildQoderFixture,
  ROOT_SESSION_ID,
  SUBAGENT_SESSION_ID,
  USER_MSG_ID,
  ASSISTANT_MSG_ID,
  TC_READ_FILE,
  TC_SEARCH_FILE,
  TC_GREP_CODE,
  TC_SEARCH_CODEBASE,
  TC_LIST_DIR,
  TC_RUN_TERMINAL,
  TC_AGENT,
} from '@/tests/fixtures/qoder/build-fixture';
import type { TraceToolCall, TraceSubagentLink, ToolCategory } from '@/types/trace';

// ============================================================================
// Fixture setup
// ============================================================================

const TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), 'qoder-test-'));
const FIXTURE_PATH = path.join(TMPDIR, 'test-qoder.db');

beforeAll(() => {
  buildQoderFixture(FIXTURE_PATH);
});

afterAll(() => {
  try {
    fs.rmSync(TMPDIR, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

// ============================================================================
// Tests
// ============================================================================

describe('parseQoderSession', () => {
  describe('canonical session id prefix', () => {
    it('prefixes session.id with "qoder:" and preserves raw ID in sourceSessionId', async () => {
      const result = await parseQoderSession(FIXTURE_PATH, ROOT_SESSION_ID);

      expect(result.session.id).toBe(`qoder:${ROOT_SESSION_ID}`);
      expect(result.session.source).toBe('qoder');
      expect(result.session.sourceSessionId).toBe(ROOT_SESSION_ID);
    });

    it('sets relationshipType to "root" for root session', async () => {
      const result = await parseQoderSession(FIXTURE_PATH, ROOT_SESSION_ID);
      expect(result.session.relationshipType).toBe('root');
      expect(result.session.parentSessionId).toBeUndefined();
    });

    it('sets relationshipType to "subagent" for subagent session', async () => {
      const result = await parseQoderSession(FIXTURE_PATH, SUBAGENT_SESSION_ID);
      expect(result.session.relationshipType).toBe('subagent');
      expect(result.session.parentSessionId).toBe(`qoder:${ROOT_SESSION_ID}`);
    });
  });

  describe('tool categories', () => {
    let toolCalls: TraceToolCall[];

    beforeAll(async () => {
      const result = await parseQoderSession(FIXTURE_PATH, ROOT_SESSION_ID);
      toolCalls = result.activities.filter(
        (a): a is TraceToolCall => a.type === 'tool_call'
      );
    });

    it('maps all 7 Qoder tools to correct categories', () => {
      const expected: Record<string, ToolCategory> = {
        read_file: 'Read',
        search_file: 'Grep',
        grep_code: 'Grep',
        search_codebase: 'Grep',
        list_dir: 'Read',
        run_in_terminal: 'Bash',
        Agent: 'Agent',
      };

      for (const [toolName, expectedCategory] of Object.entries(expected)) {
        const tc = toolCalls.find(t => t.name === toolName);
        expect(tc).toBeDefined();
        expect(tc!.category).toBe(expectedCategory);
      }
    });

    it('maps unknown tools to Other', () => {
      expect(inferQoderToolCategory('unknown_tool')).toBe('Other');
      expect(inferQoderToolCategory('')).toBe('Other');
    });
  });

  describe('ERROR tool', () => {
    it('surfaces status="error" and errorMsg', async () => {
      const result = await parseQoderSession(FIXTURE_PATH, ROOT_SESSION_ID);
      const toolCalls = result.activities.filter(
        (a): a is TraceToolCall => a.type === 'tool_call'
      );

      const errorTool = toolCalls.find(t => t.name === 'run_in_terminal');
      expect(errorTool).toBeDefined();
      expect(errorTool!.status).toBe('error');
      expect(errorTool!.error).toBeTruthy();
      expect(errorTool!.error).toContain('Permission denied');
      expect(errorTool!.resultEvents.length).toBeGreaterThan(0);
    });
  });

  describe('token attribution (SPEC §8)', () => {
    it('resolves assistant and session model from chat_record.extra via request_id', async () => {
      const result = await parseQoderSession(FIXTURE_PATH, ROOT_SESSION_ID);
      const assistant = result.messages.find((msg) => msg.role === 'assistant');

      expect(assistant).toBeDefined();
      expect(assistant!.model).toBe('experts-ultimate');
      expect(result.session.model).toBe('experts-ultimate');
    });

    it('computes totalTokens = prompt_tokens + completion_tokens ONLY', async () => {
      const result = await parseQoderSession(FIXTURE_PATH, ROOT_SESSION_ID);

      // From fixture: prompt_tokens=120, completion_tokens=80, cached_tokens=40
      // totalTokens MUST be 200, NOT 240 (no cached_tokens)
      const metrics = result.session.metrics;

      expect(metrics.inputTokens).toBe(120);
      expect(metrics.outputTokens).toBe(80);
      expect(metrics.cacheReadTokens).toBe(40);
      expect(metrics.totalTokens).toBe(200);

      // Explicitly assert that adding cache_read would have been wrong
      expect(metrics.totalTokens).not.toBe(240);
    });

    it('message token usage and session totals match', async () => {
      const result = await parseQoderSession(FIXTURE_PATH, ROOT_SESSION_ID);
      const assistant = result.messages.find((msg) => msg.role === 'assistant');

      expect(assistant?.tokenUsage).toEqual({
        inputTokens: 120,
        outputTokens: 80,
        cacheReadTokens: 40,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        totalTokens: 200,
      });

      // Session metrics reflect the sum of all assistant message token_info
      expect(result.session.metrics.inputTokens).toBe(120);
      expect(result.session.metrics.outputTokens).toBe(80);
      expect(result.session.metrics.cacheReadTokens).toBe(40);
      expect(result.session.metrics.totalTokens).toBe(200);
    });
  });

  describe('plaintext conversation history fallback', () => {
    it('uses Qoder conversation-history text when chat_message.content is encrypted', async () => {
      const encryptedFixturePath = path.join(TMPDIR, 'encrypted-qoder.db');
      buildQoderFixture(encryptedFixturePath);

      const encryptedUserContent = Buffer.from(
        Array.from({ length: 160 }, (_, index) => (17 + index * 47) % 256)
      ).toString('base64');
      const encryptedAssistantContent = Buffer.from(
        Array.from({ length: 160 }, (_, index) => (83 + index * 41) % 256)
      ).toString('base64');

      const fixtureDb = new Database(encryptedFixturePath);
      try {
        fixtureDb.prepare('UPDATE chat_message SET content = ? WHERE id = ?')
          .run(encryptedUserContent, USER_MSG_ID);
        fixtureDb.prepare('UPDATE chat_message SET content = ? WHERE id = ?')
          .run(encryptedAssistantContent, ASSISTANT_MSG_ID);
      } finally {
        fixtureDb.close();
      }

      const historyRoot = path.join(TMPDIR, 'qoder-history-root');
      const shortSessionId = ROOT_SESSION_ID.split('-')[0];
      const historyDir = path.join(
        historyRoot,
        'fixture-project-local',
        'conversation-history',
        shortSessionId
      );
      fs.mkdirSync(historyDir, { recursive: true });
      fs.writeFileSync(
        path.join(historyDir, `${shortSessionId}.jsonl`),
        [
          JSON.stringify({
            role: 'user',
            message: { content: [{ type: 'text', text: 'Plain user text from history' }] },
          }),
          JSON.stringify({
            role: 'assistant',
            message: { content: [{ type: 'text', text: 'Plain assistant text from history' }] },
          }),
        ].join('\n') + '\n',
        'utf8'
      );

      const previousHistoryRoot = process.env.QODER_HISTORY_ROOT;
      process.env.QODER_HISTORY_ROOT = historyRoot;
      try {
        const result = await parseQoderSession(encryptedFixturePath, ROOT_SESSION_ID);
        const userMessage = result.messages.find((msg) => msg.role === 'user');
        const assistantMessage = result.messages.find((msg) => msg.role === 'assistant');

        expect(userMessage?.content).toBe('Plain user text from history');
        expect(assistantMessage?.content).toBe('Plain assistant text from history');
        expect(result.messages.map((msg) => msg.content).join('\n')).not.toContain(encryptedUserContent);
        expect(result.messages.map((msg) => msg.content).join('\n')).not.toContain(encryptedAssistantContent);
      } finally {
        if (previousHistoryRoot == null) {
          delete process.env.QODER_HISTORY_ROOT;
        } else {
          process.env.QODER_HISTORY_ROOT = previousHistoryRoot;
        }
      }
    });

    it('extracts only <user_query> text from Qoder injected user wrappers', async () => {
      const wrappedFixturePath = path.join(TMPDIR, 'wrapped-user-query-qoder.db');
      buildQoderFixture(wrappedFixturePath);

      const historyRoot = path.join(TMPDIR, 'qoder-wrapped-history-root');
      const shortSessionId = ROOT_SESSION_ID.split('-')[0];
      const historyDir = path.join(
        historyRoot,
        'fixture-project-local',
        'conversation-history',
        shortSessionId
      );
      fs.mkdirSync(historyDir, { recursive: true });
      fs.writeFileSync(
        path.join(historyDir, `${shortSessionId}.jsonl`),
        [
          JSON.stringify({
            role: 'user',
            message: {
              content: [{
                type: 'text',
                text: [
                  '<system-reminder>',
                  '[IMPORTANT] You must always respond in 中文.',
                  '</system-reminder>',
                  '',
                  '<user_query>',
                  '分析一下这个项目，总结一下他的功能和架构，以及在实现上有没有什么漏洞。不要更改代码或者源文件。',
                  '</user_query><system_reminder>',
                  "You need to determine whether the user's task requires switching to plan mode.",
                  '</system_reminder>',
                ].join('\n'),
              }],
            },
          }),
          JSON.stringify({
            role: 'assistant',
            message: { content: [{ type: 'text', text: 'OK' }] },
          }),
        ].join('\n') + '\n',
        'utf8'
      );

      const previousHistoryRoot = process.env.QODER_HISTORY_ROOT;
      process.env.QODER_HISTORY_ROOT = historyRoot;
      try {
        const result = await parseQoderSession(wrappedFixturePath, ROOT_SESSION_ID);
        const userMessage = result.messages.find((msg) => msg.role === 'user');

        expect(userMessage?.content).toBe(
          '分析一下这个项目，总结一下他的功能和架构，以及在实现上有没有什么漏洞。不要更改代码或者源文件。'
        );
        expect(userMessage?.content).not.toContain('<system-reminder>');
        expect(userMessage?.content).not.toContain('<system_reminder>');
        expect(userMessage?.content).not.toContain('<user_query>');
      } finally {
        if (previousHistoryRoot == null) {
          delete process.env.QODER_HISTORY_ROOT;
        } else {
          process.env.QODER_HISTORY_ROOT = previousHistoryRoot;
        }
      }
    });

    it('renders Qoder command wrappers as the invoked command and arguments', async () => {
      const commandFixturePath = path.join(TMPDIR, 'command-wrapper-qoder.db');
      buildQoderFixture(commandFixturePath);

      const historyRoot = path.join(TMPDIR, 'qoder-command-history-root');
      const shortSessionId = ROOT_SESSION_ID.split('-')[0];
      const historyDir = path.join(
        historyRoot,
        'fixture-project-local',
        'conversation-history',
        shortSessionId
      );
      fs.mkdirSync(historyDir, { recursive: true });
      fs.writeFileSync(
        path.join(historyDir, `${shortSessionId}.jsonl`),
        [
          JSON.stringify({
            role: 'user',
            message: {
              content: [{
                type: 'text',
                text: [
                  '<system-reminder>',
                  '[IMPORTANT] You must always respond in 中文.',
                  '</system-reminder>',
                  '',
                  '<command-message>gsd-plan-phase</command-message>',
                  '<command-name>/gsd-plan-phase</command-name>',
                  '<command-args>18',
                  '确保cd .claude/worktrees/phase-18-qoder-source-integration并在worktree上进行变更</command-args>',
                  '',
                  'Base directory for this skill: /tmp/.qoder/skills/gsd-plan-phase',
                  '<objective>internal workflow text</objective>',
                ].join('\n'),
              }],
            },
          }),
          JSON.stringify({
            role: 'assistant',
            message: { content: [{ type: 'text', text: 'OK' }] },
          }),
        ].join('\n') + '\n',
        'utf8'
      );

      const previousHistoryRoot = process.env.QODER_HISTORY_ROOT;
      process.env.QODER_HISTORY_ROOT = historyRoot;
      try {
        const result = await parseQoderSession(commandFixturePath, ROOT_SESSION_ID);
        const userMessage = result.messages.find((msg) => msg.role === 'user');

        expect(userMessage?.content).toBe(
          '/gsd-plan-phase\n\n18\n确保cd .claude/worktrees/phase-18-qoder-source-integration并在worktree上进行变更'
        );
        expect(userMessage?.content).not.toContain('<system-reminder>');
        expect(userMessage?.content).not.toContain('<objective>');
        expect(userMessage?.content).not.toContain('Base directory');
      } finally {
        if (previousHistoryRoot == null) {
          delete process.env.QODER_HISTORY_ROOT;
        } else {
          process.env.QODER_HISTORY_ROOT = previousHistoryRoot;
        }
      }
    });
  });

  describe('subagent link', () => {
    it('emits TraceSubagentLink with subagentSource="qoder" and relationship="spawned"', async () => {
      // Parse subagent session — it should emit a subagent link
      const subResult = await parseQoderSession(FIXTURE_PATH, SUBAGENT_SESSION_ID);

      expect(subResult.session.relationshipType).toBe('subagent');
      expect(subResult.session.parentSessionId).toBe(`qoder:${ROOT_SESSION_ID}`);

      // Find the subagent link in activities
      const links = subResult.activities.filter(
        (a): a is TraceSubagentLink => a.type === 'subagent_link'
      );
      expect(links.length).toBeGreaterThan(0);

      const link = links[0];
      expect(link.subagentSessionId).toBe(`qoder:${SUBAGENT_SESSION_ID}`);
      expect(link.subagentSource).toBe('qoder');
      expect(link.relationship).toBe('spawned');
      expect(link.messageOrdinal).toBeDefined();
    });

    it('root session does not emit subagent links for itself', async () => {
      const rootResult = await parseQoderSession(FIXTURE_PATH, ROOT_SESSION_ID);

      // Root session should not emit subagent links (it's not a child)
      const links = rootResult.activities.filter(
        (a): a is TraceSubagentLink => a.type === 'subagent_link'
      );
      expect(links.length).toBe(0);
    });
  });

  describe('malformed JSON warning', () => {
    it('produces a warning for malformed tool_result JSON', async () => {
      const result = await parseQoderSession(FIXTURE_PATH, ROOT_SESSION_ID);

      // Should have at least one warning about malformed JSON
      const malformedWarnings = result.warnings.filter(w =>
        /json|parse|malformed/i.test(w)
      );
      expect(malformedWarnings.length).toBeGreaterThan(0);

      // Session should still parse successfully (errors empty or non-blocking)
      expect(result.errors.length).toBe(0);
    });
  });

  describe('fingerprint determinism', () => {
    it('returns identical sha256 for identical inputs', () => {
      const row = {
        id: 'test-session-123',
        gmt_modified: 1736935200000,
        msg_count: 10,
        max_msg_gmt: 1736935210000,
      };

      const fp1 = computeQoderSessionFingerprint(row);
      const fp2 = computeQoderSessionFingerprint(row);

      expect(fp1).toBe(fp2);
      expect(fp1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    it('differs when any input field changes', () => {
      const base = {
        id: 'test-session-123',
        gmt_modified: 1736935200000,
        msg_count: 10,
        max_msg_gmt: 1736935210000,
      };

      const fpBase = computeQoderSessionFingerprint(base);

      // Change id
      expect(computeQoderSessionFingerprint({ ...base, id: 'other' })).not.toBe(fpBase);

      // Change gmt_modified
      expect(computeQoderSessionFingerprint({ ...base, gmt_modified: base.gmt_modified + 1 })).not.toBe(fpBase);

      // Change msg_count
      expect(computeQoderSessionFingerprint({ ...base, msg_count: 11 })).not.toBe(fpBase);

      // Change max_msg_gmt
      expect(computeQoderSessionFingerprint({ ...base, max_msg_gmt: base.max_msg_gmt! + 1 })).not.toBe(fpBase);
    });
  });

  describe('session not found', () => {
    it('returns error result for non-existent session', async () => {
      const result = await parseQoderSession(FIXTURE_PATH, 'nonexistent-session-id');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('not found');
      expect(result.session.id).toBe('qoder:nonexistent-session-id');
    });
  });
});

describe('inferQoderToolCategory', () => {
  it('maps read_file and list_dir to Read', () => {
    expect(inferQoderToolCategory('read_file')).toBe('Read');
    expect(inferQoderToolCategory('list_dir')).toBe('Read');
  });

  it('maps search_file, grep_code, search_codebase to Grep', () => {
    expect(inferQoderToolCategory('search_file')).toBe('Grep');
    expect(inferQoderToolCategory('grep_code')).toBe('Grep');
    expect(inferQoderToolCategory('search_codebase')).toBe('Grep');
  });

  it('maps run_in_terminal to Bash', () => {
    expect(inferQoderToolCategory('run_in_terminal')).toBe('Bash');
  });

  it('maps mutating file tools to Edit', () => {
    expect(inferQoderToolCategory('create_file')).toBe('Edit');
    expect(inferQoderToolCategory('delete_file')).toBe('Edit');
    expect(inferQoderToolCategory('search_replace')).toBe('Edit');
  });

  it('maps Agent to Agent', () => {
    expect(inferQoderToolCategory('Agent')).toBe('Agent');
  });
});
