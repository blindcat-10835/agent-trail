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
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseClaudeSession } from '@/ingest/parser/claude';
import { parseCodexSession } from '@/ingest/parser/codex';

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
      });
    }
  }
}
