import { redirect } from 'next/navigation'

/**
 * Legacy redirect: /office → /openclaw/office
 *
 * Per D-05: Preserve existing bookmarks with seamless 307 redirect.
 */
export default function LegacyOfficePage() {
  redirect('/openclaw/office')
}
