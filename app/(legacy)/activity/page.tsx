import { redirect } from 'next/navigation'

/**
 * Legacy redirect: /activity → /openclaw/activity
 *
 * Per D-05: Preserve existing bookmarks with seamless 307 redirect.
 */
export default function LegacyActivityPage() {
  redirect('/openclaw/activity')
}
