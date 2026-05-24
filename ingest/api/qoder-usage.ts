import Database from 'better-sqlite3';
import { Hono } from 'hono';
import { getConfig } from '../config/index.js';
import { discoverQoderSources } from '../sync/sources.js';
import {
  estimateQoderSessionCost,
  getQoderModelMultiplier,
  QODER_TOKEN_CALIBRATED_COST_SOURCE,
  type QoderCostUsageRow,
} from '../pricing/qoder-pricing.js';

export const qoderUsageRoutes = new Hono();

interface QoderRootRecordRow {
  request_id: string;
  session_id: string;
  session_title: string | null;
  project_name: string | null;
  project_uri: string | null;
  record_mode: string | null;
  session_mode: string | null;
  gmt_create: number;
  session_modified: number;
  next_record_gmt: number | null;
  record_extra: string | null;
  preferred_model_info: string | null;
}

interface QoderUsageTokenRow {
  token_info: string | null;
  model_info: string | null;
  record_extra: string | null;
  preferred_model_info: string | null;
}

interface QoderUsageEntry {
  id: string;
  sessionId: string;
  requestId: string;
  sessionTitle: string | null;
  project: string;
  startedAt: string | null;
  source: 'IDE';
  operation: string;
  model: string | null;
  modelMultiplier: number | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  credits: number | null;
  costUsd: number | null;
  costSource: string;
  pricingStatus: string | null;
}

qoderUsageRoutes.get('/api/v1/qoder/usage', async (c) => {
  const limit = sanitizeLimit(c.req.query('limit'));
  const sources = await discoverQoderSources(getConfig().toolDirs.get('qoder'));
  const entries: QoderUsageEntry[] = [];

  for (const source of sources) {
    if (source.error) continue;

    let db: Database.Database | null = null;
    try {
      db = new Database(source.path, { readonly: true, fileMustExist: true });
      const records = loadQoderRootRecords(db, Math.max(limit - entries.length, 0));

      for (const record of records) {
        entries.push(buildQoderUsageEntry(db, record));
      }
    } finally {
      db?.close();
    }

    if (entries.length >= limit) break;
  }

  entries.sort((a, b) => {
    const left = a.startedAt ? Date.parse(a.startedAt) : 0;
    const right = b.startedAt ? Date.parse(b.startedAt) : 0;
    return right - left;
  });

  const limitedEntries = entries.slice(0, limit);
  const totalCredits = sumNullable(limitedEntries.map((entry) => entry.credits));
  const totalCostUsd = sumNullable(limitedEntries.map((entry) => entry.costUsd));

  return c.json({
    entries: limitedEntries,
    totalCredits,
    totalCostUsd,
    costSource: QODER_TOKEN_CALIBRATED_COST_SOURCE,
    calibration: {
      baseCreditsPerMillionTokensEnv: process.env.QODER_BASE_CREDITS_PER_M_TOKENS ?? null,
      ultimateMultiplierEnv: process.env.QODER_ULTIMATE_MULTIPLIER ?? null,
      usdPerCreditEnv: process.env.QODER_USD_PER_CREDIT ?? null,
    },
  });
});

function loadQoderRootRecords(db: Database.Database, limit: number): QoderRootRecordRow[] {
  if (limit <= 0) return [];

  return db.prepare(
    `SELECT
       cr.request_id,
       cr.session_id,
       cs.session_title,
       cs.project_name,
       cs.project_uri,
       cr.mode AS record_mode,
       cs.mode AS session_mode,
       cr.gmt_create,
       cs.gmt_modified AS session_modified,
       cr.extra AS record_extra,
       cs.preferred_model_info,
       (
         SELECT MIN(next.gmt_create)
         FROM chat_record next
         WHERE next.session_id = cr.session_id
           AND next.gmt_create > cr.gmt_create
       ) AS next_record_gmt
     FROM chat_record cr
     JOIN chat_session cs ON cs.session_id = cr.session_id
     WHERE (cs.parent_session_id IS NULL OR cs.parent_session_id = '')
     ORDER BY cr.gmt_create DESC, cr.request_id DESC
     LIMIT ?`
  ).all(limit) as QoderRootRecordRow[];
}

function buildQoderUsageEntry(
  db: Database.Database,
  record: QoderRootRecordRow,
): QoderUsageEntry {
  const usageRows = collectRequestUsageRows(db, record);
  const estimate = estimateQoderSessionCost({ usageRows, isSubagent: false });
  const inputTokens = usageRows.reduce((sum, row) => sum + row.inputTokens, 0);
  const outputTokens = usageRows.reduce((sum, row) => sum + row.outputTokens, 0);
  const model = chooseUsageModel(usageRows) ?? parseQoderRecordModelKey(record.record_extra)
    ?? parseQoderModelKey(record.preferred_model_info);

  return {
    id: `${record.session_id}:${record.request_id}`,
    sessionId: `qoder:${record.session_id}`,
    requestId: record.request_id,
    sessionTitle: record.session_title,
    project: extractProject(record),
    startedAt: epochToIso(record.gmt_create),
    source: 'IDE',
    operation: record.record_mode || record.session_mode || 'unknown',
    model,
    modelMultiplier: getQoderModelMultiplier(model),
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    credits: estimate.credits,
    costUsd: estimate.costUsd,
    costSource: estimate.costSource ?? QODER_TOKEN_CALIBRATED_COST_SOURCE,
    pricingStatus: estimate.pricingStatus,
  };
}

