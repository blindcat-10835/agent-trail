/**
 * OpenClaw JSONL Parser
 *
 * Parses OpenClaw session files from JSONL format into canonical trace model.
 * Handles streaming line-by-line parsing, session context extraction, and tool call discovery.
 *
 * @module ingest/parser/openclaw
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import {
  TraceSession,
  TraceMessage,
  TraceToolCall,
  TraceToolResultEvent,
  TraceActivity,
  ToolCategory,
  MessageRole,
  SourceMetadata,
  TokenUsage,
} from '@/types/trace';
import {
  OpenClawJsonlLine,
  ParseResult,
  ParseError,
  SessionContext,
} from './types';

/**
 * Parse an OpenClaw session file and return structured trace data
 *
 * @param filePath - Full path to the JSONL session file
 * @param project - Project name for session metadata
 * @returns ParseResult with session, messages, activities, errors, and warnings
 */
export async function parseOpenClawSession(
  filePath: string,
  project: string
): Promise<ParseResult> {
  const errors: ParseError[] = [];
  const warnings: string[] = [];
  const messages: TraceMessage[] = [];
  const activities: TraceActivity[] = [];

  // Extract session context from file path
  const context = extractSessionContext(filePath, project);

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

  for await (const line of rl) {
    lineNum++;
    if (!line.trim()) continue;

    try {
      const parsed: OpenClawJsonlLine = JSON.parse(line);

      if (parsed.type !== 'message') {
        warnings.push(`Line ${lineNum}: Skipping non-message type: ${parsed.type}`);
        continue;
      }

      if (!parsed.message) {
        errors.push({ line: lineNum, raw: line.substring(0, 200), error: 'Missing message field' });
        continue;
      }

      // Extract timestamp
      if (parsed.timestamp && !startedAt) {
        startedAt = parsed.timestamp;
      }
      if (parsed.timestamp) {
        endedAt = parsed.timestamp;
      }

      // Parse message
      const message = parseMessage(parsed.message, ordinal, context, lineNum);
      messages.push(message);

      // Extract tool calls from assistant messages
      if (message.role === 'assistant') {
        const toolCalls = extractToolCalls(parsed.message, context, lineNum);
        activities.push(...toolCalls);
        if (toolCalls.length > 0) hasToolCalls = true;
      }

      // Accumulate token usage
      if (parsed.message.usage) {
        totalInputTokens += parsed.message.usage.input_tokens || 0;
        totalOutputTokens += parsed.message.usage.output_tokens || 0;
      }

      ordinal++;
    } catch (err) {
      errors.push({
        line: lineNum,
        raw: line.substring(0, 200),
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Build session
  const session: TraceSession = {
    id: context.uuid,
    source: 'openclaw',
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
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      hasToolCalls,
      terminationStatus: undefined,
      parserMalformedLines: errors.length,
      isTruncated: false,
    },
    turns: [], // Will be populated by turn assembler in Plan 02-03
  };

  return {
    session,
    messages,
    activities,
    errors,
    warnings,
  };
}

/**
 * Extract session context from file path
 *
 * Path format: .../agents/{agentName}/sessions/{uuid}.jsonl
 *
 * @param filePath - Full path to session file
 * @param project - Project name
 * @returns SessionContext with extracted metadata
 */
function extractSessionContext(filePath: string, project: string): SessionContext {
  // Try to match agent session path pattern
  const match = filePath.match(/\/agents\/([^/]+)\/sessions\/([^/]+)\.jsonl/);
  if (match) {
    return {
      sessionKey: `agent:${match[1]}:${match[2]}`,
      agentName: match[1],
      uuid: match[2],
      project,
      filePath,
      fileMtime: fs.statSync(filePath).mtimeMs,
    };
  }

  // Fallback: extract UUID from filename
  const uuidMatch = filePath.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  const uuid = uuidMatch ? uuidMatch[1] : path.basename(filePath, '.jsonl');

  return {
    sessionKey: uuid,
    uuid,
    project,
    filePath,
    fileMtime: fs.statSync(filePath).mtimeMs,
  };
}

/**
 * Create an empty session for error cases
 */
function createEmptySession(context: SessionContext): TraceSession {
  return {
    id: context.uuid,
    source: 'openclaw',
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
 * Parse a single OpenClaw message
 *
 * @param msg - Raw OpenClaw message object
 * @param ordinal - Message ordinal position
 * @param context - Session context
 * @param lineNum - Line number for source metadata
 * @returns TraceMessage in canonical format
 */
function parseMessage(
  msg: any,
  ordinal: number,
  context: SessionContext,
  lineNum: number
): TraceMessage {
  // Extract content from message
  let content = '';
  if (typeof msg.content === 'string') {
    content = msg.content;
  } else if (Array.isArray(msg.content)) {
    const textBlock = msg.content.find((b: any) => b.type === 'text');
    content = textBlock?.text || '';
  }

  const sourceMetadata: SourceMetadata = {
    sourceType: 'openclaw',
    sourceFile: context.filePath,
    sourceLine: lineNum,
    sourceVersion: '1.0', // OpenClaw log version
  };

  return {
    id: `${context.uuid}-${ordinal}`,
    ordinal,
    role: msg.role as MessageRole,
    content,
    timestamp: msg.timestamp,
    model: msg.model,
    tokenUsage: msg.usage
      ? {
          inputTokens: msg.usage.input_tokens || 0,
          outputTokens: msg.usage.output_tokens || 0,
        }
      : undefined,
    sourceMetadata,
  };
}

/**
 * Extract tool calls from assistant message content blocks
 *
 * @param msg - OpenClaw message object
 * @param context - Session context
 * @param lineNum - Line number for ID generation
 * @returns Array of TraceToolCall activities
 */
function extractToolCalls(msg: any, context: SessionContext, lineNum: number): TraceToolCall[] {
  const toolCalls: TraceToolCall[] = [];

  if (Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (block.type === 'tool_use' || block.type === 'toolCall') {
        const name = block.name || block.toolName || 'unknown';
        const category = inferToolCategory(name);

        toolCalls.push({
          type: 'tool_call',
          id: block.id || `${context.uuid}-${lineNum}-${toolCalls.length}`,
          name,
          category,
          inputJson: JSON.stringify(block.input || {}),
          resultEvents: [], // Tool results come from tool_result messages
          status: 'pending', // Will be updated when tool_result is parsed
        });
      }
    }
  }

  return toolCalls;
}

/**
 * Infer tool category from tool name
 *
 * @param name - Tool name
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

/**
 * Parse a single OpenClaw message line
 *
 * Helper function for testing and single-line parsing scenarios
 *
 * @param line - JSONL line string
 * @param context - Session context
 * @returns TraceMessage or null if parsing fails
 */
export function parseOpenClawMessage(
  line: string,
  context: SessionContext
): TraceMessage | null {
  try {
    const parsed: OpenClawJsonlLine = JSON.parse(line);
    if (parsed.type !== 'message' || !parsed.message) return null;
    return parseMessage(parsed.message, 0, context, 0);
  } catch {
    return null;
  }
}
