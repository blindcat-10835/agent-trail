// Gateway WebSocket 协议类型（基于 OpenClaw Gateway protocol v3）

// --- 请求/响应帧 ---

export interface GatewayRequest {
  type: "req";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface GatewayResponseOk<T = unknown> {
  type: "res";
  id: string;
  ok: true;
  payload: T;
}

export interface GatewayResponseError {
  type: "res";
  id: string;
  ok: false;
  error: ErrorShape;
}

export type GatewayResponseFrame<T = unknown> = GatewayResponseOk<T> | GatewayResponseError;

export interface GatewayEventFrame<T = unknown> {
  type: "event";
  event: string;
  payload: T;
}

export type GatewayFrame = GatewayRequest | GatewayResponseFrame | GatewayEventFrame;

// --- 认证 ---

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    version: string;
    platform: string;
    mode: string;
  };
  caps: string[];
  scopes?: string[];
  auth?: { token: string };
}

export interface HealthAgentInfo {
  agentId?: string;
  id?: string;
  name?: string;
  isDefault?: boolean;
}

export interface HealthSnapshot {
  ok?: boolean;
  ts?: number;
  agents?: HealthAgentInfo[];
  defaultAgentId?: string;
  channels?: Record<string, unknown>;
  sessions?: Record<string, unknown>;
}

export interface HelloOk {
  type: "hello-ok";
  protocol: number;
  server: {
    version: string;
    connId?: string;
  };
  snapshot?: {
    presence?: unknown;
    health?: HealthSnapshot;
    sessionDefaults?: unknown;
    uptimeMs?: number;
    configPath?: string;
    stateDir?: string;
    authMode?: string;
    scopes?: string[];
  };
}

// --- Agent 事件 ---

export type AgentStream = "lifecycle" | "tool" | "assistant" | "error";

export interface AgentEventPayload {
  runId: string;
  seq: number;
  stream: AgentStream;
  ts: number;
  data: Record<string, unknown>;
  sessionKey?: string;
}

// --- RPC 数据 ---

export interface AgentSummary {
  id: string;
  name: string;
  default?: boolean;
  identity?: {
    name?: string;
    emoji?: string;
    avatar?: string;
    avatarUrl?: string;
  };
}

export interface AgentsListResponse {
  defaultId: string;
  mainKey: string;
  scope: string;
  agents: AgentSummary[];
}

// --- 连接状态 ---

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

// --- 错误 ---

export interface ErrorShape {
  code: string;
  message: string;
  retryable?: boolean;
}