function collectRequestUsageRows(
  db: Database.Database,
  record: QoderRootRecordRow,
): QoderCostUsageRow[] {
  const endMs = record.next_record_gmt ?? null;
  const rows = db.prepare(
    `WITH RECURSIVE session_tree(session_id) AS (
       SELECT ?
       UNION ALL
       SELECT child.session_id
       FROM chat_session child
       JOIN session_tree parent ON child.parent_session_id = parent.session_id
     )
     SELECT
       cm.token_info,
       cm.model_info,
       cr.extra AS record_extra,
       cs.preferred_model_info
     FROM session_tree tree
     JOIN chat_session cs ON cs.session_id = tree.session_id
     JOIN chat_message cm ON cm.session_id = cs.session_id
     LEFT JOIN chat_record cr ON cr.request_id = cm.request_id
     WHERE cm.role = 'assistant'
       AND cm.token_info IS NOT NULL
       AND cm.gmt_create >= ?
       AND (? IS NULL OR cm.gmt_create < ?)
     ORDER BY cm.gmt_create, cm.id`
  ).all(record.session_id, record.gmt_create, endMs, endMs) as QoderUsageTokenRow[];

  const usageRows: QoderCostUsageRow[] = [];
  for (const row of rows) {
    const tokenInfo = parseQoderTokenInfo(row.token_info);
    if (!tokenInfo) continue;

    usageRows.push({
      inputTokens: tokenInfo.inputTokens,
      outputTokens: tokenInfo.outputTokens,
      model:
        parseQoderModelKey(row.model_info)
        ?? parseQoderRecordModelKey(row.record_extra)
        ?? parseQoderModelKey(row.preferred_model_info)
        ?? null,
    });
  }

  return usageRows;
}

function parseQoderTokenInfo(raw: string | null): { inputTokens: number; outputTokens: number } | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainObject(parsed)) return null;

    const inputTokens = readNonNegativeNumber(parsed, 'prompt_tokens')
      ?? readNonNegativeNumber(parsed, 'input_tokens')
      ?? 0;
    const outputTokens = readNonNegativeNumber(parsed, 'completion_tokens')
      ?? readNonNegativeNumber(parsed, 'output_tokens')
      ?? 0;

    return { inputTokens, outputTokens };
  } catch {
    return null;
  }
}

function chooseUsageModel(rows: QoderCostUsageRow[]): string | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.model) continue;
    counts.set(row.model, (counts.get(row.model) ?? 0) + row.inputTokens + row.outputTokens);
  }

  let selected: string | null = null;
  let selectedTokens = 0;
  for (const [model, tokens] of counts.entries()) {
    if (tokens > selectedTokens) {
      selected = model;
      selectedTokens = tokens;
    }
  }

  return selected;
}

function parseQoderModelKey(raw: string | null): string | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainObject(parsed)) return null;
    if (typeof parsed.model_key === 'string') return parsed.model_key;
    if (typeof parsed.key === 'string') return parsed.key;
    return null;
  } catch {
    return null;
  }
}

function parseQoderRecordModelKey(raw: string | null): string | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainObject(parsed)) return null;
    if (isPlainObject(parsed.modelConfig) && typeof parsed.modelConfig.key === 'string') {
      return parsed.modelConfig.key;
    }
    if (isPlainObject(parsed.model_config) && typeof parsed.model_config.key === 'string') {
      return parsed.model_config.key;
    }
    return null;
  } catch {
    return null;
  }
}

function extractProject(record: QoderRootRecordRow): string {
  if (record.project_name) return record.project_name;
  if (record.project_uri) {
    const parts = record.project_uri.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'unknown';
  }
  return 'unknown';
}

function sumNullable(values: Array<number | null>): number | null {
  let total = 0;
  let count = 0;
  for (const value of values) {
    if (value == null) continue;
    total += value;
    count += 1;
  }
  return count === 0 ? null : Math.round(total * 1_000_000) / 1_000_000;
}

function readNonNegativeNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function epochToIso(epochMs: number | null): string | null {
  if (epochMs == null || epochMs === 0) return null;
  return new Date(epochMs).toISOString();
}

function sanitizeLimit(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return 20;
  return Math.min(parsed, 100);
}
