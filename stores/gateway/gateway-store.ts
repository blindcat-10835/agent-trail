import { create } from "zustand";

import type { ChannelInfo, CronTask, SessionInfo, SkillInfo, UsageProviderInfo } from "@/gateway/adapter-types";
import { readDashboardSnapshot, writeDashboardSnapshot } from "@/lib/dashboard-snapshot-cache";
import { parseAgentEvent } from "@/gateway/event-parser";
import { GatewayRpcClient } from "@/gateway/rpc-client";
import type { AgentEventPayload, AgentsListResponse, ConnectionStatus, HelloOk } from "@/gateway/types";
import { GatewayWsClient } from "@/gateway/ws-client";
import type { LogEntry } from "@/types/log";

import { resolveAgentDisplayName } from "./agent-display-name";
import { inferAgentIdFromSessionKey, resolveAgentId, upsertSessionKeyMap } from "./agent-event-routing";
import { buildAgentEventDedupKey, reduceAgentLogs } from "./log-reducer";
import type { AlertItem, GlobalEventFeedItem, UsageDetailSnapshot } from "./p0-types";
import { MAX_GLOBAL_FEED_ITEMS } from "./p0-types";
import { mergeRpcAgentsWithRuntimeState } from "./rpc-agent-merge";
import { isTerminalLifecycleEvent, shouldUpdateStatusForRun } from "./run-terminal-guard";
import { extractSnapshotSeedAgents } from "./snapshot-seed";

// Agent 展示状态
export type AgentDisplayStatus = "idle" | "working" | "tool_calling" | "speaking" | "error";

function getGatewayHttpBase(): string | null {
  const wsUrl = process.env.NEXT_PUBLIC_GATEWAY_WS;
  if (!wsUrl) return null;
  try {
    const u = new URL(wsUrl);
    u.protocol = u.protocol === "wss:" ? "https:" : "http:";
    return u.origin;
  } catch {
    return null;
  }
}

export interface AgentInfo {
  id: string;
  name: string;
  emoji?: string | null;
  avatarUrl?: string | null;
  isDefault: boolean;
  status: AgentDisplayStatus;
  currentTool?: string | null;
  activeSessionKey?: string | null;
  sessionStartedAt?: number | null;
}

// --- 内部 Gateway 响应类型 ---

interface GatewayChannelAccountSnapshot {
  accountId?: string;
  name?: string;
  connected?: boolean;
  configured?: boolean;
  linked?: boolean;
  running?: boolean;
  error?: string;
  lastError?: string | null;
  lastConnectedAt?: number | null;
  lastMessageAt?: number | null;
  reconnectAttempts?: number;
  mode?: string;
}

interface GatewayChannelsStatusResult {
  channelAccounts?: Record<string, GatewayChannelAccountSnapshot[]>;
  channelLabels?: Record<string, string>;
}

interface GatewaySkillEntry {
  skillKey?: string;
  name?: string;
  description?: string;
  disabled?: boolean;
  emoji?: string;
  version?: string;
  author?: string;
}

interface GatewaySkillsStatusResult {
  skills?: GatewaySkillEntry[];
}

// --- 数据转换函数 ---

function flattenChannels(result: GatewayChannelsStatusResult): ChannelInfo[] {
  const accounts = result.channelAccounts ?? {};
  const labels = result.channelLabels ?? {};
  const channels: ChannelInfo[] = [];

  for (const [type, snapshots] of Object.entries(accounts)) {
    for (const snap of snapshots) {
      const error = snap.error ?? snap.lastError ?? undefined;
      let status: ChannelInfo["status"] = "disconnected";
      if (error) {
        status = "error";
      } else if (snap.connected === true) {
        status = "connected";
      } else if (snap.running) {
        status = "connecting";
      }

      channels.push({
        id: snap.accountId ? `${type}:${snap.accountId}` : type,
        type: type as ChannelInfo["type"],
        name: snap.name ?? labels[type] ?? type,
        status,
        accountId: snap.accountId,
        error: error ?? undefined,
        configured: snap.configured,
        linked: snap.linked,
        running: snap.running,
        lastConnectedAt: snap.lastConnectedAt,
        lastMessageAt: snap.lastMessageAt,
        reconnectAttempts: snap.reconnectAttempts,
        mode: snap.mode,
      });
    }
  }
  return channels;
}

function mapSkills(result: GatewaySkillsStatusResult): SkillInfo[] {
  return (result.skills ?? [])
    .filter((e) => !e.disabled)
    .map((e) => ({
      id: e.skillKey ?? "",
      slug: e.skillKey ?? "",
      name: e.name ?? e.skillKey ?? "",
      description: e.description ?? "",
      enabled: !e.disabled,
      icon: e.emoji ?? "📦",
      version: e.version ?? "",
      author: e.author,
    }));
}

