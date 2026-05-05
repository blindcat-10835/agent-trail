import type { ChannelInfo, SkillInfo, CronTask, UsageProviderInfo } from "@/gateway/adapter-types";
import type { AgentInfo } from "@/stores/gateway/gateway-store";
import type { UsageDetailSnapshot } from "@/stores/gateway/p0-types";

const SNAPSHOT_KEY = "ovao.dashboard.snapshot.v1";
const SNAPSHOT_VERSION = 1;
const SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface StoredSnapshotV1 {
  version: 1;
  savedAt: number;
  agents: [string, AgentInfo][];
  skills: SkillInfo[];
  cronTasks: CronTask[];
  channels: ChannelInfo[];
  providers: UsageProviderInfo[];
  usageDetail: UsageDetailSnapshot | null;
}

export interface DashboardSnapshot {
  agents: Map<string, AgentInfo>;
  skills: SkillInfo[];
  cronTasks: CronTask[];
  channels: ChannelInfo[];
  providers: UsageProviderInfo[];
  usageDetail: UsageDetailSnapshot | null;
}

// Module-level memory cache to avoid repeated deserialization
let memCache: DashboardSnapshot | null | undefined = undefined; // undefined = not yet read

export function readDashboardSnapshot(): DashboardSnapshot | null {
  // Return memory cache if already loaded this session
  if (memCache !== undefined) return memCache;

  // SSR safety: localStorage is only available in the browser
  if (typeof window === "undefined") {
    memCache = null;
    return null;
  }

  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) {
      memCache = null;
      return null;
    }

    const stored: StoredSnapshotV1 = JSON.parse(raw) as StoredSnapshotV1;

    // Version check
    if (stored.version !== SNAPSHOT_VERSION) {
      localStorage.removeItem(SNAPSHOT_KEY);
      memCache = null;
      return null;
    }

    // TTL check
    if (Date.now() - stored.savedAt > SNAPSHOT_TTL_MS) {
      localStorage.removeItem(SNAPSHOT_KEY);
      memCache = null;
      return null;
    }

    const snapshot: DashboardSnapshot = {
      agents: new Map(stored.agents),
      skills: stored.skills,
      cronTasks: stored.cronTasks,
      channels: stored.channels,
      providers: stored.providers,
      usageDetail: stored.usageDetail,
    };

    memCache = snapshot;
    return snapshot;
  } catch {
    // Corrupted data — clear and return null
    try {
      localStorage.removeItem(SNAPSHOT_KEY);
    } catch {
      // ignore
    }
    memCache = null;
    return null;
  }
}

export function writeDashboardSnapshot(data: DashboardSnapshot): void {
  // SSR safety
  if (typeof window === "undefined") return;

  try {
    const stored: StoredSnapshotV1 = {
      version: SNAPSHOT_VERSION,
      savedAt: Date.now(),
      agents: [...data.agents.entries()],
      skills: data.skills,
      cronTasks: data.cronTasks,
      channels: data.channels,
      providers: data.providers,
      usageDetail: data.usageDetail,
    };

    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(stored));

    // Update memory cache with fresh data
    memCache = data;
  } catch {
    // localStorage may be full or unavailable — ignore silently
  }
}

export function clearDashboardSnapshot(): void {
  // SSR safety
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // ignore
  }
  memCache = null;
}
