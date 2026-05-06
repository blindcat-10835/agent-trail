// Wave 2 P0 data types — frozen contract for Dashboard P0 consumption
import type { AgentStream } from "@/gateway/types";

// --- Global Event Feed ---

export interface GlobalEventFeedItem {
  agentId: string;
  agentName: string;
  time: number;
  type: AgentStream;
  content: string;
  runId: string;
}

export const MAX_GLOBAL_FEED_ITEMS = 100;

// --- Usage Detail ---

export interface UsageDetailSnapshot {
  providers: {
    provider: string;
    displayName: string;
    tokensIn?: number;
    tokensOut?: number;
    totalTokens?: number;
    estimatedCostUsd?: number;
  }[];
  updatedAt: number;
}

// --- Alerts ---

export type AlertSeverity = "info" | "warn" | "action-required";

export interface AlertItem {
  id: string;
  agentId: string;
  agentName: string;
  severity: AlertSeverity;
  message: string;
  ts: number;
  acked: boolean;
}
