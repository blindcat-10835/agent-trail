import { afterEach, describe, expect, it } from 'vitest';
import { getIngestBaseUrl } from './ingest-url.js';

describe('getIngestBaseUrl', () => {
  afterEach(() => {
    delete process.env.INGEST_URL;
    delete process.env.INGEST_PORT;
  });

  it('prefers INGEST_URL when provided', () => {
    process.env.INGEST_URL = 'http://localhost:7004';
    process.env.INGEST_PORT = '8078';

    expect(getIngestBaseUrl()).toBe('http://localhost:7004');
  });

  it('falls back to INGEST_PORT when INGEST_URL is missing', () => {
    process.env.INGEST_PORT = '7004';

    expect(getIngestBaseUrl()).toBe('http://localhost:7004');
  });

  it('falls back to default port when no env is set', () => {
    expect(getIngestBaseUrl()).toBe('http://localhost:8078');
  });
});
