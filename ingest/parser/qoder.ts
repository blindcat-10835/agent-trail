/**
 * Qoder SQLite Readonly Parser
 *
 * Reads Qoder sessions from the local SQLite main database and produces
 * canonical ParseResult objects with `qoder:` session ID prefixes.
 *
 * Privacy hardline (SPEC §10 / D-10):
 *   - DB opened with { readonly: true, fileMustExist: true }
 *   - Only ONE new Database() call per parseQoderSession invocation
 *   - Never reads credential/token/auth files (privacy hardline)
 *   - Never calls fs.readFile/readFileSync/fs.openSync against any other path
 *   - No INSERT/UPDATE/DELETE/PRAGMA writes against the Qoder DB
 *
 * Token attribution (SPEC §8):
 *   - totalTokens = prompt_tokens + completion_tokens ONLY
 *   - cached_tokens NEVER added to total (exposed as cacheReadTokens)
 *   - max_input_tokens stored as metadata only
 *
 * @module ingest/parser/qoder
 */

import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import type {
  TraceSession,
  TraceMessage,
  TraceActivity,
  TraceToolCall,
  TraceToolResultEvent,
  TraceSubagentLink,
  TraceSource,
  ToolCategory,
  TokenUsage,
  SessionMetrics,
  SessionStatus,
  SourceMetadata,
  MessageRole,
} from '@/types/trace';
import type { ParseResult, ParseError } from './types';

// ============================================================================
// Types
// ============================================================================

export interface QoderParseOptions {
  force?: boolean;
}

interface QoderChatSession {
  session_id: string;
  session_title: string | null;
  project_id: string | null;
  project_uri: string | null;
  project_name: string | null;
  gmt_create: number;
  gmt_modified: number;
  session_type: string | null;
  mode: string | null;
  version: number | null;
  preferred_model_info: string | null;
  stop_reason: string | null;
  extra: string | null;
  parent_session_id: string | null;
  parent_tool_call_id: string | null;
}

interface QoderChatRecord {
  request_id: string;
  session_id: string;
  question: string | null;
  answer: string | null;
  reasoning_content: string | null;
  gmt_create: number;
  extra: string | null;
}

interface QoderChatMessage {
  id: string;
  session_id: string;
  request_id: string | null;
  role: string;
  content: string | null;
  summary: string | null;
  gmt_create: number;
  model_info: string | null;
  token_info: string | null;
  tool_calls?: string | null;
  tool_call_id?: string | null;
  tool_result: string | null;
  tool_call_status?: string | null;
  extra: string | null;
}

interface QoderToolCall {
  toolCallId: string;
  name: string;
  parameters: Record<string, unknown>;
}

interface QoderToolResult {
  toolCallId?: string;
  toolCallName?: string;
  toolCallStatus?: string;
  parameters?: Record<string, unknown>;
  results?: Array<{ type?: string; text?: string }>;
  errorMsg?: string;
  error?: string;
  [key: string]: unknown;
}

// ============================================================================
// Retry helper for SQLITE_BUSY
// ============================================================================

function withRetry<T>(fn: () => T, retries = 3, delayMs = 100): T {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isBusy = msg.includes('SQLITE_BUSY') || msg.includes('database is locked');
      if (!isBusy || attempt === retries) throw err;
      // Wait before retry
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
    }
  }
  // Unreachable, but satisfies TypeScript
  throw new Error('withRetry exhausted');
}

// ============================================================================
// Tool Category Mapping (SPEC §7)
// ============================================================================

/**
 * Map Qoder tool names to canonical ToolCategory values.
 *
 * Per SPEC §7:
 *   read_file → Read, list_dir → Read
 *   search_file → Grep, grep_code → Grep, search_codebase → Grep
 *   run_in_terminal → Bash
 *   Agent → Agent
 *   default → Other
 */
