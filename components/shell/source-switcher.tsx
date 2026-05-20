'use client'

import { useRouter, usePathname } from 'next/navigation'
import {
  prefetchOverviewData,
  prefetchSessionsRailData,
  useAgentTool,
} from '@/lib/agent-tools/client-hooks'
import { getAllDefinitions } from '@/lib/agent-tools/registry'
import { buildSourceSwitchHref } from './source-switcher-routing'
import type { AgentToolId } from '@/lib/agent-tools/types'

export function SourceSwitcher() {
  const { toolId: currentToolId } = useAgentTool()
  const router = useRouter()
  const pathname = usePathname()

  const tools = getAllDefinitions()

  function prefetchTarget(targetToolId: AgentToolId) {
    const href = buildSourceSwitchHref(pathname, targetToolId, tools)
    router.prefetch(href)
    void prefetchOverviewData(targetToolId, '30d')
    void prefetchSessionsRailData(targetToolId)
  }

  function handleSwitch(targetToolId: AgentToolId) {
    if (targetToolId === currentToolId) return
    router.push(buildSourceSwitchHref(pathname, targetToolId, tools))
  }

  return (
    <nav className="flex items-center justify-center gap-1">
      {tools.map((def) => {
        const isActive = def.id === currentToolId
        return (
          <button
            key={def.id}
            onFocus={() => prefetchTarget(def.id)}
            onMouseEnter={() => prefetchTarget(def.id)}
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
