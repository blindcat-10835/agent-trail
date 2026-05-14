import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSyncScheduler } from '@/ingest/src/sync-scheduler';
import type { SyncResult } from '@/ingest/sync';

function result(overrides?: Partial<SyncResult>): SyncResult {
  return {
    sessionsInserted: 0,
    sessionsUpdated: 0,
    messagesInserted: 0,
    toolCallsInserted: 0,
    toolResultEventsInserted: 0,
    errors: [],
    metrics: {
      filesConsidered: 0,
      filesSkippedBeforeParse: 0,
      filesParsed: 0,
      filesParsedFully: 0,
      filesParsedIncrementally: 0,
      incrementalFallbacks: 0,
      largestFileBytes: 0,
    },
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('createSyncScheduler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs queued sync jobs serially', async () => {
    const first = deferred<SyncResult>();
    const order: string[] = [];
    const syncSource = vi
      .fn()
      .mockImplementationOnce(async () => {
        order.push('first:start');
        const value = await first.promise;
        order.push('first:end');
        return value;
      })
      .mockImplementationOnce(async () => {
        order.push('second');
        return result();
      });

    const scheduler = createSyncScheduler({
      syncSource,
      syncPaths: vi.fn(),
    });

    const firstRun = scheduler.enqueueFullSource('codex', 'background');
    const secondRun = scheduler.enqueueFullSource('claude-code', 'periodic');

    await Promise.resolve();
    expect(scheduler.getStatus().active).toBe(true);
    expect(scheduler.getStatus().queued).toBe(true);
    expect(order).toEqual(['first:start']);

    first.resolve(result());
    await Promise.all([firstRun, secondRun]);

    expect(order).toEqual(['first:start', 'first:end', 'second']);
    expect(syncSource).toHaveBeenCalledTimes(2);
    expect(scheduler.getStatus().active).toBe(false);
    expect(scheduler.getStatus().lastDurationMs).not.toBeNull();
  });

  it('coalesces duplicate queued requests while active', async () => {
    const blocker = deferred<SyncResult>();
    const syncSource = vi
      .fn()
      .mockImplementationOnce(() => blocker.promise)
      .mockResolvedValue(result());

    const scheduler = createSyncScheduler({
      syncSource,
      syncPaths: vi.fn(),
    });

    const firstRun = scheduler.enqueueFullSource('codex', 'background');
    const queuedA = scheduler.enqueueFullSource('claude-code', 'periodic');
    const queuedB = scheduler.enqueueFullSource('claude-code', 'periodic');

    await Promise.resolve();
    expect(queuedA).toBe(queuedB);
    expect(scheduler.getStatus().queuedReasons).toEqual(['periodic']);

    blocker.resolve(result());
    await Promise.all([firstRun, queuedA, queuedB]);

    expect(syncSource).toHaveBeenCalledTimes(2);
  });

  it('coalesces duplicate requests with the active run', async () => {
    const blocker = deferred<SyncResult>();
    const syncSource = vi.fn().mockImplementation(() => blocker.promise);

    const scheduler = createSyncScheduler({
      syncSource,
      syncPaths: vi.fn(),
    });

    const activeRun = scheduler.enqueueFullSource('codex', 'background');

    await Promise.resolve();
    const duplicate = scheduler.enqueueFullSource('codex', 'periodic');

    expect(duplicate).toBe(activeRun);
    expect(scheduler.getStatus().queued).toBe(false);

    blocker.resolve(result());
    await Promise.all([activeRun, duplicate]);

    expect(syncSource).toHaveBeenCalledTimes(1);
  });

  it('reports errors without leaving scheduler active', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const scheduler = createSyncScheduler({
      syncSource: vi.fn().mockRejectedValue(new Error('sync failed')),
      syncPaths: vi.fn(),
    });

    await expect(scheduler.enqueueFullSource('codex', 'manual')).rejects.toThrow('sync failed');

    const status = scheduler.getStatus();
    expect(status.active).toBe(false);
    expect(status.lastError).toBe('sync failed');
  });

  it('caps recent history at 20 runs by default', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const scheduler = createSyncScheduler({
      syncSource: vi.fn().mockResolvedValue(result()),
      syncPaths: vi.fn(),
    });

    for (let i = 0; i < 25; i++) {
      await scheduler.enqueueFullSource('codex', 'manual', { force: i % 2 === 0 });
    }

    expect(scheduler.getDebugStatus().recentRuns).toHaveLength(20);
  });

  it('reports active file and offset from sync progress', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const blocker = deferred<SyncResult>();
    const syncSource = vi.fn().mockImplementation((_source, options) => {
      options.observer.onFileStart({
        sourceType: 'codex',
        filePath: '/tmp/session.jsonl',
        fileSize: 2048,
        currentOffset: 1024,
        filesConsidered: 1,
        filesSkippedBeforeParse: 0,
        filesParsed: 0,
        largestFileBytes: 2048,
      });
      return blocker.promise;
    });
    const scheduler = createSyncScheduler({ syncSource, syncPaths: vi.fn() });

    const run = scheduler.enqueueFullSource('codex', 'watcher');
    await Promise.resolve();

    const status = scheduler.getStatus();
    expect(status.currentFile).toBe('/tmp/session.jsonl');
    expect(status.currentFileSize).toBe(2048);
    expect(status.currentOffset).toBe(1024);

    blocker.resolve(result());
    await run;
  });
});
