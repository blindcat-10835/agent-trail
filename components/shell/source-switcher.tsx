'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import { getAllDefinitions } from '@/lib/agent-tools/registry'
import type { AgentToolId } from '@/lib/agent-tools/types'

export function SourceSwitcher() {
  const { toolId: currentToolId } = useAgentTool()
  const router = useRouter()
  const pathname = usePathname()

  const tools = getAllDefinitions()

  function handleSwitch(targetToolId: AgentToolId) {
    // Replace the [tool] segment in the current path
    // e.g., /openclaw/dashboard -> /codex/dashboard
    const segments = pathname.split('/').filter(Boolean)
    // segments[0] is the current tool, replace it
    segments[0] = targetToolId
    router.push('/' + segments.join('/'))
  }

  return (
    <nav className="flex items-center justify-center gap-1">
      {tools.map((def) => {
        const isActive = def.id === currentToolId
        return (
          <button
            key={def.id}
            onClick={() => handleSwitch(def.id)}
            className={`hud-clip-sm border px-2.5 py-1 text-xs tracking-[0.14em] font-semibold transition-all ${
              isActive
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border text-muted-foreground hover:border-accent hover:text-accent'
            }`}
          >
            {def.shortLabel}
          </button>
        )
      })}
    </nav>
  )
}
