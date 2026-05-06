/**
 * Claude Code JSONL Parser
 *
 * Parses Claude Code session files from JSONL format into canonical trace model.
 * Supports DAG/fork/continuation resolution, streaming UUID dedup, compact/system
 * boundary handling, and subagent mapping.
 *
 * @module ingest/parser/claude
 */

import {
  TraceSession,
  TraceMessage,
  TraceActivity,
} from '@/types/trace';
import {
  ClaudeJsonlLine,
  ParseResult,
  SessionContext,
} from './types';

/**
 * Parse a Claude Code session file and return structured trace data
 *
 * @param filePath - Full path to the JSONL session file
 * @param project - Project name for session metadata
 * @returns ParseResult with session, messages, activities, errors, and warnings
 */
export async function parseClaudeSession(
  _filePath: string,
  _project: string
): Promise<ParseResult> {
  // Stub — will be implemented in GREEN phase
  throw new Error('Not implemented');
}

/**
 * Parse a single Claude Code message line
 *
 * Helper function for testing and single-line parsing scenarios.
 * Per D-03: Does NOT track UUID dedup (single-line context).
 *
 * @param _line - JSONL line string
 * @param _context - Session context
 * @returns TraceMessage or null if parsing fails
 */
export function parseClaudeMessage(
  _line: string,
  _context: SessionContext
): TraceMessage | null {
  // Stub — will be implemented in GREEN phase
  throw new Error('Not implemented');
}
