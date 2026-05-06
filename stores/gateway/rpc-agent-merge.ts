import type { AgentInfo } from "./gateway-store";

/**
 * Merge RPC refresh data with live runtime state.
 * Runtime non-idle status has higher priority than RPC idle.
 * RPC avatar wins when present; otherwise keep the local/runtime avatar fallback.
 */
export function mergeRpcAgentsWithRuntimeState(
  prevAgents: Map<string, AgentInfo>,
  rpcAgents: Map<string, AgentInfo>,
): Map<string, AgentInfo> {
  const merged = new Map(prevAgents);

  for (const [agentId, rpcAgent] of rpcAgents.entries()) {
    const runtimeAgent = prevAgents.get(agentId);
    if (!runtimeAgent) {
      merged.set(agentId, rpcAgent);
      continue;
    }

    const status = runtimeAgent.status !== "idle" && rpcAgent.status === "idle" ? runtimeAgent.status : rpcAgent.status;
    const avatarUrl = rpcAgent.avatarUrl ?? runtimeAgent.avatarUrl ?? null;

    merged.set(agentId, {
      ...rpcAgent,
      status,
      avatarUrl,
    });
  }

  return merged;
}
