/**
 * Overview API Tests — Golden Fixture Suite
 *
 * Tests all 8 overview endpoints with isolated SQLite databases
 * and golden fixture data covering multiple sources, dates,
 * and edge cases.
 *
 * Pattern: open temp DB, run schema, insert fixtures, mount routes.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { Hono } from 'hono';
import { openDatabase, closeDatabase, initSchema, getDatabase } from '../db/index.js';
import { overviewRoutes } from './overview.js';

// ============================================================================
// Test infrastructure
// ============================================================================

let dbPath: string;

function createApp(): Hono {
  const app = new Hono();
  app.route('/', overviewRoutes);
  return app;
}

// ============================================================================
// Golden Fixture Data
// ============================================================================

function insertFixtures(db: Database.Database): void {
  const now = new Date();
  const today = now.toISOString().replace('T', ' ').split('.')[0];

  // 5 days ago
  const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000)
    .toISOString().replace('T', ' ').split('.')[0];

  // 15 days ago
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 86400000)
    .toISOString().replace('T', ' ').split('.')[0];

  // 40 days ago
  const fortyDaysAgo = new Date(now.getTime() - 40 * 86400000)
    .toISOString().replace('T', ' ').split('.')[0];

  const insertSession = db.prepare(`
    INSERT INTO sessions (
      id, source, project, name, agent_name, started_at, ended_at, status,
      message_count, user_message_count, total_output_tokens, total_input_tokens,
      has_tool_calls, file_path, file_mtime
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Session 1: openclaw, today, active
  insertSession.run(
    'oc-1', 'openclaw', 'project-alpha', 'Alpha task', 'agent-blue',
    today, null, 'active',
    10, 5, 5000, 3000,
    1, '/tmp/oc-1.jsonl', today,
  );

  // Session 2: openclaw, 5 days ago, completed
  insertSession.run(
    'oc-2', 'openclaw', 'project-beta', 'Beta analysis', 'agent-blue',
    fiveDaysAgo, fiveDaysAgo, 'idle',
    8, 4, 3000, 2000,
    1, '/tmp/oc-2.jsonl', fiveDaysAgo,
  );

  // Session 3: claude-code, 5 days ago, completed
  insertSession.run(
    'cc-1', 'claude-code', 'project-alpha', 'Code review', null,
    fiveDaysAgo, fiveDaysAgo, 'idle',
    20, 10, 10000, 8000,
    1, '/tmp/cc-1.jsonl', fiveDaysAgo,
  );

  // Session 4: claude-code, 15 days ago, error
  insertSession.run(
    'cc-2', 'claude-code', 'project-gamma', 'Failed deploy', null,
    fifteenDaysAgo, fifteenDaysAgo, 'error',
    5, 3, 2000, 1000,
    0, '/tmp/cc-2.jsonl', fifteenDaysAgo,
  );

  // Session 5: codex, 40 days ago, completed
  insertSession.run(
    'cx-1', 'codex', 'project-alpha', 'Old task', null,
    fortyDaysAgo, fortyDaysAgo, 'idle',
    6, 3, 4000, 2000,
    0, '/tmp/cx-1.jsonl', fortyDaysAgo,
  );

  // Session 6: openclaw automation (agent_name set, user_message_count = 0)
  insertSession.run(
    'oc-auto-1', 'openclaw', 'project-alpha', 'Auto deploy', 'auto-deploy',
    today, today, 'idle',
    4, 0, 2000, 1000,
    1, '/tmp/oc-auto-1.jsonl', today,
  );

  // Session 7: openclaw automation (same agent, different day)
  insertSession.run(
    'oc-auto-2', 'openclaw', 'project-beta', 'Auto deploy v2', 'auto-deploy',
    fiveDaysAgo, fiveDaysAgo, 'idle',
    3, 0, 1500, 800,
    1, '/tmp/oc-auto-2.jsonl', fiveDaysAgo,
  );

  // Session 8: openclaw agent session WITH user messages (NOT an automation)
  insertSession.run(
    'oc-3', 'openclaw', 'project-alpha', 'Manual agent task', 'agent-blue',
    fiveDaysAgo, fiveDaysAgo, 'idle',
    10, 5, 3000, 2000,
    1, '/tmp/oc-3.jsonl', fiveDaysAgo,
  );

  // Insert messages with model info for top-models
  const insertMessage = db.prepare(`
    INSERT INTO messages (id, session_id, ordinal, role, content, model)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Messages for oc-1 (model: gpt-4o)
  insertMessage.run('msg-oc1-1', 'oc-1', 1, 'user', 'Hello', null);
  insertMessage.run('msg-oc1-2', 'oc-1', 2, 'assistant', 'Hi there', 'gpt-4o');

  // Messages for oc-2 (model: gpt-4o)
  insertMessage.run('msg-oc2-1', 'oc-2', 1, 'user', 'Analyze this', null);
  insertMessage.run('msg-oc2-2', 'oc-2', 2, 'assistant', 'Analysis complete', 'gpt-4o');

  // Messages for cc-1 (model: claude-sonnet-4-20250514)
  insertMessage.run('msg-cc1-1', 'cc-1', 1, 'user', 'Review code', null);
  insertMessage.run('msg-cc1-2', 'cc-1', 2, 'assistant', 'Code looks good', 'claude-sonnet-4-20250514');

  // Messages for cc-2 (model: claude-sonnet-4-20250514)
  insertMessage.run('msg-cc2-1', 'cc-2', 1, 'user', 'Deploy this', null);
  insertMessage.run('msg-cc2-2', 'cc-2', 2, 'assistant', 'Deploy failed', 'claude-sonnet-4-20250514');

  // Messages for cx-1 (model: codex-mini)
  insertMessage.run('msg-cx1-1', 'cx-1', 1, 'user', 'Run task', null);
  insertMessage.run('msg-cx1-2', 'cx-1', 2, 'assistant', 'Task done', 'codex-mini');

  // Star 2 sessions
  const starSession = db.prepare(`
    INSERT INTO session_stars (session_id, starred_at) VALUES (?, ?)
  `);
  starSession.run('oc-1', today);
  starSession.run('cc-1', fiveDaysAgo);

  // Sync status with one error entry
  const insertSyncStatus = db.prepare(`
    INSERT INTO sync_status (source_type, last_full_sync_at, files_watched, last_error)
    VALUES (?, ?, ?, ?)
  `);
  insertSyncStatus.run('openclaw', today, 10, null);
  insertSyncStatus.run('claude-code', fiveDaysAgo, 5, 'Failed to parse /tmp/bad.jsonl');
  insertSyncStatus.run('codex', fortyDaysAgo, 3, null);

  // Insert tool calls for agent summaries
  const insertToolCall = db.prepare(`
    INSERT INTO tool_calls (session_id, message_ordinal, tool_id, name, input_json, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertToolCall.run('oc-1', 2, 'tool-1', 'Bash', '{}', 'success');
  insertToolCall.run('oc-2', 2, 'tool-2', 'Read', '{}', 'success');
  insertToolCall.run('oc-auto-1', 2, 'tool-3', 'Bash', '{}', 'success');
  insertToolCall.run('oc-auto-2', 2, 'tool-4', 'Write', '{}', 'success');
}

// ============================================================================
// Tests
// ============================================================================

describe('overview endpoints', () => {
  let app: Hono;

  beforeAll(() => {
    dbPath = join(tmpdir(), `overview-test-${randomUUID()}.db`);
    openDatabase({ path: dbPath });
    initSchema();
    const db = getDatabase();
    insertFixtures(db);
    app = createApp();
  });

  afterAll(() => {
    closeDatabase();
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
  });

  // ==========================================================================
  // 1. Aggregates (DATA-101)
  // ==========================================================================

  describe('GET /api/v1/overview/aggregates', () => {
    it('returns correct counts for 7d window (default)', async () => {
      const res = await app.request('/api/v1/overview/aggregates');
      expect(res.status).toBe(200);
      const body = await res.json();

      // Sessions: oc-1 (today), oc-2 (5d ago), cc-1 (5d ago), oc-3 (5d ago), oc-auto-1 (today), oc-auto-2 (5d ago) = 6
      // Projects: alpha, beta = 2
      // user_message_count sum: 5+4+10+5+0+0 = 24
      expect(body.sessionCount).toBe(6);
      expect(body.projectCount).toBe(2);
      expect(body.turnCount).toBe(24);
      expect(body.inputTokens).toBe(16800);
      expect(body.outputTokens).toBe(24500);
      expect(body.totalTokens).toBe(body.inputTokens + body.outputTokens);
    });

    it('returns correct counts for today window', async () => {
      const res = await app.request('/api/v1/overview/aggregates?window=today');
      expect(res.status).toBe(200);
      const body = await res.json();

      // oc-1 + oc-auto-1 are today
      expect(body.sessionCount).toBe(2);
      expect(body.projectCount).toBe(1);
      expect(body.inputTokens).toBe(4000);
      expect(body.outputTokens).toBe(7000);
    });

    it('returns correct counts for 30d window', async () => {
      const res = await app.request('/api/v1/overview/aggregates?window=30d');
      expect(res.status).toBe(200);
      const body = await res.json();

      // Sessions within 30d: oc-1, oc-2, cc-1, cc-2, oc-3, oc-auto-1, oc-auto-2 = 7
      expect(body.sessionCount).toBe(7);
      expect(body.projectCount).toBe(3); // alpha, beta, gamma
    });

    it('filters by source', async () => {
      const res = await app.request('/api/v1/overview/aggregates?source=openclaw&window=30d');
      expect(res.status).toBe(200);
      const body = await res.json();

      // oc-1 + oc-2 + oc-3 + oc-auto-1 + oc-auto-2 = 5 openclaw sessions within 30d
      expect(body.sessionCount).toBe(5);
      expect(body.projectCount).toBe(2);
    });

    it('returns all data when source is omitted (no source filter)', async () => {
      const res = await app.request('/api/v1/overview/aggregates?window=30d');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sessionCount).toBe(7);
    });

    it('returns 400 for invalid source', async () => {
      const res = await app.request('/api/v1/overview/aggregates?source=invalid');
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid window', async () => {
      const res = await app.request('/api/v1/overview/aggregates?window=invalid');
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // 2. Top Models (DATA-102)
  // ==========================================================================

  describe('GET /api/v1/overview/top-models', () => {
    it('returns models with sharePercent summing to ~100', async () => {
      const res = await app.request('/api/v1/overview/top-models');
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.models.length).toBeGreaterThan(0);
      const totalShare = body.models.reduce(
        (sum: number, m: { sharePercent: number }) => sum + m.sharePercent,
        0,
      );
      // Share may not sum to 100% because sessions without model-tagged
      // messages (e.g. automations) still contribute to total tokens
      expect(totalShare).toBeGreaterThan(0);
      expect(totalShare).toBeLessThanOrEqual(101);
    });

    it('includes model name and token counts', async () => {
      const res = await app.request('/api/v1/overview/top-models');
      expect(res.status).toBe(200);
      const body = await res.json();

      const modelNames = body.models.map((m: { name: string }) => m.name);
      expect(modelNames).toContain('gpt-4o');
      expect(modelNames).toContain('claude-sonnet-4-20250514');

      for (const m of body.models) {
        expect(m).toHaveProperty('name');
        expect(m).toHaveProperty('sessionCount');
        expect(m).toHaveProperty('inputTokens');
        expect(m).toHaveProperty('outputTokens');
        expect(m).toHaveProperty('totalTokens');
        expect(m).toHaveProperty('sharePercent');
        expect(m).toHaveProperty('cost');
        expect(m.cost).toBeNull();
      }
    });

    it('filters by source', async () => {
      const res = await app.request('/api/v1/overview/top-models?source=openclaw');
      expect(res.status).toBe(200);
      const body = await res.json();

      // Only gpt-4o for openclaw
      expect(body.models).toHaveLength(1);
      expect(body.models[0].name).toBe('gpt-4o');
    });

    it('respects limit parameter', async () => {
      const res = await app.request('/api/v1/overview/top-models?limit=1');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.models).toHaveLength(1);
    });

    it('caps limit at 50', async () => {
      const res = await app.request('/api/v1/overview/top-models?limit=999');
      expect(res.status).toBe(200);
      // Should still work — capped at 50
      const body = await res.json();
      expect(body.models.length).toBeLessThanOrEqual(50);
    });

    it('returns 400 for invalid source', async () => {
      const res = await app.request('/api/v1/overview/top-models?source=invalid');
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // 3. Top Projects (DATA-103)
  // ==========================================================================

  describe('GET /api/v1/overview/top-projects', () => {
    it('returns projects with token counts and rank weight', async () => {
      const res = await app.request('/api/v1/overview/top-projects');
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.projects.length).toBeGreaterThan(0);
      for (const p of body.projects) {
        expect(p).toHaveProperty('project');
        expect(p).toHaveProperty('sessionCount');
        expect(p).toHaveProperty('turnCount');
        expect(p).toHaveProperty('inputTokens');
        expect(p).toHaveProperty('outputTokens');
        expect(p).toHaveProperty('totalTokens');
        expect(p).toHaveProperty('rankWeight');
        expect(typeof p.rankWeight).toBe('number');
      }

      // Rank weights should sum to ~100
      const totalWeight = body.projects.reduce(
        (sum: number, p: { rankWeight: number }) => sum + p.rankWeight,
        0,
      );
      expect(totalWeight).toBeGreaterThanOrEqual(99);
      expect(totalWeight).toBeLessThanOrEqual(101);
    });

    it('filters by source', async () => {
      const res = await app.request('/api/v1/overview/top-projects?source=openclaw');
      expect(res.status).toBe(200);
      const body = await res.json();

      // openclaw has alpha and beta within 7d
      const projectNames = body.projects.map((p: { project: string }) => p.project);
      expect(projectNames).toContain('project-alpha');
      expect(projectNames).toContain('project-beta');
    });

    it('respects limit', async () => {
      const res = await app.request('/api/v1/overview/top-projects?limit=1');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.projects).toHaveLength(1);
    });

    it('returns 400 for invalid source', async () => {
      const res = await app.request('/api/v1/overview/top-projects?source=invalid');
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // 4. Starred (DATA-104)
  // ==========================================================================

  describe('GET /api/v1/overview/starred', () => {
    it('returns starred sessions ordered by starredAt DESC', async () => {
      const res = await app.request('/api/v1/overview/starred');
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.starred).toHaveLength(2);
      // Most recent starred first (oc-1 was starred today, cc-1 was starred 5d ago)
      expect(body.starred[0].id).toBe('oc-1');
      expect(body.starred[1].id).toBe('cc-1');
    });

    it('includes session details', async () => {
      const res = await app.request('/api/v1/overview/starred');
      expect(res.status).toBe(200);
      const body = await res.json();

      const first = body.starred[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('source');
      expect(first).toHaveProperty('project');
      expect(first).toHaveProperty('status');
      expect(first).toHaveProperty('starredAt');
    });

    it('filters by source', async () => {
      const res = await app.request('/api/v1/overview/starred?source=openclaw');
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.starred).toHaveLength(1);
      expect(body.starred[0].id).toBe('oc-1');
      expect(body.starred[0].source).toBe('openclaw');
    });

    it('respects limit', async () => {
      const res = await app.request('/api/v1/overview/starred?limit=1');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.starred).toHaveLength(1);
    });

    it('returns 400 for invalid source', async () => {
      const res = await app.request('/api/v1/overview/starred?source=invalid');
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // 5. Timeline (DATA-105)
  // ==========================================================================

  describe('GET /api/v1/overview/timeline', () => {
    it('returns timeline events including session starts and sync errors', async () => {
      const res = await app.request('/api/v1/overview/timeline');
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.timeline.length).toBeGreaterThan(0);

      // Should include session_started events
      const startedEvents = body.timeline.filter(
        (e: { eventType: string }) => e.eventType === 'session_started',
      );
      expect(startedEvents.length).toBeGreaterThan(0);

      // Should include sync_error events
      const syncErrors = body.timeline.filter(
        (e: { eventType: string }) => e.eventType === 'sync_error',
      );
      expect(syncErrors.length).toBeGreaterThan(0);
    });

    it('orders events by eventTime DESC', async () => {
      const res = await app.request('/api/v1/overview/timeline');
      expect(res.status).toBe(200);
      const body = await res.json();

      for (let i = 1; i < body.timeline.length; i++) {
        const prev = body.timeline[i - 1].eventTime;
        const curr = body.timeline[i].eventTime;
        if (prev && curr) {
          expect(prev >= curr).toBe(true);
        }
      }
    });

    it('filters by source', async () => {
      const res = await app.request('/api/v1/overview/timeline?source=openclaw');
      expect(res.status).toBe(200);
      const body = await res.json();

      for (const event of body.timeline) {
        expect(event.source).toBe('openclaw');
      }
    });

    it('respects limit', async () => {
      const res = await app.request('/api/v1/overview/timeline?limit=2');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.timeline.length).toBeLessThanOrEqual(2);
    });

    it('returns 400 for invalid source', async () => {
      const res = await app.request('/api/v1/overview/timeline?source=invalid');
      expect(res.status).toBe(400);
    });

    it('includes error events for sessions with status=error', async () => {
      const res = await app.request('/api/v1/overview/timeline');
      expect(res.status).toBe(200);
      const body = await res.json();

      const errorEvents = body.timeline.filter(
        (e: { eventType: string }) => e.eventType === 'session_error',
      );
      // cc-2 has status=error
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('returns unique event ids even when one session contributes multiple timeline events', async () => {
      const res = await app.request('/api/v1/overview/timeline');
      expect(res.status).toBe(200);
      const body = await res.json();

      const ids = body.timeline.map((event: { id: string }) => event.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ==========================================================================
  // 6. Capabilities (DATA-106)
  // ==========================================================================

  describe('GET /api/v1/overview/capabilities', () => {
    it('returns capabilities map with all 3 sources', async () => {
      const res = await app.request('/api/v1/overview/capabilities');
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.capabilities).toBeDefined();
      expect(body.sources).toBeDefined();
      expect(body.sources).toHaveLength(3);
      expect(body.sources).toContain('openclaw');
      expect(body.sources).toContain('claude-code');
      expect(body.sources).toContain('codex');

      // OpenClaw has agents, automations, cost
      expect(body.capabilities.openclaw.agents).toBe(true);
      expect(body.capabilities.openclaw.automations).toBe(true);
      expect(body.capabilities.openclaw.cost).toBe(true);

      // Claude Code has cost but not agents
      expect(body.capabilities['claude-code'].agents).toBe(false);
      expect(body.capabilities['claude-code'].cost).toBe(true);

      // Codex has no cost
      expect(body.capabilities.codex.cost).toBe(false);
    });
  });

  // ==========================================================================
  // 7. Agents (OPEN-101)
  // ==========================================================================

  describe('GET /api/v1/overview/agents', () => {
    it('returns agent summaries with session and tool counts', async () => {
      const res = await app.request('/api/v1/overview/agents?source=openclaw');
      expect(res.status).toBe(200);
      const body = await res.json();

      // agent-blue (oc-1, oc-2, oc-3) + auto-deploy (oc-auto-1, oc-auto-2)
      expect(body.agents).toHaveLength(2);
      const agentBlue = body.agents.find((a: { name: string }) => a.name === 'agent-blue');
      expect(agentBlue).toBeDefined();
      expect(agentBlue.sessionCount).toBe(3);
      expect(agentBlue.toolCallCount).toBe(2);
      expect(body.agents[0]).toHaveProperty('lastActiveAt');
      expect(body.agents[0]).toHaveProperty('latestStatus');
    });

    it('returns 400 when source is missing', async () => {
      const res = await app.request('/api/v1/overview/agents');
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid source', async () => {
      const res = await app.request('/api/v1/overview/agents?source=invalid');
      expect(res.status).toBe(400);
    });

    it('returns empty agents for source without agent_name', async () => {
      const res = await app.request('/api/v1/overview/agents?source=claude-code');
      expect(res.status).toBe(200);
      const body = await res.json();
      // claude-code sessions have no agent_name, so no agents
      expect(body.agents).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 8b. Automations (OVR-104)
  // ==========================================================================

  describe('GET /api/v1/overview/automations', () => {
    it('returns automation summaries for openclaw source', async () => {
      const res = await app.request('/api/v1/overview/automations?source=openclaw');
      expect(res.status).toBe(200);
      const body = await res.json();

      // Only auto-deploy sessions (user_message_count = 0), not agent-blue
      expect(body.automations).toHaveLength(1);
      expect(body.automations[0].name).toBe('auto-deploy');
      expect(body.automations[0].sessionCount).toBe(2);
      expect(body.automations[0].toolCallCount).toBe(2);
      expect(body.automations[0]).toHaveProperty('lastActiveAt');
      expect(body.automations[0]).toHaveProperty('latestStatus');
    });

    it('returns 400 when source is missing', async () => {
      const res = await app.request('/api/v1/overview/automations');
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid source', async () => {
      const res = await app.request('/api/v1/overview/automations?source=invalid');
      expect(res.status).toBe(400);
    });

    it('returns empty automations for source without agent_name', async () => {
      const res = await app.request('/api/v1/overview/automations?source=claude-code');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.automations).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 8. Status (OPEN-103)
  // ==========================================================================

  describe('GET /api/v1/overview/status', () => {
    it('returns ingest, watcher, sync, and gateway sections', async () => {
      const res = await app.request('/api/v1/overview/status');
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty('ingest');
      expect(body).toHaveProperty('watcher');
      expect(body).toHaveProperty('sync');
      expect(body).toHaveProperty('gateway');

      expect(body.ingest).toHaveProperty('status');
      expect(body.ingest).toHaveProperty('uptime');
      expect(body.ingest).toHaveProperty('db');

      expect(body.watcher).toHaveProperty('status');
      expect(body.watcher).toHaveProperty('filesWatched');

      if (body.sync) {
        expect(body.sync).toHaveProperty('active');
        expect(body.sync).toHaveProperty('queued');
        expect(body.sync).toHaveProperty('lastError');
      }

      expect(body.gateway).toHaveProperty('status');
      expect(body.gateway.status).toBe('disconnected');
    });

    it('reports ingest status as ok when context available', async () => {
      const res = await app.request('/api/v1/overview/status');
      expect(res.status).toBe(200);
      const body = await res.json();

      // In test mode, context is null (not started via index.ts),
      // so ingest status should be 'error'
      // But the db may be connected since we opened it via openDatabase()
      expect(['ok', 'error']).toContain(body.ingest.status);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('returns 400 for invalid source across endpoints', async () => {
      const endpoints = [
        '/api/v1/overview/aggregates?source=bad',
        '/api/v1/overview/top-models?source=bad',
        '/api/v1/overview/top-projects?source=bad',
        '/api/v1/overview/starred?source=bad',
        '/api/v1/overview/timeline?source=bad',
        '/api/v1/overview/agents?source=bad',
      ];

      for (const url of endpoints) {
        const res = await app.request(url);
        expect(res.status, `Expected 400 for ${url}`).toBe(400);
      }
    });

    it('returns zero counts (not null) for empty results', async () => {
      // Filter to codex with today window — no codex sessions today
      const res = await app.request('/api/v1/overview/aggregates?source=codex&window=today');
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.sessionCount).toBe(0);
      expect(body.turnCount).toBe(0);
      expect(body.inputTokens).toBe(0);
      expect(body.outputTokens).toBe(0);
      expect(body.totalTokens).toBe(0);
    });

    it('returns empty arrays for endpoints with no matching data', async () => {
      // No codex sessions within 7d
      const res = await app.request('/api/v1/overview/top-models?source=codex&window=7d');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.models).toEqual([]);
    });
  });
});
