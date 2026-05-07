import { describe, expect, it } from 'vitest'
import { createClaudeCodeAdapter } from './server-adapter'

describe('Claude Code adapter — lookupSessionByKey', () => {
  it('returns null — no Gateway integration for Claude Code', async () => {
    const adapter = createClaudeCodeAdapter()
    const result = await adapter.lookupSessionByKey('any-gateway-key')
    expect(result).toBeNull()
  })
})
