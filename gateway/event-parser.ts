import type { LogEntry } from "@/types/log";

import type { AgentEventPayload } from "./types";

export type ParsedAgentStatus = "idle" | "working" | "tool_calling" | "speaking" | "error";

export interface ParsedAgentEvent {
  status: ParsedAgentStatus;
  logType: LogEntry["type"];
  summary: string;
}

function formatErrorDetail(data: Record<string, unknown>): string {
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message.trim();
  }

  const reason = typeof data.reason === "string" && data.reason.trim() ? data.reason.trim() : null;
  const expected = typeof data.expected === "number" ? data.expected : null;
  const received = typeof data.received === "number" ? data.received : null;

  if (reason && expected !== null && received !== null) {
    return `${reason} (expected ${expected}, received ${received})`;
  }
  if (reason) {
    return reason;
  }
  if (expected !== null && received !== null) {
    return `expected ${expected}, received ${received}`;
  }
  return "unknown";
}

function parseLifecycle(data: Record<string, unknown>): ParsedAgentEvent {
  const phase = typeof data.phase === "string" ? data.phase : "unknown";
  if (phase === "start" || phase === "thinking") {
    return { status: "working", logType: "lifecycle", summary: `lifecycle › ${phase}` };
  }
  if (phase === "end") {
    return { status: "idle", logType: "lifecycle", summary: "lifecycle › end" };
  }
  if (phase === "fallback" || phase === "error") {
    return { status: "error", logType: "lifecycle", summary: `lifecycle › ${phase}` };
  }
  return { status: "working", logType: "lifecycle", summary: `lifecycle › ${phase}` };
}

function parseTool(data: Record<string, unknown>): ParsedAgentEvent {
  const name = typeof data.name === "string" ? data.name : "unknown";
  const phase = typeof data.phase === "string" ? data.phase : "unknown";
  const status: ParsedAgentStatus = phase === "start" ? "tool_calling" : "working";
  return { status, logType: "tool", summary: `tool › ${name}` };
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return "";
        const record = item as Record<string, unknown>;
        if (typeof record.text === "string") return record.text;
        if (typeof record.content === "string") return record.content;
        if (typeof record.delta === "string") return record.delta;
        if (typeof record.message === "string") return record.message;
        return "";
      })
      .join("");
  }

  if (content && typeof content === "object") {
    const record = content as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if (typeof record.content === "string") return record.content;
    if (typeof record.delta === "string") return record.delta;
    if (typeof record.message === "string") return record.message;
  }

  return "";
}

function extractAssistantText(data: Record<string, unknown>): string {
  if (typeof data.text === "string") return data.text;
  if (typeof data.message === "string") return data.message;
  if (typeof data.delta === "string") return data.delta;
  if (typeof data.output_text === "string") return data.output_text;
  return extractTextFromContent(data.content);
}

function parseAssistant(data: Record<string, unknown>): ParsedAgentEvent {
  const text = extractAssistantText(data);
  return {
    status: "speaking",
    logType: "assistant",
    summary: `assistant › ${text}`,
  };
}

function parseError(data: Record<string, unknown>): ParsedAgentEvent {
  return { status: "error", logType: "error", summary: `error › ${formatErrorDetail(data)}` };
}

export function parseAgentEvent(event: AgentEventPayload): ParsedAgentEvent {
  switch (event.stream) {
    case "lifecycle":
      return parseLifecycle(event.data);
    case "tool":
      return parseTool(event.data);
    case "assistant":
      return parseAssistant(event.data);
    case "error":
      return parseError(event.data);
    default:
      return { status: "working", logType: "lifecycle", summary: "lifecycle › unknown" };
  }
}
