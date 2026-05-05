import type { LogEntry, LogSummary } from '@/types/activity'
import { getLogEntries, computeLogSummary } from '@/lib/logs'
import { apiErrorResponse } from '@/lib/api-error'

/**
 * GET /api/logs
 *
 * Fetches activity logs from the filesystem (cron runs and config audit logs).
 * Returns a JSON response with entries array and summary statistics.
 *
 * Response format:
 * {
 *   entries: LogEntry[],
 *   summary: LogSummary
 * }
 */
export async function GET(): Promise<Response> {
  try {
    const entries = getLogEntries({ limit: 200 })
    const summary = computeLogSummary(entries)

    return Response.json({ entries, summary })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load logs')
  }
}
