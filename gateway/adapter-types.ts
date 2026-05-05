// Dashboard 展示所需的业务领域类型（M2 只读子集）

export type ChannelType =
  | "whatsapp"
  | "telegram"
  | "discord"
  | "signal"
  | "feishu"
  | "imessage"
  | "matrix"
  | "line"
  | "msteams"
  | "googlechat"
  | "mattermost";

export type ChannelStatus = "connected" | "disconnected" | "connecting" | "error";

export interface ChannelInfo {
  id: string;
  type: ChannelType;
  name: string;
  status: ChannelStatus;
  accountId?: string;
  error?: string;
  configured?: boolean;
  linked?: boolean;
  running?: boolean;
  lastConnectedAt?: number | null;
  lastMessageAt?: number | null;
  reconnectAttempts?: number;
  mode?: string;
}

export interface SkillInfo {
  id: string;
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
  icon: string;
  version: string;
  author?: string;
}

export type CronSchedule =
  | { kind: "at"; at: string }
  | { kind: "every"; everyMs: number }
  | { kind: "cron"; expr: string; tz?: string };

export interface CronJobState {
  nextRunAtMs?: number | null;
  lastRunAtMs?: number | null;
  lastRunStatus?: "ok" | "error" | "skipped" | null;
}

export interface CronTask {
  id: string;
  name: string;
  description?: string;
  schedule: CronSchedule;
  enabled: boolean;
  state: CronJobState;
}

export interface UsageProviderWindow {
  label: string;
  usedPercent: number;
  resetAt?: number;
}

export interface UsageProviderInfo {
  provider: string;
  displayName: string;
  plan?: string;
  windows: UsageProviderWindow[];
  error?: string;
}

export type SessionStatus = "active" | "idle" | "aborted";

export interface SessionInfo {
  key: string;
  kind?: string;
  label?: string;
  displayName?: string;
  updatedAt?: number;
  sessionId?: string;
  model?: string;
  totalTokens?: number;
  contextTokens?: number;
  createdAt?: number;
  aborted?: boolean;
  thinkingLevel?: string | null;
  channel?: string;
  cost?: number;
  lastMessage?: string;
}
