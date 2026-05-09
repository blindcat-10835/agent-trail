/**
 * Internal Ingest Service Types
 *
 * These types are for ingest service implementation details,
 * separate from the canonical trace contract in types/trace.ts.
 */

import type Database from 'better-sqlite3';
import type { IngestConfig } from './config/index.js';
import type { TraceSource } from '../types/trace.js';
import type { SSEManager } from './src/sse.js';
import type { WatcherInstance } from './src/watcher.js';

// ============================================================================
// Service Context
// ============================================================================

export interface ServiceContext {
  config: IngestConfig;
  db: Database.Database;
  server: any; // Hono server type (simplified for now)
  sseManager: SSEManager;
  watcher: WatcherInstance | null;
  syncState: StartupSyncState;
}

// ============================================================================
// Health Status Types
// ============================================================================

export interface StartupSyncState {
  phase: 'starting' | 'discovering' | 'warming' | 'indexing' | 'idle' | 'error';
  startupComplete: boolean;
  foregroundLimit: number;
  backgroundSyncEnabled: boolean;
  currentSource: TraceSource | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  ready: boolean;
  version: string;
  uptime: number;
  database: 'connected' | 'disconnected';
  sync: StartupSyncState | null;
}

export interface VersionInfo {
  version: string;
  name: string;
  sources: TraceSource[];
}

// ============================================================================
// Source Health Types
// ============================================================================

export interface SourceHealth {
  source: TraceSource;
  ingestStatus: 'installed' | 'configured' | 'empty' | 'indexing' | 'error' | 'parser-warning';
  lastSyncAt?: string;
  error?: string;
}
