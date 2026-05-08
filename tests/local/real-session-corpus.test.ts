/**
 * Opt-in local real-session corpus smoke tests
 *
 * These tests run ONLY when RUN_REAL_SESSION_TESTS=1 is set in the environment.
 * They load .local/real-session-corpus.json (which is gitignored) and assert
 * structural invariants against real local session files.
 *
 * Usage:
 *   RUN_REAL_SESSION_TESTS=1 pnpm test:real-sessions
 *
 * If .local/real-session-corpus.json is absent, all tests skip with a clear message.
 * No test will fail because the manifest is absent.
 *
 * See .local/real-session-corpus.example.json for the manifest schema.
 *
 * ## Phase 8 Tag Support
 *
 * In addition to the original tags (has-tool-calls, has-subagent, has-compact),
 * the following Phase 8 target-session tags are now recognized:
 *
 * - `claude-key-null-risk`  — assert messages.id non-null (606dac00 regression class)
 * - `claude-discoverability` — assert session discoverable in sessions table (effac644 regression class)
 * - `codex-function-output`  — assert tool_calls and tool_result_events > 0 after sync
 * - `codex-custom-tool`      — assert tool_calls and tool_result_events > 0 after sync
 * - `claude-subagent`        — assert at least one subagent_link activity (alias for has-subagent with Claude specificity)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { parseClaudeSession } from '@/ingest/parser/claude';
import { parseCodexSession } from '@/ingest/parser/codex';
import { writeSessionToDatabase } from '@/ingest/sync/index';

// ============================================================================
// DB helper for Phase 8 tag-conditional assertions
// ============================================================================

function createCorpusTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  const schemaPath = path.join(process.cwd(), 'ingest', 'db', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  return db;
}

// ============================================================================
// Environment gate
// ============================================================================

const ENABLED = process.env.RUN_REAL_SESSION_TESTS === '1';
const MANIFEST_PATH = path.join(process.cwd(), '.local', 'real-session-corpus.json');

interface CorpusSession {
  id: string;
  source: 'claude-code' | 'codex' | 'openclaw';
  path: string;
  tags?: string[];
  _comment?: string;
}

interface CorpusManifest {
  sessions: CorpusSession[];
}

function loadManifest(): CorpusManifest | null {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    return JSON.parse(raw) as CorpusManifest;
  } catch {
    return null;
  }
}

// ============================================================================
// Skip guard — not enabled
// ============================================================================

if (!ENABLED) {
  describe('Real-session corpus smoke tests (skipped)', () => {
    it.skip('Set RUN_REAL_SESSION_TESTS=1 and provide .local/real-session-corpus.json to run', () => {
      // intentionally empty
    });
  });
} else {
  const manifest = loadManifest();

  if (!manifest) {
    describe('Real-session corpus smoke tests (skipped — no manifest)', () => {
      it.skip(
        '.local/real-session-corpus.json not found — copy .local/real-session-corpus.example.json and populate it',
        () => {
          // intentionally empty
        }
      );
    });
  } else {
    // ============================================================================
    // Structural invariants
    // ============================================================================

    const MAX_WARNINGS_PER_SESSION = 20;

    for (const entry of manifest.sessions) {
      const { id, source, path: sessionPath, tags = [] } = entry;
      const fileExists = fs.existsSync(sessionPath);

      describe(`Real-session corpus [${id}] (${source})`, () => {
        if (!fileExists) {
          it.skip(`File not found at ${sessionPath}`, () => {});
          return; // skip all tests in this describe when file absent
        }

        it('parser does not throw', async () => {
          if (source === 'claude-code') {
            await expect(parseClaudeSession(sessionPath, id)).resolves.toBeDefined();
          } else if (source === 'codex') {
            await expect(parseCodexSession(sessionPath, id)).resolves.toBeDefined();
          } else {
            // openclaw sessions: just verify file is valid JSONL (parser not yet wired here)
            const lines = fs.readFileSync(sessionPath, 'utf-8').split('\n').filter(Boolean);
            expect(lines.length).toBeGreaterThan(0);
          }
        });

        it('session id is non-empty after parse', async () => {
          if (source === 'claude-code') {
            const result = await parseClaudeSession(sessionPath, id);
            expect(result.session.id.length).toBeGreaterThan(0);
          } else if (source === 'codex') {
            const result = await parseCodexSession(sessionPath, id);
            expect(result.session.id.length).toBeGreaterThan(0);
          }
        });

        it('warnings are bounded (fewer than per-session limit)', async () => {
          if (source === 'claude-code') {
            const result = await parseClaudeSession(sessionPath, id);
            if (result.warnings.length >= MAX_WARNINGS_PER_SESSION) {
              console.warn(
                `[${id}] Warning count ${result.warnings.length} >= limit. First:`,
                result.warnings.slice(0, 5)
              );
            }
            expect(result.warnings.length).toBeLessThan(MAX_WARNINGS_PER_SESSION);
          } else if (source === 'codex') {
            const result = await parseCodexSession(sessionPath, id);
            if (result.warnings.length >= MAX_WARNINGS_PER_SESSION) {
              console.warn(
                `[${id}] Warning count ${result.warnings.length} >= limit. First:`,
                result.warnings.slice(0, 5)
              );
            }
            expect(result.warnings.length).toBeLessThan(MAX_WARNINGS_PER_SESSION);
          }
        });

        // Tag-conditional assertions

        if (tags.includes('has-tool-calls')) {
          it('has at least one tool_call activity (tagged: has-tool-calls)', async () => {
            let activities: Array<{ type: string }> = [];
            if (source === 'claude-code') {
              const result = await parseClaudeSession(sessionPath, id);
              activities = result.activities;
            } else if (source === 'codex') {
              const result = await parseCodexSession(sessionPath, id);
              activities = result.activities;
            }
            const toolCalls = activities.filter(a => a.type === 'tool_call');
            expect(toolCalls.length).toBeGreaterThanOrEqual(1);
          });
        }

        if (tags.includes('has-subagent')) {
          it('has at least one subagent_link activity (tagged: has-subagent)', async () => {
            let activities: Array<{ type: string }> = [];
            if (source === 'claude-code') {
              const result = await parseClaudeSession(sessionPath, id);
              activities = result.activities;
            } else if (source === 'codex') {
              const result = await parseCodexSession(sessionPath, id);
              activities = result.activities;
            }
            const subagentLinks = activities.filter(a => a.type === 'subagent_link');
            expect(subagentLinks.length).toBeGreaterThanOrEqual(1);
          });
        }

        if (tags.includes('has-compact')) {
          it('session metrics show isTruncated=true (tagged: has-compact)', async () => {
            if (source === 'claude-code') {
              const result = await parseClaudeSession(sessionPath, id);
              expect(result.session.metrics.isTruncated).toBe(true);
            }
          });
        }

        // -----------------------------------------------------------------------
        // Phase 8 target-session tags
        // -----------------------------------------------------------------------

        if (tags.includes('claude-key-null-risk')) {
          it('messages.id is non-null after force sync (tagged: claude-key-null-risk)', async () => {
            // This tag targets sessions in the 606dac00 regression class where
            // message IDs were null, causing key=null warnings in the frontend.
            let parseResult;
            if (source === 'claude-code') {
              parseResult = await parseClaudeSession(sessionPath, id);
            } else {
              return; // tag only applies to claude-code source
            }
            const db = createCorpusTestDb();
            writeSessionToDatabase(parseResult, db, undefined, { force: true });

            // count(*) = count(id) asserts no NULL ids in the messages table
            const row = db
              .prepare(
                'SELECT COUNT(*) as total, COUNT(id) as with_id FROM messages WHERE session_id = ?'
              )
              .get(parseResult.session.id) as { total: number; with_id: number };

            expect(row.total).toBeGreaterThan(0);
            expect(row.with_id).toBe(row.total);

            db.close();
          });
        }

        if (tags.includes('claude-discoverability')) {
          it('session is discoverable in sessions table after force sync (tagged: claude-discoverability)', async () => {
            // This tag targets sessions in the effac644 regression class where
            // force sync caused sessions to disappear from the index.
            let parseResult;
            if (source === 'claude-code') {
              parseResult = await parseClaudeSession(sessionPath, id);
            } else {
              return; // tag only applies to claude-code source
            }
            const db = createCorpusTestDb();

            // Initial sync
            writeSessionToDatabase(parseResult, db);

            // Force sync (the operation that previously caused disappearance)
            writeSessionToDatabase(parseResult, db, undefined, { force: true });

            // Assert session is still discoverable by id
            const row = db
              .prepare('SELECT id, source FROM sessions WHERE id = ?')
              .get(parseResult.session.id) as { id: string; source: string } | undefined;

            expect(row).toBeDefined();
            expect(row!.id).toBe(parseResult.session.id);
            expect(row!.source).toBe('claude-code');

            // Also assert via list-style query
            const allSessions = db
              .prepare('SELECT id FROM sessions ORDER BY started_at DESC')
              .all() as { id: string }[];
            const found = allSessions.find(s => s.id === parseResult!.session.id);
            expect(found).toBeDefined();

            db.close();
          });
        }

        if (tags.includes('codex-function-output')) {
          it('tool_calls and tool_result_events are non-zero after sync (tagged: codex-function-output)', async () => {
            // This tag targets Codex sessions with function_call/function_call_output pairs.
            // After Phase 8 parser fixes, these should produce rows in both tables.
            let parseResult;
            if (source === 'codex') {
              parseResult = await parseCodexSession(sessionPath, id);
            } else {
              return; // tag only applies to codex source
            }
            const db = createCorpusTestDb();
            const syncResult = writeSessionToDatabase(parseResult, db, undefined, { force: true });

            expect(syncResult.toolCallsInserted).toBeGreaterThan(0);
            expect(syncResult.toolResultEventsInserted).toBeGreaterThan(0);

            const tcCount = (
              db.prepare('SELECT COUNT(*) as c FROM tool_calls WHERE session_id = ?')
                .get(parseResult.session.id) as { c: number }
            ).c;
            expect(tcCount).toBeGreaterThan(0);

            const evtCount = (
              db.prepare(
                'SELECT COUNT(*) as c FROM tool_result_events WHERE tool_call_id IN (SELECT id FROM tool_calls WHERE session_id = ?)'
              ).get(parseResult.session.id) as { c: number }
            ).c;
            expect(evtCount).toBeGreaterThan(0);

            db.close();
          });
        }

        if (tags.includes('codex-custom-tool')) {
          it('tool_calls and tool_result_events are non-zero for custom tool session (tagged: codex-custom-tool)', async () => {
            // This tag targets Codex sessions with custom_tool_call/custom_tool_call_output pairs.
            // After Phase 8 parser fixes, custom tool calls should produce DB rows identical
            // to function_call/function_call_output pairs.
            let parseResult;
            if (source === 'codex') {
              parseResult = await parseCodexSession(sessionPath, id);
            } else {
              return; // tag only applies to codex source
            }
            const db = createCorpusTestDb();
            const syncResult = writeSessionToDatabase(parseResult, db, undefined, { force: true });

            expect(syncResult.toolCallsInserted).toBeGreaterThan(0);
            expect(syncResult.toolResultEventsInserted).toBeGreaterThan(0);

            const tcCount = (
              db.prepare('SELECT COUNT(*) as c FROM tool_calls WHERE session_id = ?')
                .get(parseResult.session.id) as { c: number }
            ).c;
            expect(tcCount).toBeGreaterThan(0);

            db.close();
          });
        }

        if (tags.includes('claude-subagent')) {
          it('has at least one subagent_link activity (tagged: claude-subagent)', async () => {
            // Phase 8 alias for has-subagent with explicit Claude source scope.
            // Verifies that subagent relationships are correctly parsed for Claude sessions
            // — used for sessions like those in the claude-subagent investigation corpus.
            if (source !== 'claude-code') return;
            const result = await parseClaudeSession(sessionPath, id);
            const subagentLinks = result.activities.filter(a => a.type === 'subagent_link');
            expect(subagentLinks.length).toBeGreaterThanOrEqual(1);
          });
        }
      });
    }
  }
}
