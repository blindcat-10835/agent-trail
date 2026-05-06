import { redirect } from 'next/navigation'

/**
 * Legacy redirect: /dashboard → /openclaw/dashboard
 *
 * Per D-05: Preserve existing bookmarks with seamless 307 redirect.
 * OpenClaw remains the default entry point for existing users.
 */
export default function LegacyDashboardPage() {
  redirect('/openclaw/dashboard')
}
