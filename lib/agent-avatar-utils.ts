const AGENT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

const MIME_TO_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
} as const;

export type AvatarExtension = (typeof MIME_TO_EXT)[keyof typeof MIME_TO_EXT];

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isValidAgentId(agentId: string): boolean {
  return AGENT_ID_PATTERN.test(agentId);
}

export function mimeTypeToExtension(mimeType: string): AvatarExtension | null {
  if (!(mimeType in MIME_TO_EXT)) return null;
  return MIME_TO_EXT[mimeType as keyof typeof MIME_TO_EXT];
}

export function pickAgentAvatarUrl(
  identity?: {
    avatar?: string;
    avatarUrl?: string;
  } | null,
): string | null {
  return nonEmptyString(identity?.avatarUrl) ?? nonEmptyString(identity?.avatar) ?? null;
}
