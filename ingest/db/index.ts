/**
 * Ingest Service Database Layer
 *
 * Manages SQLite database connection, schema initialization, and lifecycle.
 * Uses better-sqlite3 for synchronous database operations.
 */

import Database from 'better-sqlite3';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
// Types
// ============================================================================

export interface DatabaseConfig {
  path: string;
}

// ============================================================================
// Module State
// ============================================================================

export let db: Database.Database | null = null;

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Open database connection and enable WAL mode
 */
export function openDatabase(config: DatabaseConfig): Database.Database {
  if (db) {
    throw new Error('Database already open');
  }

  // Resolve path to handle relative paths
  const dbPath = path.resolve(config.path);

  // Create directory if it doesn't exist
  const dbDir = path.dirname(dbPath);
  fs.mkdir(dbDir, { recursive: true }).catch((err) => {
    console.error(`Failed to create database directory: ${dbDir}`, err);
    throw new Error(`Failed to create database directory: ${err.message}`);
  });

  // Open database
  try {
    db = new Database(dbPath);
    console.log(`Database opened: ${dbPath}`);
  } catch (err) {
    console.error('Failed to open database', err);
    throw new Error(`Failed to open database: ${(err as Error).message}`);
  }

  // Enable WAL mode for better concurrency
  try {
    db.pragma('journal_mode = WAL');
    console.log('WAL mode enabled');
  } catch (err) {
    console.error('Failed to enable WAL mode', err);
    throw new Error(`Failed to enable WAL mode: ${(err as Error).message}`);
  }

  return db;
}

/**
 * Initialize database schema from schema.sql file
 */
export function initSchema(): void {
  if (!db) {
    throw new Error('Database not open. Call openDatabase() first.');
  }

  // Read schema.sql file
  const schemaPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'schema.sql'
  );

  let schemaContent: string;
  try {
    schemaContent = require('fs').readFileSync(schemaPath, 'utf-8');
  } catch (err) {
    console.error(`Failed to read schema file: ${schemaPath}`, err);
    throw new Error(`Failed to read schema file: ${(err as Error).message}`);
  }

  // Execute schema
  try {
    db.exec(schemaContent);
    console.log('Schema initialized successfully');
  } catch (err) {
    console.error('Failed to initialize schema', err);
    throw new Error(`Failed to initialize schema: ${(err as Error).message}`);
  }

  // Verify tables were created
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )
    .all() as { name: string }[];

  const expectedTables = ['sessions', 'messages', 'tool_calls', 'tool_result_events', 'turns'];
  const missingTables = expectedTables.filter(
    (t) => !tables.find((table) => table.name === t)
  );

  if (missingTables.length > 0) {
    throw new Error(`Missing tables after schema initialization: ${missingTables.join(', ')}`);
  }

  console.log(`Verified ${tables.length} tables created: ${tables.map((t) => t.name).join(', ')}`);
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (!db) {
    console.warn('Database not open, nothing to close');
    return;
  }

  try {
    db.close();
    db = null;
    console.log('Database closed');
  } catch (err) {
    console.error('Failed to close database', err);
    throw new Error(`Failed to close database: ${(err as Error).message}`);
  }
}

/**
 * Get active database connection
 * @throws Error if database not open
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not open. Call openDatabase() first.');
  }
  return db;
}
