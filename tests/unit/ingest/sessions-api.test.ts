import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { sessionsRoutes } from '@/ingest/api/sessions'
import { closeDatabase, getDatabase, initSchema, openDatabase } from '@/ingest/db'

describe('sessions API', () => {
  let dbPath: string

  beforeEach(() => {
    dbPath = join(tmpdir(), `sessions-api-test-${randomUUID()}.db`)
    openDatabase({ path: dbPath })
    initSchema()
  })

  afterEach(() => {
    closeDatabase()
    rmSync(dbPath, { force: true })
    rmSync(`${dbPath}-shm`, { force: true })
    rmSync(`${dbPath}-wal`, { force: true })
  })

  it('sorts by user-facing activity timestamps for updated_at (excluding last_sync_at)', async () => {
    const db = getDatabase()
    const insert = db.prepare(`
      INSERT INTO sessions (
        id, source, project, name, started_at, ended_at, status,
        message_count, user_message_count, total_output_tokens, has_tool_calls,
        parser_malformed_lines, is_truncated, termination_status,
        file_path, file_mtime, last_sync_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insert.run(
      'older-start-recent-sync',
      'codex',
      '/project',
      'Recent sync',
      '2024-01-01T00:00:00.000Z',
      null,
      'idle',
      1,
      1,
      0,
      0,
      0,
      0,
      '',
      '/tmp/recent.jsonl',
      '2024-01-01T00:00:00.000Z',
      '2026-05-07T11:00:00.000Z',
    )
    insert.run(
      'newer-start-stale-sync',
      'codex',
      '/project',
      'Stale sync',
      '2025-01-01T00:00:00.000Z',
      null,
      'idle',
      1,
      1,
      0,
      0,
      0,
      0,
      '',
      '/tmp/stale.jsonl',
      '2025-01-01T00:00:00.000Z',
      '2025-01-01T00:00:00.000Z',
    )

    const response = await sessionsRoutes.request(
      'http://localhost/api/v1/sessions?source=codex&sort=updated_at&order=desc',
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.sessions.map((session: { id: string }) => session.id)).toEqual([
      'newer-start-stale-sync',
      'older-start-recent-sync',
    ])
    expect(body.sessions[0].updatedAt).toBe('2025-01-01T00:00:00.000Z')
  })
})
