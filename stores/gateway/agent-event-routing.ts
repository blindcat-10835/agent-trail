import type { AgentEventPayload } from "@/gateway/types";

export interface RoutingAgent {
  id: string;
  name?: string;
  isDefault: boolean;
}

export interface ResolveAgentIdContext {
  agents: Map<string, RoutingAgent>;
  runIdMap: Map<string, string>;
  sessionKeyMap: Map<string, string[]>;
}

function findAgentIdByToken(token: string, agents: Map<string, RoutingAgent>): string | undefined {
  const normalized = token.toLowerCase();
  for (const [id, agent] of agents) {
    const agentName = typeof agent.name === "string" ? agent.name.toLowerCase() : "";
    if (id.toLowerCase() === normalized || agentName === normalized) {
      return id;
    }
  }
  return undefined;
}

export function inferAgentIdFromSessionKey(sessionKey: string, agents: Map<string, RoutingAgent>): string | undefined {
  const match = sessionKey.match(/^agent:([^:]+):/);
  if (!match) return undefined;
  return findAgentIdByToken(match[1], agents);
}

export function selectMainPreferredAgentId(agents: Map<string, RoutingAgent>, agentIds: string[]): string | undefined {
  if (agentIds.length === 0) return undefined;

  const deduped = Array.from(new Set(agentIds));
  const existing = deduped.filter((id) => agents.has(id));
  const preferredMain = existing.find((id) => agents.get(id)?.isDefault === true);
  if (preferredMain) return preferredMain;
  if (existing.length > 0) return existing[0];

  return deduped[0];
}

export function resolveAgentId(payload: AgentEventPayload, context: ResolveAgentIdContext): string | undefined {
  const { agents, runIdMap, sessionKeyMap } = context;
  const explicitAgentId = typeof payload.data.agentId === "string" ? payload.data.agentId : undefined;
  if (explicitAgentId) {
    if (agents.has(explicitAgentId)) return explicitAgentId;
    const normalizedExplicit = findAgentIdByToken(explicitAgentId, agents);
    if (normalizedExplicit) return normalizedExplicit;
  }

  const mappedByRun = runIdMap.get(payload.runId);
  if (mappedByRun) return mappedByRun;

  if (payload.sessionKey) {
    const mappedBySession = sessionKeyMap.get(payload.sessionKey);
    if (mappedBySession && mappedBySession.length > 0) {
      const preferred = selectMainPreferredAgentId(agents, mappedBySession);
      if (preferred) return preferred;
    }

    const inferred = inferAgentIdFromSessionKey(payload.sessionKey, agents);
    if (inferred) return inferred;
  }

  return undefined;
}

export function upsertSessionKeyMap(sessionKeyMap: Map<string, string[]>, sessionKey: string, agentId: string): void {
  const existing = sessionKeyMap.get(sessionKey) ?? [];
  if (!existing.includes(agentId)) {
    existing.push(agentId);
    sessionKeyMap.set(sessionKey, existing);
  }
}
