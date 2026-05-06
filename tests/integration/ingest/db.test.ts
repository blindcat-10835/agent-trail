import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase, initSchema, closeDatabase } from '@/ingest/db';

describe('ingest database integration tests', () => {
  beforeEach(() => {
    // TODO: Set up test database
  });

  afterEach(() => {
    // TODO: Clean up test database
  });

  describe('schema initialization', () => {
    it('should create all tables', () => {
      // TODO: Implement test
      // Verify: sessions, messages, tool_calls, tool_result_events, turns tables exist
    });

    it('should create indexes', () => {
      // TODO: Implement test
      // Verify: indexes on sessions (source, project, started_at), messages (session_id, ordinal)
    });
  });

  describe('session CRUD', () => {
    it('should insert session', () => {
      // TODO: Implement test (Plan 02-02b)
    });

    it('should update session', () => {
      // TODO: Implement test (Plan 02-02b)
    });

    it('should query sessions', () => {
      // TODO: Implement test (Plan 02-03)
    });
  });

  describe('message CRUD', () => {
    it('should insert messages', () => {
      // TODO: Implement test (Plan 02-02b)
    });

    it('should query messages with filters', () => {
      // TODO: Implement test (Plan 02-03)
    });
  });
});
