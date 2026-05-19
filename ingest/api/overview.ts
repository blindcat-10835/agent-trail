/**
 * Overview API Routes
 *
 * REST API endpoints for overview aggregates, rankings, timeline,
 * starred sessions, source capabilities, agent summaries, and status.
 * Powers the KPI hero, rankings, timeline, and module availability
 * in the redesigned dashboard.
 *
 * @module ingest/api/overview
 */

import { Hono } from 'hono';
import { getDatabase } from '../db/index.js';
import { SOURCE_CAPABILITIES } from '../config/capabilities.js';
import { readFileBackedAutomations, type FileAutomationSummary } from './automation-sources.js';
import type { ServiceContext } from '../types.js';
import {
  estimateModelCost,
  rollUpCosts,
  type CostRollup,
  type PricingStatus,
  type TokenUsageForPricing,
} from '../pricing/model-pricing.js';

export const overviewRoutes = new Hono();

const VALID_SOURCES = ['openclaw', 'claude-code', 'codex', 'opencode'] as const;

const UPDATED_AT_EXPR =
  "MAX(COALESCE(ended_at, ''), COALESCE(started_at, ''), COALESCE(file_mtime, ''))";

function sessionTotalTokensExpr(alias?: string): string {
  const prefix = alias ? `${alias}.` : '';
  const channelTotal = `COALESCE(${prefix}total_input_tokens, 0) + COALESCE(${prefix}total_output_tokens, 0) + COALESCE(${prefix}total_cache_read_tokens, 0) + COALESCE(${prefix}total_cache_write_tokens, 0) + COALESCE(${prefix}total_reasoning_tokens, 0)`;
  return `CASE WHEN ${prefix}source = 'opencode' THEN ${channelTotal} WHEN COALESCE(${prefix}total_tokens, 0) > 0 THEN ${prefix}total_tokens ELSE ${channelTotal} END`;
}

type IngestDatabase = ReturnType<typeof getDatabase>;
type SqlParam = string | number;

interface SessionCostRow extends TokenUsageForPricing {
  id: string;
  project: string;
  day: string | null;
  model: string | null;
  totalTokens: number;
  source: string;
  sourceCostUsd: number | null;
  costPricingStatus: string | null;
}

// ============================================================================
// Shared Helpers
// ============================================================================

function getDateCondition(column: string, window: string): string | null {
  switch (window) {
    case 'today':
      return `${column} >= datetime('now', 'start of day')`;
    case '7d':
      return `${column} >= datetime('now', '-7 days')`;
    case '30d':
      return `${column} >= datetime('now', '-30 days')`;
    default:
      return null;
  }
}

function parseDaysParam(rawDays: string | undefined): number | null {
  const days = Number.parseInt(rawDays || '30', 10);
  if (!Number.isFinite(days) || days < 1 || days > 90) return null;
  return days;
}

function isValidSource(source: string): source is typeof VALID_SOURCES[number] {
  return (VALID_SOURCES as readonly string[]).includes(source);
}

function getSessionCostRows(
  db: IngestDatabase,
  whereClause: string,
  params: SqlParam[],
): SessionCostRow[] {
  const rows = db.prepare(`
    SELECT
      s.id,
      s.source,
      s.project,
      date(s.started_at) AS day,
      (
        SELECT m.model
        FROM messages m
        WHERE m.session_id = s.id
          AND TRIM(COALESCE(m.model, '')) <> ''
          AND m.model <> '<synthetic>'
        ORDER BY m.ordinal DESC
        LIMIT 1
      ) AS model,
      COALESCE(s.total_input_tokens, 0) AS input_tokens,
      COALESCE(s.total_output_tokens, 0) AS output_tokens,
      COALESCE(s.total_cache_read_tokens, 0) AS cache_read_tokens,
      COALESCE(s.total_cache_write_tokens, 0) AS cache_write_tokens,
      COALESCE(s.total_reasoning_tokens, 0) AS reasoning_tokens,
      ${sessionTotalTokensExpr('s')} AS total_tokens,
      s.source_cost_usd,
      s.cost_pricing_status
    FROM sessions s
    ${whereClause}
  `).all(...params) as Array<{
    id: string;
    source: string;
    project: string;
    day: string | null;
    model: string | null;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    reasoning_tokens: number;
    total_tokens: number;
    source_cost_usd: number | null;
    cost_pricing_status: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    project: row.project,
    day: row.day,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadTokens: row.cache_read_tokens,
    cacheWriteTokens: row.cache_write_tokens,
    reasoningTokens: row.reasoning_tokens,
    totalTokens: row.total_tokens,
    sourceCostUsd: row.source_cost_usd,
    costPricingStatus: row.cost_pricing_status,
  }));
}

