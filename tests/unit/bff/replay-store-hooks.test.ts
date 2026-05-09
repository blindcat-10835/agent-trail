/**
 * Tests for useReplayStore and useSessionTurns (Phase 05-01, Task 2).
 *
 * RED phase: These tests MUST fail because:
 * - stores/replay-store.ts does not exist yet
 * - useSessionTurns is not exported from client-hooks.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ============================================================================
// Zustand Store Tests
// ============================================================================

describe('useReplayStore', () => {
  beforeEach(async () => {
    // Reset store state before each test
    const { useReplayStore } = await import('@/stores/replay-store')
    useReplayStore.setState({
      scrollPositions: {},
      expandedTurns: new Set<string>(),
searchQuery: '',
      searchMatches: [],
      currentMatchIndex: 0,
    })
  })

  afterEach(() => {
    vi.resetModules()
  })

  // Test 5: toggleTurn
  it('toggleTurn adds and removes turnId from expandedTurns', async () => {
    const { useReplayStore } = await import('@/stores/replay-store')

    act(() => {
      useReplayStore.getState().toggleTurn('turn-a')
    })
    expect(useReplayStore.getState().expandedTurns.has('turn-a')).toBe(true)

    act(() => {
      useReplayStore.getState().toggleTurn('turn-a')
    })
    expect(useReplayStore.getState().expandedTurns.has('turn-a')).toBe(false)
  })

  // Test 6: expandAll / collapseAll
  it('expandAll adds all turnIds, collapseAll clears the Set', async () => {
    const { useReplayStore } = await import('@/stores/replay-store')

    act(() => {
      useReplayStore.getState().expandAll(['turn-1', 'turn-2', 'turn-3'])
    })
    const expandedAfter = useReplayStore.getState().expandedTurns
    expect(expandedAfter.has('turn-1')).toBe(true)
    expect(expandedAfter.has('turn-2')).toBe(true)
    expect(expandedAfter.has('turn-3')).toBe(true)
    expect(expandedAfter.size).toBe(3)

    act(() => {
      useReplayStore.getState().collapseAll()
    })
    expect(useReplayStore.getState().expandedTurns.size).toBe(0)
  })

  // Test 8: scrollPosition
  it('scrollPosition defaults to 0, setScrollPosition updates per sessionId', async () => {
    const { useReplayStore } = await import('@/stores/replay-store')

    // Default is empty object
    expect(useReplayStore.getState().scrollPositions).toEqual({})

    act(() => {
      useReplayStore.getState().setScrollPosition('session-a', 500)
    })
    expect(useReplayStore.getState().scrollPositions['session-a']).toBe(500)

    // Different session has independent scroll
    act(() => {
      useReplayStore.getState().setScrollPosition('session-b', 1200)
    })
    expect(useReplayStore.getState().scrollPositions['session-a']).toBe(500)
    expect(useReplayStore.getState().scrollPositions['session-b']).toBe(1200)
  })

  // Search state
  it('searchQuery and searchMatches work correctly', async () => {
    const { useReplayStore } = await import('@/stores/replay-store')

    act(() => {
      useReplayStore.getState().setSearchQuery('hello')
    })
    expect(useReplayStore.getState().searchQuery).toBe('hello')

    act(() => {
      useReplayStore.getState().setSearchMatches([
        { turnId: 'turn-1', matchCount: 3 },
        { turnId: 'turn-2', matchCount: 1 },
      ])
    })
    expect(useReplayStore.getState().searchMatches).toHaveLength(2)

    act(() => {
      useReplayStore.getState().setCurrentMatchIndex(1)
    })
    expect(useReplayStore.getState().currentMatchIndex).toBe(1)
  })
})

// ============================================================================
// useSessionTurns Hook Tests
// ============================================================================

const mockTurnsResponse = {
  sessionId: 'test-session',
  turns: [
    { id: 'turn-1', sessionId: 'test-session', index: 0 },
    { id: 'turn-2', sessionId: 'test-session', index: 1 },
  ],
  pagination: { total: 5, limit: 10, offset: 0, hasMore: true },
}

describe('useSessionTurns', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  // Test 1: initial loading state
  it('returns { turns, pagination, loading, error, refetch } with initial loading=true', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify(mockTurnsResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const { useSessionTurns } = await import('@/lib/agent-tools/client-hooks')

    const { result } = renderHook(() =>
      useSessionTurns('openclaw', 'test-session'),
    )

    // Initial state should have loading=true
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBe(null)
    expect(Array.isArray(result.current.turns)).toBe(true)
    expect(typeof result.current.refetch).toBe('function')
  })

  // Test 2: after fetch resolves
  it('populates turns and pagination after fetch resolves', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify(mockTurnsResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const { useSessionTurns } = await import('@/lib/agent-tools/client-hooks')

    const { result } = renderHook(() =>
      useSessionTurns('openclaw', 'test-session'),
    )

    // Wait for the fetch to resolve
    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.turns).toHaveLength(2)
    expect(result.current.pagination?.hasMore).toBe(true)
    expect(result.current.pagination?.total).toBe(5)
    expect(result.current.error).toBe(null)
  })

  // Test 3: query params passed through fetchToolApi
  it('passes offset and limit params through to the BFF endpoint', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      // Verify the URL contains offset=20&limit=10
      expect(url).toContain('offset=20')
      expect(url).toContain('limit=10')
      return new Response(JSON.stringify(mockTurnsResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const { useSessionTurns } = await import('@/lib/agent-tools/client-hooks')

    renderHook(() =>
      useSessionTurns('openclaw', 'test-session', {
        offset: 20,
        limit: 10,
      }),
    )

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })
  })

  // Test 4: null sessionId no-ops
  it('returns empty state when sessionId is null (no fetch)', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify(mockTurnsResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const { useSessionTurns } = await import('@/lib/agent-tools/client-hooks')

    const { result } = renderHook(() => useSessionTurns('openclaw', null))

    // Should immediately be in "not loading" state
    expect(result.current.loading).toBe(false)
    expect(result.current.turns).toHaveLength(0)
    expect(result.current.pagination).toBe(null)
  })
})
