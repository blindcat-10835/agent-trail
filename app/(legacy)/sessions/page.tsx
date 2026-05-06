import { redirect } from 'next/navigation'

/**
 * Legacy redirect: /sessions → /openclaw/sessions
 *
 * Per D-05: Preserve existing bookmarks with seamless 307 redirect.
 */
export default function LegacySessionsPage() {
  redirect('/openclaw/sessions')
}
