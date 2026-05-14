import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '@/ingest';

describe('ingest API integration tests', () => {
  beforeAll(async () => {
    // Start ingest service for testing
    // TODO: Set up test database
  });

  afterAll(async () => {
    // Stop ingest service
    // TODO: Clean up test database
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      // TODO: Implement test
      // Verify: status='ok', version present, uptime present, database='connected'
    });
  });

  describe('GET /api/v1/debug/sync', () => {
    it('returns sync debug sections', async () => {
      const res = await app.request('/api/v1/debug/sync');
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty('activeRun');
      expect(body).toHaveProperty('recentRuns');
      expect(body).toHaveProperty('metrics');
      expect(body).toHaveProperty('config');
      expect(body.config).toHaveProperty('parseConcurrency');
      expect(body.config).toHaveProperty('sqliteBatchSize');
      expect(body.config).toHaveProperty('historyLimit');
    });
  });

  describe('GET /version', () => {
    it('should return version info', async () => {
      // TODO: Implement test
      // Verify: version present, sources array includes openclaw
    });
  });

  describe('sources API', () => {
    it('should list discovered sources', async () => {
      // TODO: Implement test (Plan 02-02b)
    });

    it('should trigger sync', async () => {
      // TODO: Implement test (Plan 02-02b)
    });
  });

  describe('sessions API', () => {
    it('should list sessions', async () => {
      // TODO: Implement test (Plan 02-03)
    });

    it('should get session by ID', async () => {
      // TODO: Implement test (Plan 02-03)
    });

    it('should get turns for session', async () => {
      // TODO: Implement test (Plan 02-03)
    });
  });
});
