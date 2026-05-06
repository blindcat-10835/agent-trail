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

  const config: IngestConfig = {
    port,
    dbPath,
    logLevel,
  };

  console.log('Configuration loaded:', {
    port: config.port,
    dbPath: config.dbPath,
    logLevel: config.logLevel,
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
