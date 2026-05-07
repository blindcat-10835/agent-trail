/**
 * Tests for useSSE and useIngestStatus hooks (RED phase — these exports don't exist yet).
 *
 * These tests import hooks that will be implemented in the GREEN phase.
 * Currently, the imports will fail because useSSE and useIngestStatus
 * are not yet exported from lib/agent-tools/client-hooks.tsx.
 */

import { describe, expect, it } from 'vitest'

// RED phase: these imports will fail since the exports don't exist yet.
// After GREEN implementation, these tests will pass.
import { useSSE, useIngestStatus } from '@/lib/agent-tools/client-hooks'

describe('useSSE', () => {
  it('is an exported function from client-hooks', () => {
    expect(typeof useSSE).toBe('function')
  })

  it('has the expected signature (toolId param required, sessionId + onEvent optional)', () => {
    // Verify the function accepts the right arity
    expect(useSSE.length).toBeGreaterThanOrEqual(1)
  })
})

describe('useIngestStatus', () => {
  it('is an exported function from client-hooks', () => {
    expect(typeof useIngestStatus).toBe('function')
  })

  it('has the expected signature (toolId param required)', () => {
    expect(useIngestStatus.length).toBeGreaterThanOrEqual(1)
  })
})
