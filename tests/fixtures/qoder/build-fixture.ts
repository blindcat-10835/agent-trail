/**
 * Qoder Synthetic SQLite Fixture Builder
 *
 * Builds a hand-crafted Qoder SQLite fixture file for parser unit tests.
 * Per D-08/D-09 we do NOT use a snapshot of a real Qoder DB:
 *   - real DBs contain user data (privacy)
 *   - real DBs are large and unstable across IDE versions
 *
 * Instead, this script writes a minimal DB containing exactly the tables
 * and rows required by parseQoderSession() unit tests.
 *
 * Coverage (per D-09):
 *   (a) 1 root session (session_type='task', no parent_session_id)
 *   (b) 1 subagent session (linked by parent_session_id + parent_tool_call_id)
 *   (c) 7 tool messages on root, one per observed Qoder tool
 *   (d) 1 tool message with tool_call_status='ERROR' (run_in_terminal)
 *   (e) 1 assistant message with full token_info (prompt/completion/cached/max_input)
 *   (f) 1 user message with realistic content
 *   (g) 1 tool message with malformed tool_result JSON
 *
 * @module tests/fixtures/qoder/build-fixture
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// ============================================================================
// Stable IDs — referenced by MANIFEST.json and unit tests
// ============================================================================

export const ROOT_SESSION_ID = 'root-aaaa-bbbb-cccc';
export const SUBAGENT_SESSION_ID = 'sub-dddd-eeee-ffff';
export const ROOT_RECORD_ID = 'rec-root-001';
export const SUBAGENT_RECORD_ID = 'rec-sub-001';

// Message IDs
export const USER_MSG_ID = 'msg-user-001';
export const ASSISTANT_MSG_ID = 'msg-asst-001';
export const TOOL_READ_FILE_MSG_ID = 'msg-tool-read-file';
export const TOOL_SEARCH_FILE_MSG_ID = 'msg-tool-search-file';
export const TOOL_GREP_CODE_MSG_ID = 'msg-tool-grep-code';
export const TOOL_SEARCH_CODEBASE_MSG_ID = 'msg-tool-search-codebase';
export const TOOL_LIST_DIR_MSG_ID = 'msg-tool-list-dir';
export const TOOL_RUN_TERMINAL_MSG_ID = 'msg-tool-run-terminal';   // ERROR case
export const TOOL_AGENT_MSG_ID = 'msg-tool-agent';                 // Agent tool (subagent parent)
export const TOOL_MALFORMED_MSG_ID = 'msg-tool-malformed';         // Malformed JSON case

// Tool call IDs
export const TC_READ_FILE = 'tc-read-file-001';
export const TC_SEARCH_FILE = 'tc-search-file-001';
export const TC_GREP_CODE = 'tc-grep-code-001';
export const TC_SEARCH_CODEBASE = 'tc-search-codebase-001';
export const TC_LIST_DIR = 'tc-list-dir-001';
export const TC_RUN_TERMINAL = 'tc-run-terminal-001';
export const TC_AGENT = 'tc-agent-001';    // Parent tool call for subagent
export const TC_MALFORMED = 'tc-malformed-001';

// Session manifest type
export interface SessionManifest {
  id: string;
  purpose: string;
}

/**
 * Build the synthetic Qoder SQLite fixture at `outPath`.
 *
 * @param outPath - File path for the output SQLite DB
 * @returns Manifest of sessions created
 */
