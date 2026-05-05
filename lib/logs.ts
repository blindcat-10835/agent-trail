/**
 * Activity Console - Log parsing functions
 *
 * Parse cron runs and config audit logs from the filesystem.
 * These functions transform raw JSONL data into structured LogEntry objects.
 */

import type { LogEntry, LogSummary } from '@/types/activity'
import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import path from 'path'

/**
 * Parse a single cron run JSONL line into a LogEntry.
 * Returns null if the line can't be parsed or is not a "finished" action.
 *
 * Input format example:
 * ```json
 * {
 *   "ts": 1773554773166,
 *   "jobId": "650f415e-...",
 *   "action": "finished",
 *   "status": "error",
 *   "error": "...",
 *   "summary": "...",
 *   "durationMs": 373131,
 *   "model": "MiniMax-M2.5",
 *   "provider": "minimax-portal"
 * }
 * ```
 *
 * @param line - A single line from cron runs JSONL file
 * @param fileName - The filename (used to derive jobId if not present)
 * @returns Parsed LogEntry or null if invalid
 */
export function parseCronRunLine(line: string, fileName: string): LogEntry | null {
  if (!line.trim()) return null

  try {
    const obj = JSON.parse(line)

    // Only process "finished" actions
    if (obj.action && obj.action !== 'finished') return null

    const ts = typeof obj.ts === 'number' ? obj.ts : 0
    const jobId = String(obj.jobId || fileName.replace('.jsonl', ''))
    const status = obj.status === 'error' ? 'error' : obj.status === 'ok' ? 'ok' : 'unknown'

    return {
      id: `cron-${jobId}-${ts}`,
      ts,
      source: 'cron',
      level: status === 'error' ? 'error' : 'info',
      category: 'cron-run',
      summary:
        typeof obj.summary === 'string'
          ? obj.summary
          : typeof obj.error === 'string'
            ? obj.error
            : 'Cron run completed',
      agentId: null,
      jobId,
      durationMs: typeof obj.durationMs === 'number' ? obj.durationMs : null,
      details: obj,
    }
  } catch {
    return null
  }
}

/**
 * Parse a single config audit JSONL line into a LogEntry.
 * The ts field is an ISO string, convert to unix ms.
 *
 * Input format example:
 * ```json
 * {
 *   "ts": "2026-03-02T10:41:27.138Z",
 *   "source": "config-io",
 *   "event": "config.write",
 *   "configPath": "/Users/ebbi/.openclaw/openclaw.json",
 *   "argv": ["...", "openclaw", "onboard", "--install-daemon"],
 *   "suspicious": [],
 *   "result": "rename"
 * }
 * ```
 *
 * @param line - A single line from config audit JSONL file
 * @returns Parsed LogEntry or null if invalid
 */
export function parseConfigAuditLine(line: string): LogEntry | null {
  if (!line.trim()) return null

  try {
    const obj = JSON.parse(line)

    let ts: number
    if (typeof obj.ts === 'string') {
      ts = new Date(obj.ts).getTime()
      if (isNaN(ts)) ts = 0
    } else if (typeof obj.ts === 'number') {
      ts = obj.ts
    } else {
      ts = 0
    }

    const hasSuspicious = Array.isArray(obj.suspicious) && obj.suspicious.length > 0
    const event = typeof obj.event === 'string' ? obj.event : 'config.change'

    return {
      id: `config-${ts}-${event}`,
      ts,
      source: 'config',
      level: hasSuspicious ? 'warn' : 'info',
      category: event,
      summary: buildConfigSummary(obj),
      agentId: null,
      jobId: null,
      durationMs: null,
      details: obj,
    }
  } catch {
    return null
  }
}

/**
 * Build a human-readable summary from a config audit entry.
 * Extracts the command from argv and constructs a summary string.
 */
