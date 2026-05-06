/**
 * Codex JSONL Parser
 *
 * Parses Codex session files from JSONL format into canonical trace model.
 * Handles turn_context boundary mapping, response_item field discrimination,
 * function_call pairing, spawn_agent subagent linking, and token_count-based
 * streaming deduplication.
 *
 * Per D-06 through D-09 in Phase 3 CONTEXT.md.
 *
 * @module ingest/parser/codex
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import {
  TraceSession,
  TraceMessage,
  TraceToolCall,
  TraceToolResultEvent,
  TraceSubagentLink,
  TraceActivity,
  ToolCategory,
  MessageRole,
  SourceMetadata,
  SessionStatus,
  TokenUsage,
  SessionMetrics,
} from '@/types/trace';
import {
  CodexJsonlLine,
  CodexTurnContext,
  ParseResult,
  ParseError,
  SessionContext,
} from './types';

// ============================================================================
// Main Entry Point — parseCodexSession
// ============================================================================

/**
 * Parse a Codex session file and return structured trace data
 *
 * @param filePath - Full path to the Codex JSONL session file
 * @param project - Project name for session metadata
 * @returns ParseResult with session, messages, activities, errors, and warnings
 */
export async function parseCodexSession(
  filePath: string,
  project: string
): Promise<ParseResult> {
  const errors: ParseError[] = [];
  const warnings: string[] = [];
  const messages: TraceMessage[] = [];
  const activities: TraceActivity[] = [];

  // Extract session context from file path
  const context = extractCodexSessionContext(filePath, project);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return {
      session: createEmptySession(context),
      messages: [],
      activities: [],
      errors: [
        {
          line: 0,
          raw: filePath,
          error: 'File does not exist',
        },
      ],
      warnings: [],
    };
  }

  // Parse JSONL line by line
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let ordinal = 0;
  let lineNum = 0;
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let hasToolCalls = false;

  // Turn context tracking (D-06)
  let currentModel: string | undefined;
  let turnContexts: CodexTurnContext[] = [];

  // Session metadata from session_meta line
  let sessionCwd: string | undefined;
  let sessionGitBranch: string | undefined;
  let sessionModel: string | undefined;
  let sessionId: string = context.uuid;

  // Token-count dedup tracking (D-09)
  // Key: call_id for function_calls, content for text messages
  const messageVersions = new Map<
    string,
    { tokenCount: number; message: TraceMessage }
  >();

  // Tool call registry for pairing with function_call_output events (D-11)
  const toolCallMap = new Map<string, TraceToolCall>();

  for await (const line of rl) {
    lineNum++;
    if (!line.trim()) continue;

    try {
      const parsed: CodexJsonlLine = JSON.parse(line);

      // Handle session_meta — extract metadata from first line
      if (
        parsed.type === 'session_meta' &&
        parsed.session_meta
      ) {
        if (parsed.session_meta.session_id) {
          sessionId = parsed.session_meta.session_id;
        }
        if (parsed.session_meta.cwd) {
          sessionCwd = parsed.session_meta.cwd;
        }
        if (parsed.session_meta.git_branch) {
          sessionGitBranch = parsed.session_meta.git_branch;
        }
        if (parsed.session_meta.model) {
          sessionModel = parsed.session_meta.model;
        }
        if (parsed.timestamp && !startedAt) {
          startedAt = parsed.timestamp;
        }
        continue;
      }

      // Handle turn_context — extract turn boundary and model (D-06)
      if (
        parsed.type === 'turn_context' &&
        parsed.turn_context
      ) {
        currentModel = parsed.turn_context.model || currentModel;
        turnContexts.push({
          turnId: parsed.turn_context.turn_id,
          model: parsed.turn_context.model,
          startedAt: parsed.turn_context.started_at,
        });
        if (parsed.timestamp && !startedAt) {
          startedAt = parsed.timestamp;
        }
        continue;
      }

      // Handle response_item — the core message/activity type (D-07)
      if (
        parsed.type === 'response_item' &&
        parsed.response_item
      ) {
        const ri = parsed.response_item;
        const timestamp = parsed.timestamp;

        // Track timestamp boundaries
        if (timestamp) {
          if (!startedAt) startedAt = timestamp;
          endedAt = timestamp;
        }

        // input_text → TraceMessage (user)
        if (ri.type === 'input_text') {
          const content = ri.input_text || '';
          const dedupKey = `text:${content}`;
          const tokenCount = ri.token_count ?? 0;
          const sourceMetadata = createSourceMetadata(
            context,
            lineNum,
            sessionCwd,
            sessionGitBranch
          );

          const message: TraceMessage = {
            id: `${sessionId}-${ordinal}`,
            ordinal,
            role: 'user',
            content,
            timestamp,
            model: currentModel || sessionModel,
            sourceMetadata,
          };

          handleDedup(dedupKey, tokenCount, message, messageVersions, warnings, lineNum);
          ordinal++;
          continue;
        }

        // text → TraceMessage (assistant)
        if (ri.type === 'text') {
          const content = ri.text || '';
          const dedupKey = `text:${content}`;
          const tokenCount = ri.token_count ?? 0;
          const sourceMetadata = createSourceMetadata(
            context,
            lineNum,
            sessionCwd,
            sessionGitBranch
          );

          const message: TraceMessage = {
            id: `${sessionId}-${ordinal}`,
            ordinal,
            role: 'assistant',
            content,
            timestamp,
            model: currentModel || sessionModel,
            sourceMetadata,
          };

          handleDedup(dedupKey, tokenCount, message, messageVersions, warnings, lineNum);
          ordinal++;
          continue;
        }

        // function_call → TraceToolCall (D-07)
        if (ri.type === 'function_call') {
          const callId = ri.call_id || `call-${lineNum}`;
          const name = ri.name || 'unknown';

          // Dedup function calls by token_count too (D-09)
          const tokenCount = ri.token_count ?? 0;
          const dedupKey = `fc:${callId}`;

          // Check if we've already seen this function_call
          const existing = messageVersions.get(dedupKey);
          if (existing) {
            if (existing.tokenCount >= tokenCount) {
              warnings.push(
                `Line ${lineNum}: Duplicate function_call with same/lower token_count — keeping previous`
              );
              continue;
            }
            // Higher token_count: remove old tool call, will be replaced
            const oldIdx = toolCallMap.get(callId);
            if (oldIdx) {
              toolCallMap.delete(callId);
            }
          }

          const toolCall: TraceToolCall = {
            type: 'tool_call',
            id: callId,
            name,
            category: inferToolCategory(name),
            inputJson: ri.arguments || '{}',
            resultEvents: [],
            status: 'pending',
          };

          toolCallMap.set(callId, toolCall);
          // Store in messageVersions for dedup tracking
          messageVersions.set(dedupKey, { tokenCount, message: {
            id: callId,
            ordinal,
            role: 'assistant',
            content: `[function_call: ${name}]`,
            timestamp,
            model: currentModel || sessionModel,
            sourceMetadata: createSourceMetadata(context, lineNum, sessionCwd, sessionGitBranch),
          }});
          hasToolCalls = true;
          ordinal++;
          continue;
        }

        // Unknown response_item type
        warnings.push(
          `Line ${lineNum}: Skipping unknown response_item type: ${ri.type}`
        );
        continue;
      }

      // Handle event_msg — function_call_output → TraceToolResultEvent (D-07)
      if (parsed.type === 'event_msg' && parsed.event_msg) {
        const ev = parsed.event_msg;

        if (ev.type === 'function_call_output') {
          const callId = ev.call_id;
          if (callId && toolCallMap.has(callId)) {
            const toolCall = toolCallMap.get(callId)!;
            const resultEvent: TraceToolResultEvent = {
              type: 'result_event',
              timestamp: parsed.timestamp,
              content: ev.content || '',
              isPartial: ev.status !== 'completed',
            };
            toolCall.resultEvents.push(resultEvent);

            // Update tool call status
            if (ev.status === 'completed') {
              toolCall.status = 'success';
            }
          } else {
            // Orphan function_call_output
            warnings.push(
              `Line ${lineNum}: function_call_output for unknown call_id: ${callId}`
            );
          }
        }

        if (parsed.timestamp && !startedAt) {
          startedAt = parsed.timestamp;
        }
        if (parsed.timestamp) {
          endedAt = parsed.timestamp;
        }
        continue;
      }

      // Handle spawn_agent — TraceSubagentLink (D-08)
      if (parsed.type === 'spawn_agent' && parsed.spawn_agent) {
        const sa = parsed.spawn_agent;
        const subagentLink: TraceSubagentLink = {
          type: 'subagent_link',
          subagentSessionId: sa.session_id,
          subagentSource: 'codex',
          relationship:
            sa.type === 'attached' ? 'attached' : 'spawned',
        };
        activities.push(subagentLink);

        if (parsed.timestamp && !startedAt) {
          startedAt = parsed.timestamp;
        }
        if (parsed.timestamp) {
          endedAt = parsed.timestamp;
        }
        continue;
      }

      // Unknown line type
      warnings.push(
        `Line ${lineNum}: Skipping unknown type: ${parsed.type}`
      );
    } catch (err) {
      errors.push({
        line: lineNum,
        raw: line.substring(0, 200),
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Flush deduplicated messages
  messageVersions.forEach((entry) => {
    messages.push(entry.message);
  });

  // Flush tool calls from registry
  toolCallMap.forEach((toolCall) => {
    activities.push(toolCall);
  });

  // Build session
  const session: TraceSession = {
    id: sessionId,
    source: 'codex',
    project: context.project,
    startedAt,
    endedAt,
    status: endedAt ? 'idle' : 'active',
    rootSessionId: undefined,
    parentSessionId: undefined,
    relationshipType: undefined,
    metrics: {
      messageCount: messages.length,
      userMessageCount: messages.filter((m) => m.role === 'user').length,
      totalTokens: totalInputTokens + totalOutputTokens || undefined,
      hasToolCalls,
      terminationStatus: undefined,
      parserMalformedLines: errors.length,
      isTruncated: false,
    },
    turns: [], // Will be populated by turn assembler
  };

  return {
    session,
    messages,
    activities,
    errors,
    warnings,
  };
}

// ============================================================================
// Session Context Extraction
// ============================================================================

/**
 * Extract session context from file path
 *
 * Path format: .../codex/sessions/{session_id}.jsonl
 *
 * @param filePath - Full path to session file
 * @param project - Project name
 * @returns SessionContext with extracted metadata
 */
function extractCodexSessionContext(
  filePath: string,
  project: string
): SessionContext {
  // Try to match Codex session path pattern: .../codex/sessions/{uuid}.jsonl
  const match = filePath.match(
    /\/codex\/sessions\/([^/]+)\.jsonl/
  );
  if (match) {
    return {
      sessionKey: `codex:${match[1]}`,
      uuid: match[1],
      project,
      filePath,
      fileMtime: fs.existsSync(filePath)
        ? fs.statSync(filePath).mtimeMs
        : Date.now(),
    };
  }

  // Fallback: extract UUID from filename
  const uuidMatch = filePath.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  const uuid = uuidMatch
    ? uuidMatch[1]
    : path.basename(filePath, '.jsonl');

  return {
    sessionKey: uuid,
    uuid,
    project,
    filePath,
    fileMtime: fs.existsSync(filePath)
      ? fs.statSync(filePath).mtimeMs
      : Date.now(),
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create an empty session for error cases
 */
function createEmptySession(context: SessionContext): TraceSession {
  return {
    id: context.uuid,
    source: 'codex',
    project: context.project,
    startedAt: null,
    endedAt: null,
    status: 'error',
    rootSessionId: undefined,
    parentSessionId: undefined,
    relationshipType: undefined,
    metrics: {
      messageCount: 0,
      userMessageCount: 0,
      totalTokens: 0,
      hasToolCalls: false,
      parserMalformedLines: 0,
      isTruncated: false,
    },
    turns: [],
  };
}

/**
 * Create source metadata for trace messages
 */
function createSourceMetadata(
  context: SessionContext,
  lineNum: number,
  cwd?: string,
  gitBranch?: string
): SourceMetadata {
  return {
    sourceType: 'codex',
    sourceFile: context.filePath,
    sourceLine: lineNum,
    sourceVersion: '1.0',
    cwd,
    gitBranch,
  };
}

/**
 * Handle token_count-based deduplication (D-09)
 *
 * For streaming messages where the same logical message appears multiple
 * times with increasing token_count, keep only the version with the
 * highest token_count.
 *
 * @param key - Dedup key (call_id for function_calls, text:content for messages)
 * @param tokenCount - Token count of this version
 * @param message - The TraceMessage to potentially store
 * @param messageVersions - Accumulator map
 * @param warnings - Warnings array
 * @param lineNum - Current line number
 */
function handleDedup(
  key: string,
  tokenCount: number,
  message: TraceMessage,
  messageVersions: Map<string, { tokenCount: number; message: TraceMessage }>,
  warnings: string[],
  lineNum: number
): void {
  const existing = messageVersions.get(key);
  if (existing) {
    if (existing.tokenCount >= tokenCount) {
      warnings.push(
        `Line ${lineNum}: Duplicate response_item with same/lower token_count — keeping previous`
      );
      return;
    }
    // Higher token_count replaces previous
  }
  messageVersions.set(key, { tokenCount, message });
}

/**
 * Infer tool category from tool name
 *
 * @param name - Tool name from Codex function_call
 * @returns ToolCategory for UI grouping
 */
function inferToolCategory(name: string): ToolCategory {
  const lower = name.toLowerCase();
  if (lower.includes('bash') || lower.includes('shell')) return 'Bash';
  if (lower.includes('edit')) return 'Edit';
  if (lower.includes('read')) return 'Read';
  if (lower.includes('grep') || lower.includes('search')) return 'Grep';
  if (lower.includes('task')) return 'Task';
  if (lower.includes('agent')) return 'Agent';
  return 'Other';
}

// ============================================================================
// Single-Line Parser Helper — parseCodexMessage
// ============================================================================

/**
 * Parse a single Codex message line
 *
 * Helper function for testing. Only processes response_item lines
 * with input_text or text types; function_call, session_meta,
 * turn_context, event_msg, and spawn_agent lines return null.
 *
 * @param line - JSONL line string
 * @param context - Session context
 * @returns TraceMessage or null if not a suitable response_item or parsing fails
 */
export function parseCodexMessage(
  line: string,
  context: SessionContext
): TraceMessage | null {
  try {
    const parsed: CodexJsonlLine = JSON.parse(line);

    if (parsed.type !== 'response_item' || !parsed.response_item) {
      return null;
    }

    const ri = parsed.response_item;

    // Only process text-based response_items (not function_call)
    if (ri.type === 'function_call') return null;

    let role: MessageRole;
    let content: string;

    if (ri.type === 'input_text') {
      role = 'user';
      content = ri.input_text || '';
    } else if (ri.type === 'text') {
      role = 'assistant';
      content = ri.text || '';
    } else {
      return null;
    }

    return {
      id: `${context.uuid}-0`,
      ordinal: 0,
      role,
      content,
      timestamp: parsed.timestamp,
      sourceMetadata: {
        sourceType: 'codex',
        sourceFile: context.filePath,
        sourceLine: 0,
        sourceVersion: '1.0',
      },
    };
  } catch {
    return null;
  }
}
