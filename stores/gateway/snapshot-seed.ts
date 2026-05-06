import type { HelloOk } from "@/gateway/types";

export interface SnapshotSeedAgent {
  id: string;
  name: string;
  isDefault: boolean;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function extractSnapshotSeedAgents(snapshot: HelloOk["snapshot"] | null | undefined): SnapshotSeedAgent[] {
  const health = snapshot?.health;
  const rawAgents = health?.agents;
  if (!health || !Array.isArray(rawAgents) || rawAgents.length === 0) return [];

  const defaultAgentId = asNonEmptyString(health.defaultAgentId);
  const result: SnapshotSeedAgent[] = [];
  const seen = new Set<string>();

  for (const raw of rawAgents) {
    if (!raw || typeof raw !== "object") continue;

    const record = raw as Record<string, unknown>;
    const id = asNonEmptyString(record.agentId) ?? asNonEmptyString(record.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const name = asNonEmptyString(record.name) ?? id;
    const isDefault = record.isDefault === true || (defaultAgentId !== undefined && defaultAgentId === id);

    result.push({ id, name, isDefault });
  }

  return result;
}
