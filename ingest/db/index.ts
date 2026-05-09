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

  // Apply migrations (Phase 6: file_hash, last_sync_at)
  runMigrations();

  // Verify tables were created
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )
    .all() as { name: string }[];

  const expectedTables = ['sessions', 'messages', 'tool_calls', 'tool_result_events', 'turns', 'sync_status'];
  const missingTables = expectedTables.filter(
    (t) => !tables.find((table) => table.name === t)
  );

  if (missingTables.length > 0) {
    throw new Error(`Missing tables after schema initialization: ${missingTables.join(', ')}`);
  }

  console.log(`Verified ${tables.length} tables created: ${tables.map((t) => t.name).join(', ')}`);
}

/**
 * Apply schema migrations for existing databases
 *
 * Uses PRAGMA user_version to track migration state.
 * Migrations are wrapped in try/catch to gracefully handle
 * "duplicate column" errors on previously applied migrations.
 */
export function runMigrations(): void {
  if (!db) {
    throw new Error('Database not open. Call openDatabase() first.');
  }

  const currentVersion = db.pragma('user_version', { simple: true }) as number;
  const targetVersion = 7;

  if (currentVersion >= targetVersion) {
    console.log(`Schema at version ${currentVersion}, no migrations needed`);
    return;
  }

  console.log(`Running migrations: v${currentVersion} → v${targetVersion}`);

  // Migration 1: Add file_hash and last_sync_at columns to sessions
  // Migration 2: Add name column for session display name
  const migrationSteps: Array<{ sql: string; desc: string }> = [
    {
      desc: 'Add file_hash column to sessions',
      sql: 'ALTER TABLE sessions ADD COLUMN file_hash TEXT',
    },
    {
      desc: 'Add last_sync_at column to sessions',
      sql: 'ALTER TABLE sessions ADD COLUMN last_sync_at TEXT',
    },
    {
      desc: 'Add name column to sessions',
      sql: 'ALTER TABLE sessions ADD COLUMN name TEXT',
    },
    {
      desc: 'Invalidate skip cache to re-extract name and project',
      sql: "UPDATE sessions SET file_hash = NULL WHERE name IS NULL OR name = ''",
    },
    {
      desc: 'Invalidate stale project/name cache for repaired metadata extraction',
      sql: `
        UPDATE sessions
        SET file_hash = NULL
        WHERE name IS NULL
           OR name = ''
           OR project = 'default'
           OR project LIKE '//%'
      `,
    },
    {
      desc: 'Invalidate v4-stale metadata rows after parser cwd fixes',
      sql: `
        UPDATE sessions
        SET file_hash = NULL
        WHERE name IS NULL
           OR name = ''
           OR project = 'default'
           OR project LIKE '//%'
           OR file_path NOT LIKE '/%'
      `,
    },
    {
      desc: 'Add turn boundary columns to messages',
      sql: 'ALTER TABLE messages ADD COLUMN turn_id TEXT',
    },
    {
      desc: 'Add turn_index column to messages',
      sql: 'ALTER TABLE messages ADD COLUMN turn_index INTEGER',
    },
    {
      desc: 'Add is_real_user_input column to messages',
      sql: 'ALTER TABLE messages ADD COLUMN is_real_user_input INTEGER NOT NULL DEFAULT 0 CHECK(is_real_user_input IN (0, 1))',
    },
    {
      desc: 'Add messages turn index lookup',
      sql: 'CREATE INDEX IF NOT EXISTS idx_messages_session_turn_index ON messages(session_id, turn_index)',
    },
    {
      desc: 'Invalidate stale Claude/Codex parser cache for turn and relationship repairs',
      sql: `
        UPDATE sessions
        SET file_hash = NULL
        WHERE source IN ('claude-code', 'codex')
      `,
    },
    {
      desc: 'Add agent_name column to sessions',
      sql: 'ALTER TABLE sessions ADD COLUMN agent_name TEXT',
    },
    {
      desc: 'Add agent_name index',
      sql: 'CREATE INDEX IF NOT EXISTS idx_sessions_agent_name ON sessions(agent_name)',
    },
    {
      desc: 'Invalidate openclaw sessions cache to backfill agent_name',
      sql: "UPDATE sessions SET file_hash = NULL WHERE source = 'openclaw' AND agent_name IS NULL",
    },
  ];

  for (const step of migrationSteps) {
    try {
      db.exec(step.sql);
      console.log(`  ✓ ${step.desc}`);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('duplicate column name') || msg.includes('already exists')) {
        console.log(`  ○ ${step.desc} (already applied)`);
      } else {
        console.error(`  ✗ ${step.desc}: ${msg}`);
        throw err;
      }
    }
  }

  db.pragma(`user_version = ${targetVersion}`);
  console.log(`Migrations complete — schema at v${targetVersion}`);
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