function rollUpSessionCosts(rows: SessionCostRow[]): CostRollup {
  const estimates = rows
    .filter((row) => row.sourceCostUsd != null || row.totalTokens > 0)
    .map((row) => {
      if (row.sourceCostUsd != null) {
        return {
          cost: row.sourceCostUsd,
          pricingStatus: 'priced' as PricingStatus,
        };
      }
      return estimateModelCost(row.model, row);
    });
  return rollUpCosts(estimates);
}

// ============================================================================
// 1. GET /api/v1/overview/aggregates (DATA-101)
// ============================================================================

overviewRoutes.get('/api/v1/overview/aggregates', (c) => {
  const source = c.req.query('source');
  const window = c.req.query('window') || '7d';

  // Validate source
  if (source && !isValidSource(source)) {
    return c.json({ error: 'Invalid source parameter' }, 400);
  }

  // Validate window
  const dateCondition = getDateCondition('started_at', window);
  const costDateCondition = getDateCondition('s.started_at', window);
  if (!['today', '7d', '30d', 'all'].includes(window)) {
    return c.json({ error: 'Invalid window parameter. Must be "today", "7d", "30d", or "all"' }, 400);
  }

  const db = getDatabase();

  const conditions: string[] = [];
  const params: string[] = [];
  const costConditions: string[] = [];
  const costParams: SqlParam[] = [];

  if (source) {
    conditions.push('source = ?');
    params.push(source);
    costConditions.push('s.source = ?');
    costParams.push(source);
  }

  if (dateCondition) {
    conditions.push(dateCondition);
  }

  if (costDateCondition) {
    costConditions.push(costDateCondition);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const costWhereClause = costConditions.length > 0 ? `WHERE ${costConditions.join(' AND ')}` : '';

  const result = db.prepare(`
    SELECT
      COUNT(*) as session_count,
      COUNT(DISTINCT project) as project_count,
      COALESCE(SUM(user_message_count), 0) as turn_count,
      COALESCE(SUM(total_input_tokens), 0) as input_tokens,
      COALESCE(SUM(total_output_tokens), 0) as output_tokens,
      COALESCE(SUM(total_cache_read_tokens), 0) as cache_read_tokens,
      COALESCE(SUM(total_cache_write_tokens), 0) as cache_write_tokens,
      COALESCE(SUM(total_reasoning_tokens), 0) as reasoning_tokens,
      COALESCE(SUM(${sessionTotalTokensExpr()}), 0) as total_tokens
    FROM sessions
    ${whereClause}
  `).get(...params) as {
    session_count: number;
    project_count: number;
    turn_count: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    reasoning_tokens: number;
    total_tokens: number;
  };

  const costSummary = rollUpSessionCosts(getSessionCostRows(db, costWhereClause, costParams));

  return c.json({
    sessionCount: result.session_count,
    turnCount: result.turn_count,
    projectCount: result.project_count,
    inputTokens: result.input_tokens,
    outputTokens: result.output_tokens,
    cacheReadTokens: result.cache_read_tokens,
    cacheWriteTokens: result.cache_write_tokens,
    reasoningTokens: result.reasoning_tokens,
    totalTokens: result.total_tokens,
    totalCost: costSummary.cost,
    pricingStatus: costSummary.pricingStatus,
  });
});

// ============================================================================
// 2. GET /api/v1/overview/daily-tokens
// ============================================================================

overviewRoutes.get('/api/v1/overview/daily-tokens', (c) => {
  const source = c.req.query('source');
  const days = parseDaysParam(c.req.query('days'));

  if (source && !isValidSource(source)) {
    return c.json({ error: 'Invalid source parameter' }, 400);
  }

  if (days === null) {
    return c.json({ error: 'Invalid days parameter. Must be an integer from 1 to 90' }, 400);
  }

  const db = getDatabase();
  const sinceModifier = `-${days - 1} days`;
  const sourceFilter = source ? 'AND source = ?' : '';
  const sourceCostFilter = source ? 'AND s.source = ?' : '';
  const params: Array<string | number> = [
    sinceModifier,
    days,
    sinceModifier,
    ...(source ? [source] : []),
  ];
  const costParams: SqlParam[] = [
    sinceModifier,
    ...(source ? [source] : []),
  ];

  const rows = db.prepare(`
    WITH RECURSIVE day_series(day, n) AS (
      SELECT date('now', ?), 1
      UNION ALL
      SELECT date(day, '+1 day'), n + 1
      FROM day_series
      WHERE n < ?
    ),
    session_daily AS (
      SELECT
        date(started_at) AS day,
        COUNT(*) AS session_count,
        COALESCE(SUM(total_input_tokens), 0) AS input_tokens,
        COALESCE(SUM(total_output_tokens), 0) AS output_tokens,
        COALESCE(SUM(total_cache_read_tokens), 0) AS cache_read_tokens,
        COALESCE(SUM(total_cache_write_tokens), 0) AS cache_write_tokens,
        COALESCE(SUM(total_reasoning_tokens), 0) AS reasoning_tokens,
        COALESCE(SUM(${sessionTotalTokensExpr()}), 0) AS total_tokens
      FROM sessions
      WHERE started_at IS NOT NULL
        AND date(started_at) >= date('now', ?)
        AND date(started_at) <= date('now')
        ${sourceFilter}
      GROUP BY date(started_at)
    )
    SELECT
      ds.day AS date,
      COALESCE(sd.session_count, 0) AS session_count,
      COALESCE(sd.input_tokens, 0) AS input_tokens,
      COALESCE(sd.output_tokens, 0) AS output_tokens,
      COALESCE(sd.cache_read_tokens, 0) AS cache_read_tokens,
      COALESCE(sd.cache_write_tokens, 0) AS cache_write_tokens,
      COALESCE(sd.reasoning_tokens, 0) AS reasoning_tokens,
      COALESCE(sd.total_tokens, 0) AS total_tokens
    FROM day_series ds
    LEFT JOIN session_daily sd ON sd.day = ds.day
    ORDER BY ds.day ASC
  `).all(...params) as Array<{
    date: string;
    session_count: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    reasoning_tokens: number;
    total_tokens: number;
  }>;

  const costRows = getSessionCostRows(
    db,
    `
      WHERE s.started_at IS NOT NULL
        AND date(s.started_at) >= date('now', ?)
        AND date(s.started_at) <= date('now')
        ${sourceCostFilter}
    `,
    costParams,
  );
  const costByDate = new Map<string, CostRollup>();
  const rowsByDate = new Map<string, SessionCostRow[]>();

  for (const row of costRows) {
    if (!row.day) continue;
    rowsByDate.set(row.day, [...(rowsByDate.get(row.day) ?? []), row]);
  }

  for (const [day, dayRows] of rowsByDate) {
    costByDate.set(day, rollUpSessionCosts(dayRows));
  }

  return c.json({
    days: rows.map((row) => {
      const costSummary = costByDate.get(row.date);
      return {
        date: row.date,
        sessionCount: row.session_count,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        cacheReadTokens: row.cache_read_tokens,
        cacheWriteTokens: row.cache_write_tokens,
        reasoningTokens: row.reasoning_tokens,
        totalTokens: row.total_tokens,
        cost: costSummary?.cost ?? null,
        pricingStatus: costSummary?.pricingStatus ?? 'unknown',
      };
    }),
  });
});

// ============================================================================
// 3. GET /api/v1/overview/top-models (DATA-102)
// ============================================================================

overviewRoutes.get('/api/v1/overview/top-models', (c) => {
  const source = c.req.query('source');
  const window = c.req.query('window') || '7d';
  const rawLimit = parseInt(c.req.query('limit') || '10', 10);
  const sortBy = c.req.query('sortBy') || 'tokens';

  // Validate source
  if (source && !isValidSource(source)) {
    return c.json({ error: 'Invalid source parameter' }, 400);
  }

  // Validate sortBy
  const validSortBy = ['tokens', 'cost'];
  if (sortBy && !validSortBy.includes(sortBy)) {
    return c.json({ error: 'Invalid sortBy parameter. Must be "tokens" or "cost"' }, 400);
  }

  // Validate and cap limit
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 10 : rawLimit, 1), 50);

  const dateCondition = getDateCondition('s.started_at', window);

  const db = getDatabase();

  const conditions: string[] = [];
  const params: SqlParam[] = [];

  if (source) {
    conditions.push('s.source = ?');
    params.push(source);
  }

  if (dateCondition) {
    conditions.push(dateCondition);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total tokens across all models for share percentage
  const totalRow = db.prepare(`
    SELECT COALESCE(SUM(${sessionTotalTokensExpr('s')}), 0) as total_tokens
    FROM sessions s
    ${whereClause}
  `).get(...params) as { total_tokens: number };

  // Get per-model breakdown without duplicating session totals across messages.
  // A session can contain many message rows, empty-string model placeholders, and
  // synthetic control responses; choose the latest real model per session first,
  // then aggregate session-level token totals by that canonical model.
  const models = db.prepare(`
    WITH filtered_sessions AS (
      SELECT
        s.id,
        s.total_output_tokens,
        s.total_input_tokens,
        s.total_cache_read_tokens,
        s.total_cache_write_tokens,
        s.total_reasoning_tokens,
        ${sessionTotalTokensExpr('s')} AS total_tokens
      FROM sessions s
      ${whereClause}
    ),
    modeled_sessions AS (
      SELECT
        fs.id AS session_id,
        (
          SELECT m.model
          FROM messages m
          WHERE m.session_id = fs.id
            AND TRIM(COALESCE(m.model, '')) <> ''
            AND m.model <> '<synthetic>'
          ORDER BY m.ordinal DESC
          LIMIT 1
        ) AS model
      FROM filtered_sessions fs
    )
    SELECT
      ms.model AS name,
      COUNT(*) AS session_count,
      COALESCE(SUM(fs.total_output_tokens), 0) AS output_tokens,
      COALESCE(SUM(fs.total_input_tokens), 0) AS input_tokens,
      COALESCE(SUM(fs.total_cache_read_tokens), 0) AS cache_read_tokens,
      COALESCE(SUM(fs.total_cache_write_tokens), 0) AS cache_write_tokens,
      COALESCE(SUM(fs.total_reasoning_tokens), 0) AS reasoning_tokens,
      COALESCE(SUM(fs.total_tokens), 0) AS total_tokens
    FROM filtered_sessions fs
    JOIN modeled_sessions ms ON ms.session_id = fs.id
    WHERE ms.model IS NOT NULL
    GROUP BY ms.model
    ORDER BY total_tokens DESC
  `).all(...params) as Array<{
    name: string;
    session_count: number;
    output_tokens: number;
    input_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    reasoning_tokens: number;
    total_tokens: number;
  }>;

  const mapped = models.map((m) => {
    const costEstimate = estimateModelCost(m.name, {
      inputTokens: m.input_tokens,
      outputTokens: m.output_tokens,
      cacheReadTokens: m.cache_read_tokens,
      cacheWriteTokens: m.cache_write_tokens,
      reasoningTokens: m.reasoning_tokens,
    });

    return {
      name: m.name,
      sessionCount: m.session_count,
      inputTokens: m.input_tokens,
      outputTokens: m.output_tokens,
      cacheReadTokens: m.cache_read_tokens,
      cacheWriteTokens: m.cache_write_tokens,
      reasoningTokens: m.reasoning_tokens,
      totalTokens: m.total_tokens,
      sharePercent:
        totalRow.total_tokens > 0
          ? Math.round((m.total_tokens / totalRow.total_tokens) * 10000) / 100
          : 0,
      cost: costEstimate.cost,
      pricingStatus: costEstimate.pricingStatus,
    };
  });

  // Sort by cost when requested (nulls last)
  const result = sortBy === 'cost'
    ? [...mapped].sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1))
    : mapped;

  return c.json({ models: result.slice(0, limit) });
});

