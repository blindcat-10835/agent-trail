// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OverviewPage } from '@/components/overview/overview-page'

vi.mock('@/lib/agent-tools/client-hooks', () => ({
  useAgentTool: () => ({ toolId: 'all' }),
  useOverviewAggregates: () => ({ aggregates: null, loading: false, error: null }),
  useDailyTokens: () => ({ dailyTokens: [], loading: false, error: null }),
  useTopModels: () => ({ models: [], loading: false, error: null }),
  useTopProjects: () => ({ projects: [], loading: false, error: null }),
  useStarredSessions: () => ({ starred: [], loading: false, error: null }),
  useTimeline: () => ({ timeline: [], loading: false, error: null }),
  useOverviewCapabilities: () => ({ capabilities: null, loading: false }),
  useToolAgents: () => ({ agents: [], loading: false, error: null }),
  useOverviewAutomations: () => ({ automations: [], loading: false, error: null }),
}))

describe('OverviewPage', () => {
  it('constrains the page body so the overview scrolls inside the shell viewport', () => {
    const { container } = render(<OverviewPage />)

    const root = container.firstElementChild

    expect(root).not.toBeNull()
    expect(root?.classList.contains('h-full')).toBe(true)
    expect(root?.classList.contains('min-h-0')).toBe(true)
    expect(root?.classList.contains('overflow-y-auto')).toBe(true)
  })
})
