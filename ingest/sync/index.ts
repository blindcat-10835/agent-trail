/**
 * Ingest Sync Layer
 *
 * Orchestrates sync operations between parsers and the database.
 * Handles session upserts, message insertion, and source-level sync.
 * Supports OpenClaw, Claude Code, and Codex sources.
 *
 * @module ingest/sync
 */

import Database from 'better-sqlite3';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getDatabase } from '../db';
import { ParseResult } from '../parser/types';
import { sseManager } from '../src/sse';

// ============================================================================
// Types
// ============================================================================

export interface SyncResult {
  sessionsInserted: number;
  sessionsUpdated: number;
  messagesInserted: number;
  errors: string[];
}

export type SyncSourceType = 'openclaw' | 'claude-code' | 'codex';

// ============================================================================
// Session Name & Project Extraction
// ============================================================================

/**
 * Extract a display name from the first user message in the parse result.
 */
function extractSessionName(parseResult: ParseResult): string {
  const firstUserMsg = parseResult.messages.find(m => m.role === 'user')
  if (!firstUserMsg?.content) return ''
  const line = firstUserMsg.content.split('\n')[0].trim()
  return line.length > 80 ? line.slice(0, 77) + '...' : line
}

/**
 * Extract project path from the session file path based on source type.
 *
 * - Claude Code: ~/.claude/projects/{encoded-path}/ → decode to actual cwd
 * - OpenClaw: extract agent name from agents/{name}/sessions structure
 * - Codex: use parent directory name
 */
function extractProjectFromPath(filePath: string, sourceType: SyncSourceType): string {
  if (sourceType === 'claude-code') {
    const projectsRoot = path.join(os.homedir(), '.claude', 'projects')
    const relative = path.relative(projectsRoot, path.dirname(filePath))
    if (!relative || relative.startsWith('..')) return 'default'
    const encoded = relative.split(path.sep)[0]
    // Claude encodes cwd by replacing '/' with '-': /Users/ebbi/work → -Users-ebbi-work
    return '/' + encoded.replace(/-/g, '/')
  }

  if (sourceType === 'openclaw') {
    // Path structure: {base}/agents/{agentName}/sessions/{file}.jsonl
    const parts = path.dirname(filePath).split(path.sep)
    const sessionsIdx = parts.lastIndexOf('sessions')
    if (sessionsIdx > 0) return parts[sessionsIdx - 1]
    return 'default'
  }

  // Codex: use parent directory name
  return path.basename(path.dirname(filePath)) || 'default'
}

// ============================================================================
// Database Write Operations
// ============================================================================

/**
 * Compute SHA-256 hash of a file for skip-cache deduplication.
 *
 * @param filePath - Path to the file on disk
 * @returns Hex-encoded SHA-256 digest
 */
export function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Write a parsed session to the database
 *
 * Handles session upsert (insert or update) and message insertion.
 * If session already exists, updates metadata and replaces all messages.
 *
 * Supports skip cache: if sourceFile is provided and its hash matches the
 * stored file_hash, skips the entire parse-and-write operation.
 *
 * @param parseResult - Parsed session data from any parser
 * @param db - Optional database connection (defaults to getDatabase())
 * @param sourceFile - Optional file path for hash-based skip cache and file_path column
 * @returns SyncResult with counts and errors
 */
