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
// Database Write Operations
// ============================================================================

/**
 * Write a parsed session to the database
 *
 * Handles session upsert (insert or update) and message insertion.
 * If session already exists, updates metadata and replaces all messages.
 *
 * @param parseResult - Parsed session data from any parser
 * @param db - Optional database connection (defaults to getDatabase())
 * @returns SyncResult with counts and errors
 */
export function writeSessionToDatabase(parseResult: ParseResult, db?: Database.Database): SyncResult {
  const database = db || getDatabase();
  const errors: string[] = [];
  let sessionsInserted = 0;
  let sessionsUpdated = 0;
  let messagesInserted = 0;

  try {
    // Check if session already exists
    const existing = database.prepare(
      'SELECT id FROM sessions WHERE id = ?'
    ).get(parseResult.session.id) as { id: string } | undefined;

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
          termination_status = ?
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
        parseResult.session.id
      );
      sessionsUpdated++;
    } else {
      // Insert new session
      database.prepare(`
        INSERT INTO sessions (
          id, source, project, started_at, ended_at, status,
          message_count, user_message_count, total_output_tokens, has_tool_calls,
          parser_malformed_lines, is_truncated, termination_status,
          file_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        parseResult.session.id,
        parseResult.session.source,
        parseResult.session.project,
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
        parseResult.session.id // Use session ID as file_path for now
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
  // D-21 (Plan 01): Enumerated source types only — unknown sources have no parser
  if (sourceType === 'openclaw') {
    return syncOpenClawSource(basePath);
  }

  if (sourceType === 'claude-code') {
    return syncClaudeCodeSource();
  }

  if (sourceType === 'codex') {
    return syncCodexSource();
  }

  return {
    sessionsInserted: 0,
    sessionsUpdated: 0,
    messagesInserted: 0,
    errors: [`Unknown source type: ${sourceType}`],
  };
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
        const project = 'default'; // TODO: Extract project from path or config

        try {
          const parseResult = await parseOpenClawSession(filePath, project);
          const result = writeSessionToDatabase(parseResult);
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
        const project = 'default';

        try {
          const parseResult = await parseClaudeSession(filePath, project);
          const result = writeSessionToDatabase(parseResult);
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
        const project = 'default';

        try {
          const parseResult = await parseCodexSession(filePath, project);
          const result = writeSessionToDatabase(parseResult);
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
