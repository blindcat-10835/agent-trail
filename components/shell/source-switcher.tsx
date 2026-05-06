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
    const targetDef = tools.find((def) => def.id === targetToolId)
    if (!targetDef) return

    // Replace the [tool] segment in the current path
    // e.g., /openclaw/dashboard -> /codex/dashboard
    const segments = pathname.split('/').filter(Boolean)
    const currentSection = segments[1] ?? targetDef.defaultRoute.replace('/', '')
    const targetSupportsSection = targetDef.nav.some((item) => {
      const itemPath = item.href(targetToolId).split('?')[0]
      return itemPath === `/${targetToolId}/${currentSection}`
    })

    if (!targetSupportsSection) {
      router.push(`/${targetToolId}${targetDef.defaultRoute}`)
      return
    }

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
