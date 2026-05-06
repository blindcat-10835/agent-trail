import type { AgentEventPayload } from "@/gateway/types";

export function isTerminalLifecycleEvent(payload: AgentEventPayload): boolean {
  if (payload.stream !== "lifecycle") return false;
  const phase = typeof payload.data.phase === "string" ? payload.data.phase.toLowerCase() : "";
  return phase === "end";
}

export function shouldUpdateStatusForRun(terminatedRunIds: Set<string>, payload: AgentEventPayload): boolean {
  return !terminatedRunIds.has(payload.runId);
}
