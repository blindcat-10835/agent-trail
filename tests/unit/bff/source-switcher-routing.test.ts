import { describe, expect, it } from 'vitest'
import { getAllDefinitions } from '@/lib/agent-tools/registry'
import { buildSourceSwitchHref } from '@/components/shell/source-switcher-routing'

describe('buildSourceSwitchHref', () => {
  const tools = getAllDefinitions()

  it('drops source-scoped session ids when switching tools', () => {
    expect(
      buildSourceSwitchHref('/openclaw/sessions/session-123', 'codex', tools),
    ).toBe('/codex/sessions')
  })

  it('preserves supported section routes without an entity id', () => {
    expect(buildSourceSwitchHref('/openclaw/sessions', 'claude-code', tools)).toBe(
      '/claude-code/sessions',
    )
  })

  it('falls back to the target default route for unsupported sections', () => {
    expect(buildSourceSwitchHref('/openclaw/workspace', 'codex', tools)).toBe(
      '/codex/dashboard',
    )
  })
})
