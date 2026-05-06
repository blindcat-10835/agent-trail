/**
 * Turn Assembler
 *
 * Enhanced turn assembly with compact/system/queued boundary handling,
 * tool call pairing, and subagent linking.
 *
 * Per D-08: user message opens a new turn, subsequent messages belong to that turn.
 * Per D-10: compact/system boundaries are detected and stored as activities.
 * Per D-11: tool calls paired with result events, subagent sessions linked.
 *
 * @module ingest/turns/assembler
 */

import Database from 'better-sqlite3';
import { getDatabase } from '../db';
import {
  TraceTurn,
  TraceMessage,
  TraceToolCall,
  TraceToolResultEvent,
  TraceSubagentLink,
  TraceSystemEvent,
  TraceSource,
  MessageRole,
  ToolCategory,
  TokenUsage,
} from '@/types/trace';

// ============================================================================
// Public API
// ============================================================================

/**
 * Assemble messages into turn-first representation.
 *
 * Handles compact/system/queued boundaries (D-10), pairs tool calls
 * with result events (D-11), and links subagent sessions (D-11).
 *
 * Each user message opens a new turn. Consecutive user messages are merged
 * as queued commands (D-05). Compact events mark turns as truncated.
 *
 * @param sessionId - Session to assemble turns for
 * @param db - Optional database connection (defaults to getDatabase())
 * @returns Array of assembled TraceTurn objects
 */
export async function assembleTurns(
  sessionId: string,
  db?: Database.Database
): Promise<TraceTurn[]> {
  const database = db || getDatabase();

  // Fetch all messages for the session, ordered by ordinal
  const messages = database.prepare(`
    SELECT
      id, ordinal, role, content, timestamp, model,
      token_usage_json, source_file, source_line
    FROM messages
    WHERE session_id = ?
    ORDER BY ordinal ASC
  `).all(sessionId) as MessageRow[];

  const turns: TraceTurn[] = [];
  let currentTurn: Partial<TraceTurn> | null = null;
  let turnIndex = 0;

  for (const msg of messages) {
    const message = parseMessageRow(msg);

    // D-10: Compact boundary handling — check before system message handling
    if (message.role === 'system') {
      const isCompact =
        message.content?.includes('[compact]') ||
        message.content?.toLowerCase().includes('compact');

      if (isCompact) {
        // D-10: Mark preceding turn messages as truncated
        if (currentTurn) {
          currentTurn.isTruncated = true;
          currentTurn.activities = currentTurn.activities || [];
          currentTurn.activities.push({
            type: 'system',
            subtype: 'compact',
            content: message.content,
          } as TraceSystemEvent);
        }
        continue;
      }

      // D-02, D-10: Non-compact system messages stored as system events
      if (currentTurn) {
        currentTurn.activities = currentTurn.activities || [];
        currentTurn.activities.push({
          type: 'system',
          subtype: 'system_message',
          content: message.content,
        } as TraceSystemEvent);
      }
      continue;
    }

    // D-05: Queued command detection and merging
    if (message.role === 'user') {
      const isQueuedPrefix = message.content?.startsWith('[QUEUED]');

      // Check if this is a queued command continuation (D-05)
      // Either it has [QUEUED] prefix, or it's a consecutive user message
      // without intervening assistant messages
      const isConsecutiveUser =
        currentTurn &&
        currentTurn.userMessage &&
        !currentTurn.assistantMessages?.length;

      if (isQueuedPrefix || isConsecutiveUser) {
        if (currentTurn && currentTurn.userMessage) {
          // Merge: strip [QUEUED] prefix and append to existing user message
          const queuedContent = isQueuedPrefix
            ? (message.content?.replace(/^\[QUEUED\]\s*/, '') || message.content)
            : message.content;
          currentTurn.userMessage.content += '\n' + queuedContent;
          continue; // Don't start a new turn
        }
      }

      // Close previous turn if it has content
      if (
        currentTurn &&
        currentTurn.assistantMessages &&
        currentTurn.assistantMessages.length > 0
      ) {
        currentTurn.endedAt = message.timestamp || null;
        currentTurn.durationMs = calculateDuration(
          currentTurn.startedAt ?? null,
          currentTurn.endedAt ?? null
        );
        turns.push(finalizeTurn(currentTurn, sessionId, turnIndex));
        turnIndex++;
      }

      // Start new turn
      currentTurn = {
        id: `${sessionId}-turn-${turnIndex}`,
        sessionId,
        index: turnIndex,
        userMessage: message,
        assistantMessages: [],
        activities: [],
        startedAt: message.timestamp || null,
        endedAt: null,
        durationMs: null,
        tokenUsage: message.tokenUsage,
      };
    } else if (currentTurn) {
      // Non-user message belongs to current turn
      if (message.role === 'assistant') {
        currentTurn.assistantMessages!.push(message);
      } else if (message.role === 'tool_result') {
        currentTurn.assistantMessages!.push(message);
      }
    }
  }

  // Close final turn
  if (
    currentTurn &&
    currentTurn.assistantMessages &&
    currentTurn.assistantMessages.length > 0
  ) {
    turns.push(finalizeTurn(currentTurn, sessionId, turnIndex));
  }

  // D-11: Post-processing — pair tool calls with result events
  await pairToolCalls(turns, sessionId, database);

  // D-11: Post-processing — link subagent sessions
  await linkSubagents(turns, sessionId, database);

  return turns;
}

// ============================================================================
// Tool Call Pairing (D-11)
// ============================================================================