// --- Store ---

export interface GatewayState {
  // 连接
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  gatewayVersion: string | null;
  needsSetup: boolean;

  // 数据
  agents: Map<string, AgentInfo>;
  agentLogs: Record<string, LogEntry[]>; // agentId → 最近 200 条
  channels: ChannelInfo[];
  skills: SkillInfo[];
  cronTasks: CronTask[];
  providers: UsageProviderInfo[];
  sessions: SessionInfo[];
  activeSessions: number;
  isDashboardLoading: boolean;
  // P0 Contract Freeze (Wave 2)
  globalEventFeed: GlobalEventFeedItem[];
  usageDetail: UsageDetailSnapshot | null;
  alertItems: AlertItem[];

  // Actions
  init: () => void;
  disconnect: () => void;
  reconnect: () => void;
  updateAgentAvatar: (agentId: string, avatarUrl: string | null) => Promise<void>;
  setNeedsSetup: (value: boolean) => void;
  ackAlert: (alertId: string) => void;
  hydrateFromCache: () => void;
}

const ENABLE_AGENT_EVENT_DEBUG = process.env.NODE_ENV !== "production";
const KNOWN_LIFECYCLE_PHASES = new Set([
  "start",
  "thinking",
  "end",
  "ended",
  "done",
  "complete",
  "completed",
  "finish",
  "finished",
  "stop",
  "stopped",
  "fallback",
]);

function getPayloadSessionKey(payload: AgentEventPayload): string | undefined {
  return payload.sessionKey ?? (typeof payload.data.sessionKey === "string" ? payload.data.sessionKey : undefined);
}

function debugAgentEventFrame(frameEventName: string, payload: AgentEventPayload): void {
  if (!ENABLE_AGENT_EVENT_DEBUG) return;
  if (payload.stream !== "lifecycle" && payload.stream !== "error") return;

  const sessionKey = getPayloadSessionKey(payload);
  const phaseRaw = typeof payload.data.phase === "string" ? payload.data.phase : undefined;
  const phase = phaseRaw?.toLowerCase();
  const message = typeof payload.data.message === "string" ? payload.data.message : undefined;

  console.info("[OVAO][agent-event][trace]", {
    eventName: frameEventName,
    stream: payload.stream,
    runId: payload.runId,
    seq: payload.seq,
    sessionKey,
    phase: phaseRaw,
    message,
    data: payload.data,
  });

  if (payload.stream === "lifecycle" && (!phase || !KNOWN_LIFECYCLE_PHASES.has(phase))) {
    console.warn("[OVAO][agent-event][unknown-lifecycle]", {
      eventName: frameEventName,
      runId: payload.runId,
      seq: payload.seq,
      sessionKey,
      phase: phaseRaw,
      data: payload.data,
      payload,
    });
  }

  if (payload.stream === "error" && !message) {
    console.warn("[OVAO][agent-event][empty-error-message]", {
      eventName: frameEventName,
      runId: payload.runId,
      seq: payload.seq,
      sessionKey,
      data: payload.data,
      payload,
    });
  }
}

export function buildSeededAgentsMap(
  prevAgents: Map<string, AgentInfo>,
  snapshot: HelloOk["snapshot"] | null | undefined,
): Map<string, AgentInfo> {
  const seeds = extractSnapshotSeedAgents(snapshot);
  if (seeds.length === 0) return prevAgents;

  const nextAgents = new Map(prevAgents);
  for (const seed of seeds) {
    const existing = nextAgents.get(seed.id);
    nextAgents.set(seed.id, {
      id: seed.id,
      name: seed.name,
      emoji: existing?.emoji ?? null,
      avatarUrl: existing?.avatarUrl ?? null,
      isDefault: seed.isDefault,
      status: existing?.status ?? "idle",
    });
  }

  if (ENABLE_AGENT_EVENT_DEBUG) {
    console.info("[OVAO][gateway.snapshot.seeded]", {
      count: seeds.length,
      agentIds: seeds.map((s) => s.id),
    });
  }

  return nextAgents;
}

// 模块级单例（仅客户端）
let wsClient: GatewayWsClient | null = null;
let rpcClient: GatewayRpcClient | null = null;

function getClients(): { ws: GatewayWsClient; rpc: GatewayRpcClient } {
  if (!wsClient) {
    wsClient = new GatewayWsClient();
    rpcClient = new GatewayRpcClient(wsClient);
  }
  return { ws: wsClient, rpc: rpcClient! };
}

