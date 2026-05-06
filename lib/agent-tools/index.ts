/**
 * Agent Tools — Barrel Export
 *
 * Re-exports the complete agent tool type system, registry,
 * React context provider, hooks, and capability gate utilities.
 * Import from here instead of individual files for convenience.
 *
 * @example
 * ```typescript
 * import {
 *   AgentToolProvider,
 *   useAgentTool,
 *   CapabilityGate,
 *   getDefinition,
 *   assertAgentToolId,
 *   type AgentToolId,
 * } from '@/lib/agent-tools'
 * ```
 */

// Types
export type {
  AgentToolId,
  SourceToolId,
  AgentToolDefinition,
  AgentToolCapabilities,
  AgentToolUIProfile,
  ToolNavItem,
  SessionColumnDef,
  AgentToolContextValue,
  NormalizedSession,
  NormalizedToolCall,
  ReplayBlockRegistry,
} from './types'

// Registry
export {
  getDefinition,
  assertAgentToolId,
  assertSourceToolId,
  getAllDefinitions,
  AGENT_TOOL_DEFINITIONS,
  TOOL_IDS,
  SHELL_TOOL_IDS,
} from './registry'

// Per-tool definitions
export { default as allDefinition } from './all/definition'
export { default as openclawDefinition } from './openclaw/definition'
export { default as claudeCodeDefinition } from './claude-code/definition'
export { default as codexDefinition } from './codex/definition'

// Client hooks
export {
  AgentToolProvider,
  useAgentTool,
  AgentToolContext,
  getClientToolDefinition,
} from './client-hooks'

// Capability gate
export {
  CapabilityGate,
  useRequiresCapability,
} from './capability-gate'