// ============================================================================
// 3. GET /api/v1/overview/top-projects (DATA-103)
// ============================================================================

overviewRoutes.get('/api/v1/overview/top-projects', (c) => {
  const source = c.req.query('source');
  const window = c.req.query('window') || '7d';
  const rawLimit = parseInt(c.req.query('limit') || '10', 10);
  const sortBy = c.req.query('sortBy') || 'tokens';

  if (!['tokens', 'cost'].includes(sortBy)) {
    return c.json({ error: 'Invalid sortBy parameter. Must be "tokens" or "cost"' }, 400);
  }

  // Validate source
  if (source && !isValidSource(source)) {
    return c.json({ error: 'Invalid source parameter' }, 400);
  }

  // Validate and cap limit
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 10 : rawLimit, 1), 50);

  const dateCondition = getDateCondition('s.started_at', window);

  const db = getDatabase();

  const conditions: string[] = [];
  const params: SqlParam[] = [];

  if (source) {
    conditions.push('s.source = ?');
    params.push(source);
  }

  if (dateCondition) {
    conditions.push(dateCondition);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total tokens across all projects for rank weight
  const totalRow = db.prepare(`
    SELECT COALESCE(SUM(${sessionTotalTokensExpr('s')}), 0) as total_tokens
    FROM sessions s
    ${whereClause}
  `).get(...params) as { total_tokens: number };

  const projects = db.prepare(`
    SELECT
      s.project AS project,
      COUNT(*) as session_count,
      COALESCE(SUM(s.user_message_count), 0) as turn_count,
      COALESCE(SUM(s.total_input_tokens), 0) as input_tokens,
      COALESCE(SUM(s.total_output_tokens), 0) as output_tokens,
      COALESCE(SUM(s.total_cache_read_tokens), 0) as cache_read_tokens,
      COALESCE(SUM(s.total_cache_write_tokens), 0) as cache_write_tokens,
      COALESCE(SUM(s.total_reasoning_tokens), 0) as reasoning_tokens,
      COALESCE(SUM(${sessionTotalTokensExpr('s')}), 0) as total_tokens
    FROM sessions s
    ${whereClause}
    GROUP BY s.project
    ORDER BY total_tokens DESC
  `).all(...params) as Array<{
    project: string;
    session_count: number;
    turn_count: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    reasoning_tokens: number;
    total_tokens: number;
  }>;

  const costRows = getSessionCostRows(db, whereClause, params);
  const costByProject = new Map<string, CostRollup>();

  for (const project of new Set(costRows.map((row) => row.project))) {
    costByProject.set(
      project,
      rollUpSessionCosts(costRows.filter((row) => row.project === project)),
    );
  }

  const mapped = projects.map((p) => {
    const costSummary = costByProject.get(p.project);
    return {
      project: p.project,
      sessionCount: p.session_count,
      turnCount: p.turn_count,
      inputTokens: p.input_tokens,
      outputTokens: p.output_tokens,
      cacheReadTokens: p.cache_read_tokens,
      cacheWriteTokens: p.cache_write_tokens,
      reasoningTokens: p.reasoning_tokens,
      totalTokens: p.total_tokens,
      rankWeight:
        totalRow.total_tokens > 0
          ? Math.round((p.total_tokens / totalRow.total_tokens) * 10000) / 100
          : 0,
      cost: costSummary?.cost ?? null,
      pricingStatus: costSummary?.pricingStatus ?? ('unknown' as PricingStatus),
    };
  });

  const result = sortBy === 'cost'
    ? [...mapped].sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1))
    : mapped;

  return c.json({ projects: result.slice(0, limit) });
});

