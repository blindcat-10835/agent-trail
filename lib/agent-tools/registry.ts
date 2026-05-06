/**
 * Agent Tool Registry
 *
 * Central registry mapping AgentToolId to AgentToolDefinition.
 * Used by AgentToolProvider to resolve tool profiles at runtime.
 *
 * Pure TypeScript — no React, no IO, no side effects.
 */

import type { AgentToolDefinition, AgentToolId } from './types'
import openclawDef from './openclaw/definition'
import claudeCodeDef from './claude-code/definition'
import codexDef from './codex/definition'

/**
 * Map of all tool definitions indexed by AgentToolId.
 * Used by getDefinition() for O(1) lookup.
 */
export const AGENT_TOOL_DEFINITIONS: Record<AgentToolId, AgentToolDefinition> = {
  'openclaw': openclawDef,
  'claude-code': claudeCodeDef,
  'codex': codexDef,
}

/**
 * Ordered array of all valid AgentToolId values.
 * Useful for iteration (e.g. source switcher, aggregate queries).
 */
export const TOOL_IDS: AgentToolId[] = ['openclaw', 'claude-code', 'codex']

/**
 * Look up a tool definition by its ID.
 * Returns the full AgentToolDefinition — capabilities, nav, UI profile, etc.
 */
export function getDefinition(toolId: AgentToolId): AgentToolDefinition {
  return AGENT_TOOL_DEFINITIONS[toolId]
}

/**
 * Return all tool definitions as an array.
 * Order: openclaw, claude-code, codex.
 */
export function getAllDefinitions(): AgentToolDefinition[] {
  return [openclawDef, claudeCodeDef, codexDef]
}

/**
 * Validate and narrow a raw string to AgentToolId.
 * Throws an Error with a descriptive message listing valid IDs if the input
 * does not match one of 'openclaw', 'claude-code', or 'codex'.
 *
 * Use this at trust boundaries (e.g. URL param parsing) to ensure
 * downstream code only sees valid AgentToolId values.
 */
export function assertAgentToolId(raw: string): AgentToolId {
  const validIds: AgentToolId[] = ['openclaw', 'claude-code', 'codex']
  if (validIds.includes(raw as AgentToolId)) {
    return raw as AgentToolId
  }
  throw new Error(
    `Invalid agent tool ID: "${raw}". Expected one of: openclaw, claude-code, codex.`,
  )
}
