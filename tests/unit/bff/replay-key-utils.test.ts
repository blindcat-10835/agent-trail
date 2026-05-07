import { describe, expect, it } from 'vitest'
import { getActivityKey, getMessageKey, getTurnKey } from '@/components/replay/key-utils'
import type { TraceMessage, TraceToolCall, TraceTurn } from '@/types/trace'

describe('replay key utils', () => {
  it('falls back when a turn id is nullish', () => {
    const turn = {
      id: null,
      sessionId: 's1',
      index: 3,
    } as unknown as TraceTurn

    expect(getTurnKey(turn)).toBe('s1-turn-3')
  })

  it('uses ordinal and index when a message id is nullish', () => {
    const message = {
      id: null,
      role: 'assistant',
      ordinal: null,
    } as unknown as TraceMessage

    expect(getMessageKey(message, 2)).toBe('assistant-2-2')
  })

  it('uses activity type details plus turn/index when an activity id is nullish', () => {
    const activity = {
      type: 'tool_call',
      id: null,
      name: 'Read',
    } as unknown as TraceToolCall

    expect(getActivityKey(activity, 4, 8)).toBe('tool-Read-8-4')
  })
})
