const AVATAR_CACHE_KEY = "ovao.gateway.avatar-cache.v1";
const AVATAR_CACHE_VERSION = 1;
const AVATAR_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface AvatarCacheSnapshotV1 {
  version: 1;
  updatedAt: number;
  avatars: Record<string, string>;
}

let memoryCache: AvatarCacheSnapshotV1 | null | undefined;

function hasBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeAvatarMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const normalized: Record<string, string> = {};
  for (const [agentId, avatarUrl] of Object.entries(record)) {
    if (typeof avatarUrl !== "string") continue;
    const trimmedId = agentId.trim();
    const trimmedUrl = avatarUrl.trim();
    if (!trimmedId || !trimmedUrl) continue;
    normalized[trimmedId] = trimmedUrl;
  }
  return normalized;
}

function readSnapshotFromStorage(): AvatarCacheSnapshotV1 | null {
  if (!hasBrowserStorage()) return null;

  try {
    const raw = window.localStorage.getItem(AVATAR_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AvatarCacheSnapshotV1>;
    if (parsed.version !== AVATAR_CACHE_VERSION) return null;
    if (typeof parsed.updatedAt !== "number") return null;
    if (Date.now() - parsed.updatedAt > AVATAR_CACHE_TTL_MS) return null;

    return {
      version: 1,
      updatedAt: parsed.updatedAt,
      avatars: normalizeAvatarMap(parsed.avatars),
    };
  } catch {
    return null;
  }
}

function getSnapshot(): AvatarCacheSnapshotV1 | null {
  if (memoryCache !== undefined) {
    return memoryCache;
  }
  memoryCache = readSnapshotFromStorage();
  return memoryCache;
}

function writeSnapshot(avatars: Record<string, string>): void {
  if (!hasBrowserStorage()) return;

  const normalized = normalizeAvatarMap(avatars);
  if (Object.keys(normalized).length === 0) {
    memoryCache = null;
    try {
      window.localStorage.removeItem(AVATAR_CACHE_KEY);
    } catch {
      // ignore storage write failures
    }
    return;
  }

  const snapshot: AvatarCacheSnapshotV1 = {
    version: 1,
    updatedAt: Date.now(),
    avatars: normalized,
  };

  memoryCache = snapshot;
  try {
    window.localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore storage write failures
  }
}

export function getCachedAvatarUrls(): Record<string, string> {
  const snapshot = getSnapshot();
  return snapshot ? { ...snapshot.avatars } : {};
}

export function mergeCachedAvatarUrls(avatars: Record<string, string>): void {
  const current = getCachedAvatarUrls();
  writeSnapshot({ ...current, ...avatars });
}

export function setCachedAvatarUrl(agentId: string, avatarUrl: string | null): void {
  const trimmedId = agentId.trim();
  if (!trimmedId) return;

  const current = getCachedAvatarUrls();
  if (typeof avatarUrl === "string" && avatarUrl.trim()) {
    current[trimmedId] = avatarUrl.trim();
  } else {
    delete current[trimmedId];
  }

  writeSnapshot(current);
}

export function __resetAvatarCacheForTests(): void {
  memoryCache = undefined;
}
