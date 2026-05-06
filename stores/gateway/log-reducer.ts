import type { AgentEventPayload } from "@/gateway/types";
import type { LogEntry } from "@/types/log";

const ASSISTANT_PREFIX = "assistant › ";
const DEFAULT_MAX_LOGS = 200;
const MAX_ASSISTANT_LOG_CHARS = 4000;

function normalizeDedupValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDedupValue(item));
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      normalized[key] = normalizeDedupValue(obj[key]);
    }
    return normalized;
  }
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

function stripAssistantPrefix(content: string): string {
  if (!content.startsWith(ASSISTANT_PREFIX)) return content;
  return content.slice(ASSISTANT_PREFIX.length);
}

function appendWithOverlap(base: string, incoming: string): string {
  const overlapMax = Math.min(base.length, incoming.length);
  for (let size = overlapMax; size > 0; size--) {
    if (base.endsWith(incoming.slice(0, size))) {
      return base + incoming.slice(size);
    }
  }
  return base + incoming;
}

function mergeAssistantText(previous: string, incoming: string): string {
  if (!incoming) return previous;
  if (!previous) return incoming;
  if (incoming.startsWith(previous)) return incoming;
  if (previous.startsWith(incoming)) return previous;
  return appendWithOverlap(previous, incoming);
}

function capAssistantText(content: string): string {
  if (content.length <= MAX_ASSISTANT_LOG_CHARS) return content;
  const tailSize = MAX_ASSISTANT_LOG_CHARS - 1;
  return `…${content.slice(-tailSize)}`;
}

function summaryToAssistantText(summary: string): string {
  return stripAssistantPrefix(summary);
}

export function buildAgentEventDedupKey(payload: AgentEventPayload): string {
  if (typeof payload.seq === "number") {
    return `${payload.runId}|${payload.stream}|seq:${payload.seq}`;
  }

  const ts = typeof payload.ts === "number" ? payload.ts : 0;
  const dataSignature = JSON.stringify(normalizeDedupValue(payload.data));
  return `${payload.runId}|${payload.stream}|noseq:${ts}|${dataSignature}`;
}

interface ReduceAgentLogsParams {
  agentId: string;
  prevLogs: LogEntry[];
  payload: AgentEventPayload;
  parsedSummary: string;
  parsedLogType: LogEntry["type"];
  time: string;
  maxLogs?: number;
}

export function reduceAgentLogs({
  agentId,
  prevLogs,
  payload,
  parsedSummary,
  parsedLogType,
  time,
  maxLogs = DEFAULT_MAX_LOGS,
}: ReduceAgentLogsParams): LogEntry[] {
  const isAssistant = payload.stream === "assistant" && parsedLogType === "assistant";
  const lastLog = prevLogs.at(-1);
  const eventSeq = typeof payload.seq === "number" ? payload.seq : null;

  if (isAssistant && lastLog?.type === "assistant" && lastLog.runId === payload.runId) {
    const previousText = stripAssistantPrefix(lastLog.content);
    const incomingText = summaryToAssistantText(parsedSummary);
    const mergedText = capAssistantText(mergeAssistantText(previousText, incomingText));

    if (mergedText === previousText) {
      return prevLogs;
    }

    const updatedLastLog: LogEntry = {
      ...lastLog,
      time,
      content: `${ASSISTANT_PREFIX}${mergedText}`,
      seq: eventSeq,
    };
    return [...prevLogs.slice(0, -1), updatedLastLog].slice(-maxLogs);
  }

  const logEntry: LogEntry = {
    id: `${agentId}-${payload.runId}-${payload.stream}-${eventSeq ?? payload.ts}`,
    time,
    type: parsedLogType,
    content: parsedSummary,
    runId: payload.runId,
    seq: eventSeq,
  };
  return [...prevLogs, logEntry].slice(-maxLogs);
}
