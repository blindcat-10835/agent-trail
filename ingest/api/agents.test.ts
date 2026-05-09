/**
 * Agents API Tests — Param validation
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { agentsRoutes } from './agents.js'

function createApp() {
  const app = new Hono()
  app.route('/', agentsRoutes)
  return app
}

describe('GET /api/v1/agents — param validation', () => {
  it('should return 400 when source is missing', async () => {
    const app = createApp()
    const res = await app.request('/api/v1/agents')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('source')
  })

  it('should return 400 for invalid source', async () => {
    const app = createApp()
    const res = await app.request('/api/v1/agents?source=invalid')
    expect(res.status).toBe(400)
  })
})