export function writeSessionToDatabase(
  parseResult: ParseResult,
  db?: Database.Database,
  sourceFile?: string
): SyncResult {
  const database = db || getDatabase();
  const errors: string[] = [];
  let sessionsInserted = 0;
  let sessionsUpdated = 0;
  let messagesInserted = 0;

  try {
    // Compute file hash for skip cache (if sourceFile provided)
    let fileHash: string | null = null;
    if (sourceFile) {
      fileHash = computeFileHash(sourceFile);
    }

    // Check if session already exists
    const existing = database.prepare(
      'SELECT id, file_hash FROM sessions WHERE id = ?'
    ).get(parseResult.session.id) as { id: string; file_hash: string | null } | undefined;

    // Skip cache: if hash matches, skip entire parse-and-write
    if (existing && fileHash && existing.file_hash === fileHash) {
      return {
        sessionsInserted: 0,
        sessionsUpdated: 0,
        messagesInserted: 0,
        errors: [],
      };
    }

    if (existing) {
      // Update existing session
      database.prepare(`
        UPDATE sessions SET
          ended_at = ?,
          message_count = ?,
          user_message_count = ?,
          total_output_tokens = ?,
          has_tool_calls = ?,
          parser_malformed_lines = ?,
          is_truncated = ?,
          termination_status = ?,
          name = ?,
          project = ?,
          file_hash = ?
        WHERE id = ?
      `).run(
        parseResult.session.endedAt,
        parseResult.session.metrics.messageCount,
        parseResult.session.metrics.userMessageCount,
        parseResult.session.metrics.totalTokens || 0,
        parseResult.session.metrics.hasToolCalls ? 1 : 0,
        parseResult.session.metrics.parserMalformedLines,
        parseResult.session.metrics.isTruncated ? 1 : 0,
        parseResult.session.metrics.terminationStatus || '',
        parseResult.session.name || '',
        parseResult.session.project,
        fileHash,
        parseResult.session.id
      );
      sessionsUpdated++;
    } else {
      // Insert new session
      database.prepare(`
        INSERT INTO sessions (
          id, source, project, name, started_at, ended_at, status,
          message_count, user_message_count, total_output_tokens, has_tool_calls,
          parser_malformed_lines, is_truncated, termination_status,
          file_path, file_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        parseResult.session.id,
        parseResult.session.source,
        parseResult.session.project,
        parseResult.session.name || '',
        parseResult.session.startedAt,
        parseResult.session.endedAt,
        parseResult.session.status,
        parseResult.session.metrics.messageCount,
        parseResult.session.metrics.userMessageCount,
        parseResult.session.metrics.totalTokens || 0,
        parseResult.session.metrics.hasToolCalls ? 1 : 0,
        parseResult.session.metrics.parserMalformedLines,
        parseResult.session.metrics.isTruncated ? 1 : 0,
        parseResult.session.metrics.terminationStatus || '',
        sourceFile || parseResult.session.id, // Use actual file path or fall back to session ID
        fileHash
      );
      sessionsInserted++;
    }

    // Emit SSE events for real-time frontend invalidation
    if (existing) {
      sseManager.emit('session_updated', {
        sessionId: parseResult.session.id,
        source: parseResult.session.source,
      });
      sseManager.emitSessionEvent(parseResult.session.id, 'session_updated', {});
    } else {
      sseManager.emit('session_created', {
        sessionId: parseResult.session.id,
        source: parseResult.session.source,
      });
      sseManager.emitSessionEvent(parseResult.session.id, 'session_created', {});
    }

    // Delete existing messages for this session (if updating)
    if (existing) {
      database.prepare('DELETE FROM messages WHERE session_id = ?').run(parseResult.session.id);
    }

    // Insert messages
    const insertMessage = database.prepare(`
      INSERT INTO messages (
        session_id, ordinal, role, content, timestamp, model,
        token_usage_json, source_file, source_line
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const message of parseResult.messages) {
      insertMessage.run(
        parseResult.session.id,
        message.ordinal,
        message.role,
        message.content,
        message.timestamp || null,
        message.model || '',
        message.tokenUsage ? JSON.stringify(message.tokenUsage) : '',
        message.sourceMetadata.sourceFile,
        message.sourceMetadata.sourceLine || null
      );
      messagesInserted++;
    }

    // Note: Tool calls and turns will be added in Phase 3
    // For Phase 2, we only store sessions and messages

  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Unknown error');
  }

  return {
    sessionsInserted,
    sessionsUpdated,
    messagesInserted,
    errors
  };
}

// ============================================================================
// Source Sync Orchestration
// ============================================================================

/**
 * Upsert sync status into the sync_status table after a sync operation.
 *
 * Tracks last sync timestamp, files watched, and error state per source type.
 * Uses INSERT OR REPLACE for idempotent upserts.
 */
function upsertSyncStatus(sourceType: string, result: SyncResult): void {
  try {
    const database = getDatabase();
    const filesWatched = result.sessionsInserted + result.sessionsUpdated;
    const lastError = result.errors.length > 0 ? result.errors[0] : null;

    database.prepare(`
      INSERT OR REPLACE INTO sync_status
        (source_type, last_full_sync_at, last_watch_sync_at, files_watched, last_error)
      VALUES (?, datetime('now'), NULL, ?, ?)
    `).run(sourceType, filesWatched, lastError);
  } catch (err) {
    console.error(`[sync_status] Failed to upsert sync status for ${sourceType}:`, err);
  }
}

/**
 * Sync all sessions from a source type
 *
 * Orchestrates full sync pipeline: discover sources → parse files → write to database.
 * Supports OpenClaw, Claude Code, and Codex source types.
 *
 * @param sourceType - Type of source to sync ('openclaw', 'claude-code', 'codex')
 * @param basePath - Optional base path override for source discovery
 * @returns SyncResult with aggregated counts and errors
 */
export async function syncSource(
  sourceType: SyncSourceType,
  basePath?: string
): Promise<SyncResult> {
  let result: SyncResult;

  // D-21 (Plan 01): Enumerated source types only — unknown sources have no parser
  if (sourceType === 'openclaw') {
    result = await syncOpenClawSource(basePath);
  } else if (sourceType === 'claude-code') {
    result = await syncClaudeCodeSource();
  } else if (sourceType === 'codex') {
    result = await syncCodexSource();
  } else {
    result = {
      sessionsInserted: 0,
      sessionsUpdated: 0,
      messagesInserted: 0,
      errors: [`Unknown source type: ${sourceType}`],
    };
  }

  // Upsert sync_status table after each sync operation (Phase 6)
  upsertSyncStatus(sourceType, result);

  return result;
}

// ============================================================================
// OpenClaw Sync (preserved from Phase 2)
// ============================================================================

/**
 * Sync OpenClaw sessions
 *
 * Uses discoverOpenClawSources() and parseOpenClawSession() from the parser module.
 * This is the original sync path preserved from Phase 2.
 */
async function syncOpenClawSource(basePath?: string): Promise<SyncResult> {
  const { discoverOpenClawSources } = await import('./sources');
  const { parseOpenClawSession } = await import('../parser/openclaw');

  const sources = await discoverOpenClawSources({ workspacePath: basePath });
  const totalResult: SyncResult = {
    sessionsInserted: 0,
    sessionsUpdated: 0,
    messagesInserted: 0,
    errors: [],
  };

  for (const source of sources) {
    if (source.error || source.sessionCount === 0) continue;

    try {
      // Find all session files in source path
      const fs = await import('fs/promises');
      const files = await fs.readdir(source.path);
      const sessionFiles = files.filter((f) => f.endsWith('.jsonl'));

      for (const file of sessionFiles) {
        const filePath = `${source.path}/${file}`;
        const project = extractProjectFromPath(filePath, 'openclaw');

        try {
          const parseResult = await parseOpenClawSession(filePath, project);
          parseResult.session.name = extractSessionName(parseResult);
          parseResult.session.project = project;
          const result = writeSessionToDatabase(parseResult, undefined, filePath);
          totalResult.sessionsInserted += result.sessionsInserted;
          totalResult.sessionsUpdated += result.sessionsUpdated;
          totalResult.messagesInserted += result.messagesInserted;
          totalResult.errors.push(...result.errors);
        } catch (err) {
          totalResult.errors.push(`Failed to parse ${filePath}: ${err}`);
        }
      }
    } catch (err) {
      totalResult.errors.push(`Failed to sync source ${source.path}: ${err}`);
    }
  }

  sseManager.emit('sync_complete', {
    source: 'openclaw',
    sessionsInserted: totalResult.sessionsInserted,
    sessionsUpdated: totalResult.sessionsUpdated,
    errors: totalResult.errors.length,
  });

  return totalResult;
}

// ============================================================================
// Claude Code Sync
// ============================================================================

/**
 * Sync Claude Code sessions
 *
 * Uses discoverClaudeSources() and parseClaudeSession() from the parser module.
 * Handles parser errors gracefully — errors are captured in SyncResult.errors.
 */
async function syncClaudeCodeSource(): Promise<SyncResult> {
  const { discoverClaudeSources } = await import('./sources');
  const { parseClaudeSession } = await import('../parser/claude');

  const sources = await discoverClaudeSources();
  const totalResult: SyncResult = {
    sessionsInserted: 0,
    sessionsUpdated: 0,
    messagesInserted: 0,
    errors: [],
  };

  for (const source of sources) {
    if (source.error || source.sessionCount === 0) continue;

    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(source.path);
      const sessionFiles = files.filter((f) => f.endsWith('.jsonl'));

      for (const file of sessionFiles) {
        const filePath = `${source.path}/${file}`;
        const project = extractProjectFromPath(filePath, 'claude-code');

        try {
          const parseResult = await parseClaudeSession(filePath, project);
          parseResult.session.name = extractSessionName(parseResult);
          parseResult.session.project = project;
          const result = writeSessionToDatabase(parseResult, undefined, filePath);
          totalResult.sessionsInserted += result.sessionsInserted;
          totalResult.sessionsUpdated += result.sessionsUpdated;
          totalResult.messagesInserted += result.messagesInserted;
          totalResult.errors.push(...result.errors);
        } catch (err) {
          totalResult.errors.push(
            `Failed to parse Claude session ${filePath}: ${err}`
          );
        }
      }
    } catch (err) {
      totalResult.errors.push(
        `Failed to sync Claude source ${source.path}: ${err}`
      );
    }
  }

  sseManager.emit('sync_complete', {
    source: 'claude-code',
    sessionsInserted: totalResult.sessionsInserted,
    sessionsUpdated: totalResult.sessionsUpdated,
    errors: totalResult.errors.length,
  });

  return totalResult;
}

// ============================================================================
// Codex Sync
// ============================================================================

/**
 * Sync Codex sessions
 *
 * Uses discoverCodexSources() and parseCodexSession() from the parser module.
 * Handles parser errors gracefully — errors are captured in SyncResult.errors.
 */
async function syncCodexSource(): Promise<SyncResult> {
  const { discoverCodexSources } = await import('./sources');
  const { parseCodexSession } = await import('../parser/codex');

  const sources = await discoverCodexSources();
  const totalResult: SyncResult = {
    sessionsInserted: 0,
    sessionsUpdated: 0,
    messagesInserted: 0,
    errors: [],
  };

  for (const source of sources) {
    if (source.error || source.sessionCount === 0) continue;

    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(source.path);
      const sessionFiles = files.filter((f) => f.endsWith('.jsonl'));

      for (const file of sessionFiles) {
        const filePath = `${source.path}/${file}`;
        const project = extractProjectFromPath(filePath, 'codex');

        try {
          const parseResult = await parseCodexSession(filePath, project);
          parseResult.session.name = extractSessionName(parseResult);
          parseResult.session.project = project;
          const result = writeSessionToDatabase(parseResult, undefined, filePath);
          totalResult.sessionsInserted += result.sessionsInserted;
          totalResult.sessionsUpdated += result.sessionsUpdated;
          totalResult.messagesInserted += result.messagesInserted;
          totalResult.errors.push(...result.errors);
        } catch (err) {
          totalResult.errors.push(
            `Failed to parse Codex session ${filePath}: ${err}`
          );
        }
      }
    } catch (err) {
      totalResult.errors.push(
        `Failed to sync Codex source ${source.path}: ${err}`
      );
    }
  }

  sseManager.emit('sync_complete', {
    source: 'codex',
    sessionsInserted: totalResult.sessionsInserted,
    sessionsUpdated: totalResult.sessionsUpdated,
    errors: totalResult.errors.length,
  });

  return totalResult;
}
