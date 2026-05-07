/**
 * Parser-Internal Types
 *
 * These types separate parser implementation details from the canonical trace contract.
 * Parsers build ParseResult then extract canonical TraceSession/TraceMessage for storage.
 *
 * @module ingest/parser/types
 */

import {
  TraceSession,
  TraceMessage,
  TraceToolCall,
  TraceActivity,
  SourceMetadata,
} from '@/types/trace';

// ============================================================================
// Raw OpenClaw JSONL Line Types
// ============================================================================

/**
 * Raw OpenClaw JSONL line structure
 *
 * OpenClaw session files are JSONL format where each line is a JSON object
 * with a 'type' field indicating the entry type (message, session, compaction, etc.)
 */
export interface OpenClawJsonlLine {
  type: string;
  timestamp?: string;
  message?: OpenClawMessage;
  [key: string]: any;
}

/**
 * OpenClaw message structure within a JSONL line
 *
 * Messages can have different roles: user, assistant, system, tool_result
 * Content can be a string or an array of content blocks (text, tool_use, etc.)
 */
export interface OpenClawMessage {
  role: 'user' | 'assistant' | 'system' | 'tool_result';
  content: string | Array<ContentBlock>;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  tool_use_id?: string;
  id?: string;
}

/**
 * Content block in OpenClaw messages
 *
 * OpenClaw uses structured content blocks for rich messages:
 * - text: plain text content
 * - tool_use: tool invocation with name and input
 * - toolCall: alternative tool invocation format
 */
export interface ContentBlock {
  type: 'text' | 'tool_use' | 'toolCall';
  text?: string;
  name?: string;
  toolName?: string;
  id?: string;
  input?: any;
}

// ============================================================================
// Parser Output Types
// ============================================================================

/**
 * Result of parsing a session file
 *
 * Wraps canonical trace types with parser metadata like errors and warnings
 */
export interface ParseResult {
  session: TraceSession;
  messages: TraceMessage[];
  activities: TraceActivity[];
  errors: ParseError[];
  warnings: string[];
}

/**
 * Parse error for tracking malformed lines
 *
 * Individual line errors don't fail the entire parse - they're tracked
 * for debugging and reported in session metrics
 */
export interface ParseError {
  line: number;
  raw: string;
  error: string;
}

/**
 * Message with parsing context
 *
 * Associates a trace message with its source line number and any tool calls
 * extracted from that message
 */
export interface MessageWithContext {
  message: TraceMessage;
  lineNumber: number;
  toolCalls?: TraceToolCall[];
}

// ============================================================================
// Session Extraction Context
// ============================================================================

/**
 * Session metadata extracted from file path and content
 *
 * Captures information about where the session came from and how to
 * uniquely identify it
 */
export interface SessionContext {
  sessionKey: string; // e.g., "agent:blue:uuid" or "uuid"
  agentName?: string; // Extracted from session key
  uuid: string; // Session UUID
  project: string; // Extracted from path or config
  filePath: string; // Full path to JSONL file
  fileMtime: number; // File modification time
}

// ============================================================================
// Claude Code Raw JSONL Line Types
// ============================================================================

/**
 * Raw Claude Code JSONL line structure
 *
 * Claude Code session files are JSONL format where each line is a JSON object
 * with a 'uuid' field for streaming dedup (Per D-03: UUID for streaming dedup).
 *
 * Per D-01: parentUuid maps DAG relationships (fork/continuation/subagent).
 */
export interface ClaudeJsonlLine {
  uuid: string; // Unique message UUID (D-03: used for streaming dedup)
  parentUuid?: string; // Parent message UUID for DAG structure (D-01)
  type: string; // 'assistant', 'user', 'system', 'compact', etc.
  message?: {
    role: string;
    content:
      | string
      | Array<{
          type: string;
          text?: string;
          name?: string;
          input?: any;
          id?: string;
        }>;
    model?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  session?: {
    id: string;
    type?: string; // 'root', 'subagent', 'fork', 'continuation'
    parentId?: string;
    cwd?: string;
    gitBranch?: string;
  };
  timestamp?: string;
  [key: string]: any;
}

/**
 * Claude DAG relationship record
 *
 * Used during parsing to track parent/child session relationships.
 * Per D-01: Maps DAG structure (root, subagent, fork, continuation).
 */
export interface ClaudeDAGNode {
  uuid: string;
  parentUuid?: string;
  sessionId: string;
  parentSessionId?: string;
  relationshipType: 'root' | 'subagent' | 'fork' | 'continuation';
}

/**
 * Claude compact boundary marker
 *
 * Records where a compact event occurred and which messages were truncated.
 * Per D-02: Compact/system messages stored independently, preceding messages marked truncated.
 */
export interface ClaudeCompactBoundary {
  lineNumber: number;
  truncatedUuids: string[]; // UUIDs of messages that were compacted/truncated
}

// ============================================================================
// Codex Raw JSONL Line Types
// ============================================================================

/**
 * Raw Codex JSONL line structure
 *
 * Codex session files are JSONL format. Per D-06: Codex uses turn_context
 * boundaries natively. Per D-09: token_count used for streaming dedup.
 */
export interface CodexJsonlLine {
  type: string; // 'session_meta', 'turn_context', 'response_item', 'event_msg', 'spawn_agent', etc.
  payload?: any;
  session_meta?: {
    session_id: string;
    cwd?: string;
    git_branch?: string;
    model?: string;
  };
  turn_context?: {
    turn_id: string;
    model?: string;
    started_at?: string;
  };
  response_item?: {
    type: string; // 'input_text', 'text', 'function_call'
    call_id?: string;
    name?: string;
    arguments?: string;
    input_text?: string;
    text?: string;
    token_count?: number; // D-09: used for streaming dedup (compare token_count changes)
  };
  event_msg?: {
    type: string;
    call_id?: string;
    content?: string;
    status?: string;
  };
  spawn_agent?: {
    session_id: string;
    type?: string; // 'spawned', 'attached'
  };
  timestamp?: string;
  [key: string]: any;
}

/**
 * Codex turn context record
 *
 * Extracted from turn_context lines for turn boundary tracking.
 * Per D-06: Codex uses turn_context to mark turn boundaries with model info.
 */
export interface CodexTurnContext {
  turnId: string;
  model?: string;
  startedAt?: string;
}
