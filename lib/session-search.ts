export const SESSION_SEARCH_DEFAULT_LIMIT = 20
export const SESSION_SEARCH_MAX_LIMIT = 100

export function parseSessionSearchLimit(raw: string | undefined): number | null {
  const parsed = parseInt(raw || String(SESSION_SEARCH_DEFAULT_LIMIT), 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    return null
  }

  return Math.min(parsed, SESSION_SEARCH_MAX_LIMIT)
}