function buildConfigSummary(obj: Record<string, unknown>): string {
  const event = typeof obj.event === 'string' ? obj.event : 'config change'
  const result = typeof obj.result === 'string' ? obj.result : ''
  const argv = Array.isArray(obj.argv) ? obj.argv : []

  // Extract the openclaw command from argv
  const cmd = argv
    .filter((a): a is string => typeof a === 'string')
    .find(
      (a) =>
        !a.includes('/') && !a.startsWith('-') && a !== 'node' && a !== 'openclaw'
    )

  const parts = [event]
  if (cmd) parts.push(`via \`${argv.slice(argv.indexOf(cmd)).join(' ')}\``)
  if (result) parts.push(`(${result})`)

  return parts.join(' ')
}

/** Derive the cron runs directory from WORKSPACE_PATH */
function getRunsDir(): string {
  const ws = process.env.WORKSPACE_PATH || path.join(process.env.HOME || '~', '.openclaw', 'workspace')
  return path.resolve(ws, '..', 'cron', 'runs')
}

/** Derive the config audit log path from WORKSPACE_PATH */
function getConfigAuditPath(): string {
  const ws = process.env.WORKSPACE_PATH || path.join(process.env.HOME || '~', '.openclaw', 'workspace')
  return path.resolve(ws, '..', 'logs', 'config-audit.jsonl')
}

/**
 * Read both log sources, merge, sort newest-first.
 * Options: limit (default 200), source filter ('cron' | 'config').
 *
 * @param opts - Options for limiting and filtering entries
 * @returns Array of log entries sorted by timestamp descending
 */
export function getLogEntries(opts?: { limit?: number; source?: string }): LogEntry[] {
  const limit = opts?.limit ?? 200
  const sourceFilter = opts?.source
  const entries: LogEntry[] = []

  // Read cron runs
  if (!sourceFilter || sourceFilter === 'cron') {
    const runsDir = getRunsDir()
    if (existsSync(runsDir)) {
      // Sort files by mtime newest-first for faster limit cutoff
      const files = readdirSync(runsDir)
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => ({
          name: f,
          path: path.join(runsDir, f),
          mtime: statSync(path.join(runsDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime)

      for (const file of files) {
        try {
          const content = readFileSync(file.path, 'utf-8')
          for (const line of content.split('\n')) {
            const entry = parseCronRunLine(line, file.name)
            if (entry) entries.push(entry)
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  // Read config audit
  if (!sourceFilter || sourceFilter === 'config') {
    const auditPath = getConfigAuditPath()
    if (existsSync(auditPath)) {
      try {
        const content = readFileSync(auditPath, 'utf-8')
        for (const line of content.split('\n')) {
          const entry = parseConfigAuditLine(line)
          if (entry) entries.push(entry)
        }
      } catch {
        // Skip unreadable file
      }
    }
  }

  entries.sort((a, b) => b.ts - a.ts)
  return entries.slice(0, limit)
}

/**
 * Compute summary statistics from a set of log entries.
 * Handles empty arrays and filters out invalid timestamps.
 *
 * @param entries - Array of log entries to summarize
 * @returns Computed summary statistics
 */
export function computeLogSummary(entries: LogEntry[]): LogSummary {
  const errorEntries = entries.filter((e) => e.level === 'error')
  const cronCount = entries.filter((e) => e.source === 'cron').length
  const configCount = entries.filter((e) => e.source === 'config').length

  let timeRange: LogSummary['timeRange'] = null
  if (entries.length > 0) {
    const timestamps = entries.map((e) => e.ts).filter((t) => t > 0)
    if (timestamps.length > 0) {
      timeRange = {
        oldest: Math.min(...timestamps),
        newest: Math.max(...timestamps),
      }
    }
  }

  return {
    totalEntries: entries.length,
    errorCount: errorEntries.length,
    sources: { cron: cronCount, config: configCount },
    timeRange,
    recentErrors: errorEntries.slice(0, 5),
  }
}
