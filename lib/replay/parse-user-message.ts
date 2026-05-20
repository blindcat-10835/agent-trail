/**
 * Parses system-injected XML blocks out of Qoder/Claude user message content.
 *
 * Messages from Qoder (and Claude Code hooks) embed context like
 * <system-reminder>, <user_query>, <local-command-stdout> directly inside the
 * user role content. These are not typed by the user and should be rendered
 * separately from the actual user text.
 *
 * <user_query> is treated as real user text (unwrapped); all other tags become
 * InjectedPart entries rendered as collapsible context blocks in the UI.
 */

export interface InjectedPart {
  tagName: string
  content: string
}

export interface ParsedUserMessage {
  /** The actual user-visible text (bare text + <user_query> content) */
  userText: string
  /** System-injected blocks to render as collapsible cards */
  injectedParts: InjectedPart[]
  hasInjections: boolean
}

// Tags whose content IS the real user message, not system context
const USER_TEXT_TAGS = new Set(['user_query'])

// Matches <tag-name ...>content</tag-name> (non-greedy, single-level)
const TAG_RE = /<([\w-]+)[^>]*>([\s\S]*?)<\/\1>/g

export function parseUserMessage(content: string): ParsedUserMessage {
  const injectedParts: InjectedPart[] = []
  const userTextParts: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  TAG_RE.lastIndex = 0
  while ((match = TAG_RE.exec(content)) !== null) {
    const bare = content.slice(lastIndex, match.index).trim()
    if (bare) userTextParts.push(bare)

    const tagName = match[1]
    const tagContent = match[2].trim()

    if (USER_TEXT_TAGS.has(tagName)) {
      userTextParts.push(tagContent)
    } else {
      injectedParts.push({ tagName, content: tagContent })
    }

    lastIndex = match.index + match[0].length
  }

  const remaining = content.slice(lastIndex).trim()
  if (remaining) userTextParts.push(remaining)

  const userText = userTextParts.join('\n\n').trim()

  return {
    userText: userText || content,
    injectedParts,
    hasInjections: injectedParts.length > 0,
  }
}

/** Returns a clean single-line preview with all injected tags stripped. */
export function getCleanPreview(content: string): string {
  TAG_RE.lastIndex = 0
  const parsed = parseUserMessage(content)
  return parsed.userText.replace(/\n+/g, ' ').trim()
}
