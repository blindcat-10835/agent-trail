import type {
  SyncObserver,
  SyncProgressEvent,
  SyncResult,
  SyncSourceOptions,
  SyncSourceType,
} from '../sync/index.js';

export type SyncReason = 'startup-warmup' | 'background' | 'watcher' | 'periodic' | 'manual';

export interface SyncRunMetrics {
  filesConsidered: number;
  filesSkippedBeforeParse: number;
  filesParsed: number;
  filesParsedFully: number;
  filesParsedIncrementally: number;
  incrementalFallbacks: number;
  largestFileBytes: number;
  messagesWritten: number;
  toolCallsWritten: number;
  resultEventsWritten: number;
  sessionsInserted: number;
  sessionsUpdated: number;
}

export interface SyncSchedulerStatus extends SyncRunMetrics {
  active: boolean;
  activeRunId: string | null;
  activeReason: SyncReason | null;
  activeScope: string | null;
  activeSourceType: SyncSourceType | null;
  currentFile: string | null;
  currentFileSize: number | null;
  currentOffset: number | null;
  queued: boolean;
  queuedReasons: SyncReason[];
  coalescedCount: number;
  startedAt: string | null;
  durationMs: number | null;
  lastCompletedAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
  maxRssBytes: number;
  recentRuns: SyncRunHistoryEntry[];
  recentErrors: string[];
}

export interface SyncRunHistoryEntry extends SyncRunMetrics {
  runId: string;
  reason: SyncReason;
  scope: string;
  sourceType: SyncSourceType | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  queued: boolean;
  coalescedCount: number;
  maxRssBytes: number;
  errorCount: number;
  lastError: string | null;
}

export interface SyncDebugStatus {
  activeRun: SyncSchedulerStatus | null;
  queue: {
    queued: boolean;
    queuedReasons: SyncReason[];
    coalescedCount: number;
  };
  recentRuns: SyncRunHistoryEntry[];
  recentErrors: string[];
  metrics: SyncRunMetrics & {
    maxRssBytes: number;
    lastDurationMs: number | null;
  };
  config: {
    historyLimit: number;
  };
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
  getDebugStatus(): SyncDebugStatus;
}

interface SchedulerDeps {
  syncSource: (sourceType: SyncSourceType, options?: SyncSourceOptions) => Promise<SyncResult>;
  syncPaths: (
    sourceType: SyncSourceType,
    paths: string[],
    options?: SyncSourceOptions
  ) => Promise<SyncResult>;
}

interface SchedulerOptions {
  historyLimit?: number;
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
  sourceType: SyncSourceType | null;
  run: () => Promise<SyncResult>;
  deferred: Deferred<SyncResult>;
  coalescedCount: number;
}

const EMPTY_RESULT: SyncResult = {
  sessionsInserted: 0,
  sessionsUpdated: 0,
  messagesInserted: 0,
  toolCallsInserted: 0,
  toolResultEventsInserted: 0,
  errors: [],
};

const EMPTY_METRICS: SyncRunMetrics = {
  filesConsidered: 0,
  filesSkippedBeforeParse: 0,
  filesParsed: 0,
  filesParsedFully: 0,
  filesParsedIncrementally: 0,
  incrementalFallbacks: 0,
  largestFileBytes: 0,
  messagesWritten: 0,
  toolCallsWritten: 0,
  resultEventsWritten: 0,
  sessionsInserted: 0,
  sessionsUpdated: 0,
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
  if (metrics) {
    target.filesConsidered += metrics.filesConsidered;
    target.filesSkippedBeforeParse += metrics.filesSkippedBeforeParse;
    target.filesParsed += metrics.filesParsed;
    target.filesParsedFully += metrics.filesParsedFully ?? 0;
    target.filesParsedIncrementally += metrics.filesParsedIncrementally ?? 0;
    target.incrementalFallbacks += metrics.incrementalFallbacks ?? 0;
    target.largestFileBytes = Math.max(target.largestFileBytes, metrics.largestFileBytes);
  }
  target.messagesWritten += result.messagesInserted;
  target.toolCallsWritten += result.toolCallsInserted;
  target.resultEventsWritten += result.toolResultEventsInserted;
  target.sessionsInserted += result.sessionsInserted;
  target.sessionsUpdated += result.sessionsUpdated;
}

function waitForNextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function cloneMetrics(metrics: SyncRunMetrics): SyncRunMetrics {
  return {
    filesConsidered: metrics.filesConsidered,
    filesSkippedBeforeParse: metrics.filesSkippedBeforeParse,
    filesParsed: metrics.filesParsed,
    filesParsedFully: metrics.filesParsedFully,
    filesParsedIncrementally: metrics.filesParsedIncrementally,
    incrementalFallbacks: metrics.incrementalFallbacks,
    largestFileBytes: metrics.largestFileBytes,
    messagesWritten: metrics.messagesWritten,
    toolCallsWritten: metrics.toolCallsWritten,
    resultEventsWritten: metrics.resultEventsWritten,
    sessionsInserted: metrics.sessionsInserted,
    sessionsUpdated: metrics.sessionsUpdated,
  };
}

function sampleRss(): number {
  return process.memoryUsage().rss;
}

export function createSyncScheduler(deps: SchedulerDeps, options: SchedulerOptions = {}): SyncScheduler {
  const historyLimit = Math.min(Math.max(options.historyLimit ?? 20, 1), 100);
  const queue: QueueItem[] = [];
  const queuedKeys = new Map<string, QueueItem>();
  const activeKeys = new Map<string, QueueItem>();
  let draining = false;
  let exclusiveTail: Promise<unknown> = Promise.resolve();
  let runSeq = 0;
  const recentRuns: SyncRunHistoryEntry[] = [];

  const status: SyncSchedulerStatus = {
    active: false,
    activeRunId: null,
    activeReason: null,
    activeScope: null,
    activeSourceType: null,
    currentFile: null,
    currentFileSize: null,
    currentOffset: null,
    queued: false,
    queuedReasons: [],
    coalescedCount: 0,
    startedAt: null,
    durationMs: null,
    lastCompletedAt: null,
    lastDurationMs: null,
    lastError: null,
    maxRssBytes: 0,
    recentRuns,
    recentErrors: [],
    ...EMPTY_METRICS,
  };

  function refreshQueuedStatus(): void {
    status.queued = queue.length > 0;
    status.queuedReasons = Array.from(new Set(queue.map((item) => item.reason)));
  }

  function resetActiveMetrics(): void {
    Object.assign(status, EMPTY_METRICS);
    status.currentFile = null;
    status.currentFileSize = null;
    status.currentOffset = null;
    status.maxRssBytes = sampleRss();
  }

  function updateFromProgress(event: SyncProgressEvent): void {
    status.currentFile = event.filePath;
    status.currentFileSize = event.fileSize;
    status.currentOffset = event.currentOffset;
    status.filesConsidered = event.filesConsidered;
    status.filesSkippedBeforeParse = event.filesSkippedBeforeParse;
    status.filesParsed = event.filesParsed;
    status.largestFileBytes = event.largestFileBytes;
    status.maxRssBytes = Math.max(status.maxRssBytes, sampleRss());
    if (status.startedAt) {
      status.durationMs = Date.now() - Date.parse(status.startedAt);
    }
  }

  function createObserver(): SyncObserver {
    return {
      onFileStart: updateFromProgress,
      onFileProgress: updateFromProgress,
      onFileComplete: updateFromProgress,
    };
  }

  function pushHistory(entry: SyncRunHistoryEntry): void {
    recentRuns.push(entry);
    while (recentRuns.length > historyLimit) {
      recentRuns.shift();
    }
    status.recentErrors = recentRuns
      .filter((run) => run.lastError)
      .slice(-historyLimit)
      .map((run) => run.lastError!);
  }

  function logCompletion(entry: SyncRunHistoryEntry): void {
    console.log(JSON.stringify({
      event: 'ingest_sync_complete',
      runId: entry.runId,
      reason: entry.reason,
      scope: entry.scope,
      sourceType: entry.sourceType,
      filesConsidered: entry.filesConsidered,
      filesSkippedBeforeParse: entry.filesSkippedBeforeParse,
      filesParsed: entry.filesParsed,
      filesParsedFully: entry.filesParsedFully,
      filesParsedIncrementally: entry.filesParsedIncrementally,
      sessionsInserted: entry.sessionsInserted,
      sessionsUpdated: entry.sessionsUpdated,
      messagesWritten: entry.messagesWritten,
      toolCallsWritten: entry.toolCallsWritten,
      resultEventsWritten: entry.resultEventsWritten,
      largestFileBytes: entry.largestFileBytes,
      maxRssBytes: entry.maxRssBytes,
      durationMs: entry.durationMs,
      queued: entry.queued,
      coalescedCount: entry.coalescedCount,
      incrementalFallbacks: entry.incrementalFallbacks,
      errorCount: entry.errorCount,
    }));
  }

  async function runItem(item: QueueItem): Promise<void> {
    const started = Date.now();
    const startedAt = new Date(started).toISOString();
    const runId = `sync-${++runSeq}`;
    activeKeys.set(item.key, item);
    status.active = true;
    status.activeRunId = runId;
    status.activeReason = item.reason;
    status.activeScope = item.scope;
    status.activeSourceType = item.sourceType;
    status.startedAt = startedAt;
    status.durationMs = 0;
    status.coalescedCount = item.coalescedCount;
    status.lastError = null;
    resetActiveMetrics();
    let result: SyncResult | null = null;

    try {
      result = await item.run();
      mergeMetrics(status, result);
      item.deferred.resolve(result);
    } catch (err) {
      status.lastError = err instanceof Error ? err.message : String(err);
      item.deferred.reject(err);
    } finally {
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - started;
      status.maxRssBytes = Math.max(status.maxRssBytes, sampleRss());
      const entry: SyncRunHistoryEntry = {
        runId,
        reason: item.reason,
        scope: item.scope,
        sourceType: item.sourceType,
        startedAt,
        completedAt,
        durationMs,
        queued: queue.length > 0,
        coalescedCount: item.coalescedCount,
        maxRssBytes: status.maxRssBytes,
        errorCount: result?.errors.length ?? (status.lastError ? 1 : 0),
        lastError: result?.errors[0] ?? status.lastError,
        ...cloneMetrics(status),
      };
      pushHistory(entry);
      logCompletion(entry);
      status.active = false;
      status.activeRunId = null;
      status.activeReason = null;
      status.activeScope = null;
      status.activeSourceType = null;
      status.currentFile = null;
      status.currentFileSize = null;
      status.currentOffset = null;
      status.lastCompletedAt = new Date().toISOString();
      status.lastDurationMs = durationMs;
      status.durationMs = null;
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
      active.coalescedCount++;
      status.coalescedCount = active.coalescedCount;
      return active.deferred.promise;
    }

    const existing = queuedKeys.get(item.key);
    if (existing) {
      existing.coalescedCount++;
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
        sourceType,
        run: () => deps.syncSource(sourceType, { ...(options ?? {}), observer: createObserver() }),
        deferred: createDeferred<SyncResult>(),
        coalescedCount: 0,
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
        sourceType,
        run: () => deps.syncPaths(sourceType, uniquePaths, { ...(options ?? {}), observer: createObserver() }),
        deferred: createDeferred<SyncResult>(),
        coalescedCount: 0,
      });
    },

    runExclusive(reason, scope, run) {
      const execute = async () => {
        while (draining || status.active || queue.length > 0) {
          await waitForNextTick();
        }

        const started = Date.now();
        status.active = true;
        status.activeRunId = `exclusive-${++runSeq}`;
        status.activeReason = reason;
        status.activeScope = scope;
        status.activeSourceType = null;
        status.startedAt = new Date(started).toISOString();
        status.lastError = null;
        resetActiveMetrics();

        try {
          return await run();
        } catch (err) {
          status.lastError = err instanceof Error ? err.message : String(err);
          throw err;
        } finally {
          status.active = false;
          status.activeRunId = null;
          status.activeReason = null;
          status.activeScope = null;
          status.activeSourceType = null;
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
      if (status.startedAt) {
        status.durationMs = Date.now() - Date.parse(status.startedAt);
      }
      return {
        ...status,
        queuedReasons: [...status.queuedReasons],
        recentRuns: [...recentRuns],
        recentErrors: [...status.recentErrors],
      };
    },

    getDebugStatus() {
      const current = this.getStatus();
      const latest = recentRuns[recentRuns.length - 1];
      return {
        activeRun: current.active ? current : null,
        queue: {
          queued: current.queued,
          queuedReasons: current.queuedReasons,
          coalescedCount: current.coalescedCount,
        },
        recentRuns: [...recentRuns],
        recentErrors: [...current.recentErrors],
        metrics: {
          ...(latest ? cloneMetrics(latest) : cloneMetrics(current)),
          maxRssBytes: latest?.maxRssBytes ?? current.maxRssBytes,
          lastDurationMs: current.lastDurationMs,
        },
        config: {
          historyLimit,
        },
      };
    },
  };
}
