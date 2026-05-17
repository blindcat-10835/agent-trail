/**
 * OpenCode SQLite Parser
 *
 * Reads opencode sessions from opencode.db (SQLite) and produces canonical
 * ParseResult objects. Stateless: open readonly per call, close after.
 *
 * Per Phase 17 decisions D-01 through D-11.
 *
 * @module ingest/parser/opencode
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';
import {
  TraceSession,
  TraceMessage,
  TraceToolCall,
  TraceThinkingBlock,
  TraceSystemEvent,
  TraceSubagentLink,
  TraceActivity,
  TraceToolResultEvent,
  ToolCategory,
  SourceMetadata,
} from '@/types/trace';
import { ParseResult, ParseError } from './types';

const BUSY_RETRIES = 3;
const BUSY_DELAY_MS = 100;
const REQUIRED_TABLES = ['session', 'message', 'part', 'project'] as const;

export interface OpencodeSessionRow {
  id: string;
  project_id: string | null;
  parent_id: string | null;
  slug: string | null;
  directory: string | null;
  title: string | null;
  version: string | null;
  agent: string | null;
  model: string | null;
  cost: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  tokens_reasoning: number | null;
  tokens_cache_read: number | null;
  tokens_cache_write: number | null;
  time_created: string | null;
  time_updated: string | null;
  time_archived: string | null;
  path: string | null;
  workspace_id: string | null;
}

interface OpencodeProjectRow {
  id: string;
  worktree: string | null;
  name: string | null;
  vcs: string | null;
}

interface OpencodeMessageRow {
  id: string;
  session_id: string;
  time_created: string | null;
  time_updated: string | null;
  data: string | null;
}

interface OpencodePartRow {
  id: string;
  message_id: string;
  session_id: string;
  time_created: string | null;
  time_updated: string | null;
  data: string | null;
}

function openReadonly(dbPath: string): Database.Database {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= BUSY_RETRIES; attempt++) {
    try {
      return new Database(dbPath, { readonly: true, fileMustExist: true });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (isBusyError(err)) {
        if (attempt < BUSY_RETRIES) {
          sleepSync(BUSY_DELAY_MS);
          continue;
        }
      }
      throw new Error(
        `Failed to open opencode database at ${dbPath}: ${lastError.message}`,
      );
    }
  }
  throw lastError!;
}

function withRetry<T>(db: Database.Database, fn: () => T): T {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= BUSY_RETRIES; attempt++) {
    try {
      return fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (isBusyError(err)) {
        if (attempt < BUSY_RETRIES) {
          sleepSync(BUSY_DELAY_MS);
          continue;
        }
      }
      throw lastError;
    }
  }
  throw lastError!;
}

function isBusyError(err: unknown): boolean {
  if (err instanceof Error) {
    const code = (err as unknown as Record<string, unknown>).code;
    return (
      err.message?.includes('SQLITE_BUSY') ||
      code === 'SQLITE_BUSY'
    );
  }
  return false;
}

function sleepSync(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy wait — acceptable for 100ms retry delays
  }
}

function validateSchema(db: Database.Database): void {
  const rows = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all() as { name: string }[];
  const existing = new Set(rows.map((r) => r.name));

  const missing = REQUIRED_TABLES.filter((t) => !existing.has(t));
  if (missing.length > 0) {
    throw new Error(
      `OpenCode DB schema validation failed: missing tables [${missing.join(', ')}]`,
    );
  }
}

function inferOpencodeToolCategory(name: string): ToolCategory {
  const lower = name.toLowerCase();
  if (lower === 'bash' || lower.includes('shell')) return 'Bash';
  if (lower === 'read') return 'Read';
  if (lower === 'write' || lower === 'edit') return 'Edit';
  if (lower === 'grep' || lower === 'glob') return 'Grep';
  if (lower === 'task') return 'Task';
  if (lower === 'agent') return 'Agent';
  return 'Other';
}

function parseModelJson(modelStr: string | null): string | undefined {
  if (!modelStr) return undefined;
  try {
    const parsed = JSON.parse(modelStr);
    if (parsed && typeof parsed === 'object') {
      const provider = parsed.providerID ?? parsed.providerId ?? '';
      const id = parsed.id ?? '';
      return provider ? `${provider}/${id}` : id || undefined;
    }
    return typeof parsed === 'string' ? parsed : undefined;
  } catch {
    return modelStr || undefined;
  }
}

function parseJsonData(dataStr: string | null): Record<string, unknown> | null {
  if (!dataStr) return null;
  try {
    return JSON.parse(dataStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function safeTimestamp(val: string | null): string | null {
  return val || null;
}

function safeNumber(val: number | null): number {
  return typeof val === 'number' && Number.isFinite(val) && val > 0 ? val : 0;
}

export async function parseOpencodeSession(
  dbPath: string,
  rawSessionId: string,
  projectOverride?: string,
): Promise<ParseResult> {
  const errors: ParseError[] = [];
  const warnings: string[] = [];
  const messages: TraceMessage[] = [];
  const activities: TraceActivity[] = [];

  let db: Database.Database | undefined;

  try {
    db = openReadonly(dbPath);

    validateSchema(db);

    const sessionRow = withRetry(db, () =>
      db!.prepare('SELECT * FROM session WHERE id = ?').get(rawSessionId),
    ) as OpencodeSessionRow | undefined;

    if (!sessionRow) {
      return {
        session: createEmptySession(rawSessionId, projectOverride ?? ''),
        messages: [],
        activities: [],
        errors: [
          {
            line: 0,
            raw: rawSessionId,
            error: `Session not found: ${rawSessionId}`,
          },
        ],
        warnings: [],
      };
    }

    let projectPath = projectOverride ?? sessionRow.directory ?? '';

    if (!projectOverride && sessionRow.project_id) {
      const projectRow = withRetry(db, () =>
        db!.prepare('SELECT * FROM project WHERE id = ?').get(
          sessionRow.project_id,
        ),
      ) as OpencodeProjectRow | undefined;

      if (projectRow?.worktree) {
        projectPath = projectRow.worktree;
      }
    }

    const messageRows = withRetry(db, () =>
      db!
        .prepare(
          'SELECT * FROM message WHERE session_id = ? ORDER BY time_created, id',
        )
        .all(rawSessionId),
    ) as OpencodeMessageRow[];

    const partRows = withRetry(db, () =>
      db!
        .prepare(
          'SELECT * FROM part WHERE session_id = ? ORDER BY time_created, id',
        )
        .all(rawSessionId),
    ) as OpencodePartRow[];

    const partsByMessage = new Map<string, OpencodePartRow[]>();
    for (const part of partRows) {
      const existing = partsByMessage.get(part.message_id) ?? [];
      existing.push(part);
      partsByMessage.set(part.message_id, existing);
    }

    const sessionId = `opencode:${sessionRow.id}`;
    const model = parseModelJson(sessionRow.model);
    let ordinal = 0;
    let currentTurnIndex = -1;
    let currentTurnId: string | undefined;
    let startedAt: string | null = safeTimestamp(sessionRow.time_created);
    let endedAt: string | null = null;
    let hasToolCalls = false;

    const sourceMetadata: SourceMetadata = {
      sourceType: 'opencode',
      sourceFile: dbPath,
      sourceVersion: sessionRow.version ?? undefined,
    };

    for (const msgRow of messageRows) {
      const msgData = parseJsonData(msgRow.data);
      const role = msgData?.role ?? 'unknown';

      const ts = safeTimestamp(msgRow.time_created);
      if (ts) {
        if (!startedAt || ts < startedAt) startedAt = ts;
        endedAt = ts;
      }

      if (role === 'user') {
        currentTurnIndex++;
        currentTurnId = `turn-${currentTurnIndex}`;
      }

      const turnId = currentTurnId;
      const turnIndex = currentTurnIndex >= 0 ? currentTurnIndex : undefined;

      const msgParts = partsByMessage.get(msgRow.id) ?? [];
      const textParts: string[] = [];
      const fileAttachments: string[] = [];

      for (const partRow of msgParts) {
        const partData = parseJsonData(partRow.data);
        if (!partData) continue;

        const partType = partData.type as string | undefined;
        if (!partType) continue;

        switch (partType) {
          case 'text': {
            const text =
              typeof partData.text === 'string' ? partData.text : '';
            if (text) textParts.push(text);
            break;
          }

          case 'tool': {
            hasToolCalls = true;
            const toolName =
              typeof partData.name === 'string' ? partData.name : 'unknown';
            const callId =
              typeof partData.id === 'string'
                ? partData.id
                : `tool-${ordinal}`;
            const input =
              typeof partData.input === 'object'
                ? JSON.stringify(partData.input)
                : typeof partData.input === 'string'
                  ? partData.input
                  : '{}';
            const output =
              typeof partData.output === 'string'
                ? partData.output
                : partData.output !== undefined
                  ? JSON.stringify(partData.output)
                  : '';

            const resultEvents: TraceToolResultEvent[] = output
              ? [
                  {
                    type: 'result_event',
                    timestamp: safeTimestamp(partRow.time_created) ?? undefined,
                    content: output,
                    isPartial: false,
                  },
                ]
              : [];

            const toolCall: TraceToolCall = {
              type: 'tool_call',
              id: callId,
              name: toolName,
              category: inferOpencodeToolCategory(toolName),
              inputJson: input,
              resultEvents,
              status: output ? 'success' : 'pending',
              messageOrdinal: ordinal,
            };

            activities.push(toolCall);
            break;
          }

          case 'reasoning': {
            const content =
              typeof partData.text === 'string' ? partData.text : '';
            activities.push({
              type: 'thinking',
              content,
              isRedacted: false,
            } as TraceThinkingBlock);
            break;
          }

          case 'patch': {
            hasToolCalls = true;
            const patchCallId =
              typeof partData.id === 'string'
                ? partData.id
                : `patch-${ordinal}`;
            const files = partData.files ?? partData.patches;
            const patchInput =
              typeof files === 'object' ? JSON.stringify(files) : '{}';

            const toolCall: TraceToolCall = {
              type: 'tool_call',
              id: patchCallId,
              name: 'patch',
              category: 'Edit',
              inputJson: patchInput,
              resultEvents: [],
              status: 'pending',
              messageOrdinal: ordinal,
            };

            activities.push(toolCall);
            break;
          }

          case 'step-start':
          case 'step-finish': {
            const stepContent =
              typeof partData.text === 'string'
                ? partData.text
                : JSON.stringify(partData);
            activities.push({
              type: 'system',
              subtype: partType,
              content: stepContent,
            } as TraceSystemEvent);
            break;
          }

          case 'subtask': {
            const sessionIdRef = partData.sessionId ?? partData.session_id;
            if (
              typeof sessionIdRef === 'string' &&
              sessionIdRef.length > 0
            ) {
              activities.push({
                type: 'subagent_link',
                subagentSessionId: `opencode:${sessionIdRef}`,
                subagentSource: 'opencode',
                relationship: 'spawned',
                messageOrdinal: ordinal,
              } as TraceSubagentLink);
            } else {
              const subContent =
                typeof partData.text === 'string'
                  ? partData.text
                  : JSON.stringify(partData);
              activities.push({
                type: 'system',
                subtype: 'subtask',
                content: subContent,
              } as TraceSystemEvent);
            }
            break;
          }

          case 'file': {
            const fileName =
              typeof partData.name === 'string' ? partData.name : '';
            const filePath =
              typeof partData.path === 'string' ? partData.path : fileName;
            if (filePath) {
              fileAttachments.push(`[Attachment: ${filePath}]`);
            }
            break;
          }

          default:
            warnings.push(
              `Unknown part type: ${partType} in part ${partRow.id}`,
            );
            break;
        }
      }

      let content = textParts.join('\n');
      if (fileAttachments.length > 0) {
        content = content
          ? `${content}\n${fileAttachments.join('\n')}`
          : fileAttachments.join('\n');
      }

      if (!content && msgData) {
        const msgContent = msgData.content;
        if (typeof msgContent === 'string') {
          content = msgContent;
        } else if (Array.isArray(msgContent)) {
          content = msgContent
            .map((block: Record<string, unknown>) => (typeof block?.text === 'string' ? block.text : ''))
            .filter(Boolean)
            .join('\n');
        }
      }

      const message: TraceMessage = {
        id: `${sessionId}-${ordinal}`,
        ordinal,
        role: role === 'user' || role === 'assistant' || role === 'system' || role === 'tool_result'
          ? role
          : 'system',
        content,
        timestamp: safeTimestamp(msgRow.time_created) ?? undefined,
        model,
        turnId,
        turnIndex,
        isRealUserInput: role === 'user',
        sourceMetadata,
      };

      messages.push(message);
      ordinal++;
    }

    const session: TraceSession = {
      id: sessionId,
      source: 'opencode',
      project: projectPath,
      name: sessionRow.title || sessionRow.slug || undefined,
      startedAt,
      endedAt,
      updatedAt: safeTimestamp(sessionRow.time_updated) ?? undefined,
      status: sessionRow.time_archived ? 'idle' : endedAt ? 'idle' : 'active',
      parentSessionId: sessionRow.parent_id
        ? `opencode:${sessionRow.parent_id}`
        : undefined,
      relationshipType: sessionRow.parent_id ? 'subagent' : 'root',
      sourceSessionId: rawSessionId,
      cwd: sessionRow.directory ?? undefined,
      model,
      metrics: {
        messageCount: messages.length,
        userMessageCount: messages.filter((m) => m.role === 'user').length,
        inputTokens: safeNumber(sessionRow.tokens_input) || undefined,
        outputTokens: safeNumber(sessionRow.tokens_output) || undefined,
        cacheReadTokens: safeNumber(sessionRow.tokens_cache_read) || undefined,
        cacheWriteTokens:
          safeNumber(sessionRow.tokens_cache_write) || undefined,
        reasoningTokens:
          safeNumber(sessionRow.tokens_reasoning) || undefined,
        totalTokens:
          safeNumber(sessionRow.tokens_input) +
            safeNumber(sessionRow.tokens_output) || undefined,
        hasToolCalls,
        parserMalformedLines: errors.length,
        isTruncated: false,
      },
      turns: [],
    };

    return { session, messages, activities, errors, warnings };
  } catch (err) {
    return {
      session: createEmptySession(rawSessionId, projectOverride ?? ''),
      messages: [],
      activities: [],
      errors: [
        {
          line: 0,
          raw: dbPath,
          error: err instanceof Error ? err.message : String(err),
        },
      ],
      warnings,
    };
  } finally {
    db?.close();
  }
}

function createEmptySession(
  rawSessionId: string,
  project: string,
): TraceSession {
  return {
    id: `opencode:${rawSessionId}`,
    source: 'opencode',
    project,
    startedAt: null,
    endedAt: null,
    status: 'error',
    relationshipType: 'root',
    sourceSessionId: rawSessionId,
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

export function computeOpencodeSkipKey(
  session: OpencodeSessionRow,
  messageCount: number,
  partCount: number,
): string {
  const composite = `opencode:${session.id}:${session.time_updated}:${messageCount}:${partCount}`;
  return crypto.createHash('sha256').update(composite).digest('hex');
}