/**
 * Pair tool calls with result events for all turns in a session.
 *
 * Queries tool_calls and tool_result_events tables, matches by
 * tool_call_id, and adds TraceToolCall activities to each turn.
 *
 * @param turns - Assembled turns
 * @param sessionId - Session ID
 * @param db - Database connection
 */
async function pairToolCalls(
  turns: TraceTurn[],
  sessionId: string,
  db: Database.Database
): Promise<void> {
  for (const turn of turns) {
    if (!turn.assistantMessages?.length) continue;

    const ordinals = turn.assistantMessages.map((m) => m.ordinal);
    const placeholders = ordinals.map(() => '?').join(',');

    const toolCalls = db
      .prepare(
        `
      SELECT id, tool_id, name, category, input_json, status, error, duration_ms
      FROM tool_calls
      WHERE session_id = ? AND message_ordinal IN (${placeholders})
    `
      )
      .all(sessionId, ...ordinals) as ToolCallRow[];

    for (const tc of toolCalls) {
      // Query result events for this tool call
      const resultEvents = db
        .prepare(
          `
        SELECT content, is_partial, timestamp
        FROM tool_result_events
        WHERE tool_call_id = ?
        ORDER BY id ASC
      `
        )
        .all(tc.id) as ResultEventRow[];

      const activity: TraceToolCall = {
        type: 'tool_call',
        id: tc.tool_id,
        name: tc.name,
        category: (tc.category as ToolCategory) || 'Other',
        inputJson: tc.input_json,
        resultEvents: resultEvents.map((re) => ({
          type: 'result_event' as const,
          content: re.content,
          isPartial: Boolean(re.is_partial),
          timestamp: re.timestamp || undefined,
        })),
        status: tc.status as 'pending' | 'success' | 'error',
        error: tc.error || undefined,
        durationMs: tc.duration_ms || undefined,
      };

      turn.activities.push(activity);
    }
  }
}

// ============================================================================
// Subagent Linking (D-11)
// ============================================================================

/**
 * Link subagent sessions to their parent session's turns.
 *
 * Queries sessions table for child sessions (parent_session_id = sessionId)
 * and adds TraceSubagentLink activities to the first turn.
 *
 * @param turns - Assembled turns
 * @param sessionId - Parent session ID
 * @param db - Database connection
 */
async function linkSubagents(
  turns: TraceTurn[],
  sessionId: string,
  db: Database.Database
): Promise<void> {
  // Query child sessions (subagents)
  const childSessions = db
    .prepare(
      `
    SELECT id, source FROM sessions
    WHERE parent_session_id = ?
  `
    )
    .all(sessionId) as { id: string; source: string }[];

  if (childSessions.length === 0) return;

  // Link subagents to the first turn (where they were spawned)
  // If no turns exist, skip
  const targetTurn = turns[0];
  if (!targetTurn) return;

  for (const child of childSessions) {
    targetTurn.activities.push({
      type: 'subagent_link',
      subagentSessionId: child.id,
      subagentSource: child.source as TraceSource,
      relationship: 'spawned',
    } as TraceSubagentLink);
  }
}

// ============================================================================
// Internal Types
// ============================================================================

interface MessageRow {
  id: string;
  ordinal: number;
  role: string;
  content: string;
  timestamp: string | null;
  model: string | null;
  token_usage_json: string | null;
  source_file: string;
  source_line: number | null;
}

interface ToolCallRow {
  id: number;
  tool_id: string;
  name: string;
  category: string | null;
  input_json: string;
  status: string;
  error: string | null;
  duration_ms: number | null;
}

interface ResultEventRow {
  content: string;
  is_partial: number;
  timestamp: string | null;
}

// ============================================================================
// Internal Helpers
// ============================================================================

function parseMessageRow(row: MessageRow): TraceMessage {
  return {
    id: row.id,
    ordinal: row.ordinal,
    role: row.role as MessageRole,
    content: row.content,
    timestamp: row.timestamp || undefined,
    model: row.model || undefined,
    tokenUsage: row.token_usage_json
      ? (JSON.parse(row.token_usage_json) as TokenUsage)
      : undefined,
    sourceMetadata: {
      sourceType: 'openclaw', // TODO: Get from session join in Phase 3
      sourceFile: row.source_file,
      sourceLine: row.source_line || undefined,
    },
  };
}

function finalizeTurn(
  partial: Partial<TraceTurn>,
  sessionId: string,
  index: number
): TraceTurn {
  return {
    id: partial.id!,
    sessionId,
    index: partial.index!,
    userMessage: partial.userMessage || null,
    assistantMessages: partial.assistantMessages || [],
    activities: partial.activities || [],
    startedAt: partial.startedAt ?? null,
    endedAt: partial.endedAt ?? null,
    durationMs: partial.durationMs ?? null,
    tokenUsage: partial.tokenUsage,
    isTruncated: partial.isTruncated || undefined,
  };
}

function calculateDuration(
  startedAt: string | null,
  endedAt: string | null
): number | null {
  if (!startedAt || !endedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  return end - start;
}

// ============================================================================
// Turn Count
// ============================================================================

/**
 * Count turns for a session.
 * Simple heuristic: count user messages (each starts a turn per D-08).
 */
export function getTurnCount(
  sessionId: string,
  db?: Database.Database
): number {
  const database = db || getDatabase();

  const result = database
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM messages
    WHERE session_id = ? AND role = 'user'
  `
    )
    .get(sessionId) as { count: number };

  return result.count;
}
