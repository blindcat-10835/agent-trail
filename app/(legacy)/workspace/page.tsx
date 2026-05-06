import { redirect } from 'next/navigation'

/**
 * Legacy redirect: /workspace → /openclaw/workspace
 *
 * Per D-05: Preserve existing bookmarks with seamless 307 redirect.
 */
export default function LegacyWorkspacePage() {
  redirect('/openclaw/workspace')
}
