import type { SyncResult, SyncSourceOptions, SyncSourceType } from '../sync/index.js';

export type SyncReason = 'startup-warmup' | 'background' | 'watcher' | 'periodic' | 'manual';

export interface SyncRunMetrics {
  filesConsidered: number;
  filesSkippedBeforeParse: number;
  filesParsed: number;
  largestFileBytes: number;
}

export interface SyncSchedulerStatus extends SyncRunMetrics {
  active: boolean;
  activeReason: SyncReason | null;
  activeScope: string | null;
  queued: boolean;
  queuedReasons: SyncReason[];
  startedAt: string | null;
  lastCompletedAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
}

export interface SyncScheduler {
  enqueueFullSource(
    sourceType: SyncSourceType,
    reason: SyncReason,
    options?: SyncSourceOptions
  ): Promise<SyncResult>;
  enqueuePaths(
    sourceType: SyncSourceType,
    paths: string[],
    reason: SyncReason,
    options?: SyncSourceOptions
  ): Promise<SyncResult>;
  runExclusive<T>(
    reason: SyncReason,
    scope: string,
    run: () => Promise<T>
  ): Promise<T>;
  getStatus(): SyncSchedulerStatus;
}

interface SchedulerDeps {
  syncSource: (sourceType: SyncSourceType, options?: SyncSourceOptions) => Promise<SyncResult>;
  syncPaths: (
    sourceType: SyncSourceType,
    paths: string[],
    options?: SyncSourceOptions
  ) => Promise<SyncResult>;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

interface QueueItem {
  key: string;
  reason: SyncReason;
  scope: string;
  run: () => Promise<SyncResult>;
  deferred: Deferred<SyncResult>;
}

const EMPTY_RESULT: SyncResult = {
  sessionsInserted: 0,
  sessionsUpdated: 0,
  messagesInserted: 0,
  toolCallsInserted: 0,
  toolResultEventsInserted: 0,
  errors: [],
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mergeMetrics(target: SyncRunMetrics, result: SyncResult): void {
  const metrics = result.metrics;
  if (!metrics) return;

  target.filesConsidered += metrics.filesConsidered;
  target.filesSkippedBeforeParse += metrics.filesSkippedBeforeParse;
  target.filesParsed += metrics.filesParsed;
  target.largestFileBytes = Math.max(target.largestFileBytes, metrics.largestFileBytes);
}

function waitForNextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function createSyncScheduler(deps: SchedulerDeps): SyncScheduler {
  const queue: QueueItem[] = [];
  const queuedKeys = new Map<string, QueueItem>();
  const activeKeys = new Map<string, QueueItem>();
  let draining = false;
  let exclusiveTail: Promise<unknown> = Promise.resolve();

  const status: SyncSchedulerStatus = {
    active: false,
    activeReason: null,
    activeScope: null,
    queued: false,
    queuedReasons: [],
    startedAt: null,
    lastCompletedAt: null,
    lastDurationMs: null,
    lastError: null,
    filesConsidered: 0,
    filesSkippedBeforeParse: 0,
    filesParsed: 0,
    largestFileBytes: 0,
  };

  function refreshQueuedStatus(): void {
    status.queued = queue.length > 0;
    status.queuedReasons = Array.from(new Set(queue.map((item) => item.reason)));
  }

  async function runItem(item: QueueItem): Promise<void> {
    const started = Date.now();
    activeKeys.set(item.key, item);
    status.active = true;
    status.activeReason = item.reason;
    status.activeScope = item.scope;
    status.startedAt = new Date(started).toISOString();
    status.lastError = null;
    status.filesConsidered = 0;
    status.filesSkippedBeforeParse = 0;
    status.filesParsed = 0;
    status.largestFileBytes = 0;

    try {
      const result = await item.run();
      mergeMetrics(status, result);
      item.deferred.resolve(result);
    } catch (err) {
      status.lastError = err instanceof Error ? err.message : String(err);
      item.deferred.reject(err);
    } finally {
      status.active = false;
      status.activeReason = null;
      status.activeScope = null;
      status.lastCompletedAt = new Date().toISOString();
      status.lastDurationMs = Date.now() - started;
      status.startedAt = null;
      activeKeys.delete(item.key);
    }
  }

  async function drain(): Promise<void> {
    if (draining) return;
    draining = true;

    try {
      while (queue.length > 0) {
        while (status.active) {
          await waitForNextTick();
        }
        const item = queue.shift()!;
        queuedKeys.delete(item.key);
        refreshQueuedStatus();
        await runItem(item);
      }
    } finally {
      draining = false;
      refreshQueuedStatus();
    }
  }

  function enqueue(item: QueueItem): Promise<SyncResult> {
    const active = activeKeys.get(item.key);
    if (active) {
      return active.deferred.promise;
    }

    const existing = queuedKeys.get(item.key);
    if (existing) {
      return existing.deferred.promise;
    }

    queue.push(item);
    queuedKeys.set(item.key, item);
    refreshQueuedStatus();
    void drain();
    return item.deferred.promise;
  }

  return {
    enqueueFullSource(sourceType, reason, options) {
      const key = `full:${sourceType}:${JSON.stringify(options ?? {})}`;
      return enqueue({
        key,
        reason,
        scope: `full:${sourceType}`,
        run: () => deps.syncSource(sourceType, options),
        deferred: createDeferred<SyncResult>(),
      });
    },

    enqueuePaths(sourceType, paths, reason, options) {
      const uniquePaths = Array.from(new Set(paths)).sort();
      if (uniquePaths.length === 0) {
        return Promise.resolve(EMPTY_RESULT);
      }

      const key = `paths:${sourceType}:${uniquePaths.join('\0')}:${JSON.stringify(options ?? {})}`;
      return enqueue({
        key,
        reason,
        scope: `paths:${sourceType}:${uniquePaths.length}`,
        run: () => deps.syncPaths(sourceType, uniquePaths, options),
        deferred: createDeferred<SyncResult>(),
      });
    },

    runExclusive(reason, scope, run) {
      const execute = async () => {
        while (draining || status.active || queue.length > 0) {
          await waitForNextTick();
        }

        const started = Date.now();
        status.active = true;
        status.activeReason = reason;
        status.activeScope = scope;
        status.startedAt = new Date(started).toISOString();
        status.lastError = null;

        try {
          return await run();
        } catch (err) {
          status.lastError = err instanceof Error ? err.message : String(err);
          throw err;
        } finally {
          status.active = false;
          status.activeReason = null;
          status.activeScope = null;
          status.startedAt = null;
          status.lastCompletedAt = new Date().toISOString();
          status.lastDurationMs = Date.now() - started;
        }
      };

      const result = exclusiveTail.then(execute, execute);
      exclusiveTail = result.catch(() => undefined);
      return result;
    },

    getStatus() {
      refreshQueuedStatus();
      return { ...status, queuedReasons: [...status.queuedReasons] };
    },
  };
}
