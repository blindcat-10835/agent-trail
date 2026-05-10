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

const PARSER_CACHE_VERSION = 'parser-v7-turn-activity-placement';

// ============================================================================
// Types
// ============================================================================

export interface SyncResult {
  sessionsInserted: number;
  sessionsUpdated: number;
  messagesInserted: number;
  toolCallsInserted: number;
  toolResultEventsInserted: number;
  errors: string[];
}

export type SyncSourceType = 'openclaw' | 'claude-code' | 'codex';

/**
 * Options for writeSessionToDatabase
 */
export interface WriteSessionOptions {
  /**
   * Force reparse — bypass the file_hash skip cache and always re-write derived rows.
   * Used when a parser fix has been applied and existing indexed sessions must be rebuilt.
   */
  force?: boolean;
}

// ============================================================================
// Session Name & Project Extraction
// ============================================================================

/**
 * Extract a display name from the first user message in the parse result.
 */
function extractSessionName(parseResult: ParseResult): string {
  for (const message of parseResult.messages) {
    if (message.role !== 'user') continue

    const candidate = deriveDisplayNameFromUserMessage(message.content)
    if (candidate) return candidate
  }

  return ''
}

function deriveDisplayNameFromUserMessage(content: string): string {
  const normalized = content.trim()
  if (!normalized) return ''

  const commandArgs = normalized.match(/<command-args>([\s\S]*?)<\/command-args>/i)?.[1]?.trim()
  if (commandArgs) return truncateDisplayName(commandArgs)

  // Slash command with no args (e.g. /effort, /model) — skip, let loop find real user message
  if (/<command-name>/i.test(normalized)) return ''

  const codexRequest = normalized.match(/## My request for Codex:\s*([\s\S]*)/i)?.[1]?.trim()
  if (codexRequest) {
    const line = firstMeaningfulLine(codexRequest)
    if (line) return truncateDisplayName(line)
  }

  // OpenClaw channel messages inject metadata blocks before the actual user text.
  // Headers include "Conversation info (untrusted metadata):", "Sender (untrusted metadata):", etc.
  // The actual message follows all the ```json ... ``` code blocks, optionally with a
  // gateway-injected date prefix like "[Wed 2026-04-29 00:58 GMT+8] ".
  if (/^.{0,100}\(untrusted metadata\):/i.test(normalized)) {
    const codeBlockEndRe = /```\s*\n/g
    let lastIdx = 0
    let m: RegExpExecArray | null
    while ((m = codeBlockEndRe.exec(normalized)) !== null) {
      lastIdx = m.index + m[0].length
    }
    const afterBlocks = normalized.slice(lastIdx).trim()
    if (afterBlocks) {
      // Strip gateway-injected date prefix: "[Wed 2026-04-29 00:58 GMT+8] "
      const stripped = afterBlocks.replace(/^\[[^\]]{1,60}\]\s*/, '')
      const line = firstMeaningfulLine(stripped || afterBlocks)
      if (line) return truncateDisplayName(line)
    }
    return ''
  }

  const lower = normalized.toLowerCase()
  const metadataPrefixes = [
    '<environment_context',
    '<security_context',
    '<local-command-caveat',
    '<local-command-stdout',
    '<command-message',
    'base directory for this skill:',
    '# context from my ide setup:',
  ]
  if (metadataPrefixes.some(prefix => lower.startsWith(prefix))) return ''

  const line = firstMeaningfulLine(normalized)
  return line ? truncateDisplayName(line) : ''
}

function firstMeaningfulLine(content: string): string {
  return content
    .split('\n')
    .map(line => line.trim())
    .find(line => line.length > 0) || ''
}

function truncateDisplayName(line: string): string {
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
    // Path structure: {openclaw-dir}/agents/{agentName}/sessions/{file}.jsonl
    // Return the openclaw dir name (e.g. ".openclaw"), not the agent name.
    const parts = path.dirname(filePath).split(path.sep)
    const agentsIdx = parts.lastIndexOf('agents')
    if (agentsIdx > 0) return parts[agentsIdx - 1]
    return 'default'
  }

  // Codex: use parent directory name
  return path.basename(path.dirname(filePath)) || 'default'
}

function extractProjectFromParsedSession(
  parseResult: ParseResult,
  fallbackProject: string
): string {
  if (parseResult.session.project && parseResult.session.project !== 'default') {
    return parseResult.session.project
  }

  const cwd = parseResult.messages
    .map(m => m.sourceMetadata.cwd?.trim())
    .find((value): value is string => Boolean(value))

  return cwd || fallbackProject || 'default'
}

/**
 * Extract agent name from OpenClaw file path.
 *
 * Path structure: {openclaw-dir}/agents/{agentName}/sessions/{file}.jsonl
 */
function extractAgentNameFromPath(filePath: string, sourceType: SyncSourceType): string | undefined {
  if (sourceType !== 'openclaw') return undefined
  const parts = path.dirname(filePath).split(path.sep)
  const agentsIdx = parts.lastIndexOf('agents')
  if (agentsIdx >= 0 && agentsIdx + 1 < parts.length) return parts[agentsIdx + 1]
  return undefined
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

function buildParserCacheHash(source: string, fileHash: string): string {
  return `${PARSER_CACHE_VERSION}:${source}:${fileHash}`;
}

function coerceSqlText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (Buffer.isBuffer(value)) return value.toString('utf8');

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Write a parsed session to the database
 *
 * Handles session upsert (insert or update) and message insertion.
 * If session already exists, deletes derived rows in dependency order
 * (tool_result_events → tool_calls → turns → messages) and inserts replacements.
 *
 * All writes are wrapped in a single database.transaction() call so partial
 * failures roll back automatically (better-sqlite3 synchronous transactions).
 *
 * Supports skip cache: if sourceFile is provided and its hash matches the
 * stored file_hash, skips the entire parse-and-write operation unless force=true.
 *
 * @param parseResult - Parsed session data from any parser
 * @param db - Optional database connection (defaults to getDatabase())
 * @param sourceFile - Optional file path for hash-based skip cache and file_path column
 * @param options - Optional flags: force=true bypasses hash skip cache
 * @returns SyncResult with counts and errors
 */
export function writeSessionToDatabase(
  parseResult: ParseResult,
  db?: Database.Database,
  sourceFile?: string,
  options?: WriteSessionOptions
): SyncResult {
  const database = db || getDatabase();
  const errors: string[] = [];
  let sessionsInserted = 0;
  let sessionsUpdated = 0;
  let messagesInserted = 0;
  let toolCallsInserted = 0;
  let toolResultEventsInserted = 0;

  try {
    // Compute file hash for skip cache (if sourceFile provided)
    let fileHash: string | null = null;
    let fileSize: number | null = null;
    let fileMtime: string | null = null;
    const lastSyncAt = new Date().toISOString();
    if (sourceFile) {
      fileHash = computeFileHash(sourceFile);
      const stats = fs.statSync(sourceFile);
      fileSize = stats.size;
      fileMtime = new Date(stats.mtimeMs).toISOString();
    }
    const cacheFileHash = fileHash
      ? buildParserCacheHash(parseResult.session.source, fileHash)
      : null;

    // Check if session already exists
    const existing = database.prepare(
      'SELECT id, file_hash, name, project FROM sessions WHERE id = ?'
    ).get(parseResult.session.id) as { id: string; file_hash: string | null; name: string | null; project: string | null } | undefined;

    // Skip cache: if hash matches AND force is not set, skip full re-parse but still patch name/project if empty.
    if (existing && cacheFileHash && existing.file_hash === cacheFileHash && !options?.force) {
      database.prepare(`
        UPDATE sessions SET
          file_size = ?,
          file_mtime = ?,
          last_sync_at = ?,
          name = CASE WHEN (name IS NULL OR name = '') THEN ? ELSE name END,
          project = CASE WHEN (project IS NULL OR project = '' OR project = 'default') THEN ? ELSE project END,
          agent_name = COALESCE(?, agent_name)
        WHERE id = ?
      `).run(fileSize, fileMtime, lastSyncAt, parseResult.session.name || '', parseResult.session.project || '', parseResult.session.agentName || null, parseResult.session.id);

      return {
        sessionsInserted: 0,
        sessionsUpdated: 0,
        messagesInserted: 0,
        toolCallsInserted: 0,
        toolResultEventsInserted: 0,
        errors: [],
      };
    }

    // Build a lookup: messageOrdinal → tool calls for that message
    // Used to set has_tool_use on message rows.
    const toolCallsByOrdinal = new Map<number, typeof parseResult.activities[number][]>();
    for (const activity of parseResult.activities) {
      if (activity.type !== 'tool_call') continue;
      const ordinal = activity.messageOrdinal;
      if (typeof ordinal === 'number') {
        const list = toolCallsByOrdinal.get(ordinal) ?? [];
        list.push(activity);
        toolCallsByOrdinal.set(ordinal, list);
      }
    }

    // -------------------------------------------------------------------------
    // Transactional write: all inserts/deletes in a single SQLite transaction
    // -------------------------------------------------------------------------
    const writeTransaction = database.transaction(() => {
      if (existing) {
        // Delete derived rows in dependency order before re-inserting
        // tool_result_events reference tool_calls, so delete events first.
        database.prepare(`
          DELETE FROM tool_result_events
          WHERE tool_call_id IN (
            SELECT id FROM tool_calls WHERE session_id = ?
          )
        `).run(parseResult.session.id);
        database.prepare('DELETE FROM tool_calls WHERE session_id = ?').run(parseResult.session.id);
        database.prepare('DELETE FROM subagent_links WHERE session_id = ?').run(parseResult.session.id);
        database.prepare('DELETE FROM turns WHERE session_id = ?').run(parseResult.session.id);
        database.prepare('DELETE FROM messages WHERE session_id = ?').run(parseResult.session.id);

        // Update session metadata
        database.prepare(`
          UPDATE sessions SET
            started_at = ?,
            ended_at = ?,
            status = ?,
            message_count = ?,
            user_message_count = ?,
            total_output_tokens = ?,
            has_tool_calls = ?,
            parser_malformed_lines = ?,
            is_truncated = ?,
            termination_status = ?,
            name = ?,
            project = ?,
            root_session_id = ?,
            parent_session_id = ?,
            relationship_type = ?,
            cwd = ?,
            git_branch = ?,
            source_session_id = ?,
            source_version = ?,
            agent_name = ?,
            file_path = ?,
            file_size = ?,
            file_mtime = ?,
            file_hash = ?,
            last_sync_at = ?
          WHERE id = ?
        `).run(
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
          parseResult.session.name || '',
          parseResult.session.project,
          parseResult.session.rootSessionId || null,
          parseResult.session.parentSessionId || null,
          parseResult.session.relationshipType || 'root',
          parseResult.session.cwd || null,
          parseResult.session.gitBranch || null,
          parseResult.session.sourceSessionId || null,
          parseResult.session.sourceVersion || null,
          parseResult.session.agentName || null,
          sourceFile || parseResult.session.id,
          fileSize,
          fileMtime,
          cacheFileHash,
          lastSyncAt,
          parseResult.session.id
        );
        sessionsUpdated++;
      } else {
        // Insert new session
        database.prepare(`
          INSERT INTO sessions (
            id, source, project, name, started_at, ended_at, status,
            root_session_id, parent_session_id, relationship_type,
            message_count, user_message_count, total_output_tokens, has_tool_calls,
            parser_malformed_lines, is_truncated, termination_status,
            file_path, file_size, file_mtime, file_hash, last_sync_at,
            cwd, git_branch, source_session_id, source_version, agent_name
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          parseResult.session.id,
          parseResult.session.source,
          parseResult.session.project,
          parseResult.session.name || '',
          parseResult.session.startedAt,
          parseResult.session.endedAt,
          parseResult.session.status,
          parseResult.session.rootSessionId || null,
          parseResult.session.parentSessionId || null,
          parseResult.session.relationshipType || 'root',
          parseResult.session.metrics.messageCount,
          parseResult.session.metrics.userMessageCount,
          parseResult.session.metrics.totalTokens || 0,
          parseResult.session.metrics.hasToolCalls ? 1 : 0,
          parseResult.session.metrics.parserMalformedLines,
          parseResult.session.metrics.isTruncated ? 1 : 0,
          parseResult.session.metrics.terminationStatus || '',
          sourceFile || parseResult.session.id,
          fileSize,
          fileMtime,
          cacheFileHash,
          lastSyncAt,
          parseResult.session.cwd || null,
          parseResult.session.gitBranch || null,
          parseResult.session.sourceSessionId || null,
          parseResult.session.sourceVersion || null,
          parseResult.session.agentName || null
        );
        sessionsInserted++;
      }

      // Insert messages with stable IDs
      // ID priority: message.id (from parser) → deterministic fallback "${sessionId}:${ordinal}"
      const insertMessage = database.prepare(`
        INSERT INTO messages (
          id, session_id, ordinal, role, content, timestamp, model,
          has_tool_use, turn_id, turn_index, is_real_user_input,
          token_usage_json, source_file, source_line
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const message of parseResult.messages) {
        const messageId = (message.id && message.id.trim())
          ? message.id
          : `${parseResult.session.id}:${message.ordinal}`;

        const hasToolUse = toolCallsByOrdinal.has(message.ordinal) ? 1 : 0;

        insertMessage.run(
          messageId,
          parseResult.session.id,
          message.ordinal,
          message.role,
          message.content,
          message.timestamp || null,
          message.model || '',
          hasToolUse,
          message.turnId || null,
          typeof message.turnIndex === 'number' ? message.turnIndex : null,
          message.isRealUserInput ? 1 : 0,
          message.tokenUsage ? JSON.stringify(message.tokenUsage) : '',
          message.sourceMetadata.sourceFile,
          message.sourceMetadata.sourceLine || null
        );
        messagesInserted++;
      }

      // Insert tool_calls and tool_result_events
      const insertToolCall = database.prepare(`
        INSERT INTO tool_calls (
          session_id, message_ordinal, tool_id, name, category,
          input_json, status, error, duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertResultEvent = database.prepare(`
        INSERT INTO tool_result_events (tool_call_id, timestamp, content, is_partial)
        VALUES (?, ?, ?, ?)
      `);

      const insertSubagentLink = database.prepare(`
        INSERT INTO subagent_links (
          session_id, subagent_session_id, subagent_source, relationship, message_ordinal
        ) VALUES (?, ?, ?, ?, ?)
      `);

      for (const activity of parseResult.activities) {
        if (activity.type !== 'tool_call') continue;

        const tc = activity as import('@/types/trace').TraceToolCall;
        const messageOrdinal = tc.messageOrdinal ?? 0;

        const insertResult = insertToolCall.run(
          parseResult.session.id,
          messageOrdinal,
          tc.id,
          tc.name,
          tc.category || 'Other',
          coerceSqlText(tc.inputJson),
          tc.status,
          tc.error || null,
          tc.durationMs || null
        );
        toolCallsInserted++;

        const toolCallDbId = insertResult.lastInsertRowid;

        // Insert each result event linked to this tool call
        for (const re of tc.resultEvents) {
          insertResultEvent.run(
            toolCallDbId,
            re.timestamp || null,
            coerceSqlText(re.content),
            re.isPartial ? 1 : 0
          );
          toolResultEventsInserted++;
        }
      }

      for (const activity of parseResult.activities) {
        if (activity.type !== 'subagent_link') continue;

        const link = activity as import('@/types/trace').TraceSubagentLink;
        insertSubagentLink.run(
          parseResult.session.id,
          link.subagentSessionId,
          link.subagentSource,
          link.relationship,
          typeof link.messageOrdinal === 'number' ? link.messageOrdinal : null
        );
      }
    });

    writeTransaction();

    // Emit SSE events for real-time frontend invalidation (outside transaction)
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

  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Unknown error');
  }

  return {
    sessionsInserted,
    sessionsUpdated,
    messagesInserted,
    toolCallsInserted,
    toolResultEventsInserted,
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
 * Options for syncSource
 */
export interface SyncSourceOptions {
  /** Base path override for source discovery (OpenClaw only) */
  basePath?: string;
  /** Force reparse — bypasses file_hash skip cache; reparses all session files */
  force?: boolean;
  /** Maximum number of session files to parse for this sync call */
  limit?: number;
  /** Sort candidate files by newest mtime before applying limit */
  sortByMtimeDesc?: boolean;
}

interface SyncFileCandidate {
  filePath: string;
  project: string;
  mtimeMs: number;
}

function isSessionFileName(sourceType: SyncSourceType, fileName: string): boolean {
  if (sourceType !== 'openclaw') return fileName.endsWith('.jsonl');
  if (fileName.endsWith('.jsonl')) return true;
  const idx = fileName.indexOf('.jsonl.');
  if (idx <= 0) return false;
  const suffix = fileName.slice(idx + 7); // after ".jsonl."
  return suffix.startsWith('deleted.') || suffix.startsWith('reset.') || suffix === 'full.bak';
}

async function collectSessionFileCandidates(
  sources: Array<{ path: string; error?: string; sessionCount: number }>,
  sourceType: SyncSourceType,
  opts: SyncSourceOptions
): Promise<SyncFileCandidate[]> {
  const fsp = await import('fs/promises');
  const candidates: SyncFileCandidate[] = [];

  for (const source of sources) {
    if (source.error || source.sessionCount === 0) continue;

    let files: string[];
    try {
      files = await fsp.readdir(source.path);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!isSessionFileName(sourceType, file)) continue;

      const filePath = path.join(source.path, file);
      let mtimeMs = 0;
      if (opts.sortByMtimeDesc || typeof opts.limit === 'number') {
        try {
          const stats = await fsp.stat(filePath);
          mtimeMs = stats.mtimeMs;
        } catch {
          // Keep candidate with lowest priority; parser will report read errors.
        }
      }

      candidates.push({
        filePath,
        project: extractProjectFromPath(filePath, sourceType),
        mtimeMs,
      });
    }
  }

  if (opts.sortByMtimeDesc || typeof opts.limit === 'number') {
    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs || a.filePath.localeCompare(b.filePath));
  }

  if (typeof opts.limit === 'number') {
    return candidates.slice(0, Math.max(0, opts.limit));
  }

  return candidates;
}

