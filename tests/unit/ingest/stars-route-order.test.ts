import { randomUUID } from 'crypto'
import { rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { app } from '@/ingest/index'
import { sessionsRoutes } from '@/ingest/api/sessions'
import { starsRoutes } from '@/ingest/api/stars'
import { closeDatabase, getDatabase, initSchema, openDatabase } from '@/ingest/db'

describe('stars route order', () => {
  let dbPath: string

  beforeEach(() => {
    dbPath = join(tmpdir(), `stars-route-order-test-${randomUUID()}.db`)
    openDatabase({ path: dbPath })
    initSchema()
    getDatabase()
      .prepare('INSERT INTO session_stars (session_id) VALUES (?)')
      .run('session-a')
  })

  afterEach(() => {
    closeDatabase()
    rmSync(dbPath, { force: true })
    rmSync(`${dbPath}-shm`, { force: true })
    rmSync(`${dbPath}-wal`, { force: true })
  })

  it('returns persisted star ids when stars routes are mounted before sessions routes', async () => {
    const composed = new Hono()
    composed.route('/', starsRoutes)
    composed.route('/', sessionsRoutes)

    const response = await composed.request('http://localhost/api/v1/sessions/starred')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ session_ids: ['session-a'] })
    expect(body).not.toEqual({ error: 'Session not found', sessionId: 'starred' })
  })

  it('keeps the production ingest app starred route ahead of dynamic session ids', async () => {
    const response = await app.request('http://localhost/api/v1/sessions/starred')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ session_ids: ['session-a'] })
    expect(body).not.toEqual({ error: 'Session not found', sessionId: 'starred' })
  })
})