export function inferQoderToolCategory(toolName: string): ToolCategory {
  switch (toolName) {
    case 'read_file':
    case 'list_dir':
      return 'Read';
    case 'search_file':
    case 'grep_code':
    case 'search_codebase':
      return 'Grep';
    case 'create_file':
    case 'delete_file':
    case 'search_replace':
      return 'Edit';
    case 'run_in_terminal':
      return 'Bash';
    case 'Agent':
      return 'Agent';
    default:
      return 'Other';
  }
}

// ============================================================================
// Fingerprint Helper (D-03)
// ============================================================================

/**
 * Compute per-session fingerprint for skip-cache deduplication.
 *
 * Formula: sha256("qoder-session-v1:<id>:<gmt_modified>:<msg_count>:<max_msg_gmt>")
 * Stored in sessions.file_hash column (reused per D-03).
 */
export function computeQoderSessionFingerprint(row: {
  id: string;
  gmt_modified: number;
  msg_count: number;
  max_msg_gmt: number | null;
}): string {
  return createHash('sha256')
    .update(`qoder-session-v1:${row.id}:${row.gmt_modified}:${row.msg_count}:${row.max_msg_gmt ?? 0}`)
    .digest('hex');
}

// ============================================================================
// Epoch-to-ISO helper
// ============================================================================

