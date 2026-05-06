/**
 * Turn Assembler
 *
 * Minimal turn assembly per D-08: user message opens a new turn,
 * subsequent assistant/tool_result messages belong to that turn.
 * Complex boundary handling (compact, queued commands, system messages)
 * deferred to Phase 3.
 *
 * @module ingest/turns/assembler
 */

import Database from 'better-sqlite3';
import { getDatabase } from '../db';
import { TraceTurn, TraceMessage, MessageRole, TokenUsage } from '@/types/trace';

/**
 * Assemble messages into turn-first representation.
 *
 * Per D-08: Scan messages by ordinal. Each user message opens a new turn.
 * Subsequent assistant/tool_result messages belong to that turn.
 * Turn ends when next user message appears or session ends.
 *
 * System messages are skipped (Phase 3 will handle them).
 */
export function assembleTurns(
  sessionId: string,
  db?: Database.Database
): TraceTurn[] {
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

    // Skip system messages (deferred to Phase 3 per D-08)
    if (message.role === 'system') {
      continue;
    }

    // User message starts a new turn
    if (message.role === 'user') {
      // Close previous turn if it has content
      if (currentTurn && currentTurn.assistantMessages && currentTurn.assistantMessages.length > 0) {
        currentTurn.endedAt = message.timestamp || null;
        currentTurn.durationMs = calculateDuration(currentTurn.startedAt, currentTurn.endedAt);
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
        activities: [], // Phase 3 will populate with tool calls
        startedAt: message.timestamp || null,
        endedAt: null,
        durationMs: null,
        tokenUsage: message.tokenUsage
      };
    } else if (currentTurn) {
      // Non-user message belongs to current turn
      if (message.role === 'assistant') {
        currentTurn.assistantMessages!.push(message);
      } else if (message.role === 'tool_result') {
        // Tool results are collected as assistant context (Phase 3 will properly parse activities)
        currentTurn.assistantMessages!.push(message);
      }
      // System messages skipped entirely per D-08 (Phase 3 will handle)
    }
  }

  // Close final turn
  if (currentTurn && currentTurn.assistantMessages && currentTurn.assistantMessages.length > 0) {
    turns.push(finalizeTurn(currentTurn, sessionId, turnIndex));
  }

  return turns;
}

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

function parseMessageRow(row: MessageRow): TraceMessage {
  return {
    id: row.id,
    ordinal: row.ordinal,
    role: row.role as MessageRole,
    content: row.content,
    timestamp: row.timestamp || undefined,
    model: row.model || undefined,
    tokenUsage: row.token_usage_json ? JSON.parse(row.token_usage_json) as TokenUsage : undefined,
    sourceMetadata: {
      sourceType: 'openclaw', // TODO: Get from session join in Phase 3
      sourceFile: row.source_file,
      sourceLine: row.source_line || undefined
    }
  };
}

function finalizeTurn(partial: Partial<TraceTurn>, sessionId: string, index: number): TraceTurn {
  return {
    id: partial.id!,
    sessionId,
    index: partial.index!,
    userMessage: partial.userMessage || null,
    assistantMessages: partial.assistantMessages || [],
    activities: partial.activities || [],
    startedAt: partial.startedAt,
    endedAt: partial.endedAt,
    durationMs: partial.durationMs,
    tokenUsage: partial.tokenUsage
  };
}

function calculateDuration(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || !endedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  return end - start;
}

/**
 * Count turns for a session.
 * Simple heuristic: count user messages (each starts a turn per D-08).
 */
export function getTurnCount(sessionId: string, db?: Database.Database): number {
  const database = db || getDatabase();

  const result = database.prepare(`
    SELECT COUNT(*) as count
    FROM messages
    WHERE session_id = ? AND role = 'user'
  `).get(sessionId) as { count: number };

  return result.count;
}