// ============================================================================
// 4. GET /api/v1/overview/starred (DATA-104)
// ============================================================================

overviewRoutes.get('/api/v1/overview/starred', (c) => {
  const source = c.req.query('source');
  const rawLimit = parseInt(c.req.query('limit') || '20', 10);

  // Validate source
  if (source && !isValidSource(source)) {
    return c.json({ error: 'Invalid source parameter' }, 400);
  }

  // Validate and cap limit
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 20 : rawLimit, 1), 100);

  const db = getDatabase();

  const conditions: string[] = [];
  const params: SqlParam[] = [];

  if (source) {
    conditions.push('s.source = ?');
    params.push(source);
  }

  const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

  const starred = db.prepare(`
    SELECT
      s.id,
      s.name,
      s.source,
      s.project,
      s.status,
      s.started_at as startedAt,
      ${UPDATED_AT_EXPR} as updatedAt,
      ss.starred_at as starredAt
    FROM session_stars ss
    JOIN sessions s ON s.id = ss.session_id
    WHERE 1=1 ${whereClause}
    ORDER BY ss.starred_at DESC
    LIMIT ?
  `).all(...params, limit) as Array<{
    id: string;
    name: string | null;
    source: string;
    project: string;
    status: string;
    startedAt: string | null;
    updatedAt: string;
    starredAt: string;
  }>;

  return c.json({
    starred: starred.map((row) => ({
      id: row.id,
      name: row.name || undefined,
      source: row.source,
      project: row.project,
      status: row.status,
      startedAt: row.startedAt,
      updatedAt: row.updatedAt || undefined,
      starredAt: row.starredAt,
    })),
  });
});