/**
 * Sync all sessions from a source type
 *
 * Orchestrates full sync pipeline: discover sources → parse files → write to database.
 * Supports OpenClaw, Claude Code, and Codex source types.
 *
 * @param sourceType - Type of source to sync ('openclaw', 'claude-code', 'codex')
 * @param options - Optional sync options (basePath, force)
 * @returns SyncResult with aggregated counts and errors
 */
export async function syncSource(
  sourceType: SyncSourceType,
  options?: SyncSourceOptions | string
): Promise<SyncResult> {
  // Backward-compatible: accept legacy string argument as basePath
  const opts: SyncSourceOptions = typeof options === 'string'
    ? { basePath: options }
    : (options ?? {});

  let result: SyncResult;

  // D-21 (Plan 01): Enumerated source types only — unknown sources have no parser
  if (sourceType === 'openclaw') {
    result = await syncOpenClawSource(opts);
  } else if (sourceType === 'claude-code') {
    result = await syncClaudeCodeSource(opts);
  } else if (sourceType === 'codex') {
    result = await syncCodexSource(opts);
  } else {
    result = {
      sessionsInserted: 0,
      sessionsUpdated: 0,
      messagesInserted: 0,
      toolCallsInserted: 0,
      toolResultEventsInserted: 0,
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
async function syncOpenClawSource(opts: SyncSourceOptions): Promise<SyncResult> {
  const { discoverOpenClawSources } = await import('./sources');
  const { parseOpenClawSession } = await import('../parser/openclaw');

  const { getConfig } = await import('../config');
  const toolDirs = getConfig().toolDirs;
  const dirs = opts.basePath ? [opts.basePath] : toolDirs.get('openclaw');
  const sources = await discoverOpenClawSources(dirs);
  const totalResult: SyncResult = {
    sessionsInserted: 0,
    sessionsUpdated: 0,
    messagesInserted: 0,
    toolCallsInserted: 0,
    toolResultEventsInserted: 0,
    errors: [],
  };

  try {
    const candidates = await collectSessionFileCandidates(sources, 'openclaw', opts);

    for (const candidate of candidates) {
      const filePath = candidate.filePath;

      try {
        const parseResult = await parseOpenClawSession(filePath, candidate.project);
        parseResult.session.name = extractSessionName(parseResult);
        parseResult.session.project = extractProjectFromParsedSession(parseResult, candidate.project);
        parseResult.session.agentName = extractAgentNameFromPath(filePath, 'openclaw')
        const result = writeSessionToDatabase(parseResult, undefined, filePath, { force: opts.force });
        totalResult.sessionsInserted += result.sessionsInserted;
        totalResult.sessionsUpdated += result.sessionsUpdated;
        totalResult.messagesInserted += result.messagesInserted;
        totalResult.toolCallsInserted += result.toolCallsInserted;
        totalResult.toolResultEventsInserted += result.toolResultEventsInserted;
        totalResult.errors.push(...result.errors);
      } catch (err) {
        totalResult.errors.push(`Failed to parse ${filePath}: ${err}`);
      }
    }
  } catch (err) {
    totalResult.errors.push(`Failed to collect OpenClaw session files: ${err}`);
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
async function syncClaudeCodeSource(opts: SyncSourceOptions): Promise<SyncResult> {
  const { discoverClaudeSources } = await import('./sources');
  const { parseClaudeSession } = await import('../parser/claude');

  const { getConfig } = await import('../config');
  const toolDirs = getConfig().toolDirs;
  const sources = await discoverClaudeSources(toolDirs.get('claude-code'));
  const totalResult: SyncResult = {
    sessionsInserted: 0,
    sessionsUpdated: 0,
    messagesInserted: 0,
    toolCallsInserted: 0,
    toolResultEventsInserted: 0,
    errors: [],
  };

  try {
    const candidates = await collectSessionFileCandidates(sources, 'claude-code', opts);

    for (const candidate of candidates) {
      const filePath = candidate.filePath;

      try {
        const parseResult = await parseClaudeSession(filePath, candidate.project);
        parseResult.session.name = extractSessionName(parseResult);
        parseResult.session.project = extractProjectFromParsedSession(parseResult, candidate.project);
        const result = writeSessionToDatabase(parseResult, undefined, filePath, { force: opts.force });
        totalResult.sessionsInserted += result.sessionsInserted;
        totalResult.sessionsUpdated += result.sessionsUpdated;
        totalResult.messagesInserted += result.messagesInserted;
        totalResult.toolCallsInserted += result.toolCallsInserted;
        totalResult.toolResultEventsInserted += result.toolResultEventsInserted;
        totalResult.errors.push(...result.errors);
      } catch (err) {
        totalResult.errors.push(
          `Failed to parse Claude session ${filePath}: ${err}`
        );
      }
    }
  } catch (err) {
    totalResult.errors.push(`Failed to collect Claude session files: ${err}`);
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
async function syncCodexSource(opts: SyncSourceOptions): Promise<SyncResult> {
  const { discoverCodexSources } = await import('./sources');
  const { parseCodexSession } = await import('../parser/codex');

  const { getConfig } = await import('../config');
  const toolDirs = getConfig().toolDirs;
  const sources = await discoverCodexSources(toolDirs.get('codex'));
  const relationshipsByChild = typeof opts.limit === 'number'
    ? new Map<string, { parentSessionId: string; rootSessionId?: string }>()
    : await collectCodexRelationships(sources);
  const totalResult: SyncResult = {
    sessionsInserted: 0,
    sessionsUpdated: 0,
    messagesInserted: 0,
    toolCallsInserted: 0,
    toolResultEventsInserted: 0,
    errors: [],
  };

  try {
    const candidates = await collectSessionFileCandidates(sources, 'codex', opts);

    for (const candidate of candidates) {
      const filePath = candidate.filePath;

      try {
        const parseResult = await parseCodexSession(filePath, candidate.project);
        const relationship = relationshipsByChild.get(parseResult.session.id);
        if (relationship) {
          parseResult.session.parentSessionId = relationship.parentSessionId;
          parseResult.session.rootSessionId = relationship.rootSessionId || relationship.parentSessionId;
          parseResult.session.relationshipType = 'subagent';
          parseResult.session.sourceSessionId = parseResult.session.sourceSessionId || parseResult.session.id;
        }
        parseResult.session.name = extractSessionName(parseResult);
        parseResult.session.project = extractProjectFromParsedSession(parseResult, candidate.project);
        const result = writeSessionToDatabase(parseResult, undefined, filePath, { force: opts.force });
        totalResult.sessionsInserted += result.sessionsInserted;
        totalResult.sessionsUpdated += result.sessionsUpdated;
        totalResult.messagesInserted += result.messagesInserted;
        totalResult.toolCallsInserted += result.toolCallsInserted;
        totalResult.toolResultEventsInserted += result.toolResultEventsInserted;
        totalResult.errors.push(...result.errors);
      } catch (err) {
        totalResult.errors.push(
          `Failed to parse Codex session ${filePath}: ${err}`
        );
      }
    }
  } catch (err) {
    totalResult.errors.push(`Failed to collect Codex session files: ${err}`);
  }

  if (relationshipsByChild.size > 0) {
    try {
      backfillCodexRelationships(getDatabase(), relationshipsByChild);
    } catch (err) {
      totalResult.errors.push(`Codex relationship backfill failed: ${err}`);
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

/**
 * Backfill Codex subagent relationship columns for already-indexed child sessions.
 *
 * Iterates over a map of child IDs → parent/root IDs and updates matching
 * Codex session rows that still have root/null relationship_type. The function
 * is idempotent: running it twice on the same data produces identical rows.
 *
 * @param database - better-sqlite3 database instance
 * @param relationships - Map from child session ID to { parentSessionId, rootSessionId? }
 * @returns Number of rows updated
 */
export function backfillCodexRelationships(
  database: Database.Database,
  relationships: Map<string, { parentSessionId: string; rootSessionId?: string }>
): number {
  let totalUpdated = 0;

  const backfill = database.transaction(() => {
    const stmt = database.prepare(`
      UPDATE sessions
      SET parent_session_id = ?,
          root_session_id = ?,
          relationship_type = 'subagent',
          source_session_id = COALESCE(source_session_id, id)
      WHERE source = 'codex'
        AND id = ?
    `);

    for (const [childId, rel] of relationships) {
      if (!childId || childId === rel.parentSessionId || !rel.parentSessionId) {
        continue;
      }
      const result = stmt.run(rel.parentSessionId, rel.rootSessionId || rel.parentSessionId, childId);
      totalUpdated += result.changes;
    }
  });

  backfill();
  return totalUpdated;
}

export async function collectCodexRelationships(
  sources: Array<{ path: string; error?: string; sessionCount: number }>
): Promise<Map<string, { parentSessionId: string; rootSessionId?: string }>> {
  const relationships = new Map<string, { parentSessionId: string; rootSessionId?: string }>();
  const fsp = await import('fs/promises');
  const readline = await import('readline');

  for (const source of sources) {
    if (source.error || source.sessionCount === 0) continue;

    let files: string[];
    try {
      files = await fsp.readdir(source.path);
    } catch {
      continue;
    }

    for (const file of files.filter((f) => f.endsWith('.jsonl'))) {
      const filePath = `${source.path}/${file}`;
      if (!fs.existsSync(filePath)) continue;
      const stream = fs.createReadStream(filePath);
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

      try {
        for await (const line of rl) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            const payload = parsed?.event_msg || parsed?.payload;
            if (
              parsed?.type === 'event_msg' &&
              payload?.type === 'collab_agent_spawn_end' &&
              typeof payload.new_thread_id === 'string' &&
              typeof payload.sender_thread_id === 'string'
            ) {
              relationships.set(payload.new_thread_id, {
                parentSessionId: payload.sender_thread_id,
                rootSessionId: payload.sender_thread_id,
              });
            }
          } catch {
            // Relationship collection is best-effort; parser records malformed lines later.
          }
        }
      } finally {
        rl.close();
      }
    }
  }

  return relationships;
}
