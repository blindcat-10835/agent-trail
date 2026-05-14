import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '@/ingest/config';

const KEYS = [
  'INGEST_PARSE_CONCURRENCY',
  'INGEST_SQLITE_BATCH_SIZE',
  'INGEST_SYNC_HISTORY_LIMIT',
];

describe('ingest config throughput bounds', () => {
  afterEach(() => {
    for (const key of KEYS) delete process.env[key];
    vi.restoreAllMocks();
  });

  it('uses bounded defaults', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const config = loadConfig();

    expect(config.parseConcurrency).toBe(1);
    expect(config.sqliteBatchSize).toBe(500);
    expect(config.syncHistoryLimit).toBe(20);
  });

  it('accepts valid throughput values', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.INGEST_PARSE_CONCURRENCY = '4';
    process.env.INGEST_SQLITE_BATCH_SIZE = '5000';
    process.env.INGEST_SYNC_HISTORY_LIMIT = '100';

    const config = loadConfig();

    expect(config.parseConcurrency).toBe(4);
    expect(config.sqliteBatchSize).toBe(5000);
    expect(config.syncHistoryLimit).toBe(100);
  });

  it('rejects invalid parse concurrency', () => {
    process.env.INGEST_PARSE_CONCURRENCY = '5';

    expect(() => loadConfig()).toThrow('INGEST_PARSE_CONCURRENCY');
  });

  it('rejects invalid sqlite batch size', () => {
    process.env.INGEST_SQLITE_BATCH_SIZE = '5001';

    expect(() => loadConfig()).toThrow('INGEST_SQLITE_BATCH_SIZE');
  });

  it('rejects invalid sync history limit', () => {
    process.env.INGEST_SYNC_HISTORY_LIMIT = '0';

    expect(() => loadConfig()).toThrow('INGEST_SYNC_HISTORY_LIMIT');
  });
});
