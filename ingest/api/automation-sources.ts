import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import os from 'os';
import path from 'path';
import { resolveToolDirs } from '../config/tool-dirs.js';
import type { SourceToolId } from '@/lib/agent-tools/types';

export interface FileAutomationSummary {
  id?: string;
  source: SourceToolId;
  name: string;
  sessionCount: number;
  lastActiveAt: string | null;
  latestStatus: string;
  toolCallCount: number;
  schedule?: string;
  nextRunAt?: string | null;
  model?: string;
}

interface OpenClawRunStats {
  count: number;
  lastActiveAt: string | null;
  latestStatus: string | null;
}

const FILE_AUTOMATION_CACHE_TTL_MS = 10_000;
const fileAutomationCache = new Map<string, { expiresAt: number; rows: FileAutomationSummary[] }>();

function unique(paths: string[]): string[] {
  return [...new Set(paths.map((p) => path.resolve(p)))];
}

function getOpenClawRoots(): string[] {
  if (process.env.OPENCLAW_HOME) {
    return [process.env.OPENCLAW_HOME];
  }

  const roots: string[] = [];
  const toolDirs = resolveToolDirs().get('openclaw') ?? [];
  for (const dir of toolDirs) {
    roots.push(path.basename(dir) === 'agents' ? path.dirname(dir) : dir);
  }
  roots.push(path.join(os.homedir(), '.openclaw'));
  return unique(roots);
}

function getCodexRoots(): string[] {
  if (process.env.CODEX_HOME) {
    return [process.env.CODEX_HOME];
  }

  const roots: string[] = [];
  const toolDirs = resolveToolDirs().get('codex') ?? [];
  for (const dir of toolDirs) {
    roots.push(path.basename(dir) === 'sessions' ? path.dirname(dir) : dir);
  }
  roots.push(path.join(os.homedir(), '.codex'));
  return unique(roots);
}

function msToIso(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return new Date(value).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function formatOpenClawSchedule(schedule: unknown): string | undefined {
  if (!isRecord(schedule)) return undefined;
  const kind = readString(schedule, 'kind');
  if (kind === 'cron') {
    const expr = readString(schedule, 'expr');
    const tz = readString(schedule, 'tz');
    if (!expr) return undefined;
    return tz ? `${expr} ${tz}` : expr;
  }
  if (kind === 'every') {
    const everyMs = readNumber(schedule, 'everyMs');
    if (!everyMs) return undefined;
    const minutes = Math.round(everyMs / 60000);
    if (minutes % 60 === 0) return `every ${minutes / 60}h`;
    return `every ${minutes}m`;
  }
  return kind;
}

function countNonEmptyLines(raw: string): number {
  let count = 0;
  let inLine = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw.charCodeAt(i);
    if (ch === 10 || ch === 13) {
      if (inLine) count += 1;
      inLine = false;
    } else if (!inLine) {
      inLine = true;
    }
  }

  return inLine ? count + 1 : count;
}

function lastNonEmptyLine(raw: string): string | null {
  let end = raw.length - 1;
  while (end >= 0 && /\s/.test(raw[end])) end -= 1;
  if (end < 0) return null;

  const start = raw.lastIndexOf('\n', end);
  return raw.slice(start + 1, end + 1).trim() || null;
}

function readOpenClawRunStats(root: string, jobIds: Set<string>): Map<string, OpenClawRunStats> {
  const runsDir = path.join(root, 'cron', 'runs');
  const stats = new Map<string, OpenClawRunStats>();

  if (!existsSync(runsDir)) return stats;

  for (const jobId of jobIds) {
    const filePath = path.join(runsDir, `${jobId}.jsonl`);
    if (!existsSync(filePath)) continue;

    try {
      const raw = readFileSync(filePath, 'utf-8');
      const obj = parseJsonObject(lastNonEmptyLine(raw) ?? '');
      const timestamp = msToIso(obj?.runAtMs) ?? msToIso(obj?.ts);
      const status = obj ? readString(obj, 'status') ?? null : null;

      stats.set(jobId, {
        count: countNonEmptyLines(raw),
        lastActiveAt: timestamp,
        latestStatus: status,
      });
    } catch {
      // Ignore unreadable or malformed run logs.
    }
  }

  return stats;
}

