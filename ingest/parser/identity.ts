/**
 * IDENTITY.md Parser
 *
 * Extracts structured fields from OpenClaw workspace IDENTITY.md files.
 * Format: `- **Key:** Value` lines, plus optional H1 title with display name.
 */

export interface IdentityFields {
  name?: string
  creature?: string
  vibe?: string
  emoji?: string
  avatar?: string
}

const VALID_KEYS = new Set(['name', 'creature', 'vibe', 'emoji', 'avatar'])

const KV_RE = /^-\s+\*\*(.+?):\*\*\s*(.*)/
const TITLE_RE = /^#\s+IDENTITY\.md\s*[-–—]\s*(.+?)(?:\s*[|│]\s*(.*))?$/

export function parseIdentityMarkdown(content: string): IdentityFields {
  const fields: IdentityFields = {}

  for (const line of content.split('\n')) {
    // H1 title: # IDENTITY.md - Display Name | Subtitle
    const titleMatch = TITLE_RE.exec(line)
    if (titleMatch && !fields.name) {
      fields.name = titleMatch[1].trim()
      continue
    }

    // Key-value: - **Key:** Value
    const kvMatch = KV_RE.exec(line)
    if (kvMatch) {
      const key = kvMatch[1].trim().toLowerCase()
      const val = kvMatch[2].trim()
      if (val && VALID_KEYS.has(key)) {
        ;(fields as Record<string, string>)[key] = val
      }
    }
  }

  return fields
}