// ============================================================================
// 5. GET /api/v1/overview/timeline (DATA-105)
// ============================================================================

overviewRoutes.get('/api/v1/overview/timeline', (c) => {
  const source = c.req.query('source');
  const rawLimit = parseInt(c.req.query('limit') || '50', 10);

  // Validate source
  if (source && !isValidSource(source)) {
    return c.json({ error: 'Invalid source parameter' }, 400);
  }

  // Validate and cap limit
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 200);

  const db = getDatabase();

  const sourceFilter = source ? `AND source = ?` : '';
  const sourceFilterSync = source ? `AND source_type = ?` : '';

  // Each UNION branch has its own params array for clarity
  const p1: string[] = source ? [source] : [];
  const p2: string[] = source ? [source] : [];
  const p3: string[] = source ? [source] : [];
  const p4: string[] = source ? [source] : [];
  const p5: string[] = source ? [source] : [];

  const timeline = db.prepare(`
    SELECT * FROM (
      SELECT id, source, project, name, 'session_started' as event_type,
             started_at as event_time, status, NULL as error_message
      FROM sessions
      WHERE started_at IS NOT NULL ${sourceFilter}

      UNION ALL

      SELECT id, source, project, name, 'session_completed' as event_type,
             ended_at as event_time, status, NULL as error_message
      FROM sessions
      WHERE ended_at IS NOT NULL AND status IN ('idle', 'aborted')
      ${source ? 'AND source = ?' : ''}

      UNION ALL

      SELECT id, source, project, name, 'session_error' as event_type,
             COALESCE(ended_at, started_at) as event_time, status,
             termination_status as error_message
      FROM sessions
      WHERE status = 'error' ${sourceFilter}

      UNION ALL

      SELECT id, source, project, agent_name as name,
             'automation_completed' as event_type,
             ended_at as event_time, status, NULL as error_message
      FROM sessions
      WHERE agent_name IS NOT NULL
        AND user_message_count = 0
        AND ended_at IS NOT NULL
        AND status IN ('idle', 'aborted')
      ${source ? 'AND source = ?' : ''}

      UNION ALL

      SELECT source_type as id, source_type as source, '' as project, '' as name,
             'sync_error' as event_type, datetime('now') as event_time,
             'error' as status, last_error as error_message
      FROM sync_status
      WHERE last_error IS NOT NULL ${sourceFilterSync}
    )
    ORDER BY event_time DESC
    LIMIT ?
  `).all(
    ...p1,
    ...p2,
    ...p3,
    ...p4,
    ...p5,
    limit,
  ) as Array<{
    id: string;
    source: string;
    project: string;
    name: string;
    event_type: string;
    event_time: string | null;
    status: string;
    error_message: string | null;
  }>;

  return c.json({
    timeline: timeline.map((row) => ({
      id: buildTimelineEventId(row),
      source: row.source,
      eventType: row.event_type,
      eventTime: row.event_time,
      project: row.project || undefined,
      name: row.name || undefined,
      status: row.status,
      errorMessage: row.error_message || undefined,
    })),
  });
});

