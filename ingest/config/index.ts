/**
 * Ingest Service Configuration Management
 *
 * Loads and caches configuration from environment variables.
 * Provides validation and default values.
 */

// ============================================================================
// Types
// ============================================================================

export interface IngestConfig {
  port: number;
  dbPath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  resyncIntervalMs: number;      // default 300000 (5 min)
  debounceMs: number;            // default 500
  startupSyncLimit: number;      // default 50 sessions per source before ready=true
  backgroundSyncEnabled: boolean; // default true
  rateLimitRPM: number;          // default 100
  rateLimitEnabled: boolean;     // default true (parse from INGEST_RATE_LIMIT_ENABLED)
  debugMode: boolean;            // default false (parse from INGEST_DEBUG)
}

// ============================================================================
// Module State
// ============================================================================

let cachedConfig: IngestConfig | null = null;

// ============================================================================
// Configuration Loading
// ============================================================================

/**
 * Load configuration from environment variables
 * @throws Error if configuration is invalid
 */
export function loadConfig(): IngestConfig {
  // Parse port
  const portStr = process.env.INGEST_PORT || '8078';
  const port = parseInt(portStr, 10);

  if (isNaN(port)) {
    throw new Error(`Invalid INGEST_PORT: "${portStr}" is not a number`);
  }

  if (port < 1024 || port > 65535) {
    throw new Error(
      `Invalid INGEST_PORT: ${port} must be between 1024 and 65535`
    );
  }

  // Parse database path
  const dbPath = process.env.INGEST_DB_PATH || './data/ingest.db';

  if (!dbPath || dbPath.trim() === '') {
    throw new Error('INGEST_DB_PATH cannot be empty');
  }

  // Validate no obviously malicious paths
  if (dbPath.includes('..')) {
    throw new Error('INGEST_DB_PATH cannot contain ".." (path traversal)');
  }

  // Parse log level
  const logLevelStr = process.env.INGEST_LOG_LEVEL || 'info';
  const validLogLevels = ['debug', 'info', 'warn', 'error'];

  if (!validLogLevels.includes(logLevelStr)) {
    throw new Error(
      `Invalid INGEST_LOG_LEVEL: "${logLevelStr}" must be one of ${validLogLevels.join(', ')}`
    );
  }

  const logLevel = logLevelStr as IngestConfig['logLevel'];

  // Parse resync interval (default 5 minutes)
  const resyncIntervalStr = process.env.INGEST_RESYNC_INTERVAL_MS || '300000';
  const resyncIntervalMs = parseInt(resyncIntervalStr, 10);
  if (isNaN(resyncIntervalMs) || resyncIntervalMs < 5000) {
    throw new Error(`Invalid INGEST_RESYNC_INTERVAL_MS: "${resyncIntervalStr}" must be at least 5000ms`);
  }

  // Parse debounce (default 500ms)
  const debounceMsStr = process.env.INGEST_DEBOUNCE_MS || '500';
  const debounceMs = parseInt(debounceMsStr, 10);
  if (isNaN(debounceMs) || debounceMs < 100) {
    throw new Error(`Invalid INGEST_DEBOUNCE_MS: "${debounceMsStr}" must be at least 100ms`);
  }

  // Parse startup sync warmup limit. This bounds foreground indexing so the
  // service can become ready before scanning a large historical corpus.
  const startupSyncLimitStr = process.env.INGEST_STARTUP_SYNC_LIMIT || '50';
  const startupSyncLimit = parseInt(startupSyncLimitStr, 10);
  if (isNaN(startupSyncLimit) || startupSyncLimit < 0) {
    throw new Error(`Invalid INGEST_STARTUP_SYNC_LIMIT: "${startupSyncLimitStr}" must be a non-negative number`);
  }

  // Parse background sync toggle (default true; accepts "true"/"1"/"yes")
  const backgroundSyncEnabled = ['true', '1', 'yes'].includes(
    (process.env.INGEST_BACKGROUND_SYNC_ENABLED || 'true').toLowerCase()
  );

  // Parse rate limit RPM (default 100)
  const rateLimitRPM = parseInt(process.env.INGEST_RATE_LIMIT_RPM || '100', 10) || 100;

  // Parse rate limit enabled (default true; accepts "true"/"1"/"yes")
  const rateLimitEnabled = ['true', '1', 'yes'].includes(
    (process.env.INGEST_RATE_LIMIT_ENABLED || 'true').toLowerCase()
  );

  // Parse debug mode (default false; accepts "true"/"1"/"yes")
  const debugMode = ['true', '1', 'yes'].includes(
    (process.env.INGEST_DEBUG || 'false').toLowerCase()
  );

  const config: IngestConfig = {
    port,
    dbPath,
    logLevel,
    resyncIntervalMs,
    debounceMs,
    startupSyncLimit,
    backgroundSyncEnabled,
    rateLimitRPM,
    rateLimitEnabled,
    debugMode,
  };

  console.log('Configuration loaded:', {
    port: config.port,
    dbPath: config.dbPath,
    logLevel: config.logLevel,
    resyncIntervalMs: config.resyncIntervalMs,
    debounceMs: config.debounceMs,
    startupSyncLimit: config.startupSyncLimit,
    backgroundSyncEnabled: config.backgroundSyncEnabled,
    rateLimitRPM: config.rateLimitRPM,
    rateLimitEnabled: config.rateLimitEnabled,
    debugMode: config.debugMode,
  });

  return config;
}

/**
 * Get cached configuration or load if not cached
 * @throws Error if configuration is invalid
 */
export function getConfig(): IngestConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}
