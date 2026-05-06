/**
 * Internal Ingest Service Types
 *
 * These types are for ingest service implementation details,
 * separate from the canonical trace contract in types/trace.ts.
 */

import type Database from 'better-sqlite3';
import type { IngestConfig } from './config/index.js';
import type { TraceSource } from '../types/trace.js';

// ============================================================================
// Service Context
// ============================================================================

export interface ServiceContext {
  config: IngestConfig;
  db: Database.Database;
  server: any; // Hono server type (simplified for now)
}

// ============================================================================
// Health Status Types
// ============================================================================

export interface HealthStatus {
  status: 'ok' | 'error';
  version: string;
  uptime: number;
  database: 'connected' | 'disconnected';
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
