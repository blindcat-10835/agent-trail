// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OverviewPage } from '@/components/overview/overview-page'

const hookMocks = vi.hoisted(() => ({
  useAgentTool: vi.fn(() => ({ toolId: 'all' })),
  useOverviewAggregates: vi.fn(() => ({ aggregates: null, loading: false, error: null })),
  useDailyTokens: vi.fn(() => ({ dailyTokens: [], loading: false, error: null })),
  useTopModels: vi.fn(() => ({ models: [], loading: false, error: null })),
  useTopProjects: vi.fn(() => ({ projects: [], loading: false, error: null })),
  useStarredSessions: vi.fn(() => ({ starred: [], loading: false, error: null })),
  useTimeline: vi.fn(() => ({ timeline: [], loading: false, error: null })),
  useOverviewCapabilities: vi.fn(() => ({ capabilities: null, loading: false })),
  useToolAgents: vi.fn(() => ({ agents: [], loading: false, error: null })),
  useOverviewAutomations: vi.fn(() => ({ automations: [], loading: false, error: null })),
}))

vi.mock('@/lib/agent-tools/client-hooks', () => ({
  ...hookMocks,
}))

describe('OverviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('constrains the page body so the overview scrolls inside the shell viewport', () => {
    const { container } = render(<OverviewPage />)

    const root = container.firstElementChild

    expect(root).not.toBeNull()
    expect(root?.classList.contains('h-full')).toBe(true)
    expect(root?.classList.contains('min-h-0')).toBe(true)
    expect(root?.classList.contains('overflow-y-auto')).toBe(true)
  })

  it('requests all-time daily tokens when the ALL window is selected', () => {
    render(<OverviewPage />)

    expect(hookMocks.useDailyTokens).toHaveBeenLastCalledWith('all', '30d')

    fireEvent.click(screen.getByRole('button', { name: 'ALL' }))

    expect(hookMocks.useDailyTokens).toHaveBeenLastCalledWith('all', 'all')
  })
})
