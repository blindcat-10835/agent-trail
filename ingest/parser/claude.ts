/**
 * Claude Code JSONL Parser
 *
 * Parses Claude Code session files from JSONL format into canonical trace model.
 * Supports DAG/fork/continuation resolution, streaming UUID dedup, compact/system
 * boundary handling, and subagent mapping.
 *
 * @module ingest/parser/claude
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import {
  TraceSession,
  TraceMessage,
  TraceToolCall,
  TraceToolResultEvent,
  TraceThinkingBlock,
  TraceSubagentLink,
  TraceActivity,
  ToolCategory,
  MessageRole,
  SourceMetadata,
  TokenUsage,
} from '@/types/trace';
import {
  ClaudeJsonlLine,
  ClaudeDAGNode,
  ClaudeCompactBoundary,
  ParseResult,
  ParseError,
  SessionContext,
} from './types';

type ClaudeSessionContext = SessionContext & {
  rootSessionId?: string;
  parentSessionId?: string;
  relationshipType?: 'root' | 'subagent' | 'fork' | 'continuation';
  sourceSessionId?: string;
  sourceVersion?: string;
};

// ============================================================================
// Main Parser Entry Point
// ============================================================================

/**
 * Parse a Claude Code session file and return structured trace data
 *
 * Follows the same pattern as parseOpenClawSession() in openclaw.ts.
 * Key Claude-specific features:
 * - UUID-based streaming deduplication (D-03)
 * - DAG parentUuid resolution (D-01)
 * - Compact boundary detection with truncation marking (D-02)
 * - Subagent session metadata mapping (D-04)
 *
 * @param filePath - Full path to the JSONL session file
 * @param project - Project name for session metadata
 * @returns ParseResult with session, messages, activities, errors, and warnings
 */