function buildTimelineEventId(row: {
  id: string;
  source: string;
  event_type: string;
  event_time: string | null;
}): string {
  return [
    row.source,
    row.id,
    row.event_type,
    row.event_time || 'unknown',
  ].join(':');
}

// ============================================================================
// 6. GET /api/v1/overview/capabilities (DATA-106)
// ============================================================================

overviewRoutes.get('/api/v1/overview/capabilities', (c) => {
  return c.json({
    capabilities: SOURCE_CAPABILITIES,
    sources: [...VALID_SOURCES],
  });
});

// ============================================================================
// 7. GET /api/v1/overview/agents (OPEN-101)
// ============================================================================

overviewRoutes.get('/api/v1/overview/agents', (c) => {
  const source = c.req.query('source');

  // Source is required for agents endpoint
  if (!source) {
    return c.json({ error: 'source query parameter is required' }, 400);
  }

  if (!isValidSource(source)) {
    return c.json({ error: 'Invalid source parameter' }, 400);
  }

  const db = getDatabase();

  const rows = db.prepare(`
    SELECT
      s.agent_name AS name,
      COUNT(DISTINCT s.id) AS session_count,
      MAX(s.started_at) AS last_active_at,
      (
        SELECT s2.status
        FROM sessions s2
        WHERE s2.source = s.source
          AND s2.agent_name = s.agent_name
        ORDER BY COALESCE(s2.ended_at, s2.started_at) DESC
        LIMIT 1
      ) AS latest_status,
      COALESCE(
        (SELECT COUNT(*) FROM tool_calls tc WHERE tc.session_id IN (
          SELECT s3.id FROM sessions s3 WHERE s3.source = s.source AND s3.agent_name = s.agent_name
        )),
        0
      ) AS tool_call_count
    FROM sessions s
    WHERE s.source = ? AND s.agent_name IS NOT NULL
    GROUP BY s.agent_name
    ORDER BY last_active_at DESC
  `).all(source) as Array<{
    name: string;
    session_count: number;
    last_active_at: string | null;
    latest_status: string;
    tool_call_count: number;
  }>;

  return c.json({
    agents: rows.map((row) => ({
      name: row.name,
      sessionCount: row.session_count,
      toolCallCount: row.tool_call_count,
      lastActiveAt: row.last_active_at,
      latestStatus: row.latest_status,
    })),
  });
});

