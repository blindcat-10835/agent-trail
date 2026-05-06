import type { AgentSummary } from "@/gateway/types";

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveAgentDisplayName(agent: AgentSummary): string {
  return nonEmptyString(agent.identity?.name) ?? nonEmptyString(agent.name) ?? agent.id;
}
