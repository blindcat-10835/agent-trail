'use client'

/**
 * Agent Tool Client Hooks
 *
 * React context provider and hooks for accessing the current agent tool
 * from within a [tool] layout. All consumer components use useAgentTool()
 * to read toolId, definition, capabilities, and build hrefs.
 *
 * Architecture: Client-safe split from server-adapter (server-only IO).
 * The provider only exposes compile-time definition data — no IO, no fetch.
 */

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react'
import type {
  AgentToolId,
  AgentToolDefinition,
  AgentToolCapabilities,
  AgentToolContextValue,
} from './types'
import { getDefinition } from './registry'

/**
 * React context for agent tool data.
 * Defaults to null — components must be wrapped in AgentToolProvider.
 */
export const AgentToolContext = createContext<AgentToolContextValue | null>(null)

/**
 * Strip server-only fields from a tool definition before exposing to the client.
 *
 * Currently a pass-through (no server-only fields exist yet), but this is the
 * architectural boundary where IO-sensitive data would be removed in future phases.
 * Kept as a separate function for the provider to call rather than calling
 * getDefinition() directly.
 */
export function getClientToolDefinition(
  toolId: AgentToolId,
): AgentToolDefinition {
  return getDefinition(toolId)
}

/**
 * Provider that supplies agent tool context to the component tree.
 *
 * Wraps children in AgentToolContext.Provider with a computed value containing:
 * - toolId: current tool from URL segment
 * - definition: full AgentToolDefinition (capabilities, nav, UI profile)
 * - capabilities: convenience shortcut to definition.capabilities
 * - href: URL builder that prepends `/{toolId}` to any route
 *
 * @example
 * ```tsx
 * // In app/(tool-shell)/[tool]/layout.tsx
 * export default async function ToolLayout({ children, params }) {
 *   const { tool } = await params
 *   const toolId = assertAgentToolId(tool)
 *   return (
 *     <AgentToolProvider toolId={toolId}>
 *       <ShellFrame>{children}</ShellFrame>
 *     </AgentToolProvider>
 *   )
 * }
 * ```
 */
export function AgentToolProvider({
  toolId,
  children,
}: {
  toolId: AgentToolId
  children: ReactNode
}) {
  const definition = getClientToolDefinition(toolId)

  const value: AgentToolContextValue = {
    toolId,
    definition,
    capabilities: definition.capabilities,
    href: (route: string) => `/${toolId}${route}`,
  }

  return (
    <AgentToolContext.Provider value={value}>
      {children}
    </AgentToolContext.Provider>
  )
}

/**
 * Hook to access the current agent tool context.
 *
 * Must be called within a component tree wrapped by AgentToolProvider.
 * Throws a descriptive error if used outside the provider to catch
 * misconfiguration at development time.
 *
 * @returns AgentToolContextValue with toolId, definition, capabilities, href builder
 * @throws Error if called outside AgentToolProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { toolId, capabilities, href } = useAgentTool()
 *   return <a href={href('/dashboard')}>{toolId} Dashboard</a>
 * }
 * ```
 */
export function useAgentTool(): AgentToolContextValue {
  const ctx = useContext(AgentToolContext)
  if (ctx === null) {
    throw new Error(
      'useAgentTool() must be used within an AgentToolProvider. ' +
        'Wrap your layout in app/(tool-shell)/[tool]/layout.tsx with ' +
        '<AgentToolProvider toolId={...}>.',
    )
  }
  return ctx
}

/**
 * Type guard: checks if a value satisfies AgentToolCapabilities.
 * Useful for runtime validation when receiving capabilities from
 * external sources (e.g. API responses).
 */
export function isAgentToolCapabilities(
  value: unknown,
): value is AgentToolCapabilities {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.liveGateway === 'boolean' &&
    typeof v.sessions === 'boolean' &&
    typeof v.replay === 'boolean' &&
    typeof v.activity === 'boolean' &&
    typeof v.office === 'boolean' &&
    typeof v.workspace === 'boolean' &&
    typeof v.subagents === 'boolean' &&
    typeof v.cost === 'boolean' &&
    typeof v.approvals === 'boolean'
  )
}