function epochToIso(epochMs: number | null): string | null {
  if (epochMs == null || epochMs === 0) return null;
  return new Date(epochMs).toISOString();
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse a single Qoder session from the SQLite database.
 *
 * Opens the DB readonly, queries session/record/message rows, and maps
 * them to canonical ParseResult with `qoder:<rawSessionId>` prefix.
 *
 * Privacy: only ONE new Database() call; no writes to Qoder DB.
 *
 * @param dbPath - Path to the Qoder SQLite database file
 * @param rawSessionId - The raw session ID from chat_session.session_id
 * @param options - Optional parse options
 * @returns ParseResult with canonical session, messages, activities
 */
export async function parseQoderSession(
  dbPath: string,
  rawSessionId: string,
  _options: QoderParseOptions = {}
): Promise<ParseResult> {
  const errors: ParseError[] = [];
  const warnings: string[] = [];
  const messages: TraceMessage[] = [];
  const activities: TraceActivity[] = [];

  const toolCallOrdinalMap = new Map<string, number>();
  const pendingToolCalls = new Map<string, TraceToolCall>();
  let messageOrdinal = 0;

  // Aggregation accumulators
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let hasToolCalls = false;
  let userMessageCount = 0;
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  let resolvedModel: string | undefined;
  let sessionMaxInputTokens: number | null = null;

  // Single readonly DB handle — SPEC §10 hardline
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });

  try {
    // ------------------------------------------------------------------
    // 1. Load session row
    // ------------------------------------------------------------------
    let sessionRow: QoderChatSession | undefined;
    try {
      sessionRow = withRetry(() =>
        db.prepare('SELECT * FROM chat_session WHERE session_id = ?').get(rawSessionId)
      ) as QoderChatSession | undefined;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('SQLITE_BUSY') || msg.includes('database is locked')) {
        warnings.push(`Qoder DB locked when reading session ${rawSessionId}: ${msg}`);
      }
      return buildEmptyResult(
        rawSessionId,
        errors,
        warnings,
        `Failed to read session: ${msg}`
      );
    }

    if (!sessionRow) {
      return buildEmptyResult(
        rawSessionId,
        errors,
        warnings,
        `Session not found: ${rawSessionId}`
      );
    }

    // Track time bounds
    const sessionStartIso = epochToIso(sessionRow.gmt_create);
    startedAt = sessionStartIso;
    endedAt = epochToIso(sessionRow.gmt_modified) || sessionStartIso;

    // ------------------------------------------------------------------
    // 2. Load records for model fallback
    // ------------------------------------------------------------------
    let records: QoderChatRecord[] = [];
    try {
      records = withRetry(() =>
        db.prepare('SELECT * FROM chat_record WHERE session_id = ? ORDER BY gmt_create, request_id')
          .all(rawSessionId)
      ) as QoderChatRecord[];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Failed to load records for session ${rawSessionId}: ${msg}`);
    }

    // Build request_id → record lookup for model fallback.
    // Real Qoder DBs use request_id as chat_record's primary key and the
    // chat_message join key; there is no chat_message.record_id column.
    const recordByRequestId = new Map<string, QoderChatRecord>();
    for (const rec of records) {
      recordByRequestId.set(rec.request_id, rec);
    }

    // ------------------------------------------------------------------
    // 3. Load messages ordered by gmt_create, id
    // ------------------------------------------------------------------
    let chatMessages: QoderChatMessage[] = [];
    try {
      chatMessages = withRetry(() =>
        db.prepare('SELECT * FROM chat_message WHERE session_id = ? ORDER BY gmt_create, id')
          .all(rawSessionId)
      ) as QoderChatMessage[];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Failed to load messages for session ${rawSessionId}: ${msg}`);
    }

    // ------------------------------------------------------------------
    // 4. Iterate messages
    // ------------------------------------------------------------------
    for (const msg of chatMessages) {
      const msgTimestamp = epochToIso(msg.gmt_create);
      if (msgTimestamp && !startedAt) startedAt = msgTimestamp;
      if (msgTimestamp) endedAt = msgTimestamp;

      if (msg.role === 'user') {
        // Emit user message
        userMessageCount++;
        messages.push({
          id: msg.id,
          ordinal: messageOrdinal,
          role: 'user' as MessageRole,
          content: msg.content || '',
          timestamp: msgTimestamp ?? undefined,
          sourceMetadata: buildSourceMetadata(dbPath, rawSessionId),
        });
        messageOrdinal++;

      } else if (msg.role === 'assistant') {
        // Parse tool_calls JSON
        let toolCalls: QoderToolCall[] = [];
        if (msg.tool_calls) {
          try {
            toolCalls = JSON.parse(msg.tool_calls) as QoderToolCall[];
            if (!Array.isArray(toolCalls)) toolCalls = [];
          } catch {
            warnings.push(`Malformed tool_calls JSON in message ${msg.id}`);
            toolCalls = [];
          }
        }

        // Parse token_info JSON (Pattern G — SPEC §8)
        let tokenUsage: TokenUsage | undefined;
        let msgModel: string | undefined;
        if (msg.token_info) {
          try {
            const ti = JSON.parse(msg.token_info) as {
              prompt_tokens?: number;
              completion_tokens?: number;
              cached_tokens?: number;
              max_input_tokens?: number;
            };
            const inputTokens = ti.prompt_tokens ?? 0;
            const outputTokens = ti.completion_tokens ?? 0;
            const cacheReadTokens = ti.cached_tokens ?? 0;

            tokenUsage = {
              inputTokens,
              outputTokens,
              cacheReadTokens,
              cacheWriteTokens: 0,
              reasoningTokens: 0,
              totalTokens: inputTokens + outputTokens, // SPEC §8: NEVER add cached_tokens
            };

            // Accumulate session totals
            totalInputTokens += inputTokens;
            totalOutputTokens += outputTokens;
            totalCacheReadTokens += cacheReadTokens;

            // Store max_input_tokens as session metadata only
            if (ti.max_input_tokens != null) {
              sessionMaxInputTokens = ti.max_input_tokens;
            }
          } catch {
            warnings.push(`Malformed token_info JSON in message ${msg.id}`);
          }
        }

        // Model fallback chain: message.model_info > record.extra.modelConfig > session.preferred_model_info
        if (msg.model_info) {
          try {
            const mi = JSON.parse(msg.model_info) as { model_key?: string };
            if (mi.model_key) msgModel = mi.model_key;
          } catch {
            // ignore malformed model_info
          }
        }
        if (!msgModel && msg.request_id) {
          const record = recordByRequestId.get(msg.request_id);
          if (record?.extra) {
            try {
              const extra = JSON.parse(record.extra) as { modelConfig?: { key?: string } };
              if (extra.modelConfig?.key) msgModel = extra.modelConfig.key;
            } catch {
              // ignore
            }
          }
        }
        if (!msgModel && sessionRow.preferred_model_info) {
          try {
            const pm = JSON.parse(sessionRow.preferred_model_info) as { model_key?: string };
            if (pm.model_key) msgModel = pm.model_key;
          } catch {
            // ignore
          }
        }
        if (!msgModel) msgModel = 'unknown';

        // Track the first resolved model at session level
        if (!resolvedModel && msgModel && msgModel !== 'unknown') {
          resolvedModel = msgModel;
        }

        // Emit TraceToolCall for each tool call in the assistant message
        for (const tc of toolCalls) {
          hasToolCalls = true;
          const toolCallId = tc.toolCallId || `tc-${messageOrdinal}`;
          const toolCall: TraceToolCall = {
            type: 'tool_call',
            id: toolCallId,
            name: tc.name,
            category: inferQoderToolCategory(tc.name),
            inputJson: JSON.stringify(tc.parameters),
            resultEvents: [],
            status: 'pending', // will be updated when matching tool message is found
            messageOrdinal,
            sourceLine: msg.gmt_create,
          };
          pendingToolCalls.set(toolCallId, toolCall);
          toolCallOrdinalMap.set(toolCallId, messageOrdinal);
          activities.push(toolCall);
        }

        // Emit assistant message
        messages.push({
          id: msg.id,
          ordinal: messageOrdinal,
          role: 'assistant' as MessageRole,
          content: msg.content || '',
          timestamp: msgTimestamp ?? undefined,
          model: msgModel,
          tokenUsage,
          sourceMetadata: buildSourceMetadata(dbPath, rawSessionId),
        });
        messageOrdinal++;

      } else if (msg.role === 'tool') {
        // Parse tool_result JSON (with malformed handling)
        let parsedResult: QoderToolResult | null = null;
        let isMalformed = false;
        if (msg.tool_result) {
          try {
            parsedResult = JSON.parse(msg.tool_result) as QoderToolResult;
          } catch {
            isMalformed = true;
            warnings.push(`Malformed tool_result JSON in message ${msg.id}`);
          }
        }

        // Find matching pending tool call
        // Real Qoder DBs keep tool call identity inside tool_result JSON.
        // Older synthetic fixtures also had tool_call_id columns, so keep that
        // as a compatibility fallback.
        let matchedToolCallId = parsedResult?.toolCallId || msg.tool_call_id || null;
        if (!matchedToolCallId && isMalformed) {
          matchedToolCallId = `qoder-tool:${msg.id}`;
        }
        let matchedToolCall = matchedToolCallId ? pendingToolCalls.get(matchedToolCallId) : undefined;

        if (matchedToolCall) {
          // Determine status
          const statusStr = parsedResult?.toolCallStatus || msg.tool_call_status || 'FINISHED';
          const isError = statusStr === 'ERROR';

          matchedToolCall.status = isError ? 'error' : 'success';

          // Build result event content
          let resultContent: string;
          if (isMalformed) {
            resultContent = msg.tool_result || '';
          } else if (isError) {
            resultContent = parsedResult?.errorMsg || parsedResult?.error || 'Tool call failed';
            matchedToolCall.error = resultContent;
          } else {
            // Serialize results array
            const results = Array.isArray(parsedResult?.results) ? parsedResult.results : [];
            resultContent = results.map(r => r.text || JSON.stringify(r)).join('\n');
          }

          const resultEvent: TraceToolResultEvent = {
            type: 'result_event',
            timestamp: msgTimestamp ?? undefined,
            content: resultContent,
            isPartial: false,
          };
          matchedToolCall.resultEvents.push(resultEvent);
        } else if (matchedToolCallId) {
          // Tool result without a matching tool call — create an ad-hoc one
          const toolName = parsedResult?.toolCallName || 'unknown';
          const statusStr = parsedResult?.toolCallStatus || msg.tool_call_status || 'FINISHED';
          const isError = statusStr === 'ERROR';
          hasToolCalls = true;

          const toolCall: TraceToolCall = {
            type: 'tool_call',
            id: matchedToolCallId,
            name: toolName,
            category: inferQoderToolCategory(toolName),
            inputJson: parsedResult?.parameters ? JSON.stringify(parsedResult.parameters) : '',
            resultEvents: [],
            status: isError ? 'error' : 'success',
            messageOrdinal,
            sourceLine: msg.gmt_create,
          };

          if (isError) {
            toolCall.error = parsedResult?.errorMsg || parsedResult?.error || 'Tool call failed';
          }

          const resultContent = isMalformed
            ? (msg.tool_result || '')
            : isError
              ? (parsedResult?.errorMsg || parsedResult?.error || 'Tool call failed')
              : (Array.isArray(parsedResult?.results) ? parsedResult.results : [])
                  .map(r => r.text || JSON.stringify(r))
                  .join('\n');

          toolCall.resultEvents.push({
            type: 'result_event',
            timestamp: msgTimestamp ?? undefined,
            content: resultContent,
            isPartial: false,
          });

          pendingToolCalls.set(matchedToolCallId, toolCall);
          toolCallOrdinalMap.set(matchedToolCallId, messageOrdinal);
          activities.push(toolCall);
        }

        // Emit tool_result message
        messages.push({
          id: msg.id,
          ordinal: messageOrdinal,
          role: 'tool_result' as MessageRole,
          content: isMalformed ? (msg.tool_result || '') : '',
          timestamp: msgTimestamp ?? undefined,
          sourceMetadata: buildSourceMetadata(dbPath, rawSessionId),
        });
        messageOrdinal++;
      }
    }

    // ------------------------------------------------------------------
    // 5. Subagent link emission (D-06 part 1 — mirror codex.ts:842-852)
    // ------------------------------------------------------------------
    if (sessionRow.parent_session_id && sessionRow.parent_tool_call_id) {
      // Compute parentMessageOrdinal via reverse-lookup
      let parentMessageOrdinal: number | undefined;

      // Try local toolCallOrdinalMap first (if parent session was parsed in same DB)
      parentMessageOrdinal = toolCallOrdinalMap.get(sessionRow.parent_tool_call_id);

      // If not found locally, query the parent session's messages
      if (parentMessageOrdinal === undefined) {
        try {
          // Find the parent's message ordering and locate the tool call
          const parentMsgs = withRetry(() =>
            db.prepare(
              `SELECT id
               FROM chat_message
               WHERE session_id = ?
                 AND role = 'tool'
                 AND tool_result IS NOT NULL
                 AND json_valid(tool_result)
                 AND json_extract(tool_result, '$.toolCallId') = ?
               ORDER BY gmt_create, id`
            ).all(sessionRow.parent_session_id, sessionRow.parent_tool_call_id)
          ) as Array<{ id: string }>;

          if (parentMsgs.length > 0) {
            // Count all messages before this tool message to get the ordinal
            const allParentMsgs = withRetry(() =>
              db.prepare('SELECT id FROM chat_message WHERE session_id = ? ORDER BY gmt_create, id')
                .all(sessionRow.parent_session_id)
            ) as Array<{ id: string }>;

            const toolMsgId = parentMsgs[0].id;
            let idx = allParentMsgs.findIndex(m => m.id === toolMsgId);
            if (idx >= 0) {
              parentMessageOrdinal = idx;
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('SQLITE_BUSY') || msg.includes('database is locked')) {
            warnings.push(`Qoder DB locked during parent ordinal lookup: ${msg}`);
          }
        }
      }

      const subagentLink: TraceSubagentLink = {
        type: 'subagent_link',
        subagentSessionId: `qoder:${rawSessionId}`,
        subagentSource: 'qoder' as TraceSource,
        relationship: 'spawned',
        messageOrdinal: parentMessageOrdinal ?? 0,
      };
      activities.push(subagentLink);

      if (parentMessageOrdinal === undefined) {
        warnings.push(
          `Parent tool call ${sessionRow.parent_tool_call_id} not found in parent session ${sessionRow.parent_session_id}; using ordinal 0`
        );
      }
    }

    // ------------------------------------------------------------------
    // 6. Build TraceSession
    // ------------------------------------------------------------------
    const session: TraceSession = {
      id: `qoder:${rawSessionId}`,
      source: 'qoder' as TraceSource,
      sourceSessionId: rawSessionId,
      project: extractProject(sessionRow),
      name: sessionRow.session_title || undefined,
      startedAt,
      endedAt,
      status: inferSessionStatus(sessionRow),
      parentSessionId: sessionRow.parent_session_id
        ? `qoder:${sessionRow.parent_session_id}`
        : undefined,
      rootSessionId: sessionRow.parent_session_id
        ? `qoder:${sessionRow.parent_session_id}`
        : `qoder:${rawSessionId}`,
      relationshipType: sessionRow.parent_session_id ? 'subagent' : 'root',
      sourceVersion: sessionRow.version == null ? undefined : String(sessionRow.version),
      agentName: sessionRow.session_type || sessionRow.mode || undefined,
      model: resolvedModel,
      metrics: {
        messageCount: chatMessages.length,
        userMessageCount,
        inputTokens: totalInputTokens || undefined,
        outputTokens: totalOutputTokens || undefined,
        cacheReadTokens: totalCacheReadTokens || undefined,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        totalTokens: totalInputTokens + totalOutputTokens, // SPEC §8: NO cached_tokens
        hasToolCalls,
        parserMalformedLines: warnings.length,
        isTruncated: false,
        terminationStatus: sessionRow.stop_reason || undefined,
      },
      turns: [],
    };

    return { session, messages, activities, errors, warnings };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // SQLITE_BUSY after retries — return partial result
    if (msg.includes('SQLITE_BUSY') || msg.includes('database is locked')) {
      warnings.push(`Qoder DB locked for session ${rawSessionId}: ${msg}`);
      return {
        session: {
          id: `qoder:${rawSessionId}`,
          source: 'qoder' as TraceSource,
          sourceSessionId: rawSessionId,
          project: '',
          startedAt: null,
          endedAt: null,
          status: 'error',
          metrics: emptyMetrics(),
          turns: [],
        },
        messages,
        activities,
        errors,
        warnings,
      };
    }
    throw err;
  } finally {
    db.close();
  }
}