export function buildQoderFixture(outPath: string): { sessions: SessionManifest[] } {
  mkdirSync(dirname(outPath), { recursive: true });

  const db = new Database(outPath);

  // Enable WAL for consistency with real Qoder DBs
  db.pragma('journal_mode = WAL');

  // ========================================================================
  // DDL — column subset from 2026-05-17-qoder-source-integration-plan.md §2.4-§2.6
  // ========================================================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_session (
      id TEXT PRIMARY KEY,
      session_title TEXT,
      project_id TEXT,
      project_uri TEXT,
      project_name TEXT,
      gmt_create INTEGER NOT NULL,
      gmt_modified INTEGER NOT NULL,
      session_type TEXT,
      mode TEXT,
      version INTEGER,
      preferred_model_info TEXT,
      stop_reason TEXT,
      extra TEXT,
      parent_session_id TEXT,
      parent_tool_call_id TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_record (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      request_id TEXT,
      question TEXT,
      answer TEXT,
      reasoning_content TEXT,
      gmt_create INTEGER NOT NULL,
      extra TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_message (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      record_id TEXT,
      role TEXT NOT NULL,
      content TEXT,
      summary TEXT,
      gmt_create INTEGER NOT NULL,
      model_info TEXT,
      token_info TEXT,
      tool_calls TEXT,
      tool_call_id TEXT,
      tool_result TEXT,
      tool_call_status TEXT,
      extra TEXT
    );
  `);

  // ========================================================================
  // Timestamps — synthetic epoch values (2026-01-15T10:00:00Z base)
  // ========================================================================
  const T0 = 1736935200000; // base: 2026-01-15T10:00:00Z
  const T1 = T0 + 1000;     // +1s
  const T2 = T0 + 2000;     // +2s
  const T3 = T0 + 3000;     // +3s
  const T4 = T0 + 4000;     // +4s
  const T5 = T0 + 5000;     // +5s
  const T6 = T0 + 6000;     // +6s
  const T7 = T0 + 7000;     // +7s
  const T8 = T0 + 8000;     // +8s
  const T9 = T0 + 9000;     // +9s
  const T10 = T0 + 10000;   // +10s

  // ========================================================================
  // Root session
  // ========================================================================
  db.prepare(`
    INSERT INTO chat_session (id, session_title, project_id, project_uri, project_name,
      gmt_create, gmt_modified, session_type, mode, version,
      preferred_model_info, stop_reason, extra, parent_session_id, parent_tool_call_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ROOT_SESSION_ID,
    'Qoder fixture root session',
    'proj-fixture-001',
    'file:///home/user/project',
    'fixture-project',
    T0,          // gmt_create
    T10,         // gmt_modified
    'task',      // session_type
    'agent',     // mode
    3,           // version
    JSON.stringify({ model_key: 'ultimate' }), // preferred_model_info
    'completed', // stop_reason
    JSON.stringify({}), // extra (narrow keys only — no firstTurnRulesPrompt per SPEC §10)
    null,        // parent_session_id — root
    null         // parent_tool_call_id — root
  );

  // Root session record
  db.prepare(`
    INSERT INTO chat_record (id, session_id, request_id, question, answer, reasoning_content,
      gmt_create, extra)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ROOT_RECORD_ID,
    ROOT_SESSION_ID,
    'req-root-001',
    'Show me the main entry point of this project',
    null,
    null,
    T0,
    JSON.stringify({
      modelConfig: { key: 'experts-ultimate' },
      ideModelConfigOverride: { max_input_tokens: 200000, reasoning_effort: 'high' },
    })
  );

  // ========================================================================
  // Messages for root session (in chronological order)
  // ========================================================================

  // (f) User message
  db.prepare(`
    INSERT INTO chat_message (id, session_id, record_id, role, content, gmt_create)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    USER_MSG_ID,
    ROOT_SESSION_ID,
    ROOT_RECORD_ID,
    'user',
    'Show me the main entry point of this project',
    T1
  );

  // (e) Assistant message with full token_info
  db.prepare(`
    INSERT INTO chat_message (id, session_id, record_id, role, content, gmt_create,
      model_info, token_info, tool_calls)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ASSISTANT_MSG_ID,
    ROOT_SESSION_ID,
    ROOT_RECORD_ID,
    'assistant',
    'I will look at the project structure to find the main entry point.',
    T2,
    JSON.stringify({ model_key: 'experts-ultimate' }),
    JSON.stringify({
      prompt_tokens: 120,
      completion_tokens: 80,
      cached_tokens: 40,
      max_input_tokens: 200000,
    }),
    // Tool calls embedded in assistant message
    JSON.stringify([
      { toolCallId: TC_READ_FILE, name: 'read_file', parameters: { file_path: '/src/index.ts' } },
      { toolCallId: TC_SEARCH_FILE, name: 'search_file', parameters: { query: 'main', path: '/src' } },
      { toolCallId: TC_GREP_CODE, name: 'grep_code', parameters: { pattern: 'entry', path: '/src' } },
      { toolCallId: TC_SEARCH_CODEBASE, name: 'search_codebase', parameters: { query: 'entry point' } },
      { toolCallId: TC_LIST_DIR, name: 'list_dir', parameters: { path: '/src' } },
      { toolCallId: TC_RUN_TERMINAL, name: 'run_in_terminal', parameters: { command: 'ls -la' } },
      { toolCallId: TC_AGENT, name: 'Agent', parameters: { task: 'search deeper' } },
    ])
  );

  // (c) Tool result messages — 7 tools, one per observed Qoder tool

  // read_file — FINISHED
  db.prepare(`
    INSERT INTO chat_message (id, session_id, record_id, role, content, gmt_create,
      tool_call_id, tool_result, tool_call_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    TOOL_READ_FILE_MSG_ID,
    ROOT_SESSION_ID,
    ROOT_RECORD_ID,
    'tool',
    null,
    T3,
    TC_READ_FILE,
    JSON.stringify({
      toolCallId: TC_READ_FILE,
      toolCallName: 'read_file',
      toolCallStatus: 'FINISHED',
      parameters: { file_path: '/src/index.ts' },
      results: [{ type: 'text', text: 'export function main() { /* entry point */ }' }],
    }),
    'FINISHED'
  );

  // search_file — FINISHED
  db.prepare(`
    INSERT INTO chat_message (id, session_id, record_id, role, content, gmt_create,
      tool_call_id, tool_result, tool_call_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    TOOL_SEARCH_FILE_MSG_ID,
    ROOT_SESSION_ID,
    ROOT_RECORD_ID,
    'tool',
    null,
    T4,
    TC_SEARCH_FILE,
    JSON.stringify({
      toolCallId: TC_SEARCH_FILE,
      toolCallName: 'search_file',
      toolCallStatus: 'FINISHED',
      parameters: { query: 'main', path: '/src' },
      results: [{ type: 'text', text: 'Found 3 files matching "main"' }],
    }),
    'FINISHED'
  );

  // grep_code — FINISHED
  db.prepare(`
    INSERT INTO chat_message (id, session_id, record_id, role, content, gmt_create,
      tool_call_id, tool_result, tool_call_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    TOOL_GREP_CODE_MSG_ID,
    ROOT_SESSION_ID,
    ROOT_RECORD_ID,
    'tool',
    null,
    T5,
    TC_GREP_CODE,
    JSON.stringify({
      toolCallId: TC_GREP_CODE,
      toolCallName: 'grep_code',
      toolCallStatus: 'FINISHED',
      parameters: { pattern: 'entry', path: '/src' },
      results: [{ type: 'text', text: 'src/index.ts:1:export function main()' }],
    }),
    'FINISHED'
  );

  // search_codebase — FINISHED
  db.prepare(`
    INSERT INTO chat_message (id, session_id, record_id, role, content, gmt_create,
      tool_call_id, tool_result, tool_call_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    TOOL_SEARCH_CODEBASE_MSG_ID,
    ROOT_SESSION_ID,
    ROOT_RECORD_ID,
    'tool',
    null,
    T6,
    TC_SEARCH_CODEBASE,
    JSON.stringify({
      toolCallId: TC_SEARCH_CODEBASE,
      toolCallName: 'search_codebase',
      toolCallStatus: 'FINISHED',
      parameters: { query: 'entry point' },
      results: [{ type: 'text', text: 'Found entry point in src/index.ts' }],
    }),
    'FINISHED'
  );

  // list_dir — FINISHED
  db.prepare(`
    INSERT INTO chat_message (id, session_id, record_id, role, content, gmt_create,
      tool_call_id, tool_result, tool_call_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    TOOL_LIST_DIR_MSG_ID,
    ROOT_SESSION_ID,
    ROOT_RECORD_ID,
    'tool',
    null,
    T7,
    TC_LIST_DIR,
    JSON.stringify({
      toolCallId: TC_LIST_DIR,
      toolCallName: 'list_dir',
      toolCallStatus: 'FINISHED',
      parameters: { path: '/src' },
      results: [{ type: 'text', text: 'index.ts\nutils.ts\ncomponents/' }],
    }),
    'FINISHED'
  );

  // (d) run_in_terminal — ERROR
  db.prepare(`
    INSERT INTO chat_message (id, session_id, record_id, role, content, gmt_create,
      tool_call_id, tool_result, tool_call_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    TOOL_RUN_TERMINAL_MSG_ID,
    ROOT_SESSION_ID,
    ROOT_RECORD_ID,
    'tool',
    null,
    T8,
    TC_RUN_TERMINAL,
    JSON.stringify({
      toolCallId: TC_RUN_TERMINAL,
      toolCallName: 'run_in_terminal',
      toolCallStatus: 'ERROR',
      parameters: { command: 'ls -la' },
      results: [],
      errorMsg: 'Permission denied: cannot execute ls in this context',
    }),
    'ERROR'
  );

  // Agent — FINISHED (this is the parent tool call for the subagent)
  db.prepare(`
    INSERT INTO chat_message (id, session_id, record_id, role, content, gmt_create,
      tool_call_id, tool_result, tool_call_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    TOOL_AGENT_MSG_ID,
    ROOT_SESSION_ID,
    ROOT_RECORD_ID,
    'tool',
    null,
    T9,
    TC_AGENT,
    JSON.stringify({
      toolCallId: TC_AGENT,
      toolCallName: 'Agent',
      toolCallStatus: 'FINISHED',
      parameters: { task: 'search deeper' },
      results: [{ type: 'text', text: 'Subagent completed research task' }],
    }),
    'FINISHED'
  );

  // (g) Malformed tool_result JSON
  db.prepare(`
    INSERT INTO chat_message (id, session_id, record_id, role, content, gmt_create,
      tool_call_id, tool_result, tool_call_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    TOOL_MALFORMED_MSG_ID,
    ROOT_SESSION_ID,
    ROOT_RECORD_ID,
    'tool',
    null,
    T9 + 500,
    TC_MALFORMED,
    '{not valid json',
    'FINISHED'
  );

  // ========================================================================
  // Subagent session
  // ========================================================================
  db.prepare(`
    INSERT INTO chat_session (id, session_title, project_id, project_uri, project_name,
      gmt_create, gmt_modified, session_type, mode, version,
      preferred_model_info, stop_reason, extra, parent_session_id, parent_tool_call_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    SUBAGENT_SESSION_ID,
    'Qoder fixture subagent session',
    'proj-fixture-001',
    'file:///home/user/project',
    'fixture-project',
    T9,          // gmt_create (spawned when Agent tool fires)
    T10,         // gmt_modified
    'task',      // session_type
    'agent_sub', // mode
    3,           // version
    null,        // preferred_model_info
    'completed', // stop_reason
    JSON.stringify({}),
    ROOT_SESSION_ID, // parent_session_id
    TC_AGENT         // parent_tool_call_id — links back to the Agent tool call
  );

  // Subagent record
  db.prepare(`
    INSERT INTO chat_record (id, session_id, request_id, question, answer, reasoning_content,
      gmt_create, extra)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    SUBAGENT_RECORD_ID,
    SUBAGENT_SESSION_ID,
    'req-sub-001',
    'Search deeper for entry points',
    'Found additional entry points in tests/',
    null,
    T9,
    JSON.stringify({
      modelConfig: { key: 'ultimate' },
    })
  );

  // Subagent user message
  db.prepare(`
    INSERT INTO chat_message (id, session_id, record_id, role, content, gmt_create)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'msg-sub-user-001',
    SUBAGENT_SESSION_ID,
    SUBAGENT_RECORD_ID,
    'user',
    'Search deeper for entry points',
    T9 + 100
  );

  // Subagent assistant message (with token info)
  db.prepare(`
    INSERT INTO chat_message (id, session_id, record_id, role, content, gmt_create,
      model_info, token_info, tool_calls)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'msg-sub-asst-001',
    SUBAGENT_SESSION_ID,
    SUBAGENT_RECORD_ID,
    'assistant',
    'I found additional entry points in the test directory.',
    T9 + 200,
    JSON.stringify({ model_key: 'ultimate' }),
    JSON.stringify({
      prompt_tokens: 50,
      completion_tokens: 30,
      cached_tokens: 10,
      max_input_tokens: 200000,
    }),
    null // no tool calls in subagent
  );

  db.close();

  const sessions: SessionManifest[] = [
    {
      id: ROOT_SESSION_ID,
      purpose: 'Root session with all 7 tool types, 1 ERROR tool, token_info, user message, and malformed JSON',
    },
    {
      id: SUBAGENT_SESSION_ID,
      purpose: 'Subagent of root; tests TraceSubagentLink emission via parent_tool_call_id',
    },
  ];

  return { sessions };
}

// CLI entry: `pnpm tsx tests/fixtures/qoder/build-fixture.ts`
if (typeof require !== 'undefined' && require.main === module) {
  const outPath = resolve(__dirname, 'sample.db');
  const manifest = buildQoderFixture(outPath);
  console.log(`Built Qoder fixture at ${outPath}`);
  console.log(`Sessions: ${manifest.sessions.length}`);
  for (const s of manifest.sessions) {
    console.log(`  ${s.id}: ${s.purpose}`);
  }
}
