export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<Exclude<LogLevel, 'silent'>, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const VALID_LEVELS = new Set<LogLevel>(['silent', 'error', 'warn', 'info', 'debug']);

export function getLogLevel(): LogLevel {
  const configured =
    process.env.AGENTS_TRACING_LOG_LEVEL ||
    process.env.INGEST_LOG_LEVEL ||
    (process.env.NODE_ENV === 'production' ? 'warn' : 'info');
  const normalized = configured.toLowerCase() as LogLevel;
  return VALID_LEVELS.has(normalized) ? normalized : 'info';
}

function shouldLog(level: Exclude<LogLevel, 'silent'>): boolean {
  const current = getLogLevel();
  if (current === 'silent') return false;
  return LOG_LEVELS[level] <= LOG_LEVELS[current];
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (shouldLog('info')) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (shouldLog('error')) console.error(...args);
  },
};
