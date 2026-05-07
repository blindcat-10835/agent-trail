import { describe, expect, it } from 'vitest'
import { createCodexAdapter } from './server-adapter'

describe('Codex adapter — lookupSessionByKey', () => {
  it('returns null — no Gateway integration for Codex', async () => {
    const adapter = createCodexAdapter()
    const result = await adapter.lookupSessionByKey('any-gateway-key')
    expect(result).toBeNull()
  })
})
