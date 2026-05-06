// Wave 2 Contract Freeze — selector/facade layer for Dashboard P0 consumption.
// Wave 3 pages MUST import only from this file, never from gateway-store raw fields.
import type { AgentInfo, GatewayState } from "./gateway-store";
import type { AlertItem, GlobalEventFeedItem, UsageDetailSnapshot } from "./p0-types";
import type { AgentDetailUIState, P0UIState } from "./p0-ui-state";
import type { SessionInfo } from "@/gateway/adapter-types";

type ConnectionGateState = Exclude<P0UIState, "success" | "empty" | "unsupported">;

function createBaseResultMap<TData>(data: TData): Record<ConnectionGateState, { state: ConnectionGateState; data: TData }> {
  return {
    disconnected: { state: "disconnected", data },
    error: { state: "error", data },
    stale: { state: "stale", data },
    loading: { state: "loading", data },
  };
}

function connectionUIState(
  connectionStatus: GatewayState["connectionStatus"],
  isDashboardLoading: boolean,
): ConnectionGateState | null {
  if (connectionStatus === "disconnected") return "disconnected";
  if (connectionStatus === "error") return "error";
  if (connectionStatus === "reconnecting") return "stale";
  if (isDashboardLoading || connectionStatus === "connecting") return "loading";
  return null; // connected + loaded — fall through to data checks
}

const EMPTY_ALERTS: AlertItem[] = [];
const EMPTY_GLOBAL_FEED: GlobalEventFeedItem[] = [];

const usageBaseResults = createBaseResultMap<UsageDetailSnapshot | null>(null);
const usageUnsupportedResult = { state: "unsupported" as const, data: null };
let lastUsageDetail: UsageDetailSnapshot | null = null;
let lastUsageState: Extract<P0UIState, "empty" | "success"> | null = null;
let lastUsageResult: { state: P0UIState; data: UsageDetailSnapshot | null } | null = null;

const alertsBaseResults = createBaseResultMap<AlertItem[]>(EMPTY_ALERTS);
const alertsEmptyResult = { state: "empty" as const, data: EMPTY_ALERTS };
let lastAlertItems: AlertItem[] | null = null;
let lastAlertsResult: { state: P0UIState; data: AlertItem[] } | null = null;

const globalFeedBaseResults = createBaseResultMap<GlobalEventFeedItem[]>(EMPTY_GLOBAL_FEED);
const globalFeedEmptyResult = { state: "empty" as const, data: EMPTY_GLOBAL_FEED };
let lastGlobalFeed: GlobalEventFeedItem[] | null = null;
let lastGlobalFeedResult: { state: P0UIState; data: GlobalEventFeedItem[] } | null = null;

const agentDetailBaseResults = createBaseResultMap<AgentInfo | null>(null);
const invalidAgentResult = { state: "invalid-agent" as const, data: null };

export function selectUsageState(state: GatewayState): { state: P0UIState; data: UsageDetailSnapshot | null } {
  const base = connectionUIState(state.connectionStatus, state.isDashboardLoading);
  if (base) return usageBaseResults[base];

  const usageDetail = state.usageDetail;
  if (usageDetail === null) return usageUnsupportedResult;

  const nextState = usageDetail.providers.length === 0 ? "empty" : "success";
  if (usageDetail === lastUsageDetail && nextState === lastUsageState && lastUsageResult) {
    return lastUsageResult;
  }

  lastUsageDetail = usageDetail;
  lastUsageState = nextState;
  lastUsageResult = { state: nextState, data: usageDetail };
  return lastUsageResult;
}

export function selectAlertsState(state: GatewayState): { state: P0UIState; data: AlertItem[] } {
  const base = connectionUIState(state.connectionStatus, state.isDashboardLoading);
  if (base) return alertsBaseResults[base];

  const alertItems = state.alertItems;
  if (alertItems.length === 0) return alertsEmptyResult;
  if (alertItems === lastAlertItems && lastAlertsResult) return lastAlertsResult;

  lastAlertItems = alertItems;
  lastAlertsResult = { state: "success", data: alertItems };
  return lastAlertsResult;
}

export function selectAgentDetailState(agentId: string) {
  let lastAgent: AgentInfo | null = null;
  let lastResult: { state: AgentDetailUIState; data: AgentInfo | null } | null = null;

  return (state: GatewayState): { state: AgentDetailUIState; data: AgentInfo | null } => {
    const base = connectionUIState(state.connectionStatus, state.isDashboardLoading);
    if (base) return agentDetailBaseResults[base];

    const agent = state.agents.get(agentId);
    if (!agent) return invalidAgentResult;
    if (agent === lastAgent && lastResult) return lastResult;

    lastAgent = agent;
    lastResult = { state: "success", data: agent };
    return lastResult;
  };
}

export function selectGlobalFeedState(state: GatewayState): { state: P0UIState; data: GlobalEventFeedItem[] } {
  const base = connectionUIState(state.connectionStatus, state.isDashboardLoading);
  if (base) return globalFeedBaseResults[base];

  const globalEventFeed = state.globalEventFeed;
  if (globalEventFeed.length === 0) return globalFeedEmptyResult;
  if (globalEventFeed === lastGlobalFeed && lastGlobalFeedResult) return lastGlobalFeedResult;

  lastGlobalFeed = globalEventFeed;
  lastGlobalFeedResult = { state: "success", data: globalEventFeed };
  return lastGlobalFeedResult;
}

const sessionsBaseResults = createBaseResultMap<SessionInfo[]>([]);
const sessionsEmptyResult = { state: "empty" as const, data: [] as SessionInfo[] };
let lastSessions: SessionInfo[] | null = null;
let lastSessionsResult: { state: P0UIState; data: SessionInfo[] } | null = null;

export function selectSessionsState(state: GatewayState): { state: P0UIState; data: SessionInfo[] } {
  const base = connectionUIState(state.connectionStatus, state.isDashboardLoading);
  if (base) return sessionsBaseResults[base];

  const sessions = state.sessions;
  if (sessions.length === 0) return sessionsEmptyResult;
  if (sessions === lastSessions && lastSessionsResult) return lastSessionsResult;

  lastSessions = sessions;
  lastSessionsResult = { state: "success", data: sessions };
  return lastSessionsResult;
}