export const useGatewayStore = create<GatewayState>()((set, get) => {
  // runId -> agentId 映射（用于同一次运行后续事件快速归属）
  const runIdMap = new Map<string, string>();
  // 已收到终态 lifecycle 的 runId，后续事件只记日志，不再覆盖状态
  // Bug #5 fix: bounded to MAX_TERMINATED_RUN_IDS entries (FIFO eviction)
  const terminatedRunIds = new Set<string>();
  const terminatedRunOrder: string[] = [];
  const MAX_TERMINATED_RUN_IDS = 1000;
  // sessionKey -> candidateAgentIds 映射（允许多候选，再做主 agent 优选）
  const sessionKeyMap = new Map<string, string[]>();
  // 用于过滤重复事件帧，避免重连或重复转发导致日志刷屏
  const seenEventKeys = new Set<string>();
  const seenEventOrder: string[] = [];
  const MAX_SEEN_EVENT_KEYS = 5000;

  // 跨重连的 handler 取消订阅引用，防止重复注册累积
  let unsubStatus: (() => void) | null = null;
  let unsubEvent: (() => void) | null = null;

  function rebuildSessionKeyMap(sessions: SessionInfo[], agents: Map<string, AgentInfo>): void {
    sessionKeyMap.clear();
    for (const s of sessions) {
      const inferredAgentId = inferAgentIdFromSessionKey(s.key, agents);
      if (inferredAgentId) {
        upsertSessionKeyMap(sessionKeyMap, s.key, inferredAgentId);
      }
    }
  }

  // 连接成功后并发拉取所有 Dashboard 数据，同时构建 sessionKeyMap（sessions.list 单次调用复用）
  async function fetchDashboardData(rpc: GatewayRpcClient): Promise<void> {
    const results = await Promise.allSettled([
      rpc.request<AgentsListResponse>("agents.list"),
      rpc.request<SessionInfo[] | { sessions?: SessionInfo[] }>("sessions.list"),
      rpc.request<GatewaySkillsStatusResult>("skills.status"),
      rpc.request<{ jobs?: CronTask[] }>("cron.list"),
      rpc.request<GatewayChannelsStatusResult>("channels.status", { probe: true }),
      rpc.request<{ providers: UsageProviderInfo[] }>("usage.status"),
      rpc.request<UsageDetailSnapshot>("usage.detail"),
    ]);

    const [agentsRes, sessionsRes, skillsRes, cronRes, channelsRes, usageRes, usageDetailRes] = results;

    const gatewayHttpBase = getGatewayHttpBase();

    const rpcAgents = new Map<string, AgentInfo>();
    if (agentsRes.status === "fulfilled") {
      const { agents: list, defaultId } = agentsRes.value;
      for (const a of list) {
        rpcAgents.set(a.id, {
          id: a.id,
          name: resolveAgentDisplayName(a),
          emoji: a.identity?.emoji ?? null,
          avatarUrl: gatewayHttpBase ? `${gatewayHttpBase}/avatar/${encodeURIComponent(a.id)}` : null,
          isDefault: a.id === defaultId,
          status: "idle",
        });
      }
    }

    let activeSessions = 0;
    const sessions: SessionInfo[] = [];
    if (sessionsRes.status === "fulfilled") {
      const val = sessionsRes.value;
      const rawSessions = Array.isArray(val) ? val : (val.sessions ?? []);
      activeSessions = rawSessions.length;

      // Store sessions with all fields; UI components will compute status from updatedAt and aborted
      for (const s of rawSessions) {
        sessions.push({ ...s });
      }

      // 同时构建 sessionKey 映射，复用已有 sessions.list 结果，无需二次请求
      rebuildSessionKeyMap(sessions, rpcAgents);
    }

    runIdMap.clear();
    terminatedRunIds.clear();
    terminatedRunOrder.length = 0;
    seenEventKeys.clear();
    seenEventOrder.length = 0;

    const skills = skillsRes.status === "fulfilled" ? mapSkills(skillsRes.value) : [];
    const cronTasks = cronRes.status === "fulfilled" ? (cronRes.value.jobs ?? []) : [];
    const channels = channelsRes.status === "fulfilled" ? flattenChannels(channelsRes.value) : [];
    const providers = usageRes.status === "fulfilled" ? (usageRes.value.providers ?? []) : [];

    const usageDetail = usageDetailRes.status === "fulfilled" ? usageDetailRes.value : null;

    set((state) => ({
      agents: mergeRpcAgentsWithRuntimeState(state.agents, rpcAgents),
      sessions,
      activeSessions,
      skills,
      cronTasks,
      channels,
      providers,
      isDashboardLoading: false,
      usageDetail,
      globalEventFeed: [],
      alertItems: [],
    }));

    // Persist snapshot for stale-while-revalidate on next page load
    writeDashboardSnapshot({ agents: new Map(rpcAgents), skills, cronTasks, channels, providers, usageDetail });
  }

  // sessionKey 未命中时防抖重拉 sessions.list，保持映射新鲜
  // Bug #6 fix: replaced fixed 2000ms delay with 100ms debounce — events in unknown sessions
  // are now routed within ≤100ms instead of being silently dropped for 2 seconds.
  const SESSION_REFETCH_DEBOUNCE_MS = 100;
  let sessionRefetchTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleSessionRefetch(): void {
    if (!rpcClient) return;
    if (sessionRefetchTimer) {
      clearTimeout(sessionRefetchTimer);
    }
    sessionRefetchTimer = setTimeout(async () => {
      sessionRefetchTimer = null;
      try {
        const val = await rpcClient!.request<SessionInfo[] | { sessions?: SessionInfo[] }>("sessions.list");
        const sessions = Array.isArray(val) ? val : (val.sessions ?? []);
        rebuildSessionKeyMap(sessions, get().agents);
      } catch {
        // ignore
      }
    }, SESSION_REFETCH_DEBOUNCE_MS);
  }

  // 处理 agent 实时事件，通过多级回退解析 agentId 后更新状态
  function handleAgentEvent(payload: AgentEventPayload): void {
    const agentId = resolveAgentId(payload, {
      agents: get().agents,
      runIdMap,
      sessionKeyMap,
    });
    if (!agentId) {
      // sessionKey 未知说明会话是连接后新建的，补拉映射表
      if (payload.sessionKey) scheduleSessionRefetch();
      return;
    }
    runIdMap.set(payload.runId, agentId);
    if (payload.sessionKey) {
      upsertSessionKeyMap(sessionKeyMap, payload.sessionKey, agentId);
    }

    const eventKey = buildAgentEventDedupKey(payload);
    if (seenEventKeys.has(eventKey)) {
      return;
    }
    seenEventKeys.add(eventKey);
    seenEventOrder.push(eventKey);
    if (seenEventOrder.length > MAX_SEEN_EVENT_KEYS) {
      const removed = seenEventOrder.shift();
      if (removed) {
        seenEventKeys.delete(removed);
      }
    }

    set((state) => {
      const agents = new Map(state.agents);
      const agent = agents.get(agentId);
      if (!agent) return {};
      const parsed = parseAgentEvent(payload);
      const shouldUpdateStatus = shouldUpdateStatusForRun(terminatedRunIds, payload);

      // Build updated agent — W2-3: track currentTool, activeSessionKey, sessionStartedAt
      const updatedAgent: AgentInfo = { ...agent };
      if (shouldUpdateStatus) {
        updatedAgent.status = parsed.status as AgentDisplayStatus;
      }
      if (payload.sessionKey) {
        updatedAgent.activeSessionKey = payload.sessionKey;
      }
      if (payload.stream === "tool") {
        const toolPhase = typeof payload.data.phase === "string" ? payload.data.phase : "";
        const toolName = typeof payload.data.name === "string" ? payload.data.name : null;
        updatedAgent.currentTool = toolPhase === "start" ? toolName : null;
      }
      if (payload.stream === "lifecycle") {
        const phase = typeof payload.data.phase === "string" ? payload.data.phase.toLowerCase() : "";
        if (phase === "start") {
          updatedAgent.sessionStartedAt = payload.ts;
        } else if (["end", "done", "complete", "completed", "finish", "finished"].includes(phase)) {
          updatedAgent.sessionStartedAt = null;
          updatedAgent.currentTool = null;
        }
      }
      agents.set(agentId, updatedAgent);

      if (isTerminalLifecycleEvent(payload) && !terminatedRunIds.has(payload.runId)) {
        terminatedRunIds.add(payload.runId);
        terminatedRunOrder.push(payload.runId);
        if (terminatedRunOrder.length > MAX_TERMINATED_RUN_IDS) {
          const evicted = terminatedRunOrder.shift();
          if (evicted) terminatedRunIds.delete(evicted);
        }
      }

      // 追加日志
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      const prevLogs = state.agentLogs[agentId] ?? [];
      const nextLogs = reduceAgentLogs({
        agentId,
        prevLogs,
        payload,
        parsedSummary: parsed.summary,
        parsedLogType: parsed.logType,
        time,
      });

      // W2-2: append to global event feed (FIFO, max 100)
      const feedItem: GlobalEventFeedItem = {
        agentId,
        agentName: agent.name,
        time: payload.ts,
        type: payload.stream,
        content: parsed.summary,
        runId: payload.runId,
      };
      const prevFeed = state.globalEventFeed;
      const nextFeed =
        prevFeed.length >= MAX_GLOBAL_FEED_ITEMS
          ? [...prevFeed.slice(-(MAX_GLOBAL_FEED_ITEMS - 1)), feedItem]
          : [...prevFeed, feedItem];

      // W2-4: derive alertItems from agent error/recovery
      let alertItems = state.alertItems;
      if (shouldUpdateStatus) {
        if (updatedAgent.status === "error") {
          const alreadyAlerting = alertItems.some((a) => a.agentId === agentId && !a.acked);
          if (!alreadyAlerting) {
            alertItems = [
              ...alertItems,
              {
                id: `${agentId}-${payload.runId}-${payload.seq}`,
                agentId,
                agentName: agent.name,
                severity: "action-required" as const,
                message: parsed.summary,
                ts: payload.ts,
                acked: false,
              },
            ];
          }
        } else {
          alertItems = alertItems.filter((a) => !(a.agentId === agentId && !a.acked));
        }
      }

      return {
        agents,
        agentLogs: { ...state.agentLogs, [agentId]: nextLogs },
        globalEventFeed: nextFeed,
        alertItems,
      };
    });
  }

  return {
    connectionStatus: "disconnected",
    connectionError: null,
    gatewayVersion: null,
    needsSetup: false,
    agents: new Map(),
    agentLogs: {},
    channels: [],
    skills: [],
    cronTasks: [],
    providers: [],
    sessions: [],
    activeSessions: 0,
    isDashboardLoading: false,
    globalEventFeed: [],
    usageDetail: null,
    alertItems: [],

    ackAlert: (alertId) =>
      set((state) => ({
        alertItems: state.alertItems.map((a) => (a.id === alertId ? { ...a, acked: true } : a)),
      })),

    hydrateFromCache: () => {
      const snapshot = readDashboardSnapshot();
      if (!snapshot) return;
      set((state) => {
        // Only hydrate when agents map is empty — avoid overwriting live data
        if (state.agents.size > 0) return {};
        return {
          agents: snapshot.agents,
          skills: snapshot.skills,
          cronTasks: snapshot.cronTasks,
          channels: snapshot.channels,
          providers: snapshot.providers,
          usageDetail: snapshot.usageDetail,
          isDashboardLoading: true, // mark as loading — WS will overwrite when connected
        };
      });
    },

    init: () => {
      // 先取消上一轮注册，防止重连后 handler 累积
      unsubStatus?.();
      unsubEvent?.();

      const { ws, rpc } = getClients();

      unsubStatus = ws.onStatusChange((status, error) => {
        set({ connectionStatus: status, connectionError: error ?? null });
        if (status === "connected") {
          const snapshot = ws.getSnapshot();
          set((state) => {
            const seededAgents = buildSeededAgentsMap(state.agents, snapshot);
            if (seededAgents === state.agents) return {};
            return { agents: seededAgents };
          });
          set({ gatewayVersion: ws.getServerVersion(), isDashboardLoading: true });
          void fetchDashboardData(rpc);
        }
      });

      // 订阅所有事件并按 payload 结构识别 agent 事件，兼容不同 Gateway 版本的事件名
      unsubEvent = ws.onEvent("*", (frame) => {
        const payload = frame.payload as AgentEventPayload;
        if (payload?.runId !== undefined && payload?.stream !== undefined) {
          debugAgentEventFrame(frame.event, payload);
          handleAgentEvent(payload);
        }
      });

      ws.connect();
    },

    disconnect: () => {
      getClients().ws.disconnect();
      set({ connectionStatus: "disconnected", connectionError: null });
    },

    reconnect: () => {
      get().disconnect();
      get().init();
    },

    updateAgentAvatar: async (agentId, avatarUrl) => {
      if (!rpcClient) {
        throw new Error("Gateway RPC is not initialized");
      }

      await rpcClient.request("agents.update", {
        agentId,
        avatar: avatarUrl ?? "",
      });

      set((state) => {
        const agents = new Map(state.agents);
        const agent = agents.get(agentId);
        if (!agent) return {};
        agents.set(agentId, { ...agent, avatarUrl });
        return { agents };
      });
    },

    setNeedsSetup: (value) => set({ needsSetup: value }),
  };
});
