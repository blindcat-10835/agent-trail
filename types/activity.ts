/**
 * Activity Console Types
 *
 * Type definitions for the Activity Console data layer.
 * These types represent log entries from cron runs and config audit logs.
 */

/**
 * Core log entry type representing a single activity event.
 * Used for both cron runs and config audit logs.
 */
export interface LogEntry {
  /** Unique identifier (e.g., "cron-{jobId}-{ts}" or "config-{ts}-{event}") */
  id: string
  /** Unix timestamp in milliseconds */
  ts: number
  /** Data source */
  source: 'cron' | 'config'
  /** Log level */
  level: 'info' | 'warn' | 'error'
  /** Category (e.g., "cron-run", "config.write") */
  category: string
  /** Human-readable summary (1-2 lines) */
  summary: string
  /** Associated agent ID (if applicable) */
  agentId: string | null
  /** Cron job ID (for cron entries) */
  jobId: string | null
  /** Execution duration in milliseconds (for cron entries) */
  durationMs: number | null
  /** Raw JSON object for expanded view */
  details: Record<string, unknown>
}

/**
 * Aggregated statistics computed from a set of log entries.
 * Provides summary metrics for the Activity Console.
 */
export interface LogSummary {
  /** Total log entries */
  totalEntries: number
  /** Number of error-level entries */
  errorCount: number
  /** Count by source */
  sources: {
    cron: number
    config: number
  }
  /** Timestamp range (null if no valid timestamps) */
  timeRange: { oldest: number; newest: number } | null
  /** Up to 5 most recent error entries */
  recentErrors: LogEntry[]
}

/**
 * Filter type for UI log filtering.
 * Used to filter log entries by source or level.
 */
export type LogFilter = 'all' | 'error' | 'config' | 'cron'
