'use client'

/**
 * Capability Gate Utilities
 *
 * Conditional rendering based on agent tool capabilities.
 * Use CapabilityGate to show/hide UI elements per tool, and useRequiresCapability
 * as a lightweight boolean check for imperative logic.
 */

import { type ReactNode } from 'react'
import { useAgentTool } from './client-hooks'
import type { AgentToolCapabilities } from './types'

/**
 * Conditionally renders children based on the current tool's capabilities.
 *
 * If the current tool supports the given capability, children are rendered.
 * Otherwise, fallback is rendered (or null if no fallback provided).
 *
 * @example
 * ```tsx
 * <CapabilityGate capability="office" fallback={<UnsupportedMessage feature="Office" />}>
 *   <OfficeView />
 * </CapabilityGate>
 * ```
 */
export function CapabilityGate({
  capability,
  children,
  fallback = null,
}: {
  /** Capability to check — must be a key of AgentToolCapabilities */
  capability: keyof AgentToolCapabilities
  /** Content rendered when capability is available */
  children: ReactNode
  /** Optional fallback when capability is unavailable (default: null) */
  fallback?: ReactNode
}) {
  const { capabilities } = useAgentTool()

  if (capabilities[capability]) {
    return <>{children}</>
  }

  return <>{fallback}</>
}

/**
 * Hook returning whether the current tool supports a given capability.
 *
 * Thin convenience wrapper: `useAgentTool().capabilities[capability]`.
 * Use for imperative logic where a component wrapper is awkward.
 *
 * @example
 * ```tsx
 * function NavBar() {
 *   const showOffice = useRequiresCapability('office')
 *   const showCost = useRequiresCapability('cost')
 *   return (
 *     <nav>
 *       {showOffice && <OfficeLink />}
 *       {showCost && <CostLink />}
 *     </nav>
 *   )
 * }
 * ```
 */
export function useRequiresCapability(
  capability: keyof AgentToolCapabilities,
): boolean {
  const { capabilities } = useAgentTool()
  return capabilities[capability]
}
