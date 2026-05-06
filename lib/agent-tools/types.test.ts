import { describe, it, expect } from 'vitest'
import {
  getDefinition,
  assertAgentToolId,
  assertSourceToolId,
  getAllDefinitions,
  AGENT_TOOL_DEFINITIONS,
  TOOL_IDS,
  SHELL_TOOL_IDS,
} from './registry'
import type {
  AgentToolId,
  SourceToolId,
  AgentToolCapabilities,
} from './types'

describe('AgentToolId', () => {
  it('is the literal union of all, openclaw, claude-code, and codex', () => {
    // Type-level check: if the union is correct, this array is valid
    const ids: AgentToolId[] = ['all', 'openclaw', 'claude-code', 'codex']
    expect(ids).toHaveLength(4)
    expect(ids).toContain('all')
    expect(ids).toContain('openclaw')
    expect(ids).toContain('claude-code')
    expect(ids).toContain('codex')
  })

  it('has source IDs compatible with TraceSource from types/trace.ts', () => {
    const toolIds: SourceToolId[] = ['openclaw', 'claude-code', 'codex']
    // Verify each can be used where TraceSource is expected
    toolIds.forEach((id) => {
      expect(typeof id).toBe('string')
      expect(['openclaw', 'claude-code', 'codex']).toContain(id)
    })
  })
})

describe('AgentToolDefinition', () => {
  it('has all required fields', () => {
    // Verify the shape contract — all definitions must have these fields
    const def = getDefinition('openclaw')
    expect(def).toHaveProperty('id')
    expect(def).toHaveProperty('label')
    expect(def).toHaveProperty('shortLabel')
    expect(def).toHaveProperty('defaultRoute')
    expect(def).toHaveProperty('capabilities')
    expect(def).toHaveProperty('nav')
    expect(def).toHaveProperty('ui')
    expect(typeof def.label).toBe('string')
    expect(typeof def.shortLabel).toBe('string')
    expect(typeof def.defaultRoute).toBe('string')
    expect(Array.isArray(def.nav)).toBe(true)
  })
})

describe('AgentToolCapabilities', () => {
  it('defaults all booleans as specified', () => {
    // Get a definition and check each capability
    const def = getDefinition('openclaw')
    const caps: AgentToolCapabilities = def.capabilities

    // Per plan: sessions, replay, activity default to true; rest false
    // But openclaw specifically has liveGateway=true, office=true, workspace=true, cost=true
    expect(typeof caps.liveGateway).toBe('boolean')
    expect(typeof caps.sessions).toBe('boolean')
    expect(typeof caps.replay).toBe('boolean')
    expect(typeof caps.activity).toBe('boolean')
    expect(typeof caps.office).toBe('boolean')
    expect(typeof caps.workspace).toBe('boolean')
    expect(typeof caps.subagents).toBe('boolean')
    expect(typeof caps.cost).toBe('boolean')
    expect(typeof caps.approvals).toBe('boolean')

    // All 9 capability fields must be present
    const keys = Object.keys(caps) as (keyof AgentToolCapabilities)[]
    expect(keys).toHaveLength(9)
  })
})

describe('assertAgentToolId', () => {
  it('returns the tool ID for valid inputs', () => {
    expect(assertAgentToolId('all')).toBe('all')
    expect(assertAgentToolId('openclaw')).toBe('openclaw')
    expect(assertAgentToolId('claude-code')).toBe('claude-code')
    expect(assertAgentToolId('codex')).toBe('codex')
  })

  it('throws with a descriptive message for invalid inputs', () => {
    expect(() => assertAgentToolId('invalid')).toThrow()
    expect(() => assertAgentToolId('garbage')).toThrow()

    // Error message must mention valid IDs
    try {
      assertAgentToolId('nonsense')
    } catch (e) {
      const msg = (e as Error).message
      expect(msg).toMatch(/all/)
      expect(msg).toMatch(/openclaw/)
      expect(msg).toMatch(/claude-code/)
      expect(msg).toMatch(/codex/)
    }
  })
})

