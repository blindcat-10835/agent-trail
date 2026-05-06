// Minimal stub — RED phase
import type { AgentToolDefinition, AgentToolId } from './types'

// Placeholder definitions — tests will fail until properly implemented
const openclawDef = {} as AgentToolDefinition
const claudeCodeDef = {} as AgentToolDefinition
const codexDef = {} as AgentToolDefinition

export const AGENT_TOOL_DEFINITIONS: Record<AgentToolId, AgentToolDefinition> = {
  'openclaw': openclawDef,
  'claude-code': claudeCodeDef,
  'codex': codexDef,
}

export const TOOL_IDS: AgentToolId[] = ['openclaw', 'claude-code', 'codex']

export function getDefinition(_toolId: AgentToolId): AgentToolDefinition {
  // Will fail tests — RED phase
  return {} as AgentToolDefinition
}

export function getAllDefinitions(): AgentToolDefinition[] {
  // Will fail tests — RED phase
  return []
}

export function assertAgentToolId(_raw: string): AgentToolId {
  // Will fail tests — RED phase
  return 'openclaw'
}