function readOpenClawAutomations(): FileAutomationSummary[] {
  const rows: FileAutomationSummary[] = [];

  for (const root of getOpenClawRoots()) {
    const jobsPath = path.join(root, 'cron', 'jobs.json');
    if (!existsSync(jobsPath)) continue;

    const jobsFile = parseJsonObject(readFileSync(jobsPath, 'utf-8'));
    const jobs = Array.isArray(jobsFile?.jobs) ? jobsFile.jobs : [];
    const jobIds = new Set(
      jobs
        .filter(isRecord)
        .map((job) => readString(job, 'id'))
        .filter((id): id is string => Boolean(id)),
    );
    const runStats = readOpenClawRunStats(root, jobIds);

    for (const job of jobs) {
      if (!job || typeof job !== 'object') continue;

      if (!isRecord(job)) continue;

      const id = readString(job, 'id');
      const name = readString(job, 'name') ?? id;
      if (!name) continue;

      const stats = id ? runStats.get(id) : undefined;
      const state = isRecord(job.state) ? job.state : {};
      const payload = isRecord(job.payload) ? job.payload : {};
      const lastActiveAt =
        stats?.lastActiveAt ??
        msToIso(state.lastRunAtMs) ??
        msToIso(job.updatedAtMs) ??
        msToIso(job.createdAtMs);
      const nextRunAt = msToIso(state.nextRunAtMs);
      const latestStatus =
        stats?.latestStatus ??
        (typeof state.lastRunStatus === 'string' ? state.lastRunStatus : null) ??
        (typeof state.lastStatus === 'string' ? state.lastStatus : null) ??
        (job.enabled === false ? 'paused' : 'scheduled');

      rows.push({
        id,
        source: 'openclaw',
        name,
        sessionCount: stats?.count ?? 0,
        lastActiveAt,
        latestStatus,
        toolCallCount: 0,
        schedule: formatOpenClawSchedule(job.schedule),
        nextRunAt,
        model: readString(payload, 'model'),
      });
    }
  }

  return rows;
}

function parseTomlValue(raw: string): unknown {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    const entries = value
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return entries.map((item) => {
      if (item.startsWith('"') && item.endsWith('"')) return item.slice(1, -1).replace(/\\"/g, '"');
      return item;
    });
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function parseFlatToml(raw: string): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};

  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (!match) continue;
    parsed[match[1]] = parseTomlValue(match[2]);
  }

  return parsed;
}

function readCodexMemoryStats(memoryPath: string): { count: number; lastActiveAt: string | null } {
  if (!existsSync(memoryPath)) return { count: 0, lastActiveAt: null };

  try {
    const raw = readFileSync(memoryPath, 'utf-8');
    const matches = [...raw.matchAll(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\s+JST)?/gm)];
    const last = matches.at(-1);
    if (!last) {
      return { count: 0, lastActiveAt: new Date(statSync(memoryPath).mtimeMs).toISOString() };
    }
    const parsed = Date.parse(`${last[1]}T${last[2]}+09:00`);
    return {
      count: matches.length,
      lastActiveAt: Number.isNaN(parsed) ? null : new Date(parsed).toISOString(),
    };
  } catch {
    return { count: 0, lastActiveAt: null };
  }
}

function readCodexAutomations(): FileAutomationSummary[] {
  const rows: FileAutomationSummary[] = [];

  for (const root of getCodexRoots()) {
    const automationsDir = path.join(root, 'automations');
    if (!existsSync(automationsDir)) continue;

    for (const entry of readdirSync(automationsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const automationPath = path.join(automationsDir, entry.name, 'automation.toml');
      if (!existsSync(automationPath)) continue;

      try {
        const toml = parseFlatToml(readFileSync(automationPath, 'utf-8'));
        const id = typeof toml.id === 'string' ? toml.id : entry.name;
        const name = typeof toml.name === 'string' ? toml.name : id;
        const status = typeof toml.status === 'string' ? toml.status.toLowerCase() : 'unknown';
        const updatedAt = msToIso(toml.updated_at);
        const memory = readCodexMemoryStats(path.join(automationsDir, entry.name, 'memory.md'));

        rows.push({
          id,
          source: 'codex',
          name,
          sessionCount: memory.count,
          lastActiveAt: memory.lastActiveAt ?? updatedAt,
          latestStatus: status,
          toolCallCount: 0,
          schedule: typeof toml.rrule === 'string' ? toml.rrule : undefined,
          nextRunAt: null,
          model: typeof toml.model === 'string' ? toml.model : undefined,
        });
      } catch {
        // Ignore unreadable or malformed automation definitions.
      }
    }
  }

  return rows;
}

export function readFileBackedAutomations(source?: SourceToolId): FileAutomationSummary[] {
  const cacheKey = source ?? 'all';
  const now = Date.now();
  const cached = fileAutomationCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.rows.map((row) => ({ ...row }));
  }

  const rows: FileAutomationSummary[] = [];

  if (!source || source === 'openclaw') {
    rows.push(...readOpenClawAutomations());
  }

  if (!source || source === 'codex') {
    rows.push(...readCodexAutomations());
  }

  fileAutomationCache.set(cacheKey, {
    expiresAt: now + FILE_AUTOMATION_CACHE_TTL_MS,
    rows,
  });

  return rows.map((row) => ({ ...row }));
}
