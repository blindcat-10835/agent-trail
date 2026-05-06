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
