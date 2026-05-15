'use client'

import { OverviewPage } from '@/components/overview/overview-page'

/**
 * Unified Overview Dashboard Page
 *
 * Delegates entirely to OverviewPage which orchestrates all overview sections.
 * Works for all tool IDs (all, openclaw, claude-code, codex).
 */
export default function ToolDashboardPage() {
  return <OverviewPage />
}