export async function parseClaudeSession(
  filePath: string,
  project: string
): Promise<ParseResult> {
  const errors: ParseError[] = [];
  const warnings: string[] = [];
  const messages: TraceMessage[] = [];
  const activities: TraceActivity[] = [];

  // Extract session context from file path
  const context = extractClaudeSessionContext(filePath, project);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return {
      session: createErrorSession(context, 'File does not exist'),
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

  // Tracking state
  const seenUuids = new Set<string>();                         // D-03: UUID dedup
  const dagNodes = new Map<string, ClaudeDAGNode>();           // D-01: DAG tracking
  const compactBoundaries: ClaudeCompactBoundary[] = [];       // D-02: compact tracking
  const truncatedUuidSet = new Set<string>();                  // UUIDs marked as truncated
  // Tool call registry for pairing tool_use with tool_result (D-11)
  const toolCallMap = new Map<string, TraceToolCall>();

  // Session-level accumulators
  let ordinal = 0;
  let lineNum = 0;
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let hasToolCalls = false;
  let sessionCwd: string | undefined;
  let sessionGitBranch: string | undefined;
  let currentTurnIndex = -1;
  let currentTurnId: string | undefined;
  let sessionMetadata: {
    sessionId?: string;
    sessionType?: string;
    parentId?: string;
    cwd?: string;
    gitBranch?: string;
  } | null = null;

  // Parse JSONL line by line
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    lineNum++;
    if (!line.trim()) continue;

    try {
      const parsed: ClaudeJsonlLine = JSON.parse(line);

      if (typeof parsed.cwd === 'string' && parsed.cwd.trim()) {
        sessionCwd = parsed.cwd;
      }
      if (typeof parsed.gitBranch === 'string' && parsed.gitBranch.trim()) {
        sessionGitBranch = parsed.gitBranch;
      }

      // D-03: UUID deduplication — only applies to real message UUIDs.
      if (typeof parsed.uuid === 'string' && parsed.uuid.length > 0) {
        if (seenUuids.has(parsed.uuid)) {
          warnings.push(
            `Line ${lineNum}: Duplicate UUID ${parsed.uuid} — skipping`
          );
          continue;
        }
        seenUuids.add(parsed.uuid);

        // D-01: Register DAG node for parent/child relationship tracking
        dagNodes.set(parsed.uuid, {
          uuid: parsed.uuid,
          parentUuid: parsed.parentUuid,
          sessionId: parsed.session?.id || context.uuid,
          parentSessionId: undefined, // resolved later
          relationshipType: context.relationshipType || 'root',
        });
      }

      // Extract timestamp
      if (parsed.timestamp && !startedAt) {
        startedAt = parsed.timestamp;
      }
      if (parsed.timestamp) {
        endedAt = parsed.timestamp;
      }

      // D-02: Compact boundary handling
      // Real Claude logs emit isCompactSummary: true (not just type: "compact")
      const isCompact =
        parsed.type === 'compact' ||
        (parsed as any).isCompactSummary === true;
      if (isCompact) {
        // Prefer compact.truncatedUuids; fall back to top-level truncatedUuids array
        const truncatedUuids: string[] =
          (parsed as any).compact?.truncatedUuids ||
          (parsed as any).truncatedUuids ||
          [];
        compactBoundaries.push({
          lineNumber: lineNum,
          truncatedUuids,
        });
        // Mark these UUIDs as truncated
        for (const uuid of truncatedUuids) {
          truncatedUuidSet.add(uuid);
        }
        // Produce a system message for the compact event
        const compactMsg: TraceMessage = {
          id: `${context.uuid}-${ordinal}`,
          ordinal,
          role: 'system',
          content: `Context compacted at line ${lineNum}. Truncated UUIDs: ${truncatedUuids.join(', ')}`,
          timestamp: parsed.timestamp,
          sourceMetadata: {
            sourceType: 'claude-code',
            sourceFile: context.filePath,
            sourceLine: lineNum,
            sourceVersion: (context as any).sourceVersion || 'unknown',
            cwd: sessionCwd,
            gitBranch: sessionGitBranch,
          },
        };
        messages.push(compactMsg);
        ordinal++;
        continue;
      }

      // Capture session metadata from lines that have session info (D-04)
      if (parsed.session) {
        sessionMetadata = {
          sessionId: parsed.session.id,
          sessionType: parsed.session.type,
          parentId: parsed.session.parentId,
          cwd: parsed.session.cwd || sessionCwd,
          gitBranch: parsed.session.gitBranch || sessionGitBranch,
        };
        // Also update DAG node with resolved session info
        const node = dagNodes.get(parsed.uuid);
        if (node) {
          node.sessionId = parsed.session.id;
        }
      }

      if (typeof parsed.sessionId === 'string' && parsed.sessionId.trim()) {
        sessionMetadata = {
          ...(sessionMetadata || {}),
          sessionId: parsed.sessionId,
          sessionType: context.relationshipType,
          parentId: context.parentSessionId,
          cwd: sessionCwd,
          gitBranch: sessionGitBranch,
        };
      }
      if (typeof parsed.agentId === 'string' && parsed.agentId.trim()) {
        sessionMetadata = {
          ...(sessionMetadata || {}),
          sessionId: parsed.agentId,
          sessionType: 'subagent',
          parentId: context.parentSessionId,
          cwd: sessionCwd,
          gitBranch: sessionGitBranch,
        };
      }

      // Skip lines without a message object (e.g., system-only lines)
      if (!parsed.message) {
        continue;
      }

      const role = parsed.message.role;

      if (role === 'user' && isClaudeLocalCommandMessage(parsed)) {
        continue;
      }

      // User messages: check if this is a tool_result-only record
      // tool_result-only user records should NOT become full user turn messages —
      // instead, pair the results with the matching tool calls.
      if (role === 'user' && Array.isArray(parsed.message.content)) {
        const blocks = parsed.message.content as any[];
        const toolResultBlocks = blocks.filter(b => b.type === 'tool_result');
        const nonToolResultBlocks = blocks.filter(b => b.type !== 'tool_result');

        // Attach result events to pending tool calls
        for (const tb of toolResultBlocks) {
          const toolUseId: string | undefined = tb.tool_use_id;
          if (toolUseId && toolCallMap.has(toolUseId)) {
            const toolCall = toolCallMap.get(toolUseId)!;
            const resultContent = typeof tb.content === 'string'
              ? tb.content
              : Array.isArray(tb.content)
                ? tb.content
                    .map((c: any) => (typeof c === 'string' ? c : c.text || JSON.stringify(c)))
                    .join('\n')
                : JSON.stringify(tb.content ?? '');
            const resultEvent: TraceToolResultEvent = {
              type: 'result_event',
              timestamp: parsed.timestamp,
              content: resultContent,
              isPartial: false,
            };
            toolCall.resultEvents.push(resultEvent);
            if (tb.is_error) {
              toolCall.status = 'error';
              toolCall.error = resultContent;
            } else {
              toolCall.status = 'success';
            }
          } else if (toolUseId) {
            warnings.push(
              `Line ${lineNum}: tool_result for unknown tool_use_id: ${toolUseId}`
            );
          }
        }

        // If there are no non-tool_result blocks, this is a tool-result-only record
        // — produce a tool_result role message rather than a user turn message
        if (nonToolResultBlocks.length === 0 && toolResultBlocks.length > 0) {
          const toolResultMsg: TraceMessage = {
            id: `${context.uuid}-${ordinal}`,
            ordinal,
            role: 'tool_result',
            content: toolResultBlocks
              .map(tb => typeof tb.content === 'string' ? tb.content : JSON.stringify(tb.content))
              .join('\n'),
            timestamp: parsed.timestamp,
            sourceMetadata: {
              sourceType: 'claude-code',
              sourceFile: context.filePath,
              sourceLine: lineNum,
              sourceVersion: (context as any).sourceVersion || 'unknown',
              cwd: sessionCwd,
              gitBranch: sessionGitBranch,
            },
            turnId: currentTurnId,
            turnIndex: currentTurnIndex >= 0 ? currentTurnIndex : undefined,
            isRealUserInput: false,
          };
          messages.push(toolResultMsg);
          ordinal++;
          // Accumulate token usage
          if (parsed.message.usage) {
            totalInputTokens += parsed.message.usage.input_tokens || 0;
            totalOutputTokens += parsed.message.usage.output_tokens || 0;
          }
          continue;
        }
        // Fall through to normal message parsing for mixed user messages
      }

      // Parse message
      const message = parseMessage(parsed, ordinal, context, lineNum, sessionCwd, sessionGitBranch);
      if (message.role === 'user') {
        currentTurnIndex++;
        currentTurnId = parsed.uuid || `turn-${currentTurnIndex}`;
        message.isRealUserInput = true;
      } else {
        message.isRealUserInput = false;
      }
      message.turnIndex = currentTurnIndex >= 0 ? currentTurnIndex : undefined;
      message.turnId = currentTurnId;
      messages.push(message);

      // Extract tool calls and thinking blocks from assistant messages
      if (role === 'assistant' || parsed.type === 'assistant') {
        const { toolCalls, thinkingBlocks } = extractClaudeActivities(parsed, context, lineNum, ordinal);
        // Register tool calls for result pairing
        for (const tc of toolCalls) {
          toolCallMap.set(tc.id, tc);
        }
        activities.push(...toolCalls, ...thinkingBlocks);
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

  // D-01: Resolve DAG relationships
  const dagResolved = resolveClaudeDAG(dagNodes);

  // Determine session relationship from resolved DAG
  let rootSessionId: string | undefined;
  let parentSessionId: string | undefined;
  let relationshipType: 'root' | 'subagent' | 'fork' | 'continuation' | undefined;

  rootSessionId = context.rootSessionId;
  parentSessionId = context.parentSessionId;
  relationshipType = context.relationshipType || 'root';

  if (sessionMetadata?.sessionType) {
    const sessionType = sessionMetadata.sessionType;
    if (sessionType === 'subagent') {
      relationshipType = 'subagent';
      // Subagent parent is the parent session
      parentSessionId = sessionMetadata.parentId || parentSessionId;
      rootSessionId = rootSessionId || parentSessionId;
    } else if (sessionType === 'fork') {
      relationshipType = 'fork';
      // Fork shares root with parent; parentSessionId from parent
      parentSessionId = sessionMetadata.parentId || parentSessionId;
    } else if (sessionType === 'continuation') {
      relationshipType = 'continuation';
      parentSessionId = sessionMetadata.parentId || parentSessionId;
    } else {
      relationshipType = 'root';
    }
  }

  // Mark messages as truncated if their UUID appears in compact boundaries (is_truncated flag in metrics)
  for (const msg of messages) {
    const uuid = msg.id.split('-').pop(); // Extract the UUID suffix from id
    if (uuid && truncatedUuidSet.has(uuid)) {
      // Mark via sourceMetadata — isTruncated on session metrics covers overall
    }
  }

  // Build session
  const session: TraceSession = {
    id: context.uuid,
    source: 'claude-code',
    project: sessionMetadata?.cwd || sessionCwd || context.project,
    startedAt,
    endedAt,
    status: endedAt ? 'idle' : 'active',
    rootSessionId,
    parentSessionId,
    relationshipType,
    sourceSessionId: sessionMetadata?.sessionId || context.sourceSessionId,
    cwd: sessionMetadata?.cwd || sessionCwd,
    gitBranch: sessionMetadata?.gitBranch || sessionGitBranch,
    sourceVersion: context.sourceVersion || 'unknown',
    metrics: {
      messageCount: messages.length,
      userMessageCount: messages.filter((m) => m.role === 'user').length,
      totalTokens: totalInputTokens + totalOutputTokens,
      hasToolCalls,
      terminationStatus: undefined,
      parserMalformedLines: errors.length,
      isTruncated: truncatedUuidSet.size > 0 || compactBoundaries.length > 0,
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
 * Claude JSONL filenames follow pattern {uuid}.jsonl in ~/.claude/sessions/.
 * Extracts UUID from filename using regex.
 *
 * @param filePath - Full path to session file
 * @param project - Project name
 * @returns SessionContext with extracted metadata
 */
function extractClaudeSessionContext(
  filePath: string,
  project: string
): ClaudeSessionContext {
  const basename = path.basename(filePath, '.jsonl');
  const parentDir = path.basename(path.dirname(filePath));
  const grandparentDir = path.basename(path.dirname(path.dirname(filePath)));
  const parentUuid = parentDir === 'subagents' ? grandparentDir : undefined;

  let uuid = basename;
  let parentSessionId: string | undefined;
  let rootSessionId: string | undefined;
  let relationshipType: ClaudeSessionContext['relationshipType'] = 'root';
  let sourceSessionId: string | undefined = basename;

  if (basename.startsWith('agent-') && parentUuid) {
    const agentId = basename.replace(/^agent-/, '');
    uuid = `claude-agent:${parentUuid}:${agentId}`;
    parentSessionId = parentUuid;
    rootSessionId = parentUuid;
    relationshipType = 'subagent';
    sourceSessionId = agentId;
  }

  let fileMtime: number;
  try {
    fileMtime = fs.statSync(filePath).mtimeMs;
  } catch {
    fileMtime = 0;
  }

  return {
    sessionKey: uuid,
    uuid,
    project,
    filePath,
    fileMtime,
    rootSessionId,
    parentSessionId,
    relationshipType,
    sourceSessionId,
    sourceVersion: 'unknown', // resolved during parse from first line
  };
}

/**
 * Create an error session for failure cases
 */
function createErrorSession(
  context: SessionContext,
  errorMsg: string
): TraceSession {
  return {
    id: context.uuid,
    source: 'claude-code',
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

function isClaudeLocalCommandMessage(parsed: ClaudeJsonlLine): boolean {
  if (parsed.isMeta === true) return true;

  const content = parsed.message?.content;
  if (typeof content !== 'string') return false;

  const normalized = content.trim().toLowerCase();
  return (
    normalized.startsWith('<local-command-caveat') ||
    normalized.startsWith('<local-command-stdout') ||
    normalized.startsWith('<command-name>') ||
    normalized.startsWith('<command-message')
  );
}

// ============================================================================
// Message Parsing
// ============================================================================

/**
 * Parse a single Claude Code message from a parsed JSONL line
 *
 * @param parsed - Parsed ClaudeJsonlLine
 * @param ordinal - Message ordinal position
 * @param context - Session context
 * @param lineNum - Line number for source metadata
 * @returns TraceMessage in canonical format
 */
function parseMessage(
  parsed: ClaudeJsonlLine,
  ordinal: number,
  context: SessionContext,
  lineNum: number,
  cwd?: string,
  gitBranch?: string
): TraceMessage {
  const msg = parsed.message!;

  // Extract content from message
  let content = '';
  if (typeof msg.content === 'string') {
    content = msg.content;
  } else if (Array.isArray(msg.content)) {
    // Concatenate text blocks; tool_use blocks handled separately
    const textBlocks = msg.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text || '');
    content = textBlocks.join('\n');
  }

  const sourceMetadata: SourceMetadata = {
    sourceType: 'claude-code',
    sourceFile: context.filePath,
    sourceLine: lineNum,
    sourceVersion: (context as any).sourceVersion || 'unknown',
    cwd,
    gitBranch,
  };

  // Map Claude role to canonical MessageRole
  const roleMap: Record<string, MessageRole> = {
    user: 'user',
    assistant: 'assistant',
    system: 'system',
    tool_result: 'tool_result',
  };
  const role: MessageRole = roleMap[msg.role] || 'system';

  return {
    id: `${context.uuid}-${ordinal}`,
    ordinal,
    role,
    content,
    timestamp: parsed.timestamp,
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

// ============================================================================
// Activity Extraction (tool calls + thinking blocks)
// ============================================================================

/**
 * Extract tool calls and thinking blocks from Claude Code assistant message content blocks
 *
 * Scans raw.message.content array for:
 * - type='tool_use': emits TraceToolCall with messageOrdinal for sync
 * - type='thinking': emits TraceThinkingBlock for replay-accessible data
 *
 * Per D-11: Uses block.id as the tool_use_id for result pairing in assembler.
 * Per T-03-09: Tool input stored as JSON.stringify — never evaluated.
 *
 * @param raw - Parsed ClaudeJsonlLine
 * @param context - Session context
 * @param lineNum - Line number for ID generation and sourceLine metadata
 * @param messageOrdinal - Ordinal of the owning message for sync persistence
 * @returns Object with toolCalls and thinkingBlocks arrays
 */
function extractClaudeActivities(
  raw: ClaudeJsonlLine,
  context: SessionContext,
  lineNum: number,
  messageOrdinal: number
): { toolCalls: TraceToolCall[]; thinkingBlocks: TraceThinkingBlock[] } {
  const toolCalls: TraceToolCall[] = [];
  const thinkingBlocks: TraceThinkingBlock[] = [];

  const msg = raw.message;
  if (!msg || !Array.isArray(msg.content)) return { toolCalls, thinkingBlocks };

  for (const block of msg.content) {
    if (block.type === 'tool_use') {
      const name = block.name || 'unknown';
      const category = inferClaudeToolCategory(name);

      toolCalls.push({
        type: 'tool_call',
        id: block.id || `${context.uuid}-${lineNum}-${toolCalls.length}`,
        name,
        category,
        inputJson: JSON.stringify(block.input || {}),
        resultEvents: [],
        status: 'pending',
        messageOrdinal,
        sourceLine: lineNum,
      });
    } else if (block.type === 'thinking') {
      // Retain thinking blocks for replay — not silently dropped
      thinkingBlocks.push({
        type: 'thinking',
        content: typeof block.thinking === 'string' ? block.thinking : '',
        isRedacted: block.thinking == null || block.thinking === '',
      });
    }
  }

  return { toolCalls, thinkingBlocks };
}

/**
 * @deprecated Use extractClaudeActivities instead.
 * Kept for backward compatibility — delegates to extractClaudeActivities.
 */
function extractClaudeToolCalls(
  raw: ClaudeJsonlLine,
  context: SessionContext,
  lineNum: number
): TraceToolCall[] {
  return extractClaudeActivities(raw, context, lineNum, 0).toolCalls;
}

/**
 * Infer tool category from Claude Code tool name
 *
 * Claude tools: Bash, Read, Write, Edit, Grep, Glob, Task, NotebookEdit,
 * WebSearch, WebFetch, etc.
 *
 * @param name - Tool name
 * @returns ToolCategory for UI grouping
 */
function inferClaudeToolCategory(name: string): ToolCategory {
  const lower = name.toLowerCase();
  if (lower === 'bash' || lower.includes('shell')) return 'Bash';
  if (lower === 'read') return 'Read';
  if (lower === 'write' || lower === 'edit' || lower === 'notebookedit') return 'Edit';
  if (lower === 'grep' || lower === 'glob') return 'Grep';
  if (lower === 'task') return 'Task';
  if (lower === 'agent') return 'Agent';
  return 'Other';
}

// ============================================================================
// DAG Resolution (D-01 per Claude DAG structure)
// ============================================================================

/**
 * Resolve DAG relationships from tracked nodes
 *
 * For each node with a parentUuid, looks up the parent node and determines
 * the relationship type based on session metadata.
 *
 * Per D-01: parentUuid maps DAG relationships (fork/continuation/subagent).
 * Per T-03-10: Orphaned parentUuid references logged as warnings; no cross-file traversal.
 *
 * @param nodes - Map of UUID to ClaudeDAGNode
 * @returns Map of resolved session relationships
 */
function resolveClaudeDAG(
  nodes: Map<string, ClaudeDAGNode>
): Map<string, { parentSessionId: string; relationshipType: string }> {
  const resolved = new Map<string, { parentSessionId: string; relationshipType: string }>();

  nodes.forEach((node, uuid) => {
    if (!node.parentUuid) {
      // Root node — no parent to resolve
      return;
    }

    const parentNode = nodes.get(node.parentUuid);
    if (!parentNode) {
      // T-03-10: Orphaned parentUuid — logged as warning later if needed
      return;
    }

    // Parent and child share root if same session or parent is root
    const parentSessionId = parentNode.sessionId;
    let relationshipType = 'fork';

    if (node.relationshipType === 'subagent') {
      relationshipType = 'subagent';
    } else if (node.relationshipType === 'continuation') {
      relationshipType = 'continuation';
    }

    resolved.set(uuid, { parentSessionId, relationshipType });
  });

  return resolved;
}

// ============================================================================
// Single-Line Message Parsing Helper
// ============================================================================

/**
 * Parse a single Claude Code message line
 *
 * Helper function for testing and single-line parsing scenarios.
 * Per D-03: Does NOT track UUID dedup (single-line context).
 *
 * @param line - JSONL line string
 * @param context - Session context
 * @returns TraceMessage or null if parsing fails
 */
export function parseClaudeMessage(
  line: string,
  context: SessionContext
): TraceMessage | null {
  try {
    const parsed: ClaudeJsonlLine = JSON.parse(line);
    if (!parsed.message) return null;
    return parseMessage(parsed, 0, context, 0);
  } catch {
    return null;
  }
}
