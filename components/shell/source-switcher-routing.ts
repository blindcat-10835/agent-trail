import type { AgentToolDefinition, AgentToolId } from '@/lib/agent-tools/types'

export function buildSourceSwitchHref(
  pathname: string,
  targetToolId: AgentToolId,
  tools: AgentToolDefinition[],
): string {
  const targetDef = tools.find((def) => def.id === targetToolId)
  if (!targetDef) return pathname

  const segments = pathname.split('/').filter(Boolean)
  const currentSection = segments[1] ?? targetDef.defaultRoute.replace('/', '')
  const targetSupportsSection = targetDef.nav.some((item) => {
    const itemPath = item.href(targetToolId).split('?')[0]
    return itemPath === `/${targetToolId}/${currentSection}`
  })

  if (!targetSupportsSection) {
    return `/${targetToolId}${targetDef.defaultRoute}`
  }

  // Entity ids are source scoped. A session id from OpenClaw must not be
  // carried into /codex/sessions/[id] or /claude-code/sessions/[id].
  if (currentSection === 'sessions' && segments.length > 2) {
    return `/${targetToolId}/sessions`
  }

  segments[0] = targetToolId
  return '/' + segments.join('/')
}