// ============================================================================
// 8b. GET /api/v1/overview/automations (OVR-104)
// ============================================================================

overviewRoutes.get('/api/v1/overview/automations', (c) => {
  const source = c.req.query('source');

  if (source && !isValidSource(source)) {
    return c.json({ error: 'Invalid source parameter' }, 400);
  }
  const requestedSource = source as FileAutomationSummary['source'] | undefined;

  const db = getDatabase();

  const conditions = ['s.agent_name IS NOT NULL', 's.user_message_count = 0'];
  const params: string[] = [];
  if (source) {
    conditions.unshift('s.source = ?');
    params.push(source);
  }

  // Session fallback: agent-named sessions with no user input.
  const rows = db.prepare(`
    SELECT
      s.source AS source,
      s.agent_name AS name,
      COUNT(DISTINCT s.id) AS session_count,
      MAX(s.started_at) AS last_active_at,
      (
        SELECT s2.status
        FROM sessions s2
        WHERE s2.source = s.source
          AND s2.agent_name = s.agent_name
          AND s2.user_message_count = 0
        ORDER BY COALESCE(s2.ended_at, s2.started_at) DESC
        LIMIT 1
      ) AS latest_status,
      COALESCE(
        (SELECT COUNT(*) FROM tool_calls tc WHERE tc.session_id IN (
          SELECT s3.id FROM sessions s3
          WHERE s3.source = s.source
            AND s3.agent_name = s.agent_name
            AND s3.user_message_count = 0
        )),
        0
      ) AS tool_call_count
    FROM sessions s
    WHERE ${conditions.join(' AND ')}
    GROUP BY s.source, s.agent_name
    ORDER BY last_active_at DESC
  `).all(...params) as Array<{
    source: string;
    name: string;
    session_count: number;
    last_active_at: string | null;
    latest_status: string;
    tool_call_count: number;
  }>;

  return c.json({
    automations: mergeAutomationSummaries(
      rows.map((row): FileAutomationSummary => ({
        source: row.source as FileAutomationSummary['source'],
        name: row.name,
        sessionCount: row.session_count,
        toolCallCount: row.tool_call_count,
        lastActiveAt: row.last_active_at,
        latestStatus: row.latest_status,
      })),
      readFileBackedAutomations(requestedSource),
    ).map((row) => ({
      id: row.id,
      source: row.source,
      name: row.name,
      sessionCount: row.sessionCount,
      toolCallCount: row.toolCallCount,
      lastActiveAt: row.lastActiveAt,
      latestStatus: row.latestStatus,
      schedule: row.schedule,
      nextRunAt: row.nextRunAt,
      model: row.model,
    })),
  });
});