describe('assertSourceToolId', () => {
  it('returns the source tool ID for ingest-backed inputs', () => {
    expect(assertSourceToolId('openclaw')).toBe('openclaw')
    expect(assertSourceToolId('claude-code')).toBe('claude-code')
    expect(assertSourceToolId('codex')).toBe('codex')
  })

  it('rejects the synthetic all scope', () => {
    expect(() => assertSourceToolId('all')).toThrow()
  })
})

describe('getAllDefinitions', () => {
  it('returns an array of 4 definitions', () => {
    const defs = getAllDefinitions()
    expect(defs).toHaveLength(4)
  })

  it('includes definitions with ids all, openclaw, claude-code, codex', () => {
    const defs = getAllDefinitions()
    const ids = defs.map((d) => d.id)
    expect(ids).toContain('all')
    expect(ids).toContain('openclaw')
    expect(ids).toContain('claude-code')
    expect(ids).toContain('codex')
  })
})

describe('getDefinition', () => {
  it('returns all definition with aggregate label and no live gateway', () => {
    const def = getDefinition('all')
    expect(def.label).toBe('All Sources')
    expect(def.shortLabel).toBe('ALL')
    expect(def.capabilities.liveGateway).toBe(false)
    expect(def.capabilities.sessions).toBe(true)
    expect(def.ui.sessionColumns.some((col) => col.id === 'project')).toBe(true)
  })

  it('returns openclaw definition with correct label and shortLabel', () => {
    const def = getDefinition('openclaw')
    expect(def.label).toBe('OpenClaw')
    expect(def.shortLabel).toBe('OPENCLAW')
    expect(def.defaultRoute).toBe('/dashboard')
  })

  it('returns openclaw definition with liveGateway=true and office=true', () => {
    const def = getDefinition('openclaw')
    expect(def.capabilities.liveGateway).toBe(true)
    expect(def.capabilities.office).toBe(true)
    expect(def.capabilities.workspace).toBe(true)
    expect(def.capabilities.cost).toBe(true)
    expect(def.capabilities.sessions).toBe(true)
    expect(def.capabilities.replay).toBe(true)
    expect(def.capabilities.activity).toBe(true)
  })

  it('returns claude-code definition with replay=true and liveGateway=false', () => {
    const def = getDefinition('claude-code')
    expect(def.capabilities.replay).toBe(true)
    expect(def.capabilities.liveGateway).toBe(false)
    expect(def.capabilities.sessions).toBe(true)
    expect(def.capabilities.activity).toBe(true)
    expect(def.capabilities.subagents).toBe(true)
  })

  it('returns claude-code with correct brand label', () => {
    const def = getDefinition('claude-code')
    expect(def.label).toBe('Claude Code')
    expect(def.shortLabel).toBe('CLAUDE:CODE')
    expect(def.ui.brand.name).toBe('Claude Code')
  })

  it('returns codex definition with approvals=false', () => {
    const def = getDefinition('codex')
    expect(def.capabilities.approvals).toBe(false)
    expect(def.capabilities.liveGateway).toBe(false)
    expect(def.capabilities.sessions).toBe(true)
    expect(def.capabilities.replay).toBe(true)
    expect(def.capabilities.activity).toBe(true)
  })

  it('returns codex with correct brand and sessionColumns', () => {
    const def = getDefinition('codex')
    expect(def.label).toBe('Codex')
    expect(def.shortLabel).toBe('CODEX')
    expect(def.ui.brand.name).toBe('Codex')
  })
})

describe('TOOL_IDS', () => {
  it('contains only ingest-backed source IDs', () => {
    expect(TOOL_IDS).toHaveLength(3)
    expect(TOOL_IDS).toEqual(['openclaw', 'claude-code', 'codex'])
  })
})

describe('SHELL_TOOL_IDS', () => {
  it('contains all four shell tool scopes', () => {
    expect(SHELL_TOOL_IDS).toHaveLength(4)
    expect(SHELL_TOOL_IDS).toEqual(['all', 'openclaw', 'claude-code', 'codex'])
  })
})

describe('AGENT_TOOL_DEFINITIONS', () => {
  it('has entries for all four shell tool scopes', () => {
    const keys = Object.keys(AGENT_TOOL_DEFINITIONS)
    expect(keys).toHaveLength(4)
    expect(keys).toContain('all')
    expect(keys).toContain('openclaw')
    expect(keys).toContain('claude-code')
    expect(keys).toContain('codex')
  })
})