// ============================================================================
// Helpers
// ============================================================================

function emptyMetrics(): SessionMetrics {
  return {
    messageCount: 0,
    userMessageCount: 0,
    hasToolCalls: false,
    parserMalformedLines: 0,
    isTruncated: false,
  };
}

function buildEmptyResult(
  rawSessionId: string,
  errors: ParseError[],
  warnings: string[],
  errorMsg: string
): ParseResult {
  errors.push({ line: 0, raw: rawSessionId, error: errorMsg });
  return {
    session: {
      id: `qoder:${rawSessionId}`,
      source: 'qoder' as TraceSource,
      sourceSessionId: rawSessionId,
      project: '',
      startedAt: null,
      endedAt: null,
      status: 'error',
      metrics: emptyMetrics(),
      turns: [],
    },
    messages: [],
    activities: [],
    errors,
    warnings,
  };
}

function buildSourceMetadata(dbPath: string, sessionId: string): SourceMetadata {
  return {
    sourceType: 'qoder',
    sourceFile: dbPath,
  };
}

function extractProject(session: QoderChatSession): string {
  // Try project_name first, then project_uri basename, then 'unknown'
  if (session.project_name) return session.project_name;
  if (session.project_uri) {
    try {
      const url = new URL(session.project_uri);
      const parts = url.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || 'unknown';
    } catch {
      // not a valid URL — treat as path
      const parts = session.project_uri.split('/').filter(Boolean);
      return parts[parts.length - 1] || 'unknown';
    }
  }
  return 'unknown';
}

function inferSessionStatus(session: QoderChatSession): SessionStatus {
  if (session.stop_reason === 'error') return 'error';
  if (session.stop_reason === 'aborted') return 'aborted';
  if (session.stop_reason) return 'idle';
  return 'unknown';
}