type AutomationEndpointRow = FileAutomationSummary;

function mergeAutomationSummaries(
  sessionRows: AutomationEndpointRow[],
  fileRows: AutomationEndpointRow[],
): AutomationEndpointRow[] {
  const merged = new Map<string, AutomationEndpointRow>();

  for (const row of [...sessionRows, ...fileRows]) {
    const key = `${row.source}:${row.name.trim().toLowerCase()}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...row });
      continue;
    }

    const lastActiveAt = laterDate(existing.lastActiveAt, row.lastActiveAt);
    merged.set(key, {
      ...existing,
      ...row,
      id: existing.id ?? row.id,
      schedule: existing.schedule ?? row.schedule,
      nextRunAt: existing.nextRunAt ?? row.nextRunAt,
      model: existing.model ?? row.model,
      sessionCount: Math.max(existing.sessionCount, row.sessionCount),
      toolCallCount: Math.max(existing.toolCallCount, row.toolCallCount),
      lastActiveAt,
      latestStatus: lastActiveAt === row.lastActiveAt ? row.latestStatus : existing.latestStatus,
    });
  }

  return [...merged.values()].sort((a, b) => {
    const at = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
    const bt = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
    if (bt !== at) return bt - at;
    return a.name.localeCompare(b.name);
  });
}

function laterDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

// ============================================================================
// 8. GET /api/v1/overview/status (OPEN-103)
// ============================================================================

overviewRoutes.get('/api/v1/overview/status', async (c) => {
  // Dynamic import to avoid circular dependency with index.ts at module load time
  let ctx: ServiceContext | null = null;
  try {
    const mod = await import('../index.js');
    ctx = mod.getServiceContext();
  } catch {
    // Service context not available (e.g. in test environment without full service)
  }

  // Ingest status
  const ingest = {
    status: ctx ? 'ok' : 'error',
    uptime: process.uptime(),
    db: ctx?.db ? 'connected' as const : 'disconnected' as const,
  };

  // Watcher status
  const watcherStatus = ctx?.watcher?.getStatus();
  const watcher = {
    status: watcherStatus?.running ? 'watching' as const : 'stopped' as const,
    filesWatched: watcherStatus?.filesWatched ?? 0,
    lastSyncAt: watcherStatus?.lastSyncAt ?? null,
  };

  const sync = ctx?.syncScheduler?.getStatus() ?? null;

  // Gateway status — placeholder per CONTEXT.md deferred ideas
  const gateway = {
    status: 'disconnected' as const,
  };

  return c.json({ ingest, watcher, sync, gateway });
});
